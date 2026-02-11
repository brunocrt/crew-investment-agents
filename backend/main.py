"""
FastAPI application for investment recommendation system
------------------------------------------------------

This module exposes a REST API and WebSocket endpoints to interact with the
investment recommendation crew.  Clients can create new analyses, query
existing ones, retrieve logs, and receive live updates of agent actions.

The application uses SQLAlchemy for persistence and runs the CrewAI
workflow in a background task to avoid blocking the event loop.  Logs
produced during execution are captured and persisted so that the
frontend can display a real‑time activity console.
"""

from __future__ import annotations

import asyncio
import io
import json
import logging
import sys
from typing import Dict, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .models.analysis import Analysis, LogEntry, AnalysisStatus
from .models.base import Base, engine, get_session
from .agents.crew import InvestmentRecommendationCrew
from fastapi.staticfiles import StaticFiles
import os


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Crew Investment Recommendation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create DB tables at startup
Base.metadata.create_all(bind=engine)

# We'll mount the frontend static files after declaring API routes to ensure
# that API endpoints like `/analyses` take precedence.  If we mount the
# static files at the root before defining routes, requests to paths such
# as `/analyses` would be handled by the static file server and return 404.
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))

# In‑memory registry of active WebSocket connections per analysis id
class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, analysis_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.setdefault(analysis_id, []).append(websocket)

    def disconnect(self, analysis_id: str, websocket: WebSocket) -> None:
        if analysis_id in self.active_connections:
            self.active_connections[analysis_id].remove(websocket)
            if not self.active_connections[analysis_id]:
                del self.active_connections[analysis_id]

    async def broadcast(self, analysis_id: str, message: str) -> None:
        for websocket in self.active_connections.get(analysis_id, []):
            try:
                await websocket.send_text(message)
            except Exception:
                # If sending fails, close the socket
                await websocket.close()

manager = ConnectionManager()


class AnalysisCreateRequest(BaseModel):
    """Request body for creating a new analysis.

    The `tickers` field is optional.  If omitted or an empty list is
    provided, the system will fall back to a default set of candidate
    tickers defined in `services.candidates.get_default_candidate_tickers`.
    """
    tickers: List[str] | None = None


@app.post("/analyses", status_code=201)
async def create_analysis(request: AnalysisCreateRequest, background_tasks: BackgroundTasks):
    """Kick off a new analysis for the supplied tickers."""
    # Determine which tickers to use.  If the request body omits them or
    # provides an empty list, fall back to default candidates for
    # monitoring mode.
    from .services.candidates import get_default_candidate_tickers

    tickers_list: List[str]
    if not request.tickers:
        tickers_list = get_default_candidate_tickers()
    else:
        tickers_list = request.tickers
    tickers_str = ",".join(tickers_list)
    # Create analysis record
    with get_session() as db:
        analysis = Analysis(ticker=tickers_str, status=AnalysisStatus.RUNNING)
        db.add(analysis)
        db.flush()  # assign id
        analysis_id = analysis.id
    # Run the crew in the background
    background_tasks.add_task(run_analysis, analysis_id, tickers_str)
    return {"analysis_id": analysis_id}


@app.get("/analyses")
async def list_analyses():
    """Return a list of all analyses with basic metadata."""
    with get_session() as db:
        analyses = db.query(Analysis).all()
        return [
            {
                "id": a.id,
                "tickers": a.ticker,
                "created_at": a.created_at.isoformat(),
                "status": a.status,
                "recommendation": a.recommendation,
            }
            for a in analyses
        ]


@app.get("/analyses/{analysis_id}")
async def get_analysis(analysis_id: str):
    """Fetch details of a specific analysis."""
    with get_session() as db:
        analysis = db.query(Analysis).filter_by(id=analysis_id).first()
        if not analysis:
            return {"error": "Analysis not found"}
        return {
            "id": analysis.id,
            "tickers": analysis.ticker,
            "created_at": analysis.created_at.isoformat(),
            "updated_at": analysis.updated_at.isoformat(),
            "status": analysis.status,
            "recommendation": analysis.recommendation,
            "summary": analysis.summary,
        }


@app.get("/analyses/{analysis_id}/logs")
async def get_logs(analysis_id: str):
    """Retrieve persisted logs for an analysis."""
    with get_session() as db:
        entries = (
            db.query(LogEntry)
            .filter_by(analysis_id=analysis_id)
            .order_by(LogEntry.id)
            .all()
        )
        return [
            {
                "timestamp": entry.timestamp.isoformat(),
                "message": entry.message,
            }
            for entry in entries
        ]


@app.websocket("/ws/{analysis_id}")
async def websocket_endpoint(websocket: WebSocket, analysis_id: str):
    """WebSocket endpoint for streaming live logs to the client."""
    await manager.connect(analysis_id, websocket)
    try:
        while True:
            # Keep connection alive; we don't expect client messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(analysis_id, websocket)


async def run_analysis(analysis_id: str, tickers_str: str) -> None:
    """
    Execute the crew workflow and persist results and logs.

    This function runs in a background task.  It captures all stdout output
    generated during the crew execution and writes each line both to the
    database and to any connected WebSocket clients.
    """
    # Prepare crew and inputs
    crew = InvestmentRecommendationCrew().crew()
    # Capture stdout
    original_stdout = sys.stdout
    log_buffer = io.StringIO()
    sys.stdout = log_buffer
    try:
        result = crew.kickoff(inputs={"tickers": tickers_str})
        # The result returned by CrewAI may be a raw string or a CrewOutput
        # object with a ``raw`` attribute.  Convert it to a string so it
        # can be persisted in the database and parsed as JSON.  If it's
        # already a plain string, use it directly.
        if hasattr(result, "raw"):
            result_str = result.raw
        else:
            # For non‑string types, fall back to the string representation
            result_str = result if isinstance(result, str) else str(result)
        # After execution, update analysis with summary and recommendation
        with get_session() as db:
            analysis = db.query(Analysis).filter_by(id=analysis_id).first()
            if analysis:
                analysis.status = AnalysisStatus.COMPLETED
                # Attempt to parse JSON output.  If parsing fails, store
                # the raw string as the summary.
                try:
                    parsed = json.loads(result_str)
                    # Before saving, enrich each recommendation with price
                    # information (current price and percent change) and a
                    # timestamp.  This provides additional context in the
                    # report for investors.  Use a helper from
                    # services.price_info.  Wrap in a try/except to avoid
                    # blocking if the price lookup fails.
                    from .services.price_info import get_stock_price_info
                    from datetime import datetime
                    recs = parsed.get('recommendations', [])
                    # Build a set of tickers we've already got recommendations for
                    existing_rec_tickers = set()
                    for rec in recs:
                        ticker = rec.get('ticker')
                        if ticker:
                            existing_rec_tickers.add(ticker.upper())
                            info = get_stock_price_info(ticker)
                            if info:
                                rec['current_price'] = info.get('current_price')
                                rec['percent_change'] = info.get('percent_change')
                            # attach a report timestamp in ISO format
                            rec['report_time'] = datetime.utcnow().isoformat()
                    # Ensure every requested ticker is represented.  Split the
                    # tickers_str by commas, normalise to uppercase and add
                    # neutral entries for any ticker that was not mentioned in
                    # the LLM's recommendations list.  This guarantees the
                    # frontend and users see explicit feedback even when no
                    # strong signals are present.
                    requested_tickers = [t.strip().upper() for t in tickers_str.split(',') if t.strip()]
                    for req in requested_tickers:
                        if req and req not in existing_rec_tickers:
                            # Look up price info
                            info = get_stock_price_info(req)
                            neutral_entry = {
                                'ticker': req,
                                'rating': 'neutral',
                                'reason': 'No strong capex growth, price spike or sector rotation signals were observed for this stock.',
                            }
                            if info:
                                neutral_entry['current_price'] = info.get('current_price')
                                neutral_entry['percent_change'] = info.get('percent_change')
                            # attach a report timestamp
                            from datetime import datetime as _datetime
                            neutral_entry['report_time'] = _datetime.utcnow().isoformat()
                            recs.append(neutral_entry)
                    # Persist the updated JSON object as a string so the
                    # frontend can access summary, reasons and price info.
                    updated_result_str = json.dumps(parsed)
                    analysis.summary = updated_result_str
                    # Create a simple aggregated recommendation string for
                    # quick display in the analyses list.  Include the
                    # rating only; the detailed reasons will be parsed
                    # client‑side from the summary.
                    if recs:
                        analysis.recommendation = ", ".join(
                            f"{r.get('ticker')}: {r.get('rating')}" for r in recs
                        )
                    else:
                        analysis.recommendation = None
                except Exception:
                    analysis.summary = result_str
                    analysis.recommendation = None
            db.flush()
    except Exception as exc:
        logger.exception("Analysis %s failed: %s", analysis_id, exc)
        with get_session() as db:
            analysis = db.query(Analysis).filter_by(id=analysis_id).first()
            if analysis:
                analysis.status = AnalysisStatus.FAILED
                analysis.summary = str(exc)
    finally:
        # Restore stdout
        sys.stdout = original_stdout
        # Retrieve logs from buffer
        log_buffer.seek(0)
        lines = log_buffer.readlines()
        with get_session() as db:
            for line in lines:
                msg = line.rstrip('\n')
                if not msg:
                    continue
                log_entry = LogEntry(analysis_id=analysis_id, message=msg)
                db.add(log_entry)
                # Broadcast to WebSocket subscribers
                asyncio.create_task(manager.broadcast(analysis_id, msg))
        log_buffer.close()

# Delete an analysis and its logs
@app.delete("/analyses/{analysis_id}")
async def delete_analysis_endpoint(analysis_id: str):
    """Remove an analysis record and all associated logs."""
    with get_session() as db:
        # Delete logs first to maintain referential integrity
        db.query(LogEntry).filter_by(analysis_id=analysis_id).delete()
        # Delete the analysis record
        deleted = db.query(Analysis).filter_by(id=analysis_id).delete()
        db.flush()
    return {"deleted": bool(deleted)}

# After defining all API routes, mount the frontend static files.  This
# placement ensures that API endpoints are matched first.  Any request
# that doesn't match an API route will be served from the frontend
# directory, with `index.html` acting as a fallback for SPA routing.
if os.path.isdir(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
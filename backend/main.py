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
    tickers: List[str]


@app.post("/analyses", status_code=201)
async def create_analysis(request: AnalysisCreateRequest, background_tasks: BackgroundTasks):
    """Kick off a new analysis for the supplied tickers."""
    tickers = request.tickers
    tickers_str = ",".join(tickers)
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
        output_summary = result
        # After execution, update analysis with summary and recommendation
        with get_session() as db:
            analysis = db.query(Analysis).filter_by(id=analysis_id).first()
            if analysis:
                analysis.status = AnalysisStatus.COMPLETED
                # result is typically a string produced by the last task's output
                # We'll attempt to parse JSON if available
                try:
                    parsed = json.loads(result)
                    analysis.summary = parsed.get('summary', result)
                    # Create a simple recommendation string
                    recs = parsed.get('recommendations', [])
                    if recs:
                        analysis.recommendation = ", ".join(
                            f"{r['ticker']}: {r['rating']}" for r in recs
                        )
                except Exception:
                    analysis.summary = result
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
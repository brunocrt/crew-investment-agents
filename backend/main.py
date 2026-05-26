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
import hashlib
import hmac
import io
import json
import logging
import secrets
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks, Depends, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import inspect, text
import yaml

from .models.analysis import Analysis, LogEntry, AnalysisStatus
from .models.candidate import Candidate
from .models.recommendation_history import RecommendationHistory
from .models.user import User
from .models.base import Base, engine, get_session
from .agents.crew import InvestmentRecommendationCrew
from fastapi.staticfiles import StaticFiles
import os


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEFAULT_USERNAME = os.getenv("APP_USERNAME", "admin")
DEFAULT_PASSWORD = os.getenv("APP_PASSWORD", "investment123")
ACTIVE_TOKENS: Dict[str, Dict[str, str]] = {}

app = FastAPI(title="Crew Investment Recommendation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000)
    return f"{salt}${digest.hex()}"


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        salt, expected = password_hash.split("$", 1)
    except ValueError:
        return False
    candidate = _hash_password(password, salt).split("$", 1)[1]
    return hmac.compare_digest(candidate, expected)


def _ensure_schema() -> None:
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    analysis_columns = {column["name"] for column in inspector.get_columns("analyses")}
    if "user_id" not in analysis_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE analyses ADD COLUMN user_id INTEGER"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_analyses_user_id ON analyses (user_id)"))
    user_columns = {column["name"] for column in inspector.get_columns("users")} if "users" in inspector.get_table_names() else set()
    if user_columns and "preferences" not in user_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN preferences TEXT"))


def _seed_default_admin() -> None:
    with get_session() as db:
        user = db.query(User).filter_by(username=DEFAULT_USERNAME).first()
        if user:
            return
        db.add(
            User(
                username=DEFAULT_USERNAME,
                display_name="Investment Admin",
                password_hash=_hash_password(DEFAULT_PASSWORD),
                role="admin",
                is_active=True,
            )
        )


# Create DB tables and seed the default admin user at startup.
_ensure_schema()
_seed_default_admin()

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


async def persist_and_broadcast_log(analysis_id: str, message: str) -> None:
    """Persist one log line and send it to connected WebSocket clients."""
    if not message:
        return
    with get_session() as db:
        db.add(LogEntry(analysis_id=analysis_id, message=message))
    await manager.broadcast(analysis_id, message)


class LiveLogStream(io.StringIO):
    """Line-buffered stdout replacement for real-time analysis logs."""

    def __init__(
        self,
        analysis_id: str,
        emit: Callable[[str, str], Awaitable[None]],
        loop: asyncio.AbstractEventLoop,
    ) -> None:
        super().__init__()
        self.analysis_id = analysis_id
        self.emit = emit
        self.loop = loop
        self._line_buffer = ""
        self.pending_tasks: List[asyncio.Future] = []

    def write(self, value: str) -> int:
        super().write(value)
        self._line_buffer += value
        while "\n" in self._line_buffer:
            line, self._line_buffer = self._line_buffer.split("\n", 1)
            self._schedule(line.rstrip("\r"))
        return len(value)

    def flush_remaining(self) -> None:
        if self._line_buffer.strip():
            self._schedule(self._line_buffer.strip())
        self._line_buffer = ""

    def _schedule(self, message: str) -> None:
        if not message:
            return
        try:
            task = self.loop.create_task(self.emit(self.analysis_id, message))
        except RuntimeError:
            return
        self.pending_tasks.append(task)


class AnalysisCreateRequest(BaseModel):
    """Request body for creating a new analysis.

    The `tickers` field is optional.  If omitted or an empty list is
    provided, the system will fall back to a default set of candidate
    tickers defined in `services.candidates.get_default_candidate_tickers`.
    """
    tickers: List[str] | None = None
    analysis_settings: Dict[str, Any] | None = None


class AgentConfigUpdateRequest(BaseModel):
    agents: Dict[str, Dict[str, Any]]
    tasks: Dict[str, Dict[str, Any]]
    llm: Dict[str, Any]


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreateRequest(BaseModel):
    username: str
    password: str
    display_name: str | None = None
    role: str = "user"


class UserProfileUpdateRequest(BaseModel):
    display_name: str | None = None
    current_password: str | None = None
    new_password: str | None = None
    preferences: Dict[str, Any] | None = None


def _parse_crew_json(result_str: str) -> dict:
    """Parse CrewAI JSON output, including JSON wrapped in Markdown fences."""
    text = result_str.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].strip().startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    for block in _extract_fenced_json_blocks(text):
        try:
            return json.loads(block)
        except json.JSONDecodeError:
            continue
    candidate = _extract_first_json_object(text)
    if candidate:
        return json.loads(candidate)
    return json.loads(text)


def _extract_fenced_json_blocks(text: str) -> List[str]:
    blocks: List[str] = []
    parts = text.split("```")
    for index in range(1, len(parts), 2):
        block = parts[index].strip()
        if block.lower().startswith("json"):
            block = block[4:].strip()
        blocks.append(block)
    return blocks


def _extract_first_json_object(text: str) -> str | None:
    start = text.find("{")
    if start < 0:
        return None
    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start:index + 1]
    return None


def _fallback_analysis_payload(result_str: str, tickers_str: str, analysis_settings: Dict[str, Any] | None = None) -> dict:
    requested_tickers = [ticker.strip().upper() for ticker in tickers_str.split(",") if ticker.strip()]
    summary = result_str.strip() or "The analysis completed, but the agents did not return a structured report."
    return {
        "summary": summary,
        "analysis_settings": _normalize_analysis_settings(analysis_settings),
        "recommendations": [
            {
                "ticker": ticker,
                "rating": "neutral",
                "reason": (
                    "This ticker was included in the analysis request, but the agents did not return "
                    "a structured recommendation for it. Treat it as a monitored holding until a fresh "
                    "analysis provides a stronger signal."
                ),
                "report_time": datetime.utcnow().isoformat(),
                "evidence": [],
                "risks": [{"signal": "missing_model_card", "detail": "No structured recommendation was returned."}],
            }
            for ticker in requested_tickers
        ],
    }


def _normalize_analysis_settings(settings: Dict[str, Any] | None) -> Dict[str, Any]:
    settings = settings or {}
    risk_tolerance = str(settings.get("riskTolerance") or settings.get("risk_tolerance") or "balanced").lower()
    if risk_tolerance not in {"conservative", "balanced", "aggressive"}:
        risk_tolerance = "balanced"

    def number(name: str, fallback: float) -> float:
        try:
            return float(settings.get(name, fallback))
        except (TypeError, ValueError):
            return fallback

    return {
        "riskTolerance": risk_tolerance,
        "riskToleranceDial": number("riskToleranceDial", 50),
        "minOpportunityScore": number("minOpportunityScore", 70),
        "minValuationScore": number("minValuationScore", 35),
        "positionSizePct": number("positionSizePct", 5),
        "stopLossPct": number("stopLossPct", 10),
        "targetGainPct": number("targetGainPct", 20),
    }


def _analysis_settings_from_summary(summary: str | None) -> Dict[str, Any]:
    if not summary:
        return {}
    try:
        parsed = _parse_crew_json(summary)
    except Exception:
        return {}
    settings = parsed.get("analysis_settings") or parsed.get("analysisSettings")
    return settings if isinstance(settings, dict) else {}


CONFIG_DIR = Path(__file__).resolve().parent / "config"
AGENTS_CONFIG_PATH = CONFIG_DIR / "agents.yaml"
TASKS_CONFIG_PATH = CONFIG_DIR / "tasks.yaml"
LLM_CONFIG_PATH = CONFIG_DIR / "llm.yaml"
LLM_LOCAL_CONFIG_PATH = CONFIG_DIR / "llm.local.yaml"


def _read_yaml(path: Path, default: Any) -> Any:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return yaml.safe_load(handle) or default
    except FileNotFoundError:
        return default


def _write_yaml(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        yaml.safe_dump(payload, handle, sort_keys=False, allow_unicode=True)


def _user_payload(user: User) -> Dict[str, str]:
    return {
        "id": str(user.id),
        "username": user.username,
        "display_name": user.display_name or user.username,
        "role": user.role,
        "preferences": json.loads(user.preferences or "{}"),
    }


def _user_from_token(token: str | None) -> Dict[str, str]:
    if not token or token not in ACTIVE_TOKENS:
        raise HTTPException(status_code=401, detail="Authentication required")
    return ACTIVE_TOKENS[token]


def require_user(authorization: str | None = Header(default=None)) -> Dict[str, str]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = authorization.split(" ", 1)[1].strip()
    return _user_from_token(token)


def require_admin(user: Dict[str, str] = Depends(require_user)) -> Dict[str, str]:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def _analysis_query_for_user(db, user: Dict[str, str]):
    query = db.query(Analysis)
    if user.get("role") != "admin":
        query = query.filter(Analysis.user_id == int(user["id"]))
    return query


def _can_access_analysis(analysis: Analysis | None, user: Dict[str, str]) -> bool:
    if not analysis:
        return False
    return user.get("role") == "admin" or analysis.user_id == int(user["id"])


@app.post("/auth/login")
async def login(request: LoginRequest):
    """Authenticate a user and return a bearer token for API calls."""
    with get_session() as db:
        user = db.query(User).filter_by(username=request.username).first()
        if not user or not user.is_active or not _verify_password(request.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid username or password")
        user_payload = _user_payload(user)
    token = secrets.token_urlsafe(32)
    ACTIVE_TOKENS[token] = user_payload
    return {"token": token, "user": user_payload}


@app.get("/auth/me")
async def auth_me(user: Dict[str, str] = Depends(require_user)):
    """Return the authenticated user profile."""
    return {"user": user}


@app.patch("/auth/me")
async def update_profile(request: UserProfileUpdateRequest, user: Dict[str, str] = Depends(require_user)):
    """Update the authenticated user's profile, password and preferences."""
    with get_session() as db:
        row = db.query(User).filter_by(id=int(user["id"])).first()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        if request.display_name is not None:
            row.display_name = request.display_name.strip() or row.username
        if request.new_password:
            if len(request.new_password) < 6:
                raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
            if not request.current_password or not _verify_password(request.current_password, row.password_hash):
                raise HTTPException(status_code=400, detail="Current password is incorrect")
            row.password_hash = _hash_password(request.new_password)
        if request.preferences is not None:
            row.preferences = json.dumps(request.preferences)
        db.flush()
        payload = _user_payload(row)
        for token, token_user in list(ACTIVE_TOKENS.items()):
            if token_user.get("id") == payload["id"]:
                ACTIVE_TOKENS[token] = payload
        return {"user": payload}


@app.get("/users")
async def list_users(user: Dict[str, str] = Depends(require_admin)):
    """Return all local users. Admin only."""
    with get_session() as db:
        users = db.query(User).order_by(User.role, User.username).all()
        return [
            {
                "id": row.id,
                "username": row.username,
                "display_name": row.display_name or row.username,
                "role": row.role,
                "is_active": row.is_active,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in users
        ]


@app.post("/users", status_code=201)
async def create_user(request: UserCreateRequest, user: Dict[str, str] = Depends(require_admin)):
    """Create a local user. Admin only."""
    username = request.username.strip()
    if not username or len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Username and password of at least 6 characters are required")
    role = request.role if request.role in {"admin", "user"} else "user"
    with get_session() as db:
        existing = db.query(User).filter_by(username=username).first()
        if existing:
            raise HTTPException(status_code=409, detail="Username already exists")
        row = User(
            username=username,
            display_name=(request.display_name or username).strip(),
            password_hash=_hash_password(request.password),
            role=role,
            is_active=True,
        )
        db.add(row)
        db.flush()
        return {
            "id": row.id,
            "username": row.username,
            "display_name": row.display_name or row.username,
            "role": row.role,
            "is_active": row.is_active,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }


@app.delete("/users/{user_id}")
async def delete_user(user_id: int, user: Dict[str, str] = Depends(require_admin)):
    """Delete a local user that does not own analyses. Admin only."""
    if user_id == int(user["id"]):
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    with get_session() as db:
        owned_count = db.query(Analysis).filter(Analysis.user_id == user_id).count()
        if owned_count:
            raise HTTPException(status_code=400, detail="User owns analyses and cannot be deleted")
        deleted = db.query(User).filter(User.id == user_id).delete()
        db.flush()
        return {"deleted": bool(deleted)}


def _llm_response_config() -> Dict[str, Any]:
    llm = {
        **_read_yaml(LLM_CONFIG_PATH, {"model": "gpt-4o", "temperature": 0.3}),
        **_read_yaml(LLM_LOCAL_CONFIG_PATH, {}),
    }
    has_override_key = bool(_read_yaml(LLM_LOCAL_CONFIG_PATH, {}).get("api_key"))
    has_env_key = bool(os.getenv("OPENAI_API_KEY"))
    return {
        "model": llm.get("model") or os.getenv("OPENAI_MODEL", os.getenv("OPENAI_MODEL_NAME", "gpt-4o")),
        "temperature": float(llm.get("temperature", os.getenv("OPENAI_TEMPERATURE", 0.3))),
        "api_key_configured": has_override_key or has_env_key,
        "api_key_source": "settings" if has_override_key else ("env" if has_env_key else "missing"),
    }


@app.post("/analyses", status_code=201)
async def create_analysis(request: AnalysisCreateRequest, background_tasks: BackgroundTasks, user: Dict[str, str] = Depends(require_user)):
    """Kick off a new analysis for the supplied tickers."""
    # Determine which tickers to use.  If the request body omits them or
    # provides an empty list, fall back to default candidates for
    # monitoring mode.
    from .services.candidates import select_monitor_tickers

    tickers_list: List[str]
    if not request.tickers:
        with get_session() as db:
            tickers_list = select_monitor_tickers(db)
    else:
        tickers_list = [ticker.strip().upper() for ticker in request.tickers if ticker.strip()]
        if not tickers_list:
            with get_session() as db:
                tickers_list = select_monitor_tickers(db)
    tickers_str = ",".join(tickers_list)
    analysis_settings = _normalize_analysis_settings(request.analysis_settings)
    # Create analysis record
    with get_session() as db:
        analysis = Analysis(ticker=tickers_str, user_id=int(user["id"]), status=AnalysisStatus.RUNNING)
        db.add(analysis)
        db.flush()  # assign id
        analysis_id = analysis.id
    # Run the crew in the background
    background_tasks.add_task(run_analysis, analysis_id, tickers_str, analysis_settings)
    return {"analysis_id": analysis_id}


@app.get("/analyses")
async def list_analyses(user: Dict[str, str] = Depends(require_user)):
    """Return a list of all analyses with basic metadata."""
    with get_session() as db:
        analyses = _analysis_query_for_user(db, user).all()
        payload = []
        for a in analyses:
            settings = _analysis_settings_from_summary(a.summary)
            payload.append({
                "id": a.id,
                "user_id": a.user_id,
                "tickers": a.ticker,
                "created_at": a.created_at.isoformat(),
                "updated_at": a.updated_at.isoformat(),
                "status": a.status,
                "recommendation": a.recommendation,
                "analysis_settings": settings,
                "risk_tolerance": settings.get("riskTolerance") or settings.get("risk_tolerance"),
                "risk_tolerance_dial": settings.get("riskToleranceDial"),
            })
        return payload


@app.get("/candidates")
async def get_candidates(discover: bool = False, user: Dict[str, str] = Depends(require_user)):
    """Return the current candidate universe used by monitor mode."""
    from .services.candidates import discover_dynamic_candidates, list_candidates

    with get_session() as db:
        if discover:
            discover_dynamic_candidates(db)
            db.flush()
        candidates = list_candidates(db)
        return [
            {
                "ticker": candidate.ticker,
                "source": candidate.source,
                "status": candidate.status,
                "theme": candidate.theme,
                "sector": candidate.sector,
                "reason": candidate.reason,
                "discovery_score": candidate.discovery_score,
                "liquidity_ok": candidate.liquidity_ok,
                "last_discovered_at": candidate.last_discovered_at.isoformat() if candidate.last_discovered_at else None,
            }
            for candidate in candidates
        ]


@app.get("/agent-config")
async def get_agent_config(user: Dict[str, str] = Depends(require_admin)):
    """Return editable agent, task and LLM configuration."""
    return {
        "agents": _read_yaml(AGENTS_CONFIG_PATH, {}),
        "tasks": _read_yaml(TASKS_CONFIG_PATH, {}),
        "llm": _llm_response_config(),
    }


@app.put("/agent-config")
async def update_agent_config(request: AgentConfigUpdateRequest, user: Dict[str, str] = Depends(require_admin)):
    """Persist agent, task and LLM configuration for future analysis runs."""
    existing_llm = _read_yaml(LLM_LOCAL_CONFIG_PATH, {})
    llm = {
        "model": str(request.llm.get("model") or "gpt-4o").strip(),
        "temperature": float(request.llm.get("temperature", 0.3)),
    }
    api_key = str(request.llm.get("api_key") or "").strip()
    if api_key:
        llm["api_key"] = api_key
    elif existing_llm.get("api_key"):
        llm["api_key"] = existing_llm.get("api_key")
    if not llm["model"]:
        llm["model"] = "gpt-4o"
    llm["temperature"] = max(0.0, min(2.0, llm["temperature"]))
    _write_yaml(AGENTS_CONFIG_PATH, request.agents)
    _write_yaml(TASKS_CONFIG_PATH, request.tasks)
    _write_yaml(LLM_LOCAL_CONFIG_PATH, llm)
    return {"status": "saved", "llm": _llm_response_config()}


@app.get("/analyses/{analysis_id}")
async def get_analysis(analysis_id: str, user: Dict[str, str] = Depends(require_user)):
    """Fetch details of a specific analysis."""
    with get_session() as db:
        analysis = db.query(Analysis).filter_by(id=analysis_id).first()
        if not _can_access_analysis(analysis, user):
            return {"error": "Analysis not found"}
        settings = _analysis_settings_from_summary(analysis.summary)
        return {
            "id": analysis.id,
            "tickers": analysis.ticker,
            "created_at": analysis.created_at.isoformat(),
            "updated_at": analysis.updated_at.isoformat(),
            "status": analysis.status,
            "recommendation": analysis.recommendation,
            "summary": analysis.summary,
            "analysis_settings": settings,
            "risk_tolerance": settings.get("riskTolerance") or settings.get("risk_tolerance"),
            "risk_tolerance_dial": settings.get("riskToleranceDial"),
        }


@app.get("/analyses/{analysis_id}/logs")
async def get_logs(analysis_id: str, user: Dict[str, str] = Depends(require_user)):
    """Retrieve persisted logs for an analysis."""
    with get_session() as db:
        entries = (
            db.query(LogEntry)
            .join(Analysis, Analysis.id == LogEntry.analysis_id)
            .filter(LogEntry.analysis_id == analysis_id)
            .filter(True if user.get("role") == "admin" else Analysis.user_id == int(user["id"]))
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


@app.get("/history/{ticker}")
async def get_recommendation_history(ticker: str, user: Dict[str, str] = Depends(require_user)):
    """Return chronological recommendation history for a ticker."""
    normalized = ticker.strip().upper()
    with get_session() as db:
        query = (
            db.query(RecommendationHistory)
            .join(Analysis, Analysis.id == RecommendationHistory.analysis_id)
            .filter(RecommendationHistory.ticker == normalized)
        )
        if user.get("role") != "admin":
            query = query.filter(Analysis.user_id == int(user["id"]))
        entries = (
            query
            .order_by(RecommendationHistory.created_at.asc())
            .all()
        )
        return [
            {
                "analysis_id": entry.analysis_id,
                "ticker": entry.ticker,
                "rating": entry.rating,
                "current_price": entry.current_price,
                "percent_change": entry.percent_change,
                "report_time": entry.report_time.isoformat() if entry.report_time else None,
                "reason": entry.reason,
                "created_at": entry.created_at.isoformat(),
            }
            for entry in entries
        ]


@app.websocket("/ws/{analysis_id}")
async def websocket_endpoint(websocket: WebSocket, analysis_id: str, token: str | None = Query(default=None)):
    """WebSocket endpoint for streaming live logs to the client."""
    try:
        user = _user_from_token(token)
    except HTTPException:
        await websocket.close(code=1008)
        return
    with get_session() as db:
        analysis = db.query(Analysis).filter_by(id=analysis_id).first()
        if not _can_access_analysis(analysis, user):
            await websocket.close(code=1008)
            return
    await manager.connect(analysis_id, websocket)
    try:
        while True:
            # Keep connection alive; we don't expect client messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(analysis_id, websocket)


async def run_analysis(analysis_id: str, tickers_str: str, analysis_settings: Dict[str, Any] | None = None) -> None:
    """
    Execute the crew workflow and persist results and logs.

    This function runs in a background task.  It captures all stdout output
    generated during the crew execution and writes each line both to the
    database and to any connected WebSocket clients.
    """
    # Prepare crew and inputs
    crew = InvestmentRecommendationCrew().crew()
    analysis_settings = _normalize_analysis_settings(analysis_settings)
    # Capture and stream stdout line-by-line.
    original_stdout = sys.stdout
    loop = asyncio.get_running_loop()
    log_buffer = LiveLogStream(analysis_id, persist_and_broadcast_log, loop)
    sys.stdout = log_buffer
    try:
        result = await crew.kickoff_async(inputs={"tickers": tickers_str})
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
                analysis_user_id = analysis.user_id
                analysis.status = AnalysisStatus.COMPLETED
                # Attempt to parse JSON output.  If parsing fails, store
                # the raw string as the summary.
                try:
                    parsed = _parse_crew_json(result_str)
                    parsed['analysis_settings'] = analysis_settings
                    # Before saving, enrich each recommendation with price
                    # information (current price and percent change) and a
                    # timestamp.  This provides additional context in the
                    # report for investors.  Use a helper from
                    # services.price_info.  Wrap in a try/except to avoid
                    # blocking if the price lookup fails.
                    from .services.price_info import get_stock_price_info
                    from .services.scoring import calculate_signal_scores
                    recs = parsed.get('recommendations', [])
                    if not isinstance(recs, list):
                        recs = []
                        parsed['recommendations'] = recs
                    requested_tickers = [t.strip().upper() for t in tickers_str.split(',') if t.strip()]
                    signal_scores = calculate_signal_scores(requested_tickers, analysis_settings)
                    # Build a set of tickers we've already got recommendations for
                    existing_rec_tickers = set()
                    for rec in recs:
                        ticker = rec.get('ticker')
                        if ticker:
                            normalized_ticker = ticker.upper()
                            rec['ticker'] = normalized_ticker
                            existing_rec_tickers.add(normalized_ticker)
                            info = get_stock_price_info(normalized_ticker)
                            if info:
                                rec['current_price'] = info.get('current_price')
                                rec['past_price'] = info.get('past_price')
                                rec['percent_change'] = info.get('percent_change')
                                rec['price_change_start_date'] = info.get('price_change_start_date')
                                rec['price_change_end_date'] = info.get('price_change_end_date')
                                rec['price_change_window_days'] = info.get('price_change_window_days')
                            # attach a report timestamp in ISO format
                            rec['report_time'] = datetime.utcnow().isoformat()
                            score = signal_scores.get(normalized_ticker)
                            if score:
                                rec['score'] = score.get('final_score')
                                rec['confidence'] = score.get('confidence')
                                rec['score_breakdown'] = {
                                    'capex': score.get('capex_score'),
                                    'pricing': score.get('pricing_score'),
                                    'rotation': score.get('rotation_score'),
                                    'valuation': score.get('valuation_score'),
                                    'quality': score.get('quality_score'),
                                    'fundamental_risk': score.get('fundamental_risk_score'),
                                    'technical_risk': score.get('technical_risk_score'),
                                    'distribution_risk': score.get('distribution_risk_score'),
                                }
                                rec['valuation'] = score.get('valuation')
                                rec['evidence'] = score.get('evidence', [])
                                rec['risks'] = score.get('risks', [])
                                rec['model_rating'] = rec.get('rating')
                                rec['rating_thresholds'] = score.get('rating_thresholds')
                                if score.get('suggested_rating') == 'buy' and not rec.get('risks'):
                                    rec['rating'] = 'buy'
                                elif not rec.get('rating'):
                                    rec['rating'] = score.get('suggested_rating')
                    # Ensure every requested ticker is represented.  Split the
                    # tickers_str by commas, normalise to uppercase and add
                    # neutral entries for any ticker that was not mentioned in
                    # the LLM's recommendations list.  This guarantees the
                    # frontend and users see explicit feedback even when no
                    # strong signals are present.
                    for req in requested_tickers:
                        if req and req not in existing_rec_tickers:
                            # Look up price info
                            info = get_stock_price_info(req)
                            score = signal_scores.get(req, {})
                            neutral_entry = {
                                'ticker': req,
                                'rating': score.get('suggested_rating', 'neutral'),
                                'reason': 'No strong capex growth, price spike or sector rotation signals were observed for this stock.',
                            }
                            if info:
                                neutral_entry['current_price'] = info.get('current_price')
                                neutral_entry['past_price'] = info.get('past_price')
                                neutral_entry['percent_change'] = info.get('percent_change')
                                neutral_entry['price_change_start_date'] = info.get('price_change_start_date')
                                neutral_entry['price_change_end_date'] = info.get('price_change_end_date')
                                neutral_entry['price_change_window_days'] = info.get('price_change_window_days')
                            neutral_entry['report_time'] = datetime.utcnow().isoformat()
                            if score:
                                neutral_entry['score'] = score.get('final_score')
                                neutral_entry['confidence'] = score.get('confidence')
                                neutral_entry['score_breakdown'] = {
                                    'capex': score.get('capex_score'),
                                    'pricing': score.get('pricing_score'),
                                    'rotation': score.get('rotation_score'),
                                    'valuation': score.get('valuation_score'),
                                    'quality': score.get('quality_score'),
                                    'fundamental_risk': score.get('fundamental_risk_score'),
                                    'technical_risk': score.get('technical_risk_score'),
                                    'distribution_risk': score.get('distribution_risk_score'),
                                }
                                neutral_entry['valuation'] = score.get('valuation')
                                neutral_entry['evidence'] = score.get('evidence', [])
                                neutral_entry['risks'] = score.get('risks', [])
                                neutral_entry['rating_thresholds'] = score.get('rating_thresholds')
                            recs.append(neutral_entry)
                    if recs:
                        for rec in recs:
                            ticker = (rec.get('ticker') or '').upper()
                            rating = (rec.get('rating') or 'neutral').lower()
                            if ticker and rating in {'hold', 'sell'}:
                                prior_buy = (
                                    db.query(RecommendationHistory)
                                    .join(Analysis, Analysis.id == RecommendationHistory.analysis_id)
                                    .filter(RecommendationHistory.ticker == ticker)
                                    .filter(RecommendationHistory.rating == 'buy')
                                    .filter(Analysis.user_id == analysis_user_id)
                                    .first()
                                )
                                if not prior_buy:
                                    rec['risk_rating'] = rating
                                    rec['rating'] = 'neutral'
                                    rec['reason'] = (
                                        f"{rec.get('reason', '')} No prior buy recommendation is recorded, "
                                        "so the exit signal is tracked as risk evidence rather than an active exit."
                                    ).strip()
                        # Persist the updated JSON object as a string so the
                        # frontend can access summary, reasons and price info.
                        updated_result_str = json.dumps(parsed)
                        analysis.summary = updated_result_str
                        # Create a simple aggregated recommendation string for
                        # quick display in the analyses list.  Include the
                        # rating only; the detailed reasons will be parsed
                        # client-side from the summary.
                        analysis.recommendation = ", ".join(
                            f"{r.get('ticker')}: {r.get('rating')}" for r in recs
                        )
                        for rec in recs:
                            report_time = None
                            if rec.get('report_time'):
                                try:
                                    report_time = datetime.fromisoformat(rec.get('report_time'))
                                except Exception:
                                    report_time = None
                            db.add(
                                RecommendationHistory(
                                    analysis_id=analysis_id,
                                    ticker=(rec.get('ticker') or '').upper(),
                                    rating=rec.get('rating') or 'neutral',
                                    current_price=rec.get('current_price'),
                                    percent_change=rec.get('percent_change'),
                                    report_time=report_time,
                                    reason=rec.get('reason'),
                                )
                            )
                    else:
                        analysis.summary = json.dumps(parsed)
                        analysis.recommendation = None
                except Exception as exc:
                    logger.warning("Analysis %s returned an unstructured report: %s", analysis_id, exc)
                    fallback = _fallback_analysis_payload(result_str, tickers_str, analysis_settings)
                    fallback_recs = fallback.get("recommendations", [])
                    analysis.summary = json.dumps(fallback)
                    analysis.recommendation = ", ".join(
                        f"{r.get('ticker')}: {r.get('rating')}" for r in fallback_recs
                    ) if fallback_recs else None
                    for rec in fallback_recs:
                        db.add(
                            RecommendationHistory(
                                analysis_id=analysis_id,
                                ticker=(rec.get('ticker') or '').upper(),
                                rating=rec.get('rating') or 'neutral',
                                current_price=rec.get('current_price'),
                                percent_change=rec.get('percent_change'),
                                report_time=datetime.utcnow(),
                                reason=rec.get('reason'),
                            )
                        )
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
        log_buffer.flush_remaining()
        if log_buffer.pending_tasks:
            await asyncio.gather(*log_buffer.pending_tasks, return_exceptions=True)
        log_buffer.close()

# Delete an analysis and its logs
@app.delete("/analyses/{analysis_id}")
async def delete_analysis_endpoint(analysis_id: str, user: Dict[str, str] = Depends(require_user)):
    """Remove an analysis record and all associated logs."""
    with get_session() as db:
        analysis = db.query(Analysis).filter_by(id=analysis_id).first()
        if not _can_access_analysis(analysis, user):
            raise HTTPException(status_code=404, detail="Analysis not found")
        # Delete logs first to maintain referential integrity
        db.query(LogEntry).filter_by(analysis_id=analysis_id).delete()
        db.query(RecommendationHistory).filter_by(analysis_id=analysis_id).delete()
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

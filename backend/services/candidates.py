"""
candidates.py
---------------

This module defines helper functions to supply default lists of ticker
symbols for monitoring mode.  When the user initiates an analysis
without specifying any tickers, the system will use these defaults to
scan for potential buy or sell signals.  The default list combines
representative industrial equipment suppliers, electrical component
manufacturers and utilities, as well as the core sector ETFs that we
already analyse for rotation signals.  These symbols can be adjusted
according to domain expertise.

The list includes:

* **Industrial suppliers and power infrastructure**: General Electric (GE),
  Eaton (ETN), Cummins (CMI), Siemens AG (SIEGY), ABB Ltd (ABB), GE
  Vernova spin (GEV, once available), A.O. Smith (AOS), and Hitachi Ltd
  (HTHIY).
* **Energy infrastructure and utilities**: NextEra Energy (NEE), Duke
  Energy (DUK), Southern Company (SO).
* **Sector ETFs**: XLI (Industrials), XLU (Utilities), XLE (Energy), XLB
  (Materials).

These tickers provide broad coverage of the industries referenced in the
strategy (gas turbines, electrical infrastructure, utilities).  The
system will run the same analyses (capex, pricing, rotation and sell
signals) across this set when no explicit tickers are provided.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Dict, List, Optional

import yfinance as yf
from sqlalchemy.orm import Session

from ..models.candidate import Candidate

logger = logging.getLogger(__name__)


CORE_THEMES: Dict[str, str] = {
    "GE": "power infrastructure",
    "ETN": "electrical infrastructure",
    "CMI": "industrial equipment",
    "AOS": "industrial equipment",
    "ABB": "electrical infrastructure",
    "SIEGY": "industrial automation",
    "HTHIY": "industrial automation",
    "NEE": "utilities",
    "DUK": "utilities",
    "SO": "utilities",
    "XLI": "sector rotation",
    "XLU": "sector rotation",
    "XLE": "sector rotation",
    "XLB": "sector rotation",
    "NVDA": "AI infrastructure",
    "MSFT": "cloud infrastructure",
    "AAPL": "large-cap technology",
    "GOOGL": "cloud and AI",
    "AMZN": "cloud infrastructure",
    "AVGO": "semiconductor infrastructure",
}


DYNAMIC_THEME_UNIVERSE: Dict[str, List[str]] = {
    "power infrastructure": ["VST", "CEG", "PWR", "EME", "FLR", "JCI", "HUBB", "NVT"],
    "electrical infrastructure": ["ROK", "AME", "PH", "HON", "ITW", "GNRC", "WCC", "URI"],
    "utilities and grid": ["AEP", "EXC", "PEG", "SRE", "D", "ED", "WEC", "PCG"],
    "semiconductor infrastructure": ["AMD", "TSM", "ASML", "LRCX", "AMAT", "KLAC", "MU", "MRVL"],
    "cloud and data centers": ["ORCL", "IBM", "DELL", "HPE", "ANET", "CSCO", "EQIX", "DLR"],
    "energy infrastructure": ["ET", "KMI", "WMB", "OKE", "LNG", "TRGP", "BKR", "SLB"],
}


def get_default_candidate_tickers() -> List[str]:
    """Return a curated list of tickers to analyse when none are provided.

    The list includes major industrial equipment manufacturers,
    electrical infrastructure providers, utilities and sector ETFs.  It
    can be customized based on user preferences or industry focus.

    Returns
    -------
    List[str]
        A list of ticker symbols.
    """
    return [
        # Industrial suppliers and manufacturers
        'GE',    # General Electric
        'ETN',   # Eaton Corporation
        'CMI',   # Cummins Inc.
        'AOS',   # A.O. Smith
        'ABB',   # ABB Ltd (Swiss engineering)
        'SIEGY', # Siemens AG (ADR)
        'HTHIY', # Hitachi Ltd (ADR)
        # Utilities and energy infrastructure
        'NEE',   # NextEra Energy
        'DUK',   # Duke Energy
        'SO',    # Southern Company
        # Sector ETFs for broader rotation analysis
        'XLI',   # Industrials Select Sector SPDR
        'XLU',   # Utilities Select Sector SPDR
        'XLE',   # Energy Select Sector SPDR
        'XLB',   # Materials Select Sector SPDR
        # Technology heavyweights and AI leaders
        'NVDA',  # Nvidia – AI/semiconductor leader
        'MSFT',  # Microsoft – software & cloud
        'AAPL',  # Apple Inc.
        'GOOGL', # Alphabet Inc. (Class A)
        'AMZN',  # Amazon.com
        'AVGO',  # Broadcom – semiconductor and networking
    ]


def seed_core_candidates(db: Session) -> None:
    """Ensure the curated core universe is present in the candidate table."""
    now = datetime.utcnow()
    for ticker in get_default_candidate_tickers():
        existing = db.query(Candidate).filter_by(ticker=ticker).first()
        if existing:
            existing.source = existing.source or "core"
            existing.status = "core" if existing.status in {None, "discovered"} else existing.status
            existing.theme = existing.theme or CORE_THEMES.get(ticker)
            existing.updated_at = now
            continue
        db.add(
            Candidate(
                ticker=ticker,
                source="core",
                status="core",
                theme=CORE_THEMES.get(ticker),
                reason="Curated core ticker from the original monitoring universe.",
                discovery_score=100.0,
                liquidity_ok=True,
                last_discovered_at=now,
            )
        )


def _score_market_candidate(ticker: str, theme: str) -> Optional[dict]:
    try:
        instrument = yf.Ticker(ticker)
        hist = instrument.history(period="6mo")
        if hist.empty or "Close" not in hist.columns:
            return None
        closes = hist["Close"].dropna()
        volumes = hist["Volume"].dropna() if "Volume" in hist.columns else []
        if len(closes) < 40:
            return None
        current_price = float(closes.iloc[-1])
        start_price = float(closes.iloc[0])
        if start_price <= 0 or current_price <= 1:
            return None
        avg_volume = float(volumes.tail(30).mean()) if len(volumes) >= 30 else 0.0
        liquidity_ok = avg_volume >= 250_000
        momentum = (current_price / start_price) - 1
        volatility = float(closes.pct_change().dropna().std() or 0.0)
        drawdown = (current_price / float(closes.max())) - 1
        raw_score = momentum - (volatility * 1.5) + (drawdown * 0.35)
        info = instrument.info or {}
        sector = info.get("sector")
        return {
            "ticker": ticker,
            "theme": theme,
            "sector": sector,
            "raw_score": raw_score,
            "discovery_score": 0.0,
            "liquidity_ok": liquidity_ok,
            "reason": (
                f"Discovered from {theme}; 6-month momentum {momentum * 100:.1f}%, "
                f"30-day average volume {avg_volume:,.0f}."
            ),
        }
    except Exception as exc:
        logger.info("Dynamic candidate discovery failed for %s: %s", ticker, exc)
        return None


def discover_dynamic_candidates(db: Session, limit: int = 8) -> List[Candidate]:
    """Discover and persist additional candidates from strategy-adjacent themes."""
    seed_core_candidates(db)
    core = set(get_default_candidate_tickers())
    existing = {row.ticker: row for row in db.query(Candidate).all()}
    scored: List[dict] = []
    for theme, tickers in DYNAMIC_THEME_UNIVERSE.items():
        for ticker in tickers:
            normalized = ticker.upper()
            if normalized in core:
                continue
            result = _score_market_candidate(normalized, theme)
            if result and result["liquidity_ok"]:
                scored.append(result)

    scored.sort(key=lambda item: item["raw_score"], reverse=True)
    now = datetime.utcnow()
    discovered: List[Candidate] = []
    selected = scored[:limit]
    selected_tickers = {item["ticker"] for item in selected}
    for stale in db.query(Candidate).filter(Candidate.source == "discovered").all():
        if stale.ticker not in selected_tickers and stale.status == "discovered":
            stale.discovery_score = min(stale.discovery_score or 0.0, 39.0)
            stale.updated_at = now

    for rank, item in enumerate(selected):
        item["discovery_score"] = round(max(40.0, 95.0 - (rank * 4.0)), 2)
        candidate = existing.get(item["ticker"])
        if candidate:
            if candidate.status == "archived":
                continue
            candidate.source = candidate.source or "discovered"
            candidate.status = "promoted" if candidate.status == "promoted" else "discovered"
            candidate.theme = item["theme"]
            candidate.sector = item["sector"]
            candidate.reason = item["reason"]
            candidate.discovery_score = item["discovery_score"]
            candidate.liquidity_ok = item["liquidity_ok"]
            candidate.last_discovered_at = now
            candidate.updated_at = now
        else:
            candidate = Candidate(
                ticker=item["ticker"],
                source="discovered",
                status="discovered",
                theme=item["theme"],
                sector=item["sector"],
                reason=item["reason"],
                discovery_score=item["discovery_score"],
                liquidity_ok=item["liquidity_ok"],
                last_discovered_at=now,
            )
            db.add(candidate)
        discovered.append(candidate)
    return discovered


def list_candidates(db: Session) -> List[Candidate]:
    """Return all candidates, seeding the core universe if needed."""
    seed_core_candidates(db)
    db.flush()
    return (
        db.query(Candidate)
        .order_by(Candidate.status, Candidate.discovery_score.desc().nullslast(), Candidate.ticker)
        .all()
    )


def select_monitor_tickers(db: Session, limit: int = 24) -> List[str]:
    """Select core plus high-quality discovered candidates for monitor mode."""
    discover_dynamic_candidates(db)
    db.flush()
    rows = (
        db.query(Candidate)
        .filter(Candidate.status.in_(["core", "discovered", "promoted"]))
        .filter(Candidate.liquidity_ok.is_(True))
        .order_by(Candidate.discovery_score.desc().nullslast(), Candidate.ticker)
        .limit(limit)
        .all()
    )
    tickers = [row.ticker for row in rows]
    return tickers or get_default_candidate_tickers()[:limit]


def discover_candidate_tickers(limit: int = 20) -> List[str]:
    """Rank the default universe by recent momentum and return top candidates.

    This keeps the curated universe as the source of truth, then orders it
    using public price data. If market data is unavailable, the static
    watch-list is returned.
    """
    universe = get_default_candidate_tickers()
    scored: List[tuple[float, str]] = []
    for ticker in universe:
        try:
            hist = yf.Ticker(ticker).history(period="6mo")
            if hist.empty or "Close" not in hist.columns:
                continue
            closes = hist["Close"].dropna()
            if len(closes) < 20:
                continue
            momentum = (float(closes.iloc[-1]) / float(closes.iloc[0])) - 1
            volatility = float(closes.pct_change().dropna().std() or 0.0)
            scored.append((momentum - (volatility * 0.5), ticker))
        except Exception as exc:
            logger.info("Candidate scoring failed for %s: %s", ticker, exc)
    if not scored:
        return universe[:limit]
    scored.sort(reverse=True)
    return [ticker for _, ticker in scored[:limit]]

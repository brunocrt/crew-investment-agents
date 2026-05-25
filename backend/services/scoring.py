"""
Deterministic recommendation scoring.

The agent report is useful for synthesis and explanation, but the system also
needs a repeatable score that can be compared across runs. This module
converts raw service outputs into bounded component scores, evidence items,
risks and a suggested rating.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Iterable, List, Optional

import yfinance as yf

from .capex import get_capex_growth
from .pricing import get_price_spikes
from .rotation import DEFAULT_SECTOR_ETFS, get_sector_rotation_analysis
from .sell import get_sell_signals

logger = logging.getLogger(__name__)

SECTOR_TO_ETF = {
    "Basic Materials": "XLB",
    "Communication Services": "XLC",
    "Consumer Cyclical": "XLY",
    "Consumer Defensive": "XLP",
    "Energy": "XLE",
    "Financial Services": "XLF",
    "Healthcare": "XLV",
    "Industrials": "XLI",
    "Real Estate": "XLRE",
    "Technology": "XLK",
    "Utilities": "XLU",
}


def _bounded(value: Optional[float], high_watermark: float) -> float:
    if value is None or high_watermark == 0:
        return 0.0
    return max(0.0, min(float(value) / high_watermark, 1.0))


def _safe_sector_for_ticker(ticker: str) -> Optional[str]:
    if ticker.upper() in DEFAULT_SECTOR_ETFS:
        return ticker.upper()
    try:
        info = yf.Ticker(ticker).info or {}
        sector = info.get("sector")
        if not sector:
            return None
        return SECTOR_TO_ETF.get(sector)
    except Exception as exc:
        logger.info("Unable to resolve sector for %s: %s", ticker, exc)
        return None


def _evidence(signal: str, value: Any, weight: float, detail: str) -> Dict[str, Any]:
    return {"signal": signal, "value": value, "weight": weight, "detail": detail}


def calculate_signal_scores(tickers: Iterable[str]) -> Dict[str, Dict[str, Any]]:
    """Return deterministic scores and evidence for each requested ticker."""
    requested = [t.strip().upper() for t in tickers if t and t.strip()]
    if not requested:
        return {}

    try:
        price_spikes = get_price_spikes()
    except Exception as exc:
        logger.exception("Pricing score failed: %s", exc)
        price_spikes = []
    max_price_spike = max([p.get("price_change_pct") or 0.0 for p in price_spikes], default=0.0)
    pricing_score = _bounded(max_price_spike, 0.10)

    try:
        rotation_results = get_sector_rotation_analysis()
    except Exception as exc:
        logger.exception("Rotation score failed: %s", exc)
        rotation_results = []
    rotation_by_ticker = {r.ticker.upper(): r for r in rotation_results}

    try:
        sell_results = get_sell_signals(requested)
    except Exception as exc:
        logger.exception("Sell score failed: %s", exc)
        sell_results = []
    sell_by_ticker = {r.get("ticker", "").upper(): r for r in sell_results}

    output: Dict[str, Dict[str, Any]] = {}
    for ticker in requested:
        evidence: List[Dict[str, Any]] = []
        risks: List[Dict[str, Any]] = []

        capex_data = get_capex_growth(ticker)
        capex_growth = capex_data.get("capex_growth_pct") if capex_data else None
        capex_score = _bounded(capex_growth, 0.20)
        if capex_growth is not None:
            evidence.append(_evidence("capex_growth", capex_growth, 0.35, "Capex growth versus the previous reporting period."))

        if price_spikes:
            evidence.append(_evidence("pricing_power", max_price_spike, 0.20, "Largest monitored commodity/component price spike."))

        sector_etf = _safe_sector_for_ticker(ticker)
        rotation = rotation_by_ticker.get(sector_etf or "")
        rotation_score = 0.0
        if rotation:
            relative = float(rotation.relative_return)
            defensive = float(rotation.up_on_down_days_ratio)
            if relative > 0:
                rotation_score += 0.55
            rotation_score += min(defensive / 0.40, 1.0) * 0.45
            rotation_score = min(rotation_score, 1.0)
            evidence.append(
                _evidence(
                    "sector_rotation",
                    {"sector_etf": sector_etf, "relative_return": relative, "up_on_down_days_ratio": defensive},
                    0.25,
                    "Mapped sector ETF performance versus SPY and behavior on market down days.",
                )
            )

        sell = sell_by_ticker.get(ticker, {})
        fundamental_risk = 1.0 if sell.get("fundamental_signal") else 0.0
        technical_risk = 1.0 if sell.get("technical_signal") else 0.0
        distribution_risk = 1.0 if sell.get("distribution_signal") else 0.0
        risk_score = max(fundamental_risk, technical_risk, distribution_risk)
        for key, label in [
            ("fundamental_signal", "fundamental_peak"),
            ("technical_signal", "technical_exhaustion"),
            ("distribution_signal", "distribution_days"),
        ]:
            if sell.get(key):
                risks.append({"signal": label, "value": True, "detail": "Exit red flag detected by the sell signal service."})

        raw_score = capex_score * 0.35 + pricing_score * 0.20 + rotation_score * 0.25 - risk_score * 0.35
        final_score = round(max(0.0, min(raw_score, 1.0)) * 100, 2)
        observed_components = sum(1 for value in [capex_growth, price_spikes, rotation, sell] if value not in (None, [], {}))
        confidence = round(min(1.0, 0.25 + observed_components * 0.18), 2)

        if risk_score >= 1.0:
            suggested_rating = "sell"
        elif final_score >= 70:
            suggested_rating = "buy"
        elif final_score >= 45:
            suggested_rating = "hold"
        else:
            suggested_rating = "neutral"

        output[ticker] = {
            "ticker": ticker,
            "capex_score": round(capex_score, 3),
            "pricing_score": round(pricing_score, 3),
            "rotation_score": round(rotation_score, 3),
            "technical_risk_score": technical_risk,
            "fundamental_risk_score": fundamental_risk,
            "distribution_risk_score": distribution_risk,
            "risk_score": risk_score,
            "final_score": final_score,
            "confidence": confidence,
            "suggested_rating": suggested_rating,
            "evidence": evidence,
            "risks": risks,
        }

    return output

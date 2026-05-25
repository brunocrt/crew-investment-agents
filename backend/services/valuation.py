"""
Fundamental valuation helpers.
------------------------------

This module adds a FastGraphs-inspired valuation layer.  It anchors the
current price to earnings power, historical valuation norms and forward
earnings expectations so opportunity scoring is not driven by momentum alone.
"""

from __future__ import annotations

import logging
from statistics import median
from typing import Any, Dict, List, Optional

import yfinance as yf

logger = logging.getLogger(__name__)


def _safe_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        number = float(value)
        if number != number:
            return None
        return number
    except (TypeError, ValueError):
        return None


def _bounded(value: Optional[float], low: float, high: float) -> float:
    if value is None or high == low:
        return 0.0
    return max(0.0, min((float(value) - low) / (high - low), 1.0))


def _first_number(info: Dict[str, Any], keys: List[str]) -> Optional[float]:
    for key in keys:
        value = _safe_float(info.get(key))
        if value is not None:
            return value
    return None


def _growth_to_fair_multiple(growth_rate: Optional[float]) -> Optional[float]:
    """Map expected earnings growth to a conservative fair P/E anchor."""
    if growth_rate is None:
        return None
    growth_pct = max(0.0, growth_rate * 100)
    if growth_pct <= 5:
        return min(18.5, 8.5 + (2 * growth_pct))
    if growth_pct < 15:
        return 15.0
    return min(35.0, max(15.0, growth_pct))


def _closing_price_at_or_before(hist, fiscal_date: Any) -> Optional[float]:
    if hist is None or hist.empty or "Close" not in hist.columns:
        return None
    try:
        index = hist.index
        if getattr(index, "tz", None) is not None:
            index = index.tz_localize(None)
        eligible = hist.loc[index <= fiscal_date]
        if eligible.empty:
            return None
        return _safe_float(eligible["Close"].iloc[-1])
    except Exception:
        return None


def _normal_pe_from_history(instrument: yf.Ticker) -> Optional[float]:
    """Estimate the market's normal P/E from annual EPS and historical prices."""
    try:
        income_stmt = instrument.income_stmt
        if income_stmt is None or income_stmt.empty:
            return None
        eps_row = None
        for row_name in ["Diluted EPS", "Basic EPS"]:
            if row_name in income_stmt.index:
                eps_row = income_stmt.loc[row_name]
                break
        if eps_row is None:
            return None

        hist = instrument.history(period="5y", interval="1mo")
        if hist.empty:
            return None

        pe_values: List[float] = []
        for fiscal_date, eps_value in eps_row.items():
            eps = _safe_float(eps_value)
            if eps is None or eps <= 0:
                continue
            price = _closing_price_at_or_before(hist, fiscal_date)
            if price is None or price <= 0:
                continue
            pe = price / eps
            if 3 <= pe <= 80:
                pe_values.append(pe)

        if len(pe_values) >= 3:
            pe_values = sorted(pe_values)[1:-1]
        if pe_values:
            return round(float(median(pe_values)), 2)
    except Exception as exc:
        logger.info("Unable to estimate normal P/E: %s", exc)
    return None


def get_valuation_profile(ticker: str) -> Dict[str, Any]:
    """Return valuation, quality and forward-return context for one ticker."""
    normalized = ticker.strip().upper()
    profile: Dict[str, Any] = {
        "ticker": normalized,
        "valuation_score": 0.0,
        "quality_score": 0.0,
        "label": "No valuation data",
        "has_valuation": False,
    }

    try:
        instrument = yf.Ticker(normalized)
        info = instrument.info or {}
        hist = instrument.history(period="1mo")
        current_price = _safe_float(info.get("currentPrice")) or _safe_float(info.get("regularMarketPrice"))
        if current_price is None and hist is not None and not hist.empty and "Close" in hist.columns:
            current_price = _safe_float(hist["Close"].dropna().iloc[-1])

        trailing_eps = _first_number(info, ["trailingEps", "epsTrailingTwelveMonths"])
        forward_eps = _first_number(info, ["forwardEps"])
        current_pe = _first_number(info, ["trailingPE"])
        forward_pe = _first_number(info, ["forwardPE"])
        if current_pe is None and current_price and trailing_eps and trailing_eps > 0:
            current_pe = current_price / trailing_eps
        if forward_pe is None and current_price and forward_eps and forward_eps > 0:
            forward_pe = current_price / forward_eps

        expected_growth = _first_number(info, ["earningsGrowth", "earningsQuarterlyGrowth"])
        if expected_growth is None and trailing_eps and forward_eps and trailing_eps > 0:
            expected_growth = (forward_eps / trailing_eps) - 1
        revenue_growth = _first_number(info, ["revenueGrowth"])
        normal_pe = _normal_pe_from_history(instrument)
        growth_pe = _growth_to_fair_multiple(expected_growth or revenue_growth)

        anchors = [value for value in [normal_pe, growth_pe] if value is not None and value > 0]
        target_multiple = round(float(median(anchors)), 2) if anchors else None
        earnings_base = forward_eps if forward_eps and forward_eps > 0 else trailing_eps
        fair_value = target_multiple * earnings_base if target_multiple and earnings_base and earnings_base > 0 else None
        margin_of_safety = (fair_value / current_price) - 1 if fair_value and current_price and current_price > 0 else None
        earnings_yield = (1 / current_pe) if current_pe and current_pe > 0 else None

        valuation_score = 0.0
        if margin_of_safety is not None:
            valuation_score = _bounded(margin_of_safety, -0.25, 0.30)
        elif current_pe is not None:
            valuation_score = 1.0 - _bounded(current_pe, 12.0, 35.0)
        if earnings_yield is not None:
            valuation_score = (valuation_score * 0.75) + (_bounded(earnings_yield, 0.02, 0.08) * 0.25)

        profit_margin = _first_number(info, ["profitMargins", "operatingMargins"])
        debt_to_equity = _first_number(info, ["debtToEquity"])
        growth_score = _bounded(expected_growth or revenue_growth, 0.0, 0.18)
        profitability_score = _bounded(profit_margin, 0.0, 0.22)
        balance_sheet_score = 0.5 if debt_to_equity is None else max(0.0, min(1.0, 1 - (debt_to_equity / 220)))
        quality_score = (growth_score * 0.40) + (profitability_score * 0.40) + (balance_sheet_score * 0.20)

        if margin_of_safety is None and current_pe is None and forward_pe is None:
            label = "No valuation data"
            has_valuation = False
        elif valuation_score >= 0.70 and quality_score >= 0.55:
            label = "Undervalued growth"
            has_valuation = True
        elif valuation_score >= 0.55:
            label = "Reasonable value"
            has_valuation = True
        elif valuation_score >= 0.35:
            label = "Fairly valued"
            has_valuation = True
        else:
            label = "Expensive versus fundamentals"
            has_valuation = True

        profile.update(
            {
                "current_price": current_price,
                "trailing_eps": trailing_eps,
                "forward_eps": forward_eps,
                "current_pe": round(current_pe, 2) if current_pe is not None else None,
                "forward_pe": round(forward_pe, 2) if forward_pe is not None else None,
                "normal_pe": normal_pe,
                "growth_fair_pe": round(growth_pe, 2) if growth_pe is not None else None,
                "target_multiple": target_multiple,
                "fair_value": round(fair_value, 2) if fair_value is not None else None,
                "margin_of_safety": round(margin_of_safety, 4) if margin_of_safety is not None else None,
                "earnings_yield": round(earnings_yield, 4) if earnings_yield is not None else None,
                "expected_growth": round(expected_growth, 4) if expected_growth is not None else None,
                "revenue_growth": round(revenue_growth, 4) if revenue_growth is not None else None,
                "profit_margin": round(profit_margin, 4) if profit_margin is not None else None,
                "debt_to_equity": round(debt_to_equity, 2) if debt_to_equity is not None else None,
                "valuation_score": round(max(0.0, min(valuation_score, 1.0)), 3),
                "quality_score": round(max(0.0, min(quality_score, 1.0)), 3),
                "label": label,
                "has_valuation": has_valuation,
            }
        )
    except Exception as exc:
        logger.info("Valuation profile failed for %s: %s", normalized, exc)

    return profile

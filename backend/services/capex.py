"""
capex.py
--------------

This module provides helper functions to inspect a company's capital expenditure
spending from publicly available data sources. The goal of these functions is
to detect large increases in capital expenditures that could serve as a
leading indicator for downstream investment opportunities, as outlined in
the user's strategy.  

For demonstration purposes the implementation leverages the `yfinance`
package to query quarterly cash‑flow statements. The SEC filings themselves
are an authoritative source for capital expenditure information but require
complex parsing of XBRL data and an API key.  By using Yahoo! Finance
financial statements we can approximate the trend in capex year‑over‑year or
quarter‑over‑quarter without additional credentials.  This code will work
out‑of‑the‑box after installing the dependencies listed in requirements.txt.

Functions in this module return structured Python dictionaries rather than
human‑readable strings.  This makes it easier to combine their output with
other agents' analyses and feed the result into a language model for
interpretation.
"""

from __future__ import annotations

import logging
from typing import Optional, Dict, Any

import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)

def get_capex_growth(ticker: str) -> Optional[Dict[str, Any]]:
    """
    Compute the change in capital expenditures for a company over the most
    recent two reported periods.

    The function fetches quarterly cash‑flow data using yfinance.  It then
    extracts the "Capital Expenditures" line item and calculates the
    percentage change between the two most recent periods.  A positive
    percentage indicates an increase in spending.  A 20% increase is
    considered a strong signal according to the Capex Trail strategy.

    Parameters
    ----------
    ticker : str
        The stock ticker symbol for the target company (e.g. 'GE', 'MSFT').

    Returns
    -------
    dict or None
        A dictionary containing the latest capex, previous capex and
        percentage change.  If the data cannot be retrieved or the
        appropriate fields are missing, returns None.
    """
    try:
        t = yf.Ticker(ticker)
        # quarterly_cashflow returns a DataFrame where rows are cash‑flow
        # categories and columns are datetime periods in descending order.
        cf: pd.DataFrame = t.quarterly_cashflow
        # Normalize the index to strings for easier lookup
        cf.index = cf.index.astype(str)
        if 'Capital Expenditures' not in cf.index:
            logger.warning("Capital Expenditures not available for %s", ticker)
            return None
        capex_series = cf.loc['Capital Expenditures']
        # Sort by date descending (already typical) but ensure there are at
        # least two periods to compare
        capex_series = capex_series.dropna().sort_index(ascending=False)
        if len(capex_series) < 2:
            logger.warning(
                "Not enough capex history for %s to compute growth", ticker
            )
            return None
        latest_date, prev_date = capex_series.index[:2]
        latest = float(-capex_series.iloc[0])  # negative sign to make positive
        prev = float(-capex_series.iloc[1])
        if prev == 0:
            growth_pct = None
        else:
            growth_pct = (latest - prev) / abs(prev)
        result = {
            'ticker': ticker,
            'latest_period': str(latest_date),
            'previous_period': str(prev_date),
            'latest_capex_mil': latest,
            'previous_capex_mil': prev,
            'capex_growth_pct': growth_pct,
        }
        return result
    except Exception as exc:
        logger.exception("Failed to compute capex growth for %s: %s", ticker, exc)
        return None
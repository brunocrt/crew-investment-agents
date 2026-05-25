"""
price_info.py
---------------

This module provides a simple helper to retrieve the current price and
recent percent change for a given stock ticker.  It fetches historical
closing prices via yfinance and computes the percentage change between
the most recent close and the close approximately ``window_days`` days
ago.  If insufficient history is available or price data is missing,
the function returns ``None``.

"""

from __future__ import annotations

from datetime import timedelta
from typing import Dict, Optional

import yfinance as yf


def get_stock_price_info(ticker: str, window_days: int = 30) -> Optional[Dict[str, float]]:
    """
    Retrieve current closing price and percent change over a recent window.

    Parameters
    ----------
    ticker : str
        The stock symbol to query.
    window_days : int, optional
        The lookback period in days for calculating the percentage change.

    Returns
    -------
    dict or None
        A dictionary with keys ``current_price`` and ``percent_change``
        representing the latest closing price and the fractional change
        relative to the closing price on or before ``window_days`` calendar
        days ago.  Returns ``None`` if price data is unavailable or
        insufficient.
    """
    try:
        # Fetch enough data to locate the trading close nearest to the
        # calendar lookback date, accounting for weekends and market holidays.
        hist = yf.Ticker(ticker).history(period=f"{window_days + 20}d")
        if hist.empty or 'Close' not in hist.columns:
            return None
        hist = hist.dropna(subset=['Close'])
        if hist.empty:
            return None

        latest_date = hist.index[-1]
        target_date = latest_date - timedelta(days=window_days)
        prior_rows = hist[hist.index <= target_date]
        if prior_rows.empty:
            return None

        current_price = float(hist['Close'].iloc[-1])
        past_price = float(prior_rows['Close'].iloc[-1])
        # Avoid division by zero
        if past_price == 0:
            percent_change = None
        else:
            percent_change = (current_price - past_price) / past_price
        return {
            'current_price': current_price,
            'past_price': past_price,
            'percent_change': percent_change,
            'price_change_start_date': prior_rows.index[-1].date().isoformat(),
            'price_change_end_date': latest_date.date().isoformat(),
            'price_change_window_days': window_days,
        }
    except Exception:
        return None

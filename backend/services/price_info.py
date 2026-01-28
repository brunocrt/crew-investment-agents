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

from typing import Optional, Dict

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
        relative to the closing price ``window_days`` days ago.  Returns
        ``None`` if price data is unavailable or insufficient.
    """
    try:
        # Retrieve a bit more history to ensure we have at least ``window_days``
        # trading sessions (markets close on weekends and holidays).
        hist = yf.Ticker(ticker).history(period=f"{window_days + 5}d")
        if hist.empty or 'Close' not in hist.columns:
            return None
        hist = hist.dropna(subset=['Close'])
        current_price = float(hist['Close'].iloc[-1])
        if len(hist) <= window_days:
            # If we don't have enough data, use the earliest available price
            past_price = float(hist['Close'].iloc[0])
        else:
            past_price = float(hist['Close'].iloc[-window_days])
        # Avoid division by zero
        if past_price == 0:
            percent_change = None
        else:
            percent_change = (current_price - past_price) / past_price
        return {
            'current_price': current_price,
            'percent_change': percent_change,
        }
    except Exception:
        return None
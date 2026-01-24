"""
pricing.py
-----------

This module offers utilities to detect unusual price movements in a set of
commodities or components.  The Pricing Power strategy described by the user
highlights the importance of supply shortages that lead to contract price
spikes.  Rather than relying on proprietary industry trackers, we take
advantage of publicly available financial market data via the `yfinance`
package.  Many commodities and exchange‑traded instruments are listed
under ticker symbols and can be queried for historical prices.

The function defined here computes the percentage change in price over a
configurable window and flags those instruments whose price has risen above
a user‑defined threshold.  This simple heuristic approximates the supply
shock dynamics described in the strategy.  More sophisticated models could
incorporate rolling volatilities, contract‑specific lead times, or
industry‑specific datasets.
"""

from __future__ import annotations

import logging
from typing import List, Dict, Any, Optional, Iterable

import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)

# A curated list of commodity or component tickers to monitor.  These
# instruments represent inputs that are critical to industrial and
# technological infrastructure.  Users can modify this list according to
# their domain expertise.
DEFAULT_TICKERS = [
    'HG=F',    # Copper futures
    'NG=F',    # Natural Gas
    'CL=F',    # Crude Oil (WTI)
    'LE=F',    # Live Cattle
    'ZW=F',    # Wheat
    'CT=F',    # Cotton
    'HO=F',    # Heating Oil
    'SI=F',    # Silver
    'PL=F',    # Platinum
    'PA=F',    # Palladium
]

def get_price_spikes(
    tickers: Optional[Iterable[str]] = None,
    window_days: int = 30,
    threshold_pct: float = 0.05,
) -> List[Dict[str, Any]]:
    """
    Identify instruments whose price has increased more than a given
    percentage over a rolling window.

    Parameters
    ----------
    tickers : iterable of str, optional
        A collection of ticker symbols to evaluate.  If omitted, the
        DEFAULT_TICKERS list is used.
    window_days : int
        The lookback period (in calendar days) used to compute the price
        change.  By default the function compares the current price to
        the closing price 30 days ago.
    threshold_pct : float
        The minimum percentage increase required to be considered a
        "spike".  For example, 0.05 corresponds to a 5% increase.

    Returns
    -------
    List[Dict[str, Any]]
        A list of dictionaries, one per instrument that meets the
        threshold.  Each dictionary includes the ticker, start and end
        dates, starting and ending prices, and the computed percent
        change.
    """
    tickers_to_use = list(tickers) if tickers is not None else DEFAULT_TICKERS
    results: List[Dict[str, Any]] = []
    for ticker in tickers_to_use:
        try:
            data = yf.Ticker(ticker).history(period=f"{window_days + 5}d")
            # Ensure we have enough data points.  Some instruments might not
            # trade every day, so pad by 5 days and drop NaNs.
            if data.empty or 'Close' not in data:
                logger.warning("No price data for %s", ticker)
                continue
            data = data.dropna(subset=['Close'])
            # Use the most recent closing price as "current" and the closing
            # price window_days ago as the comparison baseline.
            end_price = float(data['Close'].iloc[-1])
            # Find the index representing approximately window_days ago.
            # We choose the row that is window_days offset from the end.
            if len(data) <= window_days:
                start_price = float(data['Close'].iloc[0])
                start_date = str(data.index[0].date())
            else:
                start_price = float(data['Close'].iloc[-window_days])
                start_date = str(data.index[-window_days].date())
            end_date = str(data.index[-1].date())
            if start_price == 0:
                pct_change = None
            else:
                pct_change = (end_price - start_price) / start_price
            if pct_change is not None and pct_change >= threshold_pct:
                results.append(
                    {
                        'ticker': ticker,
                        'start_date': start_date,
                        'end_date': end_date,
                        'start_price': start_price,
                        'end_price': end_price,
                        'price_change_pct': pct_change,
                    }
                )
        except Exception as exc:
            logger.exception("Error retrieving price data for %s: %s", ticker, exc)
            continue
    return results
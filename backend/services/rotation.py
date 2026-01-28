"""
rotation.py
-----------

This module contains utilities for tracking relative performance of sector
exchange‑traded funds (ETFs) compared to the overall market.  The
Institutional Rotation strategy posits that large institutional investors
shift capital between sectors, and that these moves can be detected when
historically defensive sectors outperform the broader market on down days.

We leverage price data from Yahoo! Finance via the `yfinance` package to
compute trailing returns and conditional returns (returns on days when the
market index is down).  The default set of sectors mirrors the SPDR Select
Sector funds, which represent key segments of the U.S. equity market.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Dict, Any, Optional

import numpy as np
import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)

DEFAULT_SECTOR_ETFS = {
    'XLB': 'Materials',
    'XLE': 'Energy',
    'XLF': 'Financials',
    'XLI': 'Industrials',
    'XLY': 'Consumer Discretionary',
    'XLK': 'Technology',
    'XLP': 'Consumer Staples',
    'XLV': 'Healthcare',
    'XLU': 'Utilities',
    'XLC': 'Communication Services',
}

MARKET_TICKER = 'SPY'

@dataclass
class SectorRotationResult:
    ticker: str
    name: str
    trailing_return: float
    market_return: float
    relative_return: float
    up_on_down_days_ratio: float

def _compute_returns(price_series: pd.Series) -> pd.Series:
    """Compute discrete daily returns from a price series."""
    return price_series.pct_change().dropna()

def get_sector_rotation_analysis(
    lookback_days: int = 30,
    sectors: Optional[Dict[str, str]] = None,
) -> List[SectorRotationResult]:
    """
    Analyze relative sector performance over a recent window and measure
    defensive behavior during market drawdowns.

    Parameters
    ----------
    lookback_days : int
        Number of days to include in the trailing return computation.
    sectors : dict, optional
        Mapping of sector ETF tickers to human‑readable names.  If None,
        DEFAULT_SECTOR_ETFS is used.

    Returns
    -------
    List[SectorRotationResult]
        A list of dataclass instances containing performance metrics for
        each sector.  The list is sorted by relative_return in descending
        order.
    """
    sector_map = sectors or DEFAULT_SECTOR_ETFS
    all_tickers = list(sector_map.keys()) + [MARKET_TICKER]
    try:
        # Download recent price data.  When multiple tickers are requested,
        # yfinance returns a DataFrame with a MultiIndex on the columns where
        # the first level contains field names (e.g., "Open", "Close", "Adj Close")
        # and the second level contains the ticker symbols.  Some instruments
        # may not provide an "Adj Close" series; in that case, fall back to
        # using the regular closing prices.
        raw = yf.download(all_tickers, period=f"{lookback_days + 5}d")
        data = None
        # MultiIndex case: top level fields and second level tickers
        if isinstance(raw.columns, pd.MultiIndex):
            top_levels = list(raw.columns.levels[0])
            if 'Adj Close' in top_levels:
                data = raw['Adj Close']
            elif 'Close' in top_levels:
                data = raw['Close']
        else:
            # Single ticker case
            if 'Adj Close' in raw.columns:
                data = raw['Adj Close']
            elif 'Close' in raw.columns:
                data = raw['Close']
        if data is None:
            raise KeyError('Adj Close series not found for the downloaded tickers')
        # Align and drop rows with any NaNs
        data = data.dropna(how='any')
    except Exception as exc:
        logger.exception('Error downloading sector data: %s', exc)
        return []
    # Compute daily returns
    returns = data.pct_change().dropna()
    market_returns = returns[MARKET_TICKER]
    results: List[SectorRotationResult] = []
    for ticker, name in sector_map.items():
        if ticker not in returns.columns:
            continue
        sector_ret = returns[ticker]
        # Trailing return over the period
        trailing_return = (data[ticker].iloc[-1] / data[ticker].iloc[0]) - 1
        market_ret_over_period = (data[MARKET_TICKER].iloc[-1] / data[MARKET_TICKER].iloc[0]) - 1
        relative_return = trailing_return - market_ret_over_period
        # Defensive measure: compute fraction of market down days where sector was up
        down_days = market_returns < 0
        if down_days.sum() > 0:
            up_on_down = ((sector_ret[down_days] > 0).sum()) / down_days.sum()
        else:
            up_on_down = 0.0
        results.append(
            SectorRotationResult(
                ticker=ticker,
                name=name,
                trailing_return=trailing_return,
                market_return=market_ret_over_period,
                relative_return=relative_return,
                up_on_down_days_ratio=up_on_down,
            )
        )
    # Sort by relative outperformance descending
    results.sort(key=lambda x: x.relative_return, reverse=True)
    return results
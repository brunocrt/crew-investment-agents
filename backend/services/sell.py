"""
sell.py
-------

This module implements the logic for identifying exit signals that would
trigger a *sell recommendation* for a stock.  The functions here follow
the three "Red Flag" categories provided by the user: fundamental peaks,
technical exhaustion, and institutional rotation (distribution days).

Each function operates purely on publicly available market data fetched via
the `yfinance` package.  They return structured dictionaries containing
raw metrics and boolean flags indicating whether a red flag has been
triggered.  These helpers are designed to be consumed by a higher‑level
agent which synthesises them into human‑readable recommendations.

The heuristics used are as follows:

* **Fundamental Peak (Macro Exit)** — If a company's inventories grow
  significantly faster than its revenue and accounts receivable growth
  slows, it suggests a looming price war due to oversupply.  We measure
  quarter‑over‑quarter changes in total revenue, inventories and
  receivables.  The flag is set when inventory growth exceeds revenue
  growth by at least 20% **and** receivables growth is less than
  revenue growth.  We also incorporate a "capex peak" by checking the
  existing `get_capex_growth` function: if capex growth is negative
  (declining), that contributes to the fundamental signal.

* **Technical Exhaustion (Math Exit)** — Over‑extended price moves and
  waning momentum often precede reversals.  We compute the 200‑day
  simple moving average (SMA) and the 14‑period Relative Strength Index
  (RSI) from daily closing prices.  The flag is set if either (a) the
  latest close is at least 80% above the 200‑day SMA or (b) the stock
  makes a new 30‑day high while the current RSI is lower than the
  maximum RSI over the prior 30 days (a bearish divergence).

* **Institutional Rotation (Flow Exit)** — Distribution days occur when
  price falls on unusually high volume, signalling that large holders are
  selling.  We count the number of distribution days over the past 20
  trading sessions.  A distribution day is defined as a session where the
  close is lower than the previous close **and** the volume is both
  higher than the previous day and above the 60‑day average volume.  The
  flag is set when there are four or more such days in the 20‑session
  window.

These rules are deliberately conservative and meant for demonstration
purposes.  Real‑world implementations might fine‑tune thresholds or use
additional data sources.
"""

from __future__ import annotations

import logging
from typing import Optional, Dict, Any, List

import numpy as np
import pandas as pd
import yfinance as yf

from .capex import get_capex_growth

logger = logging.getLogger(__name__)


def _compute_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """
    Compute the Relative Strength Index (RSI) for a price series.

    Parameters
    ----------
    series : pd.Series
        Series of closing prices.
    period : int, optional
        Lookback period for RSI calculation (default is 14).

    Returns
    -------
    pd.Series
        A series containing the RSI values.  The length will be the same
        as the input series, with NaN values at the beginning where the
        lookback window is incomplete.
    """
    delta = series.diff()
    up = delta.clip(lower=0)
    down = -delta.clip(upper=0)
    # Use exponential moving average to smooth gains and losses
    roll_up = up.ewm(span=period, adjust=False).mean()
    roll_down = down.ewm(span=period, adjust=False).mean()
    rs = roll_up / roll_down
    rsi = 100 - (100 / (1 + rs))
    return rsi


def get_fundamental_peak_signal(ticker: str) -> Optional[Dict[str, Any]]:
    """
    Detect a potential fundamental peak for a company based on inventory,
    revenue and accounts receivable growth.  Incorporates a capex peak via
    declining capital expenditures.

    Parameters
    ----------
    ticker : str
        The stock ticker symbol to analyse.

    Returns
    -------
    dict or None
        A dictionary with growth metrics and a boolean ``fundamental_signal``
        flag.  Returns None if data is insufficient.
    """
    try:
        yf_ticker = yf.Ticker(ticker)
        # income statement for revenue, balance sheet for inventory and receivables
        income = yf_ticker.quarterly_income_stmt
        balance = yf_ticker.quarterly_balance_sheet
        # Ensure correct orientation: rows are items, columns are dates (descending)
        income.index = income.index.astype(str)
        balance.index = balance.index.astype(str)
        # We need at least two periods for comparison
        if (
            'Total Revenue' not in income.index
            or 'Inventory' not in balance.index
            or 'Accounts Receivable' not in balance.index
        ):
            logger.warning("Missing required fields for %s", ticker)
            return None
        # Extract the most recent two quarters (assuming columns sorted descending)
        rev_series = income.loc['Total Revenue'].dropna().sort_index(ascending=False)
        inv_series = balance.loc['Inventory'].dropna().sort_index(ascending=False)
        ar_series = balance.loc['Accounts Receivable'].dropna().sort_index(ascending=False)
        if (
            len(rev_series) < 2
            or len(inv_series) < 2
            or len(ar_series) < 2
        ):
            logger.warning("Not enough history for fundamental analysis on %s", ticker)
            return None
        # Use the latest two periods (index 0 is most recent)
        latest_rev, prev_rev = float(rev_series.iloc[0]), float(rev_series.iloc[1])
        latest_inv, prev_inv = float(inv_series.iloc[0]), float(inv_series.iloc[1])
        latest_ar, prev_ar = float(ar_series.iloc[0]), float(ar_series.iloc[1])
        # Compute growth rates.  If previous value is zero, skip ratio.
        rev_growth = None if prev_rev == 0 else (latest_rev - prev_rev) / abs(prev_rev)
        inv_growth = None if prev_inv == 0 else (latest_inv - prev_inv) / abs(prev_inv)
        ar_growth = None if prev_ar == 0 else (latest_ar - prev_ar) / abs(prev_ar)
        # Determine if inventory growth outpaces revenue growth by >= 20% and AR growth slows
        fundamental_signal = False
        if None not in (rev_growth, inv_growth, ar_growth):
            if (
                (inv_growth - rev_growth) >= 0.20
                and ar_growth < rev_growth
            ):
                fundamental_signal = True
        # Capex peak: re‑use existing capex growth computation.  If negative, treat as peak.
        capex_data = get_capex_growth(ticker)
        capex_growth_pct = None
        capex_peak = False
        if capex_data is not None:
            capex_growth_pct = capex_data.get('capex_growth_pct')
            if capex_growth_pct is not None and capex_growth_pct < 0:
                capex_peak = True
        # Combine both signals: if either inventory/AR condition or capex peak triggers, set fundamental_signal
        if capex_peak:
            fundamental_signal = True
        return {
            'ticker': ticker,
            'latest_revenue': latest_rev,
            'previous_revenue': prev_rev,
            'revenue_growth_pct': rev_growth,
            'latest_inventory': latest_inv,
            'previous_inventory': prev_inv,
            'inventory_growth_pct': inv_growth,
            'latest_receivables': latest_ar,
            'previous_receivables': prev_ar,
            'receivables_growth_pct': ar_growth,
            'capex_growth_pct': capex_growth_pct,
            'capex_peak': capex_peak,
            'fundamental_signal': fundamental_signal,
        }
    except Exception as exc:
        logger.exception("Fundamental analysis failed for %s: %s", ticker, exc)
        return None


def get_technical_exhaustion_signal(ticker: str) -> Optional[Dict[str, Any]]:
    """
    Detect technical exhaustion using 200‑day SMA and RSI divergence.

    Parameters
    ----------
    ticker : str
        Stock symbol to analyse.

    Returns
    -------
    dict or None
        A dictionary with metrics including current price, 200‑day SMA,
        percentage extension above the SMA, current RSI, max RSI in the
        past 30 days (excluding current), whether a new high was made, and
        a boolean ``technical_signal`` flag.
    """
    try:
        data = yf.Ticker(ticker).history(period="400d")
        if data.empty or 'Close' not in data.columns:
            logger.warning("No price data available for technical analysis on %s", ticker)
            return None
        closes = data['Close'].dropna()
        # Require at least 200 observations for 200‑day SMA
        if len(closes) < 200:
            logger.warning("Not enough data to compute 200‑day SMA for %s", ticker)
            return None
        # 200‑day SMA
        sma200 = closes.rolling(window=200).mean().iloc[-1]
        current_price = closes.iloc[-1]
        # Percent extension above SMA
        extension_pct = None
        if sma200 != 0:
            extension_pct = (current_price - sma200) / sma200
        # Compute RSI
        rsi_series = _compute_rsi(closes)
        current_rsi = float(rsi_series.iloc[-1]) if not np.isnan(rsi_series.iloc[-1]) else None
        # Determine 30‑day high and RSI divergence
        window = 30
        # Identify new high: current price >= max of last 30 closing prices
        if len(closes) >= window:
            recent_prices = closes.iloc[-window:]
            new_high = current_price >= recent_prices.max()
            # RSI values in the same window
            recent_rsi = rsi_series.iloc[-window:]
            # The maximum RSI *before* the current day
            prior_rsi_max = recent_rsi.iloc[:-1].max()
            # Check if RSI is lower than prior max (bearish divergence)
            rsi_divergence = (
                current_rsi is not None
                and not np.isnan(prior_rsi_max)
                and current_price >= recent_prices.max()
                and current_rsi < prior_rsi_max
            )
        else:
            new_high = False
            rsi_divergence = False
        # Over‑extended if price is >= 80% above 200‑day SMA
        overextended = False
        if extension_pct is not None and extension_pct >= 0.80:
            overextended = True
        technical_signal = overextended or rsi_divergence
        return {
            'ticker': ticker,
            'current_price': current_price,
            'sma200': sma200,
            'extension_pct': extension_pct,
            'current_rsi': current_rsi,
            'prior_window_rsi_max': None if 'prior_rsi_max' not in locals() else prior_rsi_max,
            'new_high': new_high,
            'rsi_divergence': rsi_divergence,
            'overextended': overextended,
            'technical_signal': technical_signal,
        }
    except Exception as exc:
        logger.exception("Technical analysis failed for %s: %s", ticker, exc)
        return None


def get_distribution_exit_signal(ticker: str) -> Optional[Dict[str, Any]]:
    """
    Count distribution days over the past month to gauge institutional selling.

    Parameters
    ----------
    ticker : str
        Stock symbol to analyse.

    Returns
    -------
    dict or None
        A dictionary with the number of distribution days in the past 20
        sessions, the 60‑day average volume, and a boolean
        ``distribution_signal`` flag if the count is >= 4.
    """
    try:
        # Fetch at least 60 days of price and volume data
        hist = yf.Ticker(ticker).history(period="90d")
        if hist.empty or not {'Close', 'Volume'}.issubset(hist.columns):
            logger.warning("No historical data for %s to compute distribution days", ticker)
            return None
        closes = hist['Close']
        volumes = hist['Volume']
        # Compute 60‑day average volume
        if len(volumes) < 60:
            avg_volume_60 = volumes.mean()
        else:
            avg_volume_60 = volumes.rolling(window=60).mean().iloc[-1]
        # Determine distribution days over the last 20 sessions (approx 4 weeks)
        distribution_count = 0
        for i in range(1, min(21, len(closes))):
            # Current and previous values
            current_close = closes.iloc[-i]
            prev_close = closes.iloc[-i - 1] if i + 1 <= len(closes) else None
            current_volume = volumes.iloc[-i]
            prev_volume = volumes.iloc[-i - 1] if i + 1 <= len(volumes) else None
            # Check criteria: price down and volume higher than previous and average
            if (
                prev_close is not None
                and current_close < prev_close
                and prev_volume is not None
                and current_volume > prev_volume
                and current_volume > avg_volume_60
            ):
                distribution_count += 1
        distribution_signal = distribution_count >= 4
        return {
            'ticker': ticker,
            'distribution_days_count': distribution_count,
            'avg_volume_60': float(avg_volume_60),
            'distribution_signal': distribution_signal,
        }
    except Exception as exc:
        logger.exception("Distribution day analysis failed for %s: %s", ticker, exc)
        return None


def get_sell_signals(tickers: List[str]) -> List[Dict[str, Any]]:
    """
    Aggregate all exit signals for a list of tickers.

    Parameters
    ----------
    tickers : list of str
        Stock symbols to evaluate.

    Returns
    -------
    list of dict
        Each entry summarises the fundamental, technical and distribution
        signals for a ticker and indicates whether any red flag was
        triggered.
    """
    results: List[Dict[str, Any]] = []
    for t in tickers:
        fundamental = get_fundamental_peak_signal(t)
        technical = get_technical_exhaustion_signal(t)
        distribution = get_distribution_exit_signal(t)
        if fundamental is None and technical is None and distribution is None:
            continue
        result: Dict[str, Any] = {'ticker': t}
        if fundamental:
            result.update({
                'fundamental_signal': fundamental.get('fundamental_signal'),
                'inventory_growth_pct': fundamental.get('inventory_growth_pct'),
                'revenue_growth_pct': fundamental.get('revenue_growth_pct'),
                'receivables_growth_pct': fundamental.get('receivables_growth_pct'),
                'capex_growth_pct': fundamental.get('capex_growth_pct'),
            })
        if technical:
            result.update({
                'technical_signal': technical.get('technical_signal'),
                'extension_pct': technical.get('extension_pct'),
                'current_rsi': technical.get('current_rsi'),
                'rsi_divergence': technical.get('rsi_divergence'),
                'overextended': technical.get('overextended'),
            })
        if distribution:
            result.update({
                'distribution_signal': distribution.get('distribution_signal'),
                'distribution_days_count': distribution.get('distribution_days_count'),
            })
        # Overall sell flag if any red flag triggered
        sell_flag = False
        for flag in [
            result.get('fundamental_signal'),
            result.get('technical_signal'),
            result.get('distribution_signal'),
        ]:
            if flag:
                sell_flag = True
                break
        result['sell_signal'] = sell_flag
        results.append(result)
    return results
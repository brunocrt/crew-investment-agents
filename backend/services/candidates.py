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

from typing import List


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
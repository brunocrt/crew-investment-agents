"""
Candidate universe model.
-------------------------

Stores the core and dynamically discovered tickers used by monitor mode.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, String, Text

from .base import Base


class Candidate(Base):
    """A ticker eligible for monitoring and recommendation analysis."""

    __tablename__ = "candidates"

    ticker = Column(String, primary_key=True)
    source = Column(String, nullable=False, default="core")
    status = Column(String, nullable=False, default="core")
    theme = Column(String, nullable=True)
    sector = Column(String, nullable=True)
    reason = Column(Text, nullable=True)
    discovery_score = Column(Float, nullable=True)
    liquidity_ok = Column(Boolean, nullable=False, default=True)
    last_discovered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

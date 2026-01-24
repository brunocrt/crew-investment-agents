"""
Data models for analyses and logs
--------------------------------

This module defines the SQLAlchemy models used to store analysis metadata and
logs generated during agent execution.  Persisting logs enables the frontend
to display historical execution traces and provides a simple audit trail of
agent behaviour.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .base import Base

class AnalysisStatus(str, Enum):
    """Enumeration of possible analysis states."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

class Analysis(Base):
    """
    Represents a single analysis run.  Each analysis corresponds to a set of
    tasks executed by our crew of agents.  The recommendation and summary
    fields are populated once the run completes.
    """

    __tablename__ = "analyses"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    ticker = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status = Column(String, default=AnalysisStatus.PENDING)
    recommendation = Column(String, nullable=True)
    summary = Column(Text, nullable=True)

    logs = relationship("LogEntry", back_populates="analysis", cascade="all, delete-orphan")

class LogEntry(Base):
    """
    Stores individual log messages associated with an analysis.  These records
    are streamed to the frontend via websockets in real time.
    """

    __tablename__ = "log_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    analysis_id = Column(String, ForeignKey("analyses.id"), index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    message = Column(Text, nullable=False)

    analysis = relationship("Analysis", back_populates="logs")
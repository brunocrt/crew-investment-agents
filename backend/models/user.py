"""
Application user model.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy import Text

from .base import Base


class User(Base):
    """A local application user."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, unique=True, nullable=False, index=True)
    display_name = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="user", nullable=False)
    preferences = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

"""User model for authentication."""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    supabase_user_id = Column(String(64), unique=True, nullable=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="student")  # "student" or "teacher"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

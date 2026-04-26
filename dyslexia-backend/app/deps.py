"""Shared dependencies for auth enforcement."""

from __future__ import annotations

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.core.supabase_auth import SupabaseAuthError, supabase_get_user


def get_current_user(
    authorization: str | None = Header(None, alias="Authorization"),
    db: Session = Depends(get_db),
) -> User:
    """
    Require valid Supabase session and return mapped local user.
    Use as Depends(get_current_user) on protected routes.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[7:].strip()
    try:
        sb_user = supabase_get_user(token)
    except SupabaseAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))

    sb_uid = str(sb_user.get("id") or "").strip()
    email = str(sb_user.get("email") or "").strip().lower()
    if not sb_uid or not email:
        raise HTTPException(status_code=401, detail="Invalid session user payload")

    user = db.query(User).filter(User.supabase_user_id == sb_uid).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user and not user.supabase_user_id:
            user.supabase_user_id = sb_uid
            db.add(user)
            db.commit()
            db.refresh(user)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

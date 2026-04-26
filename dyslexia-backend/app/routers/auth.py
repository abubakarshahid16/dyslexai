"""Authentication routes."""

from __future__ import annotations
import os

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import verify_password
from app.core.supabase_auth import (
    SupabaseAuthError,
    supabase_admin_create_user,
    supabase_admin_enabled,
    supabase_get_user,
    supabase_login,
    supabase_logout,
    supabase_signup,
)
from app.database import get_db
from app.models.user import User
from app.models.student import Student

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Schemas ─────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "student"  # "student" or "teacher"
    teacher_code: str | None = None  # Required when role == "teacher"


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserMe(BaseModel):
    id: int
    name: str
    email: str
    role: str
    student_id: str | None = None
    created_at: str


def _normalize_role(value: str | None) -> str:
    role = (value or "").strip().lower()
    if role not in ("student", "teacher"):
        raise HTTPException(status_code=400, detail="Role must be 'student' or 'teacher'")
    return role


def _get_student_id(db: Session, user: User) -> str | None:
    if (user.role or "student") != "student":
        return None
    student = db.query(Student).filter(Student.user_id == user.id).first()
    return student.id if student else None


def _ensure_local_user_from_supabase(
    db: Session,
    *,
    sb_user: dict,
    fallback_name: str,
    fallback_role: str,
) -> User:
    sb_uid = str(sb_user.get("id") or "").strip()
    email = str(sb_user.get("email") or "").strip().lower()
    if not sb_uid or not email:
        raise HTTPException(status_code=401, detail="Invalid Supabase user payload")

    meta = sb_user.get("user_metadata") if isinstance(sb_user.get("user_metadata"), dict) else {}
    role = (str(meta.get("role") or "").strip().lower() or fallback_role)
    if role not in ("student", "teacher"):
        role = fallback_role

    name = str(meta.get("name") or "").strip() or fallback_name or email.split("@")[0]

    user = db.query(User).filter(User.supabase_user_id == sb_uid).first()
    if user:
        changed = False
        if user.email != email:
            user.email = email
            changed = True
        if name and user.name != name:
            user.name = name
            changed = True
        if role and user.role != role:
            user.role = role
            changed = True
        if changed:
            db.add(user)
            db.commit()
            db.refresh(user)
        return user

    user = db.query(User).filter(User.email == email).first()
    if user:
        user.supabase_user_id = sb_uid
        if name and user.name != name:
            user.name = name
        if role and user.role != role:
            user.role = role
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user = User(
            supabase_user_id=sb_uid,
            name=name,
            email=email,
            password_hash="supabase-managed",
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if (user.role or "student") == "student":
        student = db.query(Student).filter(Student.user_id == user.id).first()
        if not student:
            student = Student(name=user.name, user_id=user.id)
            db.add(student)
            db.commit()

    return user


def _ensure_supabase_session_for_local_user(
    db: Session,
    *,
    user: User,
    password: str,
) -> tuple[str, str]:
    """Create or attach a Supabase account for an existing local user."""
    if not supabase_admin_enabled():
        raise SupabaseAuthError(
            "Legacy account detected, but SUPABASE_SERVICE_ROLE_KEY is not set so it cannot be migrated yet."
        )

    display_name = (user.name or "").strip() or user.email.split("@")[0]
    role = (user.role or "student").strip().lower()
    if role not in ("student", "teacher"):
        role = "student"

    try:
        admin_user = supabase_admin_create_user(
            email=user.email,
            password=password,
            name=display_name,
            role=role,
        )
        sb_user = admin_user.get("user") if isinstance(admin_user.get("user"), dict) else admin_user
    except SupabaseAuthError as e:
        message = str(e).lower()
        if "already registered" in message or "already exists" in message or "duplicate" in message:
            sb_user = None
        else:
            raise

    if sb_user:
        _ensure_local_user_from_supabase(
            db,
            sb_user=sb_user,
            fallback_name=display_name,
            fallback_role=role,
        )

    login_payload = supabase_login(email=user.email, password=password)
    access_token = str(login_payload.get("access_token") or "").strip()
    token_type = str(login_payload.get("token_type") or "bearer").strip() or "bearer"
    if not access_token:
        raise SupabaseAuthError("Supabase did not return an access token for the migrated account")
    return access_token, token_type


# ── Routes ──────────────────────────────────────────────────────────────────

@router.post("/signup", response_model=AuthResponse)
def signup(data: SignupRequest, db: Session = Depends(get_db)):
    """Register a new user in Supabase and map/create local app user."""
    email = (data.email or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email")
    role = _normalize_role(data.role)
    if role == "teacher":
        secret = os.getenv("TEACHER_SECRET_CODE", "TEACH2024").strip()
        if not data.teacher_code or data.teacher_code.strip() != secret:
            raise HTTPException(status_code=403, detail="Invalid teacher access code")

    display_name = (data.name or "").strip()

    if supabase_admin_enabled():
        try:
            admin_user = supabase_admin_create_user(
                email=email,
                password=data.password,
                name=display_name,
                role=role,
            )
            sb_user = admin_user.get("user") if isinstance(admin_user.get("user"), dict) else admin_user
        except SupabaseAuthError as e:
            raise HTTPException(status_code=400, detail=str(e))

        try:
            login_payload = supabase_login(email=email, password=data.password)
        except SupabaseAuthError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Account created in Supabase, but immediate sign-in failed: {e}",
            )
        access_token = str(login_payload.get("access_token") or "").strip()
        token_type = str(login_payload.get("token_type") or "bearer").strip() or "bearer"
        if not access_token:
            raise HTTPException(status_code=400, detail="Supabase did not return an access token after signup")
    else:
        try:
            signup_payload = supabase_signup(
                email=email,
                password=data.password,
                name=display_name,
                role=role,
            )
        except SupabaseAuthError as e:
            raise HTTPException(status_code=400, detail=str(e))

        access_token = str(signup_payload.get("access_token") or "").strip()
        token_type = str(signup_payload.get("token_type") or "bearer").strip() or "bearer"
        sb_user = signup_payload.get("user") if isinstance(signup_payload.get("user"), dict) else None
        if sb_user is None:
            raise HTTPException(
                status_code=400,
                detail="Supabase signup succeeded but no user returned. Check email confirmation settings.",
            )

        if not access_token:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Supabase signup requires email confirmation before login. "
                    "Either disable email confirmation in Supabase Auth or set SUPABASE_SERVICE_ROLE_KEY."
                ),
            )

    user = _ensure_local_user_from_supabase(
        db,
        sb_user=sb_user,
        fallback_name=display_name,
        fallback_role=role,
    )

    student_id = _get_student_id(db, user)

    return AuthResponse(
        access_token=access_token,
        token_type=token_type,
        user={
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "student_id": student_id,
            "created_at": user.created_at.isoformat() if user.created_at else "",
        },
    )


@router.post("/login", response_model=AuthResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate with Supabase, with legacy local-password fallback for old users."""
    email = (data.email or "").strip().lower()
    local_user = db.query(User).filter(User.email == email).first()

    try:
        login_payload = supabase_login(email=email, password=data.password)
    except SupabaseAuthError as e:
        legacy_password_ok = bool(
            local_user
            and local_user.password_hash
            and local_user.password_hash != "supabase-managed"
            and verify_password(data.password, local_user.password_hash)
        )
        if not legacy_password_ok:
            raise HTTPException(status_code=401, detail=str(e))

        if not local_user:
            raise HTTPException(status_code=401, detail="Legacy account not found")

        try:
            access_token, token_type = _ensure_supabase_session_for_local_user(
                db,
                user=local_user,
                password=data.password,
            )
        except SupabaseAuthError as legacy_error:
            raise HTTPException(status_code=401, detail=str(legacy_error))

        sb_user = supabase_get_user(access_token)
        user = _ensure_local_user_from_supabase(
            db,
            sb_user=sb_user,
            fallback_name=local_user.name,
            fallback_role=local_user.role or "student",
        )
        student_id = _get_student_id(db, user)
        return AuthResponse(
            access_token=access_token,
            token_type=token_type,
            user={
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role,
                "student_id": student_id,
                "created_at": user.created_at.isoformat() if user.created_at else "",
            },
        )

    access_token = str(login_payload.get("access_token") or "").strip()
    token_type = str(login_payload.get("token_type") or "bearer").strip() or "bearer"
    sb_user = login_payload.get("user") if isinstance(login_payload.get("user"), dict) else None
    if not access_token or sb_user is None:
        raise HTTPException(status_code=401, detail="Invalid login response from Supabase")

    meta = sb_user.get("user_metadata") if isinstance(sb_user.get("user_metadata"), dict) else {}
    fallback_role = str(meta.get("role") or "").strip().lower() or "student"
    if fallback_role not in ("student", "teacher"):
        fallback_role = "student"

    user = _ensure_local_user_from_supabase(
        db,
        sb_user=sb_user,
        fallback_name=str(meta.get("name") or "").strip() or email.split("@")[0],
        fallback_role=fallback_role,
    )
    student_id = _get_student_id(db, user)

    return AuthResponse(
        access_token=access_token,
        token_type=token_type,
        user={
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "student_id": student_id,
            "created_at": user.created_at.isoformat() if user.created_at else "",
        },
    )


@router.get("/me", response_model=UserMe)
def me(
    authorization: str | None = Header(None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    """Return current app user mapped from valid Supabase session."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[7:].strip()
    try:
        sb_user = supabase_get_user(token)
    except SupabaseAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))

    meta = sb_user.get("user_metadata") if isinstance(sb_user.get("user_metadata"), dict) else {}
    fallback_name = str(meta.get("name") or "").strip() or str(sb_user.get("email") or "").split("@")[0]
    fallback_role = str(meta.get("role") or "").strip().lower() or "student"
    if fallback_role not in ("student", "teacher"):
        fallback_role = "student"

    user = _ensure_local_user_from_supabase(
        db,
        sb_user=sb_user,
        fallback_name=fallback_name,
        fallback_role=fallback_role,
    )

    student_id = _get_student_id(db, user)

    return UserMe(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role or "student",
        student_id=student_id,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


@router.post("/logout")
def logout(authorization: str | None = Header(None, alias="Authorization")):
    """Invalidate Supabase session token when present."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        if token:
            try:
                supabase_logout(token)
            except SupabaseAuthError:
                # Keep logout idempotent for UX.
                pass
    return {"message": "Logged out"}

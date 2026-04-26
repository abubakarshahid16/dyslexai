"""Dashboard and History routes. All scoped to the logged-in user."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.ocr_run import OCRRun
from app.models.student import Student
from app.models.user import User

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _path_to_url_path(file_path: str | None) -> str | None:
    if not file_path:
        return None
    normalized = str(file_path).replace("\\", "/")
    idx = normalized.find("/data/")
    if idx != -1:
        return normalized[idx:]
    if "data" in normalized:
        parts = normalized.split("/")
        try:
            data_idx = parts.index("data")
            return "/data/" + "/".join(parts[data_idx + 1:])
        except ValueError:
            pass
    return None


@router.get("/overview")
def get_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dashboard overview metrics scoped to current user's OCR runs."""
    base = db.query(OCRRun).filter(OCRRun.user_id == current_user.id)
    total_runs = base.count()
    total_students = db.query(func.count(Student.id)).scalar() or 0
    rows = base.with_entities(func.avg(OCRRun.avg_confidence).label("avg_conf")).first()
    avg_confidence = float(rows.avg_conf or 0) if rows else 0.0
    corrected_count = base.filter(
        OCRRun.corrected_text.isnot(None),
        OCRRun.corrected_text != "",
    ).count()
    avg_correction_ratio = corrected_count / total_runs if total_runs else 0
    return {
        "total_students": total_students,
        "total_uploads": total_runs,
        "total_runs": total_runs,
        "avg_confidence": round(avg_confidence, 4),
        "avg_correction_ratio": round(avg_correction_ratio, 4),
    }


@router.get("/history")
def get_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recent OCR runs for the current user only."""
    runs = (
        db.query(OCRRun)
        .filter(OCRRun.user_id == current_user.id)
        .order_by(OCRRun.created_at.desc())
        .limit(100)
        .all()
    )

    student_ids = [str(r.student_id) for r in runs if r.student_id]
    student_name_map: dict[str, str] = {}
    if student_ids:
        for sid, sname in (
            db.query(Student.id, Student.name)
            .filter(Student.id.in_(student_ids))
            .all()
        ):
            student_name_map[str(sid)] = sname

    payload: list[dict] = []
    for r in runs:
        corrected_text = (r.corrected_text or r.reviewed_text or "").strip()

        # Keep only runs with usable corrected text.
        if not corrected_text:
            continue

        payload.append(
            {
                "run_id": r.id,
                "student_id": int(r.student_id) if r.student_id and str(r.student_id).isdigit() else None,
                "student_name": student_name_map.get(str(r.student_id), None),
                "created_at": r.created_at.isoformat() if r.created_at else "",
                "corrected_text": corrected_text,
                "avg_confidence": r.avg_confidence or 0,
                "suspicious_lines": r.suspicious_lines or 0,
                "review_status": r.review_status,
                "reviewed_text": r.reviewed_text,
                "original_image_path": r.original_image_path,
                "original_image_url": _path_to_url_path(r.original_image_path),
            }
        )
    return payload


@router.get("/students/progress")
def get_student_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Student progress for dashboard. OCR run counts scoped to current user."""
    students = db.query(Student).all()
    result = []
    for s in students:
        cnt = (
            db.query(func.count(OCRRun.id))
            .filter(OCRRun.user_id == current_user.id, OCRRun.student_id == str(s.id))
            .scalar()
            or 0
        )
        result.append({
            "student_id": s.id,
            "student_name": s.name,
            "total_runs": cnt,
            "avg_confidence": 0,
            "avg_correction_ratio": 0,
        })
    return result

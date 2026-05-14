from datetime import datetime, timezone, timedelta, date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.deps import get_current_user
from app.models.student import Student
from app.models.user import User
from app.models.session import Session as SessionModel
from app.models.word_mastery import WordMastery
from app.schemas.student import StudentCreate, StudentResponse
import uuid

router = APIRouter(prefix="/students", tags=["Students"])


@router.get("/me", response_model=StudentResponse)
def get_my_student_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the Student profile linked to the currently logged-in student user."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only student users have an exercise profile")
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="No student profile linked to this account")
    return student


@router.get("/", response_model=list[StudentResponse])
def list_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Teachers see all students. Students see only their own profile."""
    if current_user.role == "student":
        student = db.query(Student).filter(Student.user_id == current_user.id).first()
        return [student] if student else []
    return db.query(Student).order_by(Student.name).all()


@router.post("/", response_model=StudentResponse)
def create_student(
    data: StudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student = Student(name=data.name, age=data.age)
    db.add(student)
    db.commit()
    db.refresh(student)
    return student

@router.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Collective dashboard stats for teachers."""
    total_students = db.query(func.count(Student.id)).scalar() or 0

    # All submitted sessions
    submitted = db.query(SessionModel).filter(SessionModel.score.isnot(None))
    total_sessions = submitted.count()

    avg_row = submitted.with_entities(func.avg(SessionModel.score)).first()
    average_score = round(float(avg_row[0] or 0), 3)

    # Students active today (completed at least one session today, UTC)
    # Use submitted_at (completion time). This avoids counting abandoned sessions
    # and works consistently across SQLite/Postgres.
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    active_today = (
        db.query(func.count(func.distinct(SessionModel.student_id)))
        .filter(SessionModel.submitted_at.isnot(None), SessionModel.submitted_at >= today_start)
        .scalar()
    ) or 0

    # Average sessions per student
    avg_sessions_per_student = round(total_sessions / total_students, 1) if total_students else 0

    return {
        "total_students": total_students,
        "total_sessions": total_sessions,
        "average_score": average_score,
        "active_today": active_today,
        "avg_sessions_per_student": avg_sessions_per_student,
    }


@router.get("/attendance")
def get_attendance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Per-student attendance: dates (last 30 days) when each student completed sessions.

    IMPORTANT: Use SQL `date(...)` instead of casting to Date, because SQLite's
    Date/DateTime casting is inconsistent and may yield NULL.
    """
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

    students = db.query(Student).order_by(Student.name).all()
    result = []
    for s in students:
        date_rows = (
            db.query(func.distinct(func.date(SessionModel.submitted_at)))
            .filter(
                SessionModel.student_id == s.id,
                SessionModel.submitted_at.isnot(None),
                SessionModel.submitted_at >= thirty_days_ago,
            )
            .all()
        )
        # row[0] is typically a 'YYYY-MM-DD' string (SQLite) or date (Postgres)
        normalized: list[str] = []
        for (day,) in date_rows:
            if not day:
                continue
            if isinstance(day, date):
                normalized.append(day.isoformat())
            else:
                normalized.append(str(day))
        dates = sorted(set(normalized))
        result.append({
            "student_id": s.id,
            "student_name": s.name,
            "dates": dates,
        })
    return result


@router.get("/me/attendance")
def get_my_attendance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Attendance for the logged-in student only (last 30 days, UTC).

    We intentionally do NOT reuse /students/attendance here to avoid exposing
    other students' activity to student accounts.
    """
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only student users can access their attendance")
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="No student profile linked to this account")

    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    date_rows = (
        db.query(func.distinct(func.date(SessionModel.submitted_at)))
        .filter(
            SessionModel.student_id == student.id,
            SessionModel.submitted_at.isnot(None),
            SessionModel.submitted_at >= thirty_days_ago,
        )
        .all()
    )

    normalized: list[str] = []
    for (day,) in date_rows:
        if not day:
            continue
        if isinstance(day, date):
            normalized.append(day.isoformat())
        else:
            normalized.append(str(day))

    return {"student_id": student.id, "student_name": student.name, "dates": sorted(set(normalized))}


@router.get("/{student_id}", response_model=StudentResponse)
def get_student(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student = db.query(Student).filter(Student.id == str(student_id)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@router.get("/{student_id}/mastery")
def get_mastery(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns all words this student has practiced,
    sorted from weakest to strongest.
    Frontend can use this to show a struggling words list.
    """
    sid = str(student_id)
    student = db.query(Student).filter(Student.id == sid).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    words = (
        db.query(WordMastery)
        .filter(WordMastery.student_id == sid)
        .order_by(WordMastery.mastery_score.asc())
        .all()
    )

    return {
        "student_id":   str(student_id),
        "student_name": student.name,
        "total_words_practiced": len(words),
        "words": [
            {
                "word":          wm.word,
                "mastery_score": round(wm.mastery_score, 3),
                "times_seen":    wm.times_seen,
                "times_correct": wm.times_correct,
                "status":        (
                    "mastered"    if wm.mastery_score >= 0.8  else
                    "improving"   if wm.mastery_score >= 0.5  else
                    "struggling"
                )
            }
            for wm in words
        ]
    }


@router.get("/{student_id}/stats")
def get_stats(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns a full progress report for this student.
    Dashboard uses this to show charts and summaries.
    """
    sid = str(student_id)
    student = db.query(Student).filter(Student.id == sid).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # all submitted sessions
    sessions = (
        db.query(SessionModel)
        .filter(
            SessionModel.student_id == sid,
            SessionModel.score.isnot(None)
        )
        .order_by(SessionModel.submitted_at.asc())
        .all()
    )

    # average score
    avg_score = (
        round(sum(s.score for s in sessions) / len(sessions), 3)
        if sessions else 0.0
    )

    # score trend — last 10 sessions
    score_trend = [round(s.score, 3) for s in sessions[-10:]]

    # word mastery breakdown
    all_words = db.query(WordMastery).filter(
        WordMastery.student_id == sid
    ).all()

    mastered   = [w.word for w in all_words if w.mastery_score >= 0.8]
    struggling = [w.word for w in all_words if w.mastery_score <  0.5]

    # collect all character errors across all sessions
    confusion_pairs = {}
    for s in sessions:
        for err in (s.char_errors or []):
            if err.get("error_type") in ("substitution", "reversal"):
                pair = f"{err.get('expected_char')} -> {err.get('actual_char')}"
                confusion_pairs[pair] = confusion_pairs.get(pair, 0) + 1

    # sort by most frequent
    top_confusions = sorted(
        confusion_pairs.items(), key=lambda x: x[1], reverse=True
    )[:5]

    # exercise type breakdown
    from app.models.exercise import Exercise
    session_exercises = (
        db.query(SessionModel.score, Exercise.type)
        .join(Exercise, SessionModel.exercise_id == Exercise.id)
        .filter(SessionModel.student_id == sid, SessionModel.score.isnot(None))
        .all()
    )
    
    type_scores = {}
    for score, ex_type in session_exercises:
        if ex_type not in type_scores:
            type_scores[ex_type] = []
        type_scores[ex_type].append(score)

    type_accuracy = {
        t: round(sum(scores) / len(scores), 3)
        for t, scores in type_scores.items()
    }

    return {
        "student_id":            str(student_id),
        "student_name":          student.name,
        "current_difficulty":    student.difficulty_level,
        "total_sessions":        len(sessions),
        "average_score":         avg_score,
        "score_trend":           score_trend,
        "words_mastered":        mastered,
        "words_struggling":      struggling,
        "total_words_practiced": len(all_words),
        "top_confusion_pairs":   [
            {"pattern": pair, "count": count}
            for pair, count in top_confusions
        ],
        "accuracy_by_type":      type_accuracy
    }
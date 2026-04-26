from __future__ import annotations

from datetime import datetime, timezone, timedelta
import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.deps import get_current_user
from app.models.assignment import Assignment
from app.models.assignment_exercise import AssignmentExercise
from app.models.exercise import Exercise
from app.models.session import Session as SessionModel
from app.models.student import Student
from app.models.user import User
from app.models.word_mastery import WordMastery
from app.services.llm import generate_exercises as llm_generate

router = APIRouter(prefix="/assignments", tags=["Assignments"])


ExerciseType = Literal["word_typing", "sentence_typing", "handwriting", "tracing"]
WORD_PATTERN = re.compile(r"^[a-z]+(?:[-'][a-z]+)*$", re.IGNORECASE)
WORD_TOKEN_PATTERN = re.compile(r"[a-z]+(?:[-'][a-z]+)*", re.IGNORECASE)


def _normalize_expected(expected: str) -> str:
    return " ".join((expected or "").strip().split()).lower()


def _validate_expected_for_type(ex_type: ExerciseType, expected: str) -> str:
    normalized = _normalize_expected(expected)
    if not normalized:
        raise HTTPException(status_code=400, detail=f"{ex_type} expected answer is required")

    token_count = len(WORD_TOKEN_PATTERN.findall(normalized))
    is_single_word = bool(WORD_PATTERN.fullmatch(normalized))

    if ex_type == "word_typing" and not is_single_word:
        raise HTTPException(
            status_code=400,
            detail="word_typing expected answer must be a single word (no sentence)",
        )

    if ex_type == "sentence_typing" and token_count < 2:
        raise HTTPException(
            status_code=400,
            detail="sentence_typing expected answer must be a sentence (at least two words)",
        )

    if ex_type == "tracing" and not is_single_word:
        raise HTTPException(
            status_code=400,
            detail="tracing expected answer must be a single letter or single word",
        )

    return normalized


class CustomExercise(BaseModel):
    type: ExerciseType
    content: str
    expected: str
    target_words: list[str] = Field(default_factory=list)
    difficulty: int = 1


class GeneratedExerciseSpec(BaseModel):
    type: ExerciseType
    words: list[str] = Field(default_factory=list, description="Optional seed words/letters (if empty, uses student's weak words)")
    difficulty: int = 1
    student_age: int = 10
    count: int = 3


class AssignmentCreate(BaseModel):
    student_id: str
    title: str
    description: str | None = None
    due_at: datetime | None = None

    mode: Literal["custom", "generate"]
    custom_exercises: list[CustomExercise] = Field(default_factory=list)
    generate: GeneratedExerciseSpec | None = None


@router.post("")
def create_assignment(
    payload: AssignmentCreate,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create assignments")

    student = db.query(Student).filter(Student.id == str(payload.student_id)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    exercises_to_attach: list[Exercise] = []

    if payload.mode == "custom":
        if not payload.custom_exercises:
            raise HTTPException(status_code=400, detail="Provide at least one custom exercise")
        for ex in payload.custom_exercises:
            content = (ex.content or "").strip()
            if not content:
                raise HTTPException(status_code=400, detail=f"{ex.type} content is required")
            expected = _validate_expected_for_type(ex.type, ex.expected)
            new_ex = Exercise(
                type=ex.type,
                content=content,
                expected=expected,
                target_words=[w.strip().lower() for w in (ex.target_words or []) if w.strip()],
                difficulty=int(ex.difficulty or 1),
                age_group="all",
                source="teacher_assignment",
            )
            exercises_to_attach.append(new_ex)
    else:
        spec = payload.generate
        if not spec:
            raise HTTPException(status_code=400, detail="Missing generate spec")

        # If teacher didn't provide seed words, auto-pick from student's weak words.
        seed_words = [w.strip().lower() for w in (spec.words or []) if w.strip()]
        if not seed_words:
            weak = (
                db.query(WordMastery.word)
                .filter(WordMastery.student_id == str(student.id), WordMastery.mastery_score < 0.6)
                .order_by(WordMastery.mastery_score.asc())
                .limit(8)
                .all()
            )
            seed_words = [w for (w,) in weak if w]
            # Fallback if no mastery data yet
            if not seed_words:
                seed_words = ["friend", "school", "brother", "father"]

        generated = llm_generate(
            weak_words=seed_words,
            difficulty=int(spec.difficulty or 1),
            student_age=int(spec.student_age or 10),
            count=int(spec.count or 3),
            force_type=spec.type,
        )
        if not generated:
            raise HTTPException(status_code=502, detail="LLM generation failed (check GROQ_API_KEY)")

        invalid_generated = 0
        for ex_data in generated:
            ex_type = str(ex_data.get("type") or spec.type)
            if ex_type != spec.type:
                invalid_generated += 1
                continue
            content = str(ex_data.get("content") or "").strip()
            if not content:
                invalid_generated += 1
                continue
            try:
                expected = _validate_expected_for_type(spec.type, str(ex_data.get("expected") or ""))
            except HTTPException:
                invalid_generated += 1
                continue
            new_ex = Exercise(
                type=spec.type,
                content=content,
                expected=expected,
                target_words=ex_data.get("target_words") or [],
                difficulty=int(spec.difficulty or 1),
                age_group="all",
                source="ai_generated",
            )
            exercises_to_attach.append(new_ex)

        if not exercises_to_attach:
            detail = "LLM generation returned invalid exercises for the selected type. Please try again."
            if invalid_generated:
                detail += f" Filtered {invalid_generated} invalid item(s)."
            raise HTTPException(status_code=400, detail=detail)

    assignment = Assignment(
        teacher_id=current_user.id,
        student_id=str(student.id),
        title=payload.title.strip(),
        description=(payload.description or None),
        due_at=payload.due_at,
    )
    db.add(assignment)
    for ex in exercises_to_attach:
        db.add(ex)
    db.flush()

    # Attach mapping rows (preserve order)
    for idx, ex in enumerate(exercises_to_attach):
        db.add(AssignmentExercise(assignment_id=assignment.id, exercise_id=ex.id, position=idx))
    db.commit()
    db.refresh(assignment)

    return {
        "id": assignment.id,
        "student_id": assignment.student_id,
        "title": assignment.title,
        "description": assignment.description,
        "due_at": assignment.due_at.isoformat() if assignment.due_at else None,
        "exercise_count": len(exercises_to_attach),
        "created_at": assignment.created_at.isoformat() if assignment.created_at else None,
    }


@router.get("")
def list_assignments(
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "teacher":
        items = db.query(Assignment).order_by(Assignment.created_at.desc()).all()
    else:
        student = db.query(Student).filter(Student.user_id == current_user.id).first()
        if not student:
            return []
        items = (
            db.query(Assignment)
            .filter(Assignment.student_id == student.id)
            .order_by(Assignment.created_at.desc())
            .all()
        )

    # Precompute completion counts per assignment:
    # - completed_exercises: distinct exercises completed (best for progress)
    # - completed_sessions: total submitted sessions (attempts)
    ids = [a.id for a in items]
    completed_sessions: dict[int, int] = {}
    completed_exercises: dict[int, set[str]] = {}
    if ids:
        rows = (
            db.query(SessionModel.assignment_id, SessionModel.exercise_id, SessionModel.submitted_at, SessionModel.score)
            .filter(SessionModel.assignment_id.in_(ids), SessionModel.score.isnot(None))
            .order_by(SessionModel.submitted_at.asc())
            .all()
        )
        last_score_by_ex: dict[int, dict[str, float]] = {}
        for aid, ex_id, _submitted_at, score in rows:
            if aid is None:
                continue
            completed_sessions[aid] = completed_sessions.get(aid, 0) + 1
            completed_exercises.setdefault(aid, set()).add(str(ex_id))
            if score is not None:
                last_score_by_ex.setdefault(int(aid), {})[str(ex_id)] = float(score)

    # Exercise counts
    ex_counts: dict[int, int] = {}
    if ids:
        rows2 = (
            db.query(AssignmentExercise.assignment_id)
            .filter(AssignmentExercise.assignment_id.in_(ids))
            .all()
        )
        for (aid,) in rows2:
            ex_counts[aid] = ex_counts.get(aid, 0) + 1

    # Assignment exercise types (unique) for progress summaries
    types_by_assignment: dict[int, set[str]] = {}
    if ids:
        type_rows = (
            db.query(AssignmentExercise.assignment_id, Exercise.type)
            .join(Exercise, Exercise.id == AssignmentExercise.exercise_id)
            .filter(AssignmentExercise.assignment_id.in_(ids))
            .all()
        )
        for aid, ex_type in type_rows:
            types_by_assignment.setdefault(int(aid), set()).add(str(ex_type))

    # Include student name for teacher listing
    student_map: dict[str, str] = {}
    if current_user.role == "teacher":
        sids = list({a.student_id for a in items})
        if sids:
            for s in db.query(Student).filter(Student.id.in_(sids)).all():
                student_map[s.id] = s.name

    return [
        {
            "id": a.id,
            "student_id": a.student_id,
            "student_name": student_map.get(a.student_id),
            "title": a.title,
            "description": a.description,
            "due_at": a.due_at.isoformat() if a.due_at else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "exercise_count": ex_counts.get(a.id, 0),
            "completed_sessions": completed_sessions.get(a.id, 0),
            "completed_exercises": len(completed_exercises.get(a.id, set())),
            "types": sorted(types_by_assignment.get(a.id, set())),
            "avg_score": (
                round(
                    (sum(last_score_by_ex.get(a.id, {}).values()) / max(1, len(last_score_by_ex.get(a.id, {})))),
                    3
                )
                if last_score_by_ex.get(a.id) else None
            ),
        }
        for a in items
    ]


@router.get("/{assignment_id}")
def get_assignment(
    assignment_id: int,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if current_user.role != "teacher":
        student = db.query(Student).filter(Student.user_id == current_user.id).first()
        if not student or student.id != assignment.student_id:
            raise HTTPException(status_code=403, detail="Not allowed")

    # Exercises in order
    links = (
        db.query(AssignmentExercise)
        .filter(AssignmentExercise.assignment_id == assignment.id)
        .order_by(AssignmentExercise.position.asc())
        .all()
    )
    ex_ids = [l.exercise_id for l in links]
    ex_map = {e.id: e for e in db.query(Exercise).filter(Exercise.id.in_(ex_ids)).all()} if ex_ids else {}

    # Session attempts/results for this assignment (submitted)
    submitted_sessions = (
        db.query(SessionModel)
        .filter(
            SessionModel.assignment_id == assignment.id,
            SessionModel.score.isnot(None),
        )
        .order_by(SessionModel.submitted_at.asc())
        .all()
    )
    attempts_by_ex: dict[str, list[SessionModel]] = {}
    for s in submitted_sessions:
        attempts_by_ex.setdefault(str(s.exercise_id), []).append(s)
    completed_exercise_ids = set(attempts_by_ex.keys())

    return {
        "id": assignment.id,
        "student_id": assignment.student_id,
        "title": assignment.title,
        "description": assignment.description,
        "due_at": assignment.due_at.isoformat() if assignment.due_at else None,
        "created_at": assignment.created_at.isoformat() if assignment.created_at else None,
        "exercises": [
            {
                "id": ex_map[l.exercise_id].id,
                "type": ex_map[l.exercise_id].type,
                "content": ex_map[l.exercise_id].content,
                "expected": ex_map[l.exercise_id].expected,
                "target_words": ex_map[l.exercise_id].target_words or [],
                "difficulty": ex_map[l.exercise_id].difficulty,
                "completed": l.exercise_id in completed_exercise_ids,
                "attempts": len(attempts_by_ex.get(str(l.exercise_id), [])),
                "last_result": (
                    {
                        "score": attempts_by_ex[str(l.exercise_id)][-1].score,
                        "feedback": attempts_by_ex[str(l.exercise_id)][-1].feedback,
                        "student_response": attempts_by_ex[str(l.exercise_id)][-1].student_response,
                        "submitted_at": attempts_by_ex[str(l.exercise_id)][-1].submitted_at.isoformat()
                        if attempts_by_ex[str(l.exercise_id)][-1].submitted_at else None,
                    }
                    if attempts_by_ex.get(str(l.exercise_id)) else None
                ),
            }
            for l in links
            if l.exercise_id in ex_map
        ],
    }


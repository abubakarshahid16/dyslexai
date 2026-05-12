from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List

from app.database import get_db
from app.deps import get_current_user
from app.models.exercise import Exercise
from app.models.user import User
from app.models.student import Student
from app.models.word_mastery import WordMastery
from app.schemas.exercise import ExerciseCreate, ExerciseResponse
import uuid, random
from app.services.llm import generate_exercises as llm_generate

router = APIRouter(prefix="/exercises", tags=["Exercises"])


@router.post("/", response_model=ExerciseResponse)
def create_exercise(
    data: ExerciseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exercise = Exercise(**data.model_dump())
    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return exercise


@router.get("/", response_model=List[ExerciseResponse])
def list_exercises(
    difficulty: Optional[int] = Query(None),
    type:       Optional[str] = Query(None),
    db:         Session       = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Exercise)
    if difficulty:
        query = query.filter(Exercise.difficulty == difficulty)
    if type:
        query = query.filter(Exercise.type == type)
    return query.all()


def get_weak_words(db, student_id) -> set:
    """Return words where mastery score is below 0.5."""
    sid = str(student_id)
    weak = db.query(WordMastery).filter(
        WordMastery.student_id == sid,
        WordMastery.mastery_score < 0.5
    ).all()
    return {wm.word.lower() for wm in weak}


def get_confused_letters(db, student_id) -> set:
    """
    Scan recent session char_errors for reversal/substitution errors.
    Returns a set of letters the student is consistently confusing
    so the adaptive engine can recommend tracing exercises for them.
    """
    sid = str(student_id)
    from app.models.session import Session as SessionModel
    recent_sessions = (
        db.query(SessionModel)
        .filter(
            SessionModel.student_id == sid,
            SessionModel.char_errors.isnot(None)
        )
        .order_by(SessionModel.submitted_at.desc())
        .limit(20)
        .all()
    )
    letter_error_counts = {}
    for s in recent_sessions:
        for err in (s.char_errors or []):
            if err.get("error_type") in ("reversal", "substitution"):
                for ch in [err.get("expected_char", ""), err.get("actual_char", "")]:
                    if ch and len(ch) == 1 and ch.isalpha():
                        letter_error_counts[ch] = letter_error_counts.get(ch, 0) + 1
    # only letters that appeared in errors 2+ times are considered confused
    return {letter for letter, count in letter_error_counts.items() if count >= 2}


def get_recent_exercise_ids(db, student_id, n=5) -> set:
    """Return IDs of the last n exercises this student did."""
    sid = str(student_id)
    from app.models.session import Session as SessionModel
    recent = (
        db.query(SessionModel.exercise_id)
        .filter(SessionModel.student_id == sid)
        .order_by(SessionModel.started_at.desc())
        .limit(n)
        .all()
    )
    return {row.exercise_id for row in recent}


def weighted_choice(pools: list):
    """
    Pick one exercise from weighted pools.
    pools = [(list_of_exercises, weight), ...]
    Skips empty pools and redistributes weight automatically.
    """
    non_empty = [(pool, weight) for pool, weight in pools if pool]
    if not non_empty:
        return None

    total = sum(w for _, w in non_empty)
    rand  = random.uniform(0, total)
    cumulative = 0.0
    for pool, weight in non_empty:
        cumulative += weight
        if rand <= cumulative:
            return random.choice(pool)
    return random.choice(non_empty[-1][0])


def is_short_handwriting_item(ex: Exercise) -> bool:
    """Handwriting exercises must fit on one line: one short sentence or one word."""
    if ex.type != "handwriting":
        return True
    text = (ex.expected or "").strip()
    if not text or "\n" in text:
        return False
    return len(text.split()) <= 5


@router.get("/next", response_model=ExerciseResponse)
def get_next_exercise(
    student_id: uuid.UUID,
    type:       Optional[str] = Query(None, description="Filter by exercise type: word_typing, sentence_typing, handwriting, tracing"),
    db:         Session       = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student = db.query(Student).filter(Student.id == str(student_id)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    level          = student.difficulty_level
    weak_words     = get_weak_words(db, student_id)
    recent_ids     = get_recent_exercise_ids(db, student_id, n=5)
    confused_letters = get_confused_letters(db, student_id)

    # ── Base query filtered by type if provided ───────────────────────
    base_query = db.query(Exercise).filter(Exercise.difficulty == level)
    if type:
        base_query = base_query.filter(Exercise.type == type)

    all_at_level   = base_query.all()
    fresh_at_level = [e for e in all_at_level if e.id not in recent_ids]
    fresh_at_level = [e for e in fresh_at_level if is_short_handwriting_item(e)]

    # Foundation mode for the first few sessions:
    # pick exercises that target common dyslexic confusions so the child starts strong.
    chosen = None
    if student.total_sessions < 2 and level == 1:
        confusable = ["b", "d", "p", "q", "m", "n", "f", "t", "r", "l"]

        def looks_confusable(ex: Exercise) -> bool:
            text = f"{ex.expected or ''} " + " ".join(ex.target_words or [])
            t = text.lower()
            return any(ch in t for ch in confusable)

        foundation_pool = [e for e in fresh_at_level if looks_confusable(e)]
        if foundation_pool:
            chosen = random.choice(foundation_pool)
        elif fresh_at_level:
            chosen = random.choice(fresh_at_level)

    # ── Struggle pool — exercises containing weak words ───────────────
    struggle_pool = [
        e for e in fresh_at_level
        if any(w in weak_words for w in (e.target_words or []))
    ]

    # ── Auto-generate if type filter active but struggle pool is empty ─
    # Edge case: student has weak words but no seeded exercises for those
    # words exist in the requested type. Generate them on the fly so the
    # student always gets targeted practice in the type they asked for.
    if type and weak_words and not struggle_pool:
        generated = llm_generate(
            weak_words  = list(weak_words),
            difficulty  = level,
            student_age = student.age or 10,
            count       = 3,
            force_type  = type
        )
        for ex_data in generated:
            new_ex = Exercise(
                type         = ex_data["type"],
                content      = ex_data["content"],
                expected     = ex_data["expected"],
                target_words = ex_data["target_words"],
                difficulty   = level,
                age_group    = "all",
                source       = "ai_generated"
            )
            db.add(new_ex)
            struggle_pool.append(new_ex)
        if generated:
            db.commit()

    # ── Cross-type letter tracing pool ───────────────────────────────
    # When the student is NOT explicitly requesting a type, inject tracing
    # exercises for letters they confuse across all exercise types.
    # This means poor performance in typing → tracing exercises suggested.
    letter_tracing_pool = []
    if not type and confused_letters:
        tracing_candidates = (
            db.query(Exercise)
            .filter(
                Exercise.type == "tracing",
                Exercise.difficulty <= level + 1
            )
            .all()
        )
        letter_tracing_pool = [
            e for e in tracing_candidates
            if e.id not in recent_ids
            and any(ch in confused_letters for ch in (e.expected or ""))
        ]

    # ── Consolidation pool — current level, no weak word overlap ──────
    level_pool = [e for e in fresh_at_level if e not in struggle_pool]

    # ── Stretch pool — one level above ────────────────────────────────
    stretch_query = db.query(Exercise).filter(Exercise.difficulty == level + 1)
    if type:
        stretch_query = stretch_query.filter(Exercise.type == type)
    stretch_pool = stretch_query.all()

    # ── Weighted selection ─────────────────────────────────────────────
    # If there are any weak words, prioritize them heavily to avoid repeating
    # already-mastered exercises.
    if not chosen:
        if struggle_pool:
            if letter_tracing_pool and not type:
                chosen = weighted_choice([
                    (struggle_pool,       0.60),
                    (letter_tracing_pool, 0.15),
                    (level_pool,          0.15),
                    (stretch_pool,        0.10),
                ])
            else:
                chosen = weighted_choice([
                    (struggle_pool, 0.65),
                    (level_pool,    0.25),
                    (stretch_pool,  0.10),
                ])
        else:
            # No weak words left: allow level progression.
            if letter_tracing_pool and not type:
                chosen = weighted_choice([
                    (letter_tracing_pool, 0.20),
                    (level_pool,          0.65),
                    (stretch_pool,        0.15),
                ])
            else:
                chosen = weighted_choice([
                    (level_pool,   0.70),
                    (stretch_pool, 0.30),
                ])

    # fallback — if all pools empty just return anything at level
    if not chosen:
        chosen = random.choice(all_at_level) if all_at_level else None

    # fallback — if type was requested but no exercises found at student's level,
    # return ANY pre-stored exercise of that type (any difficulty) so kids always have content
    if not chosen and type:
        any_type_exercises = [
            e for e in db.query(Exercise).filter(Exercise.type == type).all()
            if e.id not in recent_ids and is_short_handwriting_item(e)
        ]
        if any_type_exercises:
            chosen = random.choice(any_type_exercises)

    # final fallback — if still nothing, generate exercises with LLM
    # for the requested type so the student always has something to start with
    if not chosen and type:
        # use weak words if available, otherwise generate generic exercises for this type
        words_to_use = list(weak_words) if weak_words else ["cat", "dog", "run", "jump", "play"]
        generated = llm_generate(
            weak_words  = words_to_use,
            difficulty  = level,
            student_age = student.age or 10,
            count       = 3,
            force_type  = type
        )
        for ex_data in generated:
            new_ex = Exercise(
                type         = ex_data["type"],
                content      = ex_data["content"],
                expected     = ex_data["expected"],
                target_words = ex_data["target_words"],
                difficulty   = level,
                age_group    = "all",
                source       = "ai_generated"
            )
            db.add(new_ex)
        if generated:
            db.commit()
            chosen = new_ex  # return the last generated exercise

    if not chosen:
        raise HTTPException(status_code=404, detail="No exercises found for this student")

    chosen.times_served += 1
    db.commit()
    return chosen


@router.get("/{exercise_id}", response_model=ExerciseResponse)
def get_exercise(
    exercise_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ex = db.query(Exercise).filter(Exercise.id == str(exercise_id)).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return ex


@router.post("/generate")
def generate_for_student(
    student_id: uuid.UUID,
    type:       Optional[str] = Query(None, description="Restrict generated exercises to a specific type: word_typing, sentence_typing, handwriting, tracing"),
    db:         Session       = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate new exercises using the LLM targeting this student's weak words.
    Pass ?type=tracing (or any other type) to generate only that type.
    Omit type to generate a natural mix of all types.
    """
    student = db.query(Student).filter(Student.id == str(student_id)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    weak_words = list(get_weak_words(db, student_id))

    # For tracing with no weak words, fall back to confused letters
    if not weak_words and type == "tracing":
        confused = list(get_confused_letters(db, student_id))
        if confused:
            weak_words = confused

    if not weak_words:
        return {"message": "No weak words found. Student is doing well!", "generated": 0}

    exercises = llm_generate(
        weak_words  = weak_words,
        difficulty  = student.difficulty_level,
        student_age = student.age or 10,
        count       = 5,
        force_type  = type
    )

    if not exercises:
        return {"message": "Generation failed", "generated": 0}

    new_exercises = []
    for ex in exercises:
        new_ex = Exercise(
            type         = ex["type"],
            content      = ex["content"],
            expected     = ex["expected"],
            target_words = ex["target_words"],
            difficulty   = student.difficulty_level,
            age_group    = "all",
            source       = "ai_generated"
        )
        db.add(new_ex)
        new_exercises.append(new_ex)

    db.commit()

    return {
        "message":   f"Generated {len(new_exercises)} new exercises",
        "generated": len(new_exercises),
        "exercises": [
            {
                "type":         e.type,
                "content":      e.content,
                "target_words": e.target_words
            }
            for e in new_exercises
        ]
    }
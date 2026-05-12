from pydantic import BaseModel
from typing import Optional, List
import uuid

class SessionCreate(BaseModel):
    student_id: uuid.UUID
    exercise_id: uuid.UUID
    is_handwriting: Optional[bool] = False
    assignment_id: Optional[int] = None

class SessionSubmit(BaseModel):
    student_response: str
    duration_seconds: Optional[int] = None
    ocr_confidence: Optional[float] = None

class ErrorDetail(BaseModel):
    position: int
    expected_char: str
    actual_char: str
    error_type: str

class SessionResponse(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    exercise_id: uuid.UUID
    score: Optional[float]
    char_errors: Optional[List[ErrorDetail]]
    phonetic_score: Optional[float]
    is_handwriting: bool

    model_config = {"from_attributes": True}

class SubmitResponse(BaseModel):
    session_id: uuid.UUID
    score: float
    char_errors: list
    phonetic_score: float
    feedback: str
    new_difficulty_level: int
    words_updated: List[str]


class HandwritingSubmitResponse(SubmitResponse):
    """Same as SubmitResponse but includes OCR output."""
    recognized_text: str
    ocr_text: str
    ocr_confidence: float


class StrokeError(BaseModel):
    """Per-letter tracing accuracy sent by the frontend."""
    letter: str
    accuracy: float  # 0.0 to 1.0


class TracingSubmit(BaseModel):
    trace_score: float               # 0.0–1.0 overall accuracy, computed by frontend
    duration_seconds: Optional[int] = None
    stroke_errors: Optional[List[StrokeError]] = []


class TracingSubmitResponse(BaseModel):
    session_id: uuid.UUID
    score: float                     # same value as trace_score
    stroke_errors: list              # echoed back from request
    feedback: str
    new_difficulty_level: int
    words_updated: List[str]
    trace_score: float               # echoed back for frontend convenience
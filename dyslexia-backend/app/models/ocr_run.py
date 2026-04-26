"""OCR run model for Dashboard and History."""

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class OCRRun(Base):
    __tablename__ = "ocr_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    student_id = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    quality_mode = Column(String(64), default="quality_local")
    corrected_text = Column(Text, default="")
    avg_confidence = Column(Float, default=0.0)
    suspicious_lines = Column(Integer, default=0)
    review_status = Column(String(32), nullable=True)
    reviewed_text = Column(Text, nullable=True)
    original_image_path = Column(String(512), nullable=True)

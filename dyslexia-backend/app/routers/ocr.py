"""OCR processing — notebook pipeline (DocTR + TrOCR + layer1 + layer2 + Groq)."""

from __future__ import annotations

import io
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from PIL import Image
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models.ocr_run import OCRRun
from app.models.user import User
from app.services.llm import correct_ocr_text_with_image
from app.utils.diffing import levenshtein_ops

router = APIRouter(prefix="/api/ocr", tags=["ocr"])

_pipeline = None


def _get_pipeline():
    global _pipeline
    if _pipeline is None:
        from app.pipeline.notebook_pipeline import NotebookPipeline
        _pipeline = NotebookPipeline()
    return _pipeline


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


def _line_to_dict(line) -> dict:
    merged = line.merged_text or line.raw_text or ""
    corrected = line.corrected_text or ""
    return {
        "bbox": list(line.bbox),
        "raw_text": line.raw_text or "",
        "merged_text": merged or None,
        "corrected_text": corrected or None,
        "confidence": line.confidence,
        "source": line.source,
        "difficulty_tier": getattr(line, "difficulty_tier", None),
        "difficulty_score": getattr(line, "difficulty_score", None),
        "fallback_used": getattr(line, "fallback_used", False),
        "suspicious": getattr(line, "suspicious", False),
        "chosen_variant": getattr(line, "chosen_variant", None),
        "uncertainty_score": getattr(line, "uncertainty_score", 0.0),
        "candidate_scores": getattr(line, "candidate_scores", []) or [],
        "edit_ops": levenshtein_ops(merged, corrected),
    }


@router.post("/process")
async def process_upload(
    file: UploadFile = File(...),
    student_id: int | str | None = Form(default=None),
    quality_mode: str = Form(default="quality_local"),
    reference_text: str | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Process handwriting image — notebook pipeline (DocTR + TrOCR + layer1 + layer2 + Groq)."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file name")

    allowed = {"image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"}
    if file.content_type and file.content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type '{file.content_type}'. Use jpg, png, webp, bmp, or tiff."
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    settings = get_settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "upload.png").suffix.lower() or ".png"
    safe_name = Path(file.filename or "upload.png").name
    original_path = settings.upload_dir / f"{Path(safe_name).stem}_{abs(hash(safe_name))}{suffix}"
    with open(original_path, "wb") as f:
        f.write(image_bytes)

    try:
        grayscale = Image.open(io.BytesIO(image_bytes)).convert("L")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        grayscale.save(f, format="PNG")
        path = f.name

    try:
        pipeline = _get_pipeline()
        result = pipeline.process_image(path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")
    finally:
        Path(path).unlink(missing_ok=True)

    # Final correction pass: cross-check rough OCR text with original image using Groq vision.
    vision_applied = False
    vision_error: str | None = None
    final_corrected_text = result.raw_text or ""
    if (result.raw_text or "").strip():
        try:
            vision_corrected = correct_ocr_text_with_image(
                rough_text=result.raw_text or "",
                image_path=str(original_path),
            )
            if (vision_corrected or "").strip():
                final_corrected_text = vision_corrected.strip()
                vision_applied = True
        except Exception as e:
            vision_error = str(e)

    result.corrected_text = final_corrected_text

    lines_json = [_line_to_dict(line) for line in result.lines]
    avg_conf = sum(line.confidence for line in result.lines) / max(1, len(result.lines)) if result.lines else 0
    suspicious = sum(1 for line in result.lines if getattr(line, "suspicious", False))

    run = OCRRun(
        user_id=current_user.id,
        student_id=str(student_id) if student_id is not None else None,
        quality_mode=quality_mode or "quality_local",
        corrected_text=final_corrected_text,
        avg_confidence=avg_conf,
        suspicious_lines=suspicious,
        original_image_path=str(original_path),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    metadata = dict(result.metadata or {})
    metadata["groq_vision_applied"] = vision_applied
    if vision_error:
        metadata["groq_vision_error"] = vision_error
    if reference_text and reference_text.strip():
        raw = result.raw_text or ""
        corrected = final_corrected_text
        cer = sum(c != r for c, r in zip(corrected, raw)) / max(1, len(raw)) if raw else 0
        metadata["transcript_evaluation"] = {
            "reference_length": len(reference_text),
            "raw_length": len(raw),
            "corrected_length": len(corrected),
            "cer_approx": round(cer, 4),
        }

    original_url = _path_to_url_path(str(original_path))
    triage_dict = (
        {
            "blur_score": result.triage.blur_score,
            "brightness": result.triage.brightness,
            "contrast": result.triage.contrast,
            "is_low_contrast": result.triage.is_low_contrast,
            "estimated_skew_angle": result.triage.estimated_skew_angle,
            "should_threshold": result.triage.should_threshold,
            "should_deskew": result.triage.should_deskew,
        }
        if result.triage else {}
    )

    return {
        "run_id": run.id,
        "upload_id": run.id,
        "student_id": int(student_id) if student_id is not None and str(student_id).isdigit() else None,
        "corrected_text": final_corrected_text,
        "metadata": metadata,
        "original_image_path": str(original_path),
        "original_image_url": original_url,
        "annotated_image_path": None,
        "preprocessed_image_path": None,
        "correction_layer1": result.correction_layer1,
        "correction_layer2": result.correction_layer2,
        "correction_layer3": result.correction_layer3,
        "correction_layer4": final_corrected_text,
        "lines": lines_json,
        "triage": triage_dict,
    }


@router.post("/{run_id}/review")
def submit_review(
    run_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update review status for an OCR run. Returns 404 if run not found or belongs to another user (hidden existence)."""
    run = db.query(OCRRun).filter(OCRRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="OCR run not found")
    if run.user_id is not None and run.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="OCR run not found")
    run.review_status = payload.get("review_status")
    run.reviewed_text = payload.get("reviewed_text")
    db.commit()
    return {"message": "Review updated"}

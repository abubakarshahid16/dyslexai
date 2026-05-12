"""
OCR service for the adaptive *exercise* handwriting type.

Strategy:
- Raw OCR output (recognized_text): used for SCORING — reflects what student actually wrote
- Corrected text (corrected_text): used for FEEDBACK — helps student see corrections
- Use ONLY TrOCR Large handwritten for recognition (no DocTR segmentation).
- Convert the uploaded image to grayscale before feeding it to TrOCR.

The full OCR Studio still uses `/api/ocr/process` which runs the notebook pipeline.
"""

from __future__ import annotations

import io
from typing import Any

from PIL import Image

from app.core.config import get_settings
from app.services.llm import correct_ocr_text

_simple_processor: TrOCRProcessor | None = None
_simple_model: VisionEncoderDecoderModel | None = None
_simple_device: Any | None = None


def _get_simple_trocr():
    global _simple_processor, _simple_model, _simple_device
    if _simple_processor is not None and _simple_model is not None and _simple_device is not None:
        return _simple_processor, _simple_model, _simple_device

    settings = get_settings()

    # Lazy imports: avoid importing torch/transformers at module-load time.
    # This prevents startup crashes in some environments and keeps
    # non-handwriting features usable without loading the model.
    import torch  # type: ignore
    from transformers import TrOCRProcessor, VisionEncoderDecoderModel  # type: ignore

    # Explicitly use the handwritten TrOCR Large model.
    model_name = getattr(settings.models, "trocr_model_name", "microsoft/trocr-large-handwritten") or "microsoft/trocr-large-handwritten"
    if "trocr-large-handwritten" not in str(model_name).lower():
        model_name = "microsoft/trocr-large-handwritten"

    _simple_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    _simple_processor = TrOCRProcessor.from_pretrained(model_name, use_fast=False)
    _simple_model = VisionEncoderDecoderModel.from_pretrained(model_name).to(_simple_device).eval()
    return _simple_processor, _simple_model, _simple_device


def warmup_simple_trocr() -> None:
    """
    Pre-load TrOCR Large handwritten model for the adaptive handwriting exercise.
    This avoids the long first-request delay during testing.
    """
    _get_simple_trocr()


def process_handwriting_image(image_bytes: bytes) -> dict[str, Any]:
    """
    Recognize handwriting text with simple TrOCR-large only.
    
    IMPORTANT: Scoring is based on RAW OCR output (what student actually wrote),
    not corrected/auto-fixed versions. This ensures fair assessment of handwriting.

    Returns dict keys:
      - recognized_text (RAW TrOCR output — used for scoring)
      - corrected_text (spell-corrected version for display feedback only)
      - confidence (0–1)
    """
    processor, model, device = _get_simple_trocr()

    # torch is imported lazily in _get_simple_trocr; re-import here so the
    # symbol is available for inference_mode.
    import torch  # type: ignore

    img = Image.open(io.BytesIO(image_bytes))
    # Required preprocessing: grayscale before OCR.
    img_gray = img.convert("L")
    # Many image processors accept either; keep grayscale content but as 3 channels.
    img_gray_rgb = img_gray.convert("RGB")

    pixel_values = processor(images=img_gray_rgb, return_tensors="pt").pixel_values.to(device)

    with torch.inference_mode():
        generated_ids = model.generate(
            pixel_values,
            max_new_tokens=64,
            num_beams=2,
            early_stopping=True,
        )

    raw_text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0].strip()
    confidence = 1.0 if raw_text else 0.0

    # Get spell-corrected version for display feedback (not scoring)
    corrected = _spell_correct_text(raw_text)

    return {
        "recognized_text": raw_text,      # Use this for scoring
        "corrected_text": corrected,       # Use this for feedback display
        "confidence": confidence,
    }


def _spell_correct_text(text: str) -> str:
    """
    Apply spell correction to OCR output for display feedback.
    Uses LLM to correct spelling while preserving meaning.
    This corrected version is shown to students for feedback, not used for scoring.
    """
    if not text or not text.strip():
        return text
    
    try:
        return correct_ocr_text(text)
    except Exception as e:
        # If correction fails, return original text
        print(f"Spell correction failed: {e}")
        return text

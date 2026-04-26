"""Notebook pipeline — DocTR + TrOCR + layer1 + layer2 + Groq.

Exact port of fyp (1).ipynb run_full_pipeline:
1. OCR (DocTR + TrOCR)
2. Layer 1 (Sanitize)
3. Layer 2 (Local Dyslexia Fix)
4. Layer 3 (Groq Context Fix)
"""

from __future__ import annotations

import os
from pathlib import Path

import cv2

from app.core.config import get_settings
from app.core.logging import get_logger
from app.correction.notebook_layers import get_groq_correction, layer_1_sanitize, layer_2_dyslexia_fix
from app.ocr.engines.notebook_engine import NotebookOCREngine
from app.ocr.types import OCRLine, OCRResult, TriageResult
from app.utils.diffing import acceptance_gate, levenshtein_ops

logger = get_logger(__name__)


class NotebookPipeline:
    """Notebook-quality OCR: DocTR + TrOCR + layer1 + layer2 + Groq."""

    def __init__(self):
        self.settings = get_settings()
        self._engine: NotebookOCREngine | None = None
        self._use_groq = bool(os.getenv("GROQ_API_KEY", "").strip())
        logger.info("Notebook pipeline | use_groq=%s", self._use_groq)

    def _get_engine(self) -> NotebookOCREngine:
        if self._engine is None:
            self._engine = NotebookOCREngine(self.settings.models)
        return self._engine

    def process_image(self, image_path: str) -> OCRResult:
        """Run full notebook pipeline: OCR -> layer1 -> layer2 -> Groq."""
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Could not read image: {image_path}")

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        triage = TriageResult(
            blur_score=0.0,
            brightness=float(gray.mean()),
            contrast=float(gray.std()),
            is_low_contrast=False,
            estimated_skew_angle=0.0,
            should_threshold=False,
            should_deskew=False,
        )
        engine = self._get_engine()
        lines, base_paragraph = engine.run(image_path)

        raw_text = base_paragraph
        sanitized = layer_1_sanitize(raw_text)
        layer2_raw = layer_2_dyslexia_fix(sanitized)

        # Do-no-harm gate: reject layer2 if repetition/echo/lower similarity
        ok2, reason2 = acceptance_gate(raw_text, sanitized, layer2_raw)
        gate_rejected_layer2 = not ok2
        layer2_rejection_reason = reason2 if not ok2 else None
        local_fixed = sanitized if not ok2 else layer2_raw
        if not ok2:
            logger.info("Gate rejected layer2 (%s), keeping layer1", reason2)

        layer3_raw: str | None = None
        gate_rejected_layer3 = False
        layer3_rejection_reason: str | None = None

        if self._use_groq:
            layer3_raw = get_groq_correction(local_fixed)
            ok3, reason3 = acceptance_gate(raw_text, local_fixed, layer3_raw)
            gate_rejected_layer3 = not ok3
            layer3_rejection_reason = reason3 if not ok3 else None
            if not ok3:
                logger.info("Gate rejected layer3 (%s), keeping layer2", reason3)
                final = local_fixed
            else:
                final = layer3_raw
        else:
            final = local_fixed

        for line in lines:
            line.corrected_text = line.raw_text
            line.merged_text = line.raw_text

        metadata = {
            "pipeline": "notebook",
            "ocr_mode": "notebook_parity" if self.settings.models.notebook_parity else "production",
            "use_groq": self._use_groq,
            "gate_rejected_layer2": gate_rejected_layer2,
            "gate_rejected_layer3": gate_rejected_layer3,
            "layer2_rejection_reason": layer2_rejection_reason,
            "layer3_rejection_reason": layer3_rejection_reason,
        }
        return OCRResult(
            image_path=image_path,
            raw_text=raw_text,
            corrected_text=final,
            lines=lines,
            triage=triage,
            metadata=metadata,
            correction_layer1=sanitized,
            correction_layer2=layer2_raw,
            correction_layer3=layer3_raw or "",
        )

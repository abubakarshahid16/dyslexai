"""Notebook OCR: DocTR detection + TrOCR recognition.

Maps directly from fyp (1).ipynb:
- load_models() -> DocTR ocr_predictor + TrOCR Large Handwritten
- run_inference() -> DocTR line detection, TrOCR per crop, sort by y_center, build paragraph

Modes (OCR_MODE env):
- production: trocr_fast, use_fast=False, generate(kwargs), decode.strip()
- notebook_parity: trocr-large, processor default, generate(pixel_values), no strip
"""

from __future__ import annotations

from statistics import median

import cv2
import numpy as np
import torch
from PIL import Image
from transformers import TrOCRProcessor, VisionEncoderDecoderModel

from app.core.config import ModelSettings
from app.core.logging import get_logger
from app.ocr.types import OCRLine

logger = get_logger(__name__)

try:
    from doctr.models import ocr_predictor
except ImportError:
    ocr_predictor = None

NOTEBOOK_PARITY_MODEL = "microsoft/trocr-large-handwritten"


class NotebookOCREngine:
    """DocTR detection + TrOCR recognition — exact notebook path."""

    def __init__(self, config: ModelSettings):
        if ocr_predictor is None:
            raise ImportError("DocTR (python-doctr) is required. pip install python-doctr")
        self._parity = config.notebook_parity
        if self._parity:
            # Allow a local fine-tuned model path via TROCR_MODEL_NAME.
            model_name = config.trocr_model_name or NOTEBOOK_PARITY_MODEL
            logger.info("Notebook parity mode: using %s", model_name)
        else:
            model_name = config.trocr_model_name
            if config.trocr_fast:
                model_name = "microsoft/trocr-base-handwritten"
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info("Loading DocTR line detector...")
        self.detection_model = ocr_predictor(pretrained=True).to(self.device).eval()
        logger.info("Loading TrOCR: %s", model_name)
        if self._parity:
            self.processor = TrOCRProcessor.from_pretrained(model_name)
        else:
            self.processor = TrOCRProcessor.from_pretrained(model_name, use_fast=False)
        self.trocr_model = VisionEncoderDecoderModel.from_pretrained(model_name).to(self.device).eval()

    def run(self, image_path: str) -> tuple[list[OCRLine], str]:
        """Run DocTR detection + TrOCR recognition. Returns (lines, paragraph)."""
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Could not read image: {image_path}")
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        img_gray_rgb = cv2.cvtColor(img_gray, cv2.COLOR_GRAY2RGB)
        height, width = img_rgb.shape[:2]

        result = self.detection_model([img_gray_rgb])
        results: list[dict] = []
        line_count = 0

        for page in result.pages:
            for block in page.blocks:
                for line in block.lines:
                    (x0, y0), (x1, y1) = line.geometry
                    x_min = int(x0 * width)
                    y_min = int(y0 * height)
                    x_max = int(x1 * width)
                    y_max = int(y1 * height)
                    pad = 5
                    x_min = max(0, x_min - pad)
                    y_min = max(0, y_min - pad)
                    x_max = min(width, x_max + pad)
                    y_max = min(height, y_max + pad)

                    crop = img_gray_rgb[y_min:y_max, x_min:x_max]
                    if crop.shape[0] < 5 or crop.shape[1] < 5:
                        continue

                    line_count += 1
                    pixel_values = self.processor(images=crop, return_tensors="pt").pixel_values.to(self.device)
                    if self._parity:
                        with torch.no_grad():
                            generated_ids = self.trocr_model.generate(pixel_values)
                        text = self.processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
                    else:
                        with torch.inference_mode():
                            generated_ids = self.trocr_model.generate(pixel_values, max_new_tokens=64, num_beams=2, early_stopping=True)
                        text = self.processor.batch_decode(generated_ids, skip_special_tokens=True)[0].strip()

                    y_center = (y_min + y_max) / 2.0
                    results.append({
                        "line_number": line_count,
                        "bbox": (x_min, y_min, x_max, y_max),
                        "y_center": y_center,
                        "text": text,
                    })

        if not results:
            return [], ""

        # Sort by y_center, cluster same row, then by x (notebook logic)
        results_sorted = sorted(results, key=lambda r: (r["y_center"], r["bbox"][0]))
        heights = [r["bbox"][3] - r["bbox"][1] for r in results_sorted]
        median_h = median(heights) if heights else 18
        clustered: list[dict] = []
        current_cluster = [results_sorted[0]]
        for r in results_sorted[1:]:
            if abs(r["y_center"] - current_cluster[-1]["y_center"]) <= (median_h * 0.5):
                current_cluster.append(r)
            else:
                clustered.extend(sorted(current_cluster, key=lambda x: x["bbox"][0]))
                current_cluster = [r]
        clustered.extend(sorted(current_cluster, key=lambda x: x["bbox"][0]))

        lines: list[OCRLine] = []
        for r in clustered:
            lines.append(OCRLine(
                bbox=r["bbox"],
                raw_text=r["text"],
                confidence=0.85,
                source="trocr",
            ))
        paragraph = " ".join(r["text"].strip() for r in clustered if r["text"].strip()).strip()
        return lines, paragraph

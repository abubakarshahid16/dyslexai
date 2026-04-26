"""Notebook correction layers — exact port from fyp (1).ipynb.

- layer_1_sanitize: Basic regex cleaning
- layer_2_dyslexia_fix: Local T5 (custom or ByT5 fallback)
- get_groq_correction: Groq API context fix
"""

from __future__ import annotations

import os
import re

import torch

from app.core.logging import get_logger

logger = get_logger(__name__)

# Custom T5 paths from notebook
DEFAULT_T5_PATHS = [
    "DyslexAI_Model_Unzipped",
    "DyslexAI_Best_Model (1)",
    "DyslexAI_Best_Best_Model_unzipped",
]


def layer_1_sanitize(text: str) -> str:
    """Basic Regex Cleaning — notebook cell layer_1_sanitize."""
    if not text:
        return ""
    text = text.replace(" . ", " ")
    text = re.sub(r"[^a-zA-Z0-9\s.,!?'\"-]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _get_t5_model():
    """Load custom T5 if path exists, else ByT5."""
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

    paths = [
        os.getenv("DYSLEXAI_T5_MODEL_PATH"),
        *DEFAULT_T5_PATHS,
        "dyslexia-backend/DyslexAI_Model_Unzipped",
    ]
    for path in paths:
        if path and os.path.isdir(path):
            logger.info("Loading custom T5 from %s", path)
            tokenizer = AutoTokenizer.from_pretrained(path)
            model = AutoModelForSeq2SeqLM.from_pretrained(path)
            device = "cuda" if torch.cuda.is_available() else "cpu"
            model = model.to(device)
            return ("custom", tokenizer, model)

    from app.correction.byt5_corrector import ByT5Corrector
    from app.core.config import get_settings
    corrector = ByT5Corrector(get_settings().models)
    return ("byt5", corrector, None)


_t5_cache = None


def layer_2_dyslexia_fix(text: str) -> str:
    """Local T5 Model Fix — notebook cell layer_2_dyslexia_fix."""
    global _t5_cache
    if not text.strip():
        return text
    try:
        if _t5_cache is None:
            _t5_cache = _get_t5_model()
        kind, a, b = _t5_cache
        if kind == "byt5":
            return a.correct(text)
        tokenizer, model = a, b
        input_text = "correct dyslexia: " + text
        device = next(model.parameters()).device
        inputs = tokenizer(input_text, return_tensors="pt", truncation=True, max_length=512).to(device)
        with torch.no_grad():
            outputs = model.generate(**inputs, max_length=512, num_beams=2, early_stopping=True)
        return tokenizer.decode(outputs[0], skip_special_tokens=True)
    except Exception as e:
        logger.warning("layer_2_dyslexia_fix failed: %s", e)
        return text


def get_groq_correction(text: str) -> str:
    """Groq (Llama 3.3) context fix — notebook cell get_groq_correction."""
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key or not text.strip():
        return text
    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        system_prompt = """You are an expert English Editor specializing in fixing OCR errors and dyslexic text.
Your Task:
1. Fix spelling and grammatical errors based on context.
2. Specifically look for historical or proper noun errors (e.g., "13 Stakes" -> "13 States", "Nklymuh" -> "Nkrumah").
3. Do NOT add conversational filler. Output ONLY the corrected text."""
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
            temperature=0.1,
            max_tokens=1024,
        )
        corrected = (completion.choices[0].message.content or "").strip()
        if corrected:
            return corrected
        from app.services.llm import correct_ocr_text
        return correct_ocr_text(text)
    except Exception as e:
        logger.warning("Groq correction failed: %s", e)
        try:
            from app.services.llm import correct_ocr_text
            return correct_ocr_text(text)
        except Exception as fallback_error:
            logger.warning("Fallback correction failed: %s", fallback_error)
            return text

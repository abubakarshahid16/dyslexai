import os
import json
import base64
import io
import re
from groq import Groq
from dotenv import load_dotenv
from PIL import Image

load_dotenv()



_client = None
MODEL  = "llama-3.3-70b-versatile"

from app.services._internal import (
    correct_ocr_text_with_image,
    transcribe_handwriting_image_with_image,
    generate_handwriting_feedback_with_image,
)

def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not set — LLM features are unavailable")
        _client = Groq(api_key=api_key)
    return _client


def correct_ocr_text(text: str) -> str:
    """
    Correct OCR text using the same LLM API/client stack used in this service.
    Returns the original text if the API is unavailable or response is empty.
    """
    if not text or not text.strip():
        return text

    prompt = f"""You are an expert English editor for OCR outputs.
Fix spelling and grammar errors while preserving the original meaning.
Do not add extra explanation.
Return only the corrected text.

Text:
{text}
"""

    try:
        response = _get_client().chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=512,
            temperature=0.1,
        )
        corrected = (response.choices[0].message.content or "").strip()
        return corrected or text
    except Exception as e:
        print(f"OCR correction fallback failed: {e}")
        return text


def generate_feedback(
    score: float,
    char_errors: list,
    target_words: list,
    student_age: int,
    exercise_type: str
) -> str:
    
    """
    Generate encouraging, age-appropriate feedback using Groq.
    Falls back to simple template if API call fails.
    """
    error_summary = ""
    if char_errors:
        reversals = [e for e in char_errors if e.get("error_type") == "reversal"]
        subs      = [e for e in char_errors if e.get("error_type") == "substitution"]

        if reversals:
            pairs = ", ".join(
                f"'{e['actual_char']}' instead of '{e['expected_char']}'"
                for e in reversals[:3]
            )
            error_summary += f"Letter reversals: {pairs}. "

        if subs:
            pairs = ", ".join(
                f"'{e['actual_char']}' instead of '{e['expected_char']}'"
                for e in subs[:3]
            )
            error_summary += f"Letter substitutions: {pairs}. "

    score_percent = round(score * 100)
    words_str     = ", ".join(target_words) if target_words else "the exercise"

    tone = (
        "low" if score_percent < 40 else
        "mid" if score_percent < 75 else
        "high"
    )

    prompt = f"""You are a supportive teacher helping a child aged {student_age}.
The child just completed a {exercise_type} exercise practicing targeted words/letters.
Their score was {score_percent}% (tone: {tone}).
{f"Errors made: {error_summary}" if error_summary else "They made no errors."}

Write short feedback in exactly 3 sentences:
1) If tone is low: be kind but realistic (avoid "awesome", "amazing", "perfect"). Clearly say they need more practice.
   If tone is mid: balanced encouragement + one concrete improvement tip.
   If tone is high: strong praise + one small tip or reinforcement.
2) Give one specific tip based on the errors (or a practice tip if no errors provided).
3) End with a motivating next step (what to do next).

Rules:
- Never use the word dyslexia
- Use simple words a {student_age} year old understands
- Do not repeat or name the specific practice words/letters in your feedback (e.g., avoid saying the exact target word)
- Do not use bullet points or numbering in the response
- Maximum 65 words total
- Return plain text only"""

    try:
        response = _get_client().chat.completions.create(
            model    = MODEL,
            messages = [{"role": "user", "content": prompt}],
            max_tokens = 120,
            temperature = 0.7
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Feedback generation failed: {e}")
        if score >= 0.85:
            return "Great work — that was very accurate. Keep the same focus on each word. Try one more and see if you can match this score."
        if score >= 0.5:
            return "Good effort. Slow down and check each letter carefully. Try the same word again and improve your score."
        return "That was a tough one, and that's okay. Let’s practice slowly: say the word out loud, then write it letter by letter. Try again and aim for a higher score."

# Vision functions live in app.services._internal; imported at top

def generate_exercises(
    weak_words: list,
    difficulty: int,
    student_age: int,
    count: int = 5,
    force_type: str = None
) -> list:
    """
    Generate new exercises targeting weak words using Groq.
    force_type: if provided, ALL generated exercises will be of this type.
    Returns a list of exercise dicts ready to insert into the database.
    """
    if not weak_words:
        return []

    words_str = ", ".join(weak_words[:8])

    # ── Type-specific prompt when a single type is requested ─────────────
    if force_type:
        type_rules = {
            "word_typing":     'content = "Type this word: WORD", expected = the word in lowercase. WORD must be a full word, never a sentence.',
            "sentence_typing": 'content = "Type this sentence: SENTENCE", expected = sentence in lowercase.',
            "handwriting":     'content = "Write this word: WORD" or "Write this sentence: SENTENCE" (max 5 words), expected = word or sentence in lowercase.',
            "tracing":         'content = "Trace this letter: LETTER" (single letter) or "Trace this word: WORD" (single word, no sentence), expected = letter or word in lowercase.',
        }
        rule = type_rules.get(force_type, "Follow the standard rules for this type.")
        prompt = f"""You are creating spelling exercises for a child aged {student_age} with dyslexia.
Difficulty level is {difficulty} out of 10.
These are words or letters the child struggles with: {words_str}

Generate {count} exercises ALL of type \"{force_type}\". Return ONLY a JSON array, no explanation, no markdown, no code blocks.
Each item must have exactly these fields:
- type: must be "{force_type}" for every item
- content: the instruction shown to the student
- expected: the exact correct answer in lowercase
- target_words: array of focus words/letters from the struggle list used in this exercise

Rule for this type: {rule}
All expected values must be lowercase.

Example item:
{{"type": "{force_type}", "content": "...", "expected": "...", "target_words": [...]}}"""
    else:
        prompt = f"""You are creating spelling exercises for a child aged {student_age} with dyslexia.
Difficulty level is {difficulty} out of 10.
These are words the child struggles with: {words_str}

Generate {count} exercises. Return ONLY a JSON array, no explanation, no markdown, no code blocks.
Each item must have exactly these fields:
- type: one of "word_typing", "sentence_typing", "handwriting", or "tracing"
- content: the instruction shown to the student
- expected: the exact correct answer in lowercase
- target_words: array of focus words from the struggle list used in this exercise

Rules:
- For word_typing: content = "Type this word: WORD", expected = the word in lowercase. WORD must be a full word, never a single letter
- For sentence_typing: content = "Type this sentence: SENTENCE", expected = sentence in lowercase
- For handwriting: content = "Write this word: WORD" or "Write this sentence: SENTENCE", expected = word or sentence in lowercase. Never a single letter
- For tracing: content = "Trace this letter: LETTER" (single letter only) or "Trace this word: WORD" (single word only). Never a sentence
- IMPORTANT: handwriting sentences must be at most 5 words long — they will be written by hand on a single line and OCR-scanned
- IMPORTANT: tracing must be a single letter OR a single word — never a sentence
- IMPORTANT: word_typing and handwriting use full words or sentences — never single letters
- Sentences must be simple, short, and use the struggle words naturally
- Mix all four types roughly equally (about 1-2 of each per 5 exercises)
- All expected values must be lowercase

Example format:
[
  {{"type": "word_typing", "content": "Type this word: friend", "expected": "friend", "target_words": ["friend"]}},
  {{"type": "sentence_typing", "content": "Type this sentence: my friend went to school", "expected": "my friend went to school", "target_words": ["friend", "school"]}},
  {{"type": "handwriting", "content": "Write this sentence: my friend is here", "expected": "my friend is here", "target_words": ["friend"]}},
  {{"type": "tracing", "content": "Trace this word: friend", "expected": "friend", "target_words": ["friend"]}}
]"""

    try:
        response = _get_client().chat.completions.create(
            model    = MODEL,
            messages = [{"role": "user", "content": prompt}],
            max_tokens  = 800,
            temperature = 0.7
        )
        text = response.choices[0].message.content.strip()

        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()

        exercises = json.loads(text)

        valid = []
        for ex in exercises:
            if all(k in ex for k in ["type", "content", "expected", "target_words"]):
                if force_type == "handwriting" and not _is_single_line_handwriting_item(ex):
                    continue
                valid.append(ex)
        return valid

    except Exception as e:
        print(f"Exercise generation failed: {e}")
        return []
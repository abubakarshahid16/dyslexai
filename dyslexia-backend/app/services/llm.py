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
_vision_client = None
MODEL  = "llama-3.3-70b-versatile"
VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not set — LLM features are unavailable")
        _client = Groq(api_key=api_key)
    return _client


def _get_vision_client():
    global _vision_client
    if _vision_client is None:
        api_key = os.getenv("GROQ_VISION_API_KEY") or os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_VISION_API_KEY is not set — vision OCR correction is unavailable")
        _vision_client = Groq(api_key=api_key)
    return _vision_client


def _sanitize_model_text(text: str) -> str:
    cleaned = (text or "").strip()
    if not cleaned:
        return ""

    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", cleaned).strip()
        cleaned = re.sub(r"\n?```$", "", cleaned).strip()

    cleaned = re.sub(
        r"^(corrected\s*(transcription|text)|final\s*transcription|transcription)\s*:\s*",
        "",
        cleaned,
        flags=re.IGNORECASE,
    ).strip()
    return cleaned


def _encode_image_for_vision(image_path: str, max_raw_bytes: int = 3_000_000) -> str:
    with open(image_path, "rb") as image_file:
        original_bytes = image_file.read()
    if len(original_bytes) <= max_raw_bytes:
        return base64.b64encode(original_bytes).decode("utf-8")

    img = Image.open(io.BytesIO(original_bytes)).convert("RGB")
    img.thumbnail((2000, 2000), Image.Resampling.LANCZOS)
    for quality in (85, 75, 65, 55, 45):
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        compressed = buf.getvalue()
        if len(compressed) <= max_raw_bytes:
            return base64.b64encode(compressed).decode("utf-8")

    # Return best-effort compressed image even if still above threshold.
    return base64.b64encode(compressed).decode("utf-8")


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


def correct_ocr_text_with_image(*, rough_text: str, image_path: str) -> str:
    """
    Cross-check rough OCR text against the original image using Groq vision.
    Returns only cleaned corrected transcription text, or the rough text on failure.
    """
    rough = (rough_text or "").strip()
    if not rough:
        return rough_text

    try:
        base64_image = _encode_image_for_vision(image_path)
        prompt = (
            "You are an OCR correction model. Read the image carefully and return only the final corrected transcription from the image. "
            "Use the rough OCR text only as a helper cross-check if it helps you spot mistakes. "
            "Return ONLY the corrected transcription text as plain text. "
            "Do not add labels, markdown, quotes, commentary, or explanations.\n\n"
            f"Rough OCR text to cross-check:\n{rough}"
        )

        completion = _get_vision_client().chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"},
                        },
                    ],
                }
            ],
            temperature=0.1,
            max_tokens=1200,
        )

        corrected = _sanitize_model_text(completion.choices[0].message.content or "")
        return corrected or rough
    except Exception as e:
        print(f"Vision OCR correction failed: {e}")
        return rough


def _is_single_line_handwriting_item(item: dict) -> bool:
    """Allow only a single word or a single short sentence for handwriting exercises."""
    content = str(item.get("content", "")).strip()
    expected = str(item.get("expected", "")).strip()
    if not content or not expected:
        return False
    if "\n" in content or "\n" in expected:
        return False
    if "Write this" not in content:
        return False

    # Reject paragraphs / multi-sentence outputs.
    sentence_parts = [part.strip() for part in re.split(r"[.!?]+", expected) if part.strip()]
    if len(sentence_parts) > 1:
        return False

    # Keep handwriting exercises short enough to fit on one line.
    return len(expected.split()) <= 5


def _is_single_line_handwriting_item(item: dict) -> bool:
    """Return True only for one word or one short sentence handwriting prompts."""
    content = str(item.get("content", "")).strip()
    expected = str(item.get("expected", "")).strip()
    if not content or not expected:
        return False
    if "\n" in content or "\n" in expected:
        return False
    if content.lower().count("write this") != 1:
        return False
    # expected text should be a single sentence or a single word, not a paragraph
    sentence_pieces = [piece.strip() for piece in re.split(r"[.!?]+", expected) if piece.strip()]
    if len(sentence_pieces) > 1:
        return False
    return len(expected.split()) <= 5 or len(expected.split()) == 1


def transcribe_handwriting_image_with_image(image_bytes: bytes) -> str:
    """
    Use the vision LLM to transcribe exactly what is written in the image.
    The result is used for display and grading.
    """
    if not image_bytes:
        return ""

    try:
        base64_image = base64.b64encode(image_bytes).decode("utf-8")
        prompt = (
            "Transcribe exactly what is written in this handwriting image. "
            "Do not correct spelling, grammar, or word choice. Return only the transcription text."
        )
        completion = _get_vision_client().chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"},
                        },
                    ],
                }
            ],
            temperature=0.0,
            max_tokens=200,
        )
        return _sanitize_model_text(completion.choices[0].message.content or "")
    except Exception as e:
        print(f"Vision handwriting transcription failed: {e}")
        return ""


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

def generate_handwriting_feedback_with_image(
    image_bytes: bytes,
    recognized_text: str,
    expected_text: str,
    score: float,
    char_errors: list,
    student_age: int
) -> dict[str, str]:
    """
    For handwriting exercises: pass the image plus recognized and expected text to the LLM.
    Returns:
      - recognized_text: LLM transcription of the image
      - feedback: exercise-specific feedback
    """
    if not image_bytes:
        return {
            "recognized_text": recognized_text,
            "feedback": generate_feedback(score, char_errors, [], student_age, "handwriting"),
        }
    
    try:
        # Encode image for vision API
        base64_image = base64.b64encode(image_bytes).decode("utf-8")
        
        # Prompt LLM to read image and provide specific feedback.
        score_percent = round(score * 100)
        
        prompt = f"""You are a supportive teacher reviewing a child's handwriting exercise.

EXPECTED TEXT: "{expected_text}"
STUDENT'S RECOGNIZED TEXT: "{recognized_text}"
SCORE: {score_percent}%

Looking at the image of what the student wrote:
    1. Transcribe exactly what the student wrote in the image. Do not correct it.
    2. Write feedback that is specific to this exact exercise and compares what they wrote vs what was expected.

    Return your response in exactly this format:
    TRANSCRIPTION: [exact text you read from the image]
    FEEDBACK: [specific feedback about mistakes vs expected]

    Feedback must be:
    - Specific to this exercise (mention actual mistakes they made)
- Ignore capitalization, commas, periods, apostrophes, and other punctuation completely
- Do not comment on uppercase vs lowercase; only judge whether the content is correct
- Focus only on missing, extra, or wrong letters/words
    - For a {student_age} year old (simple words)
    - Encouraging but honest (if they got it wrong, explain what they did wrong and what was expected)
    - 2-3 sentences maximum
    - Never mention dyslexia"""

        completion = _get_vision_client().chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"},
                        },
                    ],
                }
            ],
            temperature=0.2,
            max_tokens=500,
        )

        response_text = (completion.choices[0].message.content or "").strip()
        feedback = generate_feedback(score, char_errors, [], student_age, "handwriting")

        if response_text:
            transcription_marker = "TRANSCRIPTION:"
            feedback_marker = "FEEDBACK:"
            transcription_idx = response_text.find(transcription_marker)
            feedback_idx = response_text.find(feedback_marker)

            if transcription_idx != -1 and feedback_idx != -1 and feedback_idx > transcription_idx:
                recognized_text = response_text[
                    transcription_idx + len(transcription_marker):feedback_idx
                ].strip()
                feedback = response_text[feedback_idx + len(feedback_marker):].strip() or feedback

        return {
            "recognized_text": recognized_text,
            "feedback": feedback,
        }
    
    except Exception as e:
        print(f"Image-based feedback generation failed: {e}")
        return {
            "recognized_text": recognized_text,
            "feedback": generate_feedback(score, char_errors, [], student_age, "handwriting"),
        }

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
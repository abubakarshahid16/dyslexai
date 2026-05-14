import os
import base64
import io
import re
from groq import Groq
from dotenv import load_dotenv
from PIL import Image

load_dotenv()

_vision_client = None
VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

def _get_vision_client():
    global _vision_client
    if _vision_client is None:
        api_key = os.getenv("GROQ_API_KEY_2") or os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY_2 is not set — vision OCR correction is unavailable")
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

def correct_ocr_text_with_image(*, rough_text: str, image_path: str) -> str:
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

def transcribe_handwriting_image_with_image(image_bytes: bytes) -> str:
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

def generate_handwriting_feedback_with_image(
    image_bytes: bytes,
    recognized_text: str,
    expected_text: str,
    score: float,
    char_errors: list,
    student_age: int,
) -> dict[str, str]:
    # Import generate_feedback lazily to avoid circular imports with app.services.llm
    try:
        from app.services.llm import generate_feedback
    except Exception:
        generate_feedback = lambda *a, **k: ""

    if not image_bytes:
        return {
            "recognized_text": recognized_text,
            "feedback": generate_feedback(score, char_errors, [], student_age, "handwriting"),
        }

    try:
        base64_image = base64.b64encode(image_bytes).decode("utf-8")
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


def validate_tracing_with_vision(image_bytes: bytes, expected_text: str, student_age: int, frontend_score: float) -> dict:
    try:
        from app.services.llm import generate_feedback
    except Exception:
        generate_feedback = lambda *a, **k: ""
        
    if not image_bytes:
        return {
            "score": frontend_score,
            "feedback": generate_feedback(frontend_score, [], [], student_age, "tracing")
        }

    try:
        base64_image = base64.b64encode(image_bytes).decode("utf-8")
        prompt = f"""You are a supportive teacher evaluating a tracing exercise for a {student_age} year old.
The student was supposed to trace the word: "{expected_text}"
Look at the provided image. The dark background contains faint gray guide text, and the bright blue lines are what the student drew.
You must check TWO things:
1. Did the student actually write the expected word/letter? (Or did they just scribble gibberish?)
2. Is the blue writing directly ON TOP of the faint gray guide text? (Or did they write it somewhere else on the canvas?)

Return your response in exactly this format:
WROTE_EXPECTED: [YES or NO]
ON_TRACE: [YES or NO]
FEEDBACK: [1-2 sentences of encouraging feedback. If they didn't write it, tell them to write carefully. If they wrote it but not on the trace, tell them to write ON the gray letters.]"""

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
            max_tokens=200,
        )
        
        response_text = (completion.choices[0].message.content or "").strip()
        
        wrote_marker = "WROTE_EXPECTED:"
        on_trace_marker = "ON_TRACE:"
        feedback_marker = "FEEDBACK:"
        
        score = frontend_score
        feedback = generate_feedback(frontend_score, [], [], student_age, "tracing")
        
        wrote_idx = response_text.find(wrote_marker)
        on_trace_idx = response_text.find(on_trace_marker)
        feedback_idx = response_text.find(feedback_marker)
        
        if wrote_idx != -1 and on_trace_idx != -1 and feedback_idx != -1:
            wrote_val = response_text[wrote_idx + len(wrote_marker):on_trace_idx].strip().upper()
            on_trace_val = response_text[on_trace_idx + len(on_trace_marker):feedback_idx].strip().upper()
            
            wrote_yes = "YES" in wrote_val
            on_trace_yes = "YES" in on_trace_val
            
            if wrote_yes and on_trace_yes:
                score = max(0.85, frontend_score)
            elif wrote_yes and not on_trace_yes:
                score = 0.50  # Wrote it, but not on trace
            else:
                score = min(0.20, frontend_score) # Gibberish or wrong word
                
            feedback = response_text[feedback_idx + len(feedback_marker):].strip()
            
        return {
            "score": score,
            "feedback": feedback
        }
    except Exception as e:
        print(f"Vision tracing validation failed: {e}")
        return {
            "score": frontend_score,
            "feedback": generate_feedback(frontend_score, [], [], student_age, "tracing")
        }

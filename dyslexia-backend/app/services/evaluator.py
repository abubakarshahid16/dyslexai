import Levenshtein
import re
from difflib import SequenceMatcher

def normalize(text: str) -> str:
    """Lowercase, remove punctuation, strip extra spaces."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text

def get_char_errors(expected: str, actual: str) -> list:
    """Return list of character-level errors with position and type."""
    ops = Levenshtein.editops(actual, expected)
    errors = []
    for op, src_pos, dest_pos in ops:
        expected_char = expected[dest_pos] if dest_pos < len(expected) else ""
        actual_char   = actual[src_pos]   if src_pos  < len(actual)   else ""

        if op == "replace":
            error_type = "substitution"
            # detect common dyslexia reversals
            pair = tuple(sorted([expected_char, actual_char]))
            if pair in [("b","d"), ("p","q"), ("b","p"), ("d","q"), ("n","u"), ("m","w")]:
                error_type = "reversal"
        elif op == "delete":
            error_type = "insertion"   # student inserted an extra char
        elif op == "insert":
            error_type = "omission"    # student omitted a char

        errors.append({
            "position":      dest_pos,
            "expected_char": expected_char,
            "actual_char":   actual_char,
            "error_type":    error_type
        })
    return errors

def simple_phonetic(word: str) -> str:
    """Very simple phonetic normalization for partial credit."""
    word = word.lower()
    word = re.sub(r"ph", "f", word)
    word = re.sub(r"ck", "k", word)
    word = re.sub(r"gh", "", word)
    word = re.sub(r"kn", "n", word)
    word = re.sub(r"wr", "r", word)
    word = re.sub(r"[aeiou]+", "a", word)  # collapse vowels
    return word

def compute_phonetic_score(expected: str, actual: str) -> float:
    """Score based on phonetic similarity — rewards correct sound even if spelling differs."""
    exp_words = expected.split()
    act_words = actual.split()
    if not exp_words:
        return 1.0

    total = 0.0
    for i, exp_word in enumerate(exp_words):
        act_word = act_words[i] if i < len(act_words) else ""
        exp_phon = simple_phonetic(exp_word)
        act_phon = simple_phonetic(act_word)
        dist     = Levenshtein.distance(exp_phon, act_phon)
        max_len  = max(len(exp_phon), len(act_phon), 1)
        total   += 1.0 - (dist / max_len)

    return round(total / len(exp_words), 3)

def compute_handwriting_score(expected: str, actual: str) -> float:
    """
    Score handwriting by the number of characters that match in the right position.
    This is stricter than phonetic similarity but fairer than raw edit distance for
    short handwriting answers.
    """
    exp = expected.strip()
    act = actual.strip()
    if not exp and not act:
        return 1.0
    if not exp or not act:
        return 0.0

    matcher = SequenceMatcher(None, exp, act)
    matched = sum(i2 - i1 for tag, i1, i2, j1, j2 in matcher.get_opcodes() if tag == "equal")
    denominator = max(len(exp), len(act), 1)
    return round(matched / denominator, 3)

def evaluate_response(
    expected:       str,
    actual:         str,
    is_handwriting: bool  = False,
    ocr_confidence: float = 1.0
) -> dict:
    """
    Main evaluation function.
    Returns score, char_errors, phonetic_score.
    """
    exp_norm = normalize(expected)
    act_norm = normalize(actual)

    # handwriting gets a position-based character score; typing keeps edit-distance scoring
    if is_handwriting:
        score = compute_handwriting_score(exp_norm, act_norm)
    else:
        dist    = Levenshtein.distance(exp_norm, act_norm)
        max_len = max(len(exp_norm), len(act_norm), 1)
        score   = round(1.0 - (dist / max_len), 3)

    char_errors   = get_char_errors(exp_norm, act_norm)
    phonetic_score = compute_phonetic_score(exp_norm, act_norm)

    # typing can get a small phonetic boost; handwriting stays character-position based
    if not is_handwriting and phonetic_score > 0.85 and score < phonetic_score:
        score = round((score + phonetic_score) / 2, 3)

    return {
        "score":          max(0.0, min(1.0, score)),
        "char_errors":    char_errors,
        "phonetic_score": phonetic_score
    }
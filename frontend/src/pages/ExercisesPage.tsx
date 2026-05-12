import { useEffect, useState } from "react";

import { HandwritingSessionResult } from "../components/HandwritingSessionResult";
import { TracingCanvas } from "../components/TracingCanvas";
import {
  createExerciseStudent,
  createSession,
  fetchExerciseStudents,
  getNextExercise,
  submitHandwriting,
  submitTracing,
  submitTyping
} from "../lib/api";
import type { Exercise, ExerciseStudent, HandwritingSubmitResponse } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { KidIcon } from "../components/KidIcon";

function extractTypingPrompt(
  type: "word_typing" | "sentence_typing",
  content: string,
  expected: string
): string {
  const c = (content || "").trim();
  if (!c) return expected;
  const wordRe = /^type this word:\s*(.+)$/i;
  const sentenceRe = /^type this sentence:\s*(.+)$/i;
  if (type === "word_typing") {
    const m = c.match(wordRe);
    return m?.[1]?.trim() || expected;
  }
  const m = c.match(sentenceRe);
  return m?.[1]?.trim() || expected;
}

export function ExercisesPage() {
  const { user } = useAuth();
  const isStudent = user?.role === "student";

  const [students, setStudents] = useState<ExerciseStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<HandwritingSubmitResponse | { score: number; feedback: string } | null>(null);
  const [typingResponse, setTypingResponse] = useState("");
  const [handwritingFile, setHandwritingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newStudentName, setNewStudentName] = useState("");
  const [lastExerciseType, setLastExerciseType] = useState<"handwriting" | "word_typing" | "sentence_typing" | "tracing" | undefined>(undefined);

  useEffect(() => {
    if (isStudent && user?.student_id) {
      // Auto-select the logged-in student's profile
      setSelectedStudentId(user.student_id);
    } else {
      fetchExerciseStudents()
        .then(setStudents)
        .catch((err: Error) => setError(err.message));
    }
  }, [isStudent, user?.student_id]);

  useEffect(() => {
    if (handwritingFile) {
      const url = URL.createObjectURL(handwritingFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [handwritingFile]);

  async function handleCreateStudent() {
    if (!newStudentName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const s = await createExerciseStudent({ name: newStudentName.trim() });
      setStudents((prev) => [...prev, s]);
      setSelectedStudentId(String(s.id));
      setNewStudentName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create student");
    } finally {
      setBusy(false);
    }
  }

  async function handleGetNextExercise(type?: "handwriting" | "word_typing" | "sentence_typing" | "tracing") {
    if (!selectedStudentId) {
      setError("Select a student first");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    setExercise(null);
    setSessionId(null);
    setTypingResponse("");
    setHandwritingFile(null);
    setLastExerciseType(type);
    try {
      const ex = await getNextExercise(selectedStudentId, type);
      setExercise(ex);
      const sess = await createSession({
        student_id: selectedStudentId,
        exercise_id: ex.id,
        is_handwriting: ex.type === "handwriting"
      });
      setSessionId(sess.session_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get exercise");
    } finally {
      setBusy(false);
    }
  }

  async function handleTryAgain() {
    if (!selectedStudentId || !exercise) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setTypingResponse("");
    setHandwritingFile(null);
    try {
      // Reuse the same exercise, just create a new session for it
      const sess = await createSession({
        student_id: selectedStudentId,
        exercise_id: exercise.id,
        is_handwriting: exercise.type === "handwriting"
      });
      setSessionId(sess.session_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restart exercise");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitTyping() {
    if (!sessionId || !typingResponse.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await submitTyping(sessionId, { student_response: typingResponse.trim() });
      setResult({ score: res.score, feedback: res.feedback });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitHandwriting() {
    if (!sessionId || !handwritingFile) return;
    setBusy(true);
    setError(null);
    try {
      const res = await submitHandwriting(sessionId, handwritingFile);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  const isHandwriting = exercise?.type === "handwriting";
  const isTyping = exercise?.type === "word_typing" || exercise?.type === "sentence_typing";
  const isTracing = exercise?.type === "tracing";

  return (
    <div className="page-stack">
      <section className="hero">
        <div>
          <span className="hero-badge">Adaptive Exercises</span>
          <h1>Practice Exercises</h1>
          <p>
            Get adaptive exercises based on your progress. Supports typing, handwriting, and tracing.
          </p>
        </div>
      </section>

      <div className="card">
        <h3>Student</h3>
        {isStudent ? (
          <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>
            Logged in as <strong>{user?.name}</strong>
          </p>
        ) : (
          <div className="form-row">
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              disabled={busy}
            >
              <option value="">Select student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (level {s.difficulty_level})
                </option>
              ))}
            </select>
            <div className="form-row">
              <input
                type="text"
                placeholder="New student name"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateStudent()}
              />
              <button onClick={handleCreateStudent} disabled={busy || !newStudentName.trim()}>
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Get Exercise</h3>
        <div className="form-row">
          <button
            className="btn-type"
            onClick={() => handleGetNextExercise()}
            disabled={busy || !selectedStudentId}
          >
            <KidIcon name="dice" /> Any Type
          </button>
          <button
            className="btn-type"
            onClick={() => handleGetNextExercise("handwriting")}
            disabled={busy || !selectedStudentId}
          >
            <KidIcon name="pencil" /> Handwriting
          </button>
          <button
            className="btn-type"
            onClick={() => handleGetNextExercise("word_typing")}
            disabled={busy || !selectedStudentId}
          >
            <KidIcon name="keyboard" /> Word Typing
          </button>
          <button
            className="btn-type"
            onClick={() => handleGetNextExercise("sentence_typing")}
            disabled={busy || !selectedStudentId}
          >
            <KidIcon name="note" /> Sentence Typing
          </button>
          <button
            className="btn-type"
            onClick={() => handleGetNextExercise("tracing")}
            disabled={busy || !selectedStudentId}
          >
            <KidIcon name="pencil" /> Tracing
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {exercise && (
        <div className="card">
          <h3>Exercise ({exercise.type})</h3>
          {isTyping ? (
            <div className="as-prompt" style={{ marginLeft: "auto", marginRight: "auto", maxWidth: 820 }}>
              {extractTypingPrompt(exercise.type as any, exercise.content, exercise.expected)}
            </div>
          ) : (
            <p className="exercise-content">{exercise.content}</p>
          )}
          {!isTyping ? (
            <p className="exercise-expected">
              <strong>Expected:</strong> {exercise.expected}
            </p>
          ) : null}

          {isTyping && (
            <div style={{ marginTop: 14, display: "grid", placeItems: "center", gap: 12 }}>
              <input
                className="as-input"
                type="text"
                placeholder="Write your answer…"
                value={typingResponse}
                onChange={(e) => setTypingResponse(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmitTyping()}
              />
              <button onClick={handleSubmitTyping} disabled={busy || !typingResponse.trim()} className="btn-type">
                Submit
              </button>
            </div>
          )}

          {isHandwriting && (
            <div>
              <label className="file-label">
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => setHandwritingFile(e.target.files?.[0] ?? null)}
                />
                Choose photo
              </label>
              {previewUrl && (
                <div className="preview-wrap">
                  <img src={previewUrl} alt="Preview" className="preview-img" />
                </div>
              )}
              <button
                className="btn-type"
                onClick={handleSubmitHandwriting}
                disabled={busy || !handwritingFile}
              >
                Submit handwriting
              </button>
            </div>
          )}

          {isTracing && exercise && (
            <TracingCanvas
              expected={exercise.expected}
              onComplete={async (traceScore, durationSeconds, strokeErrors) => {
                if (!sessionId) return;
                setBusy(true);
                setError(null);
                try {
                  const res = await submitTracing(sessionId, {
                    trace_score: traceScore,
                    duration_seconds: durationSeconds,
                    stroke_errors: strokeErrors
                  });
                  setResult(res);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Submit failed");
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
            />
          )}
        </div>
      )}

      {result && (
        <>
          {"ocr_text" in result ? (
            <HandwritingSessionResult
              recognizedText={result.recognized_text}
              score={result.score}
              feedback={result.feedback}
            />
          ) : (
            <div className="card">
              <h3>Result</h3>
              <p><strong>Score:</strong> {((result as { score: number }).score * 100).toFixed(0)}%</p>
              <p><strong>Feedback:</strong> {(result as { feedback: string }).feedback}</p>
            </div>
          )}
          <div className="card">
            <div className="form-row">
              <button onClick={handleTryAgain} disabled={busy}>
                <KidIcon name="repeat" /> Try Again (same exercise)
              </button>
              <button onClick={() => handleGetNextExercise(lastExerciseType)} disabled={busy}>
                Next Exercise
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

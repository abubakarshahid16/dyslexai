import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../contexts/AuthContext";
import {
  createAssignment,
  createSession,
  fetchExerciseStudents,
  getAssignment,
  listAssignments,
  submitHandwriting,
  submitTracing,
  submitTyping,
} from "../lib/api";
import type { ExerciseStudent } from "../types";
import type {
  AssignmentDetail,
  AssignmentDetailExercise,
  AssignmentExerciseType,
  AssignmentListItem,
} from "../lib/api";
import { TracingCanvas } from "../components/TracingCanvas";

function formatDue(dueAt?: string | null): string {
  if (!dueAt) return "No deadline";
  const d = new Date(dueAt);
  return d.toLocaleString();
}

function cleanAssignmentPrompt(type: AssignmentExerciseType, content: string, expected: string): string {
  const c = (content || "").trim();
  const e = (expected || "").trim();
  if (!c) return e;
  const patterns: RegExp[] = [
    /^type this word:\s*(.+)$/i,
    /^type this sentence:\s*(.+)$/i,
    /^write this word:\s*(.+)$/i,
    /^write this sentence:\s*(.+)$/i,
    /^trace this letter:\s*(.+)$/i,
    /^trace this word:\s*(.+)$/i,
  ];
  for (const re of patterns) {
    const m = c.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  if (type === "word_typing" || type === "sentence_typing" || type === "handwriting" || type === "tracing") {
    return c;
  }
  return e || c;
}

const SINGLE_WORD_PATTERN = /^[a-z]+(?:[-'][a-z]+)*$/i;

function normalizeExpectedAnswer(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function validateExpectedByType(type: AssignmentExerciseType, rawValue: string): string | null {
  const value = normalizeExpectedAnswer(rawValue);
  if (!value) return "Expected answer is required.";

  const tokenCount = (value.match(/[a-z]+(?:[-'][a-z]+)*/gi) || []).length;
  if (type === "word_typing" && !SINGLE_WORD_PATTERN.test(value)) {
    return "Word typing must be a single word only (no sentence).";
  }
  if (type === "sentence_typing" && tokenCount < 2) {
    return "Sentence typing must contain a sentence (at least two words).";
  }
  if (type === "tracing" && !SINGLE_WORD_PATTERN.test(value)) {
    return "Tracing must be a single letter or single word (not a sentence).";
  }
  return null;
}

function TeacherAssignments() {
  const [students, setStudents] = useState<ExerciseStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  const [mode, setMode] = useState<"custom" | "generate">("generate");
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState<string>(""); // datetime-local

  // Generate mode
  const [genType, setGenType] = useState<AssignmentExerciseType>("word_typing");
  const [genDifficulty, setGenDifficulty] = useState(2);
  const [genCount, setGenCount] = useState(3);

  // Custom mode (single exercise editor + list)
  const [customList, setCustomList] = useState<
    Array<{ type: AssignmentExerciseType; content: string; expected: string; target_words: string }>
  >([]);
  const [cxType, setCxType] = useState<AssignmentExerciseType>("word_typing");
  const [cxExpected, setCxExpected] = useState("friend");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const customExpectedError = useMemo(
    () => validateExpectedByType(cxType, cxExpected),
    [cxType, cxExpected]
  );

  const customExpectedHint = useMemo(() => {
    if (cxType === "word_typing") return "Use one word only (example: friend).";
    if (cxType === "sentence_typing") return "Use a full sentence (example: my friend went to school).";
    if (cxType === "tracing") return "Use one letter or one word only (example: a or friend).";
    return "Use a word or short sentence.";
  }, [cxType]);

  useEffect(() => {
    setLoadingStudents(true);
    fetchExerciseStudents()
      .then((list) => setStudents(list))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load students"))
      .finally(() => setLoadingStudents(false));
  }, []);

  const canCreate = useMemo(() => {
    if (!studentId || !title.trim()) return false;
    if (mode === "custom") return customList.length > 0;
    return genCount > 0 && genDifficulty > 0 && !!genType;
  }, [studentId, title, mode, customList.length, genCount, genDifficulty, genType]);

  async function handleAddCustom() {
    const normalizedExpected = normalizeExpectedAnswer(cxExpected);
    const validationError = validateExpectedByType(cxType, normalizedExpected);
    if (validationError) {
      setError(validationError);
      return;
    }

    const extractedTargets = normalizedExpected
      .toLowerCase()
      .split(/[^a-zA-Z]+/g)
      .map((w) => w.trim())
      .filter(Boolean);

    setError(null);
    setCustomList((p) => [
      ...p,
      {
        type: cxType,
        content: normalizedExpected,
        expected: normalizedExpected,
        target_words: extractedTargets.join(","),
      },
    ]);
    setCxExpected("");
  }

  async function handleCreate() {
    if (!canCreate) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const dueIso = dueAt ? new Date(dueAt).toISOString() : null;
      if (mode === "custom") {
        await createAssignment({
          student_id: studentId,
          title: title.trim(),
          description: description.trim() || undefined,
          due_at: dueIso,
          mode: "custom",
          custom_exercises: customList.map((c) => ({
            type: c.type,
            content: c.content,
            expected: c.expected,
            target_words: c.target_words
              .split(",")
              .map((w) => w.trim())
              .filter(Boolean),
            difficulty: 1,
          })),
        });
      } else {
        await createAssignment({
          student_id: studentId,
          title: title.trim(),
          description: description.trim() || undefined,
          due_at: dueIso,
          mode: "generate",
          generate: {
            type: genType,
            words: [],
            difficulty: genDifficulty,
            student_age: 10,
            count: genCount,
          },
        });
      }
      setSuccess("Assignment created.");
      setTitle("");
      setDescription("");
      setDueAt("");
      setCustomList([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create assignment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="hero">
        <div>
          <span className="hero-badge">Teacher</span>
          <h1>Assignments</h1>
          <p>Create homework with a deadline. Choose custom exercises or generate by LLM.</p>
        </div>
      </section>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="card">{success}</div>}

      <div className="card">
        <h3>Create Assignment</h3>
        <div className="assignments-grid">
          <label className="assignments-field">
            <span className="assignments-label">Student</span>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={busy || loadingStudents}>
              <option value="">{loadingStudents ? "Loading students…" : "Select student…"}</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (Level {s.difficulty_level})
                </option>
              ))}
            </select>
          </label>
          <label className="assignments-field">
            <span className="assignments-label">Title</span>
            <input
              type="text"
              placeholder="e.g. Week 3 homework"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="assignments-field assignments-field-span2">
            <span className="assignments-label">Description (optional)</span>
            <input
              type="text"
              placeholder="Short instructions for the student"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="assignments-field">
            <span className="assignments-label">Deadline (optional)</span>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              disabled={busy}
              title="Deadline"
            />
          </label>
        </div>

        <div className="form-row assignments-mode-row">
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="radio" checked={mode === "generate"} onChange={() => setMode("generate")} disabled={busy} />
            Generate with LLM
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="radio" checked={mode === "custom"} onChange={() => setMode("custom")} disabled={busy} />
            Custom (hardcoded)
          </label>
        </div>
      </div>

      {mode === "generate" ? (
        <div className="card">
          <h3>Generate exercises</h3>
          <div className="assignments-grid">
            <label className="assignments-field">
              <span className="assignments-label">Exercise type</span>
              <select value={genType} onChange={(e) => setGenType(e.target.value as AssignmentExerciseType)} disabled={busy}>
                <option value="word_typing">Word typing</option>
                <option value="sentence_typing">Sentence typing</option>
                <option value="handwriting">Handwriting</option>
                <option value="tracing">Tracing</option>
              </select>
            </label>
            <label className="assignments-field">
              <span className="assignments-label">Difficulty (1–10)</span>
              <input
                type="number"
                min={1}
                max={10}
                value={genDifficulty}
                onChange={(e) => setGenDifficulty(Number(e.target.value))}
                disabled={busy}
              />
            </label>
            <label className="assignments-field">
              <span className="assignments-label">How many exercises</span>
              <input
                type="number"
                min={1}
                max={10}
                value={genCount}
                onChange={(e) => setGenCount(Number(e.target.value))}
                disabled={busy}
              />
            </label>
          </div>
          <p style={{ color: "var(--color-text-secondary)", marginTop: 10 }}>
            Generated assignments automatically target the student’s weak words and respect your selected difficulty.
          </p>
          <button className="primary-button assignments-cta" onClick={handleCreate} disabled={busy || !canCreate}>
            {busy ? "Creating…" : "Create assignment"}
          </button>
        </div>
      ) : (
        <>
          <div className="card">
            <h3>Add custom exercise</h3>
            <div className="assignments-grid">
              <label className="assignments-field">
                <span className="assignments-label">Type</span>
                <select
                  value={cxType}
                  onChange={(e) => setCxType(e.target.value as AssignmentExerciseType)}
                  disabled={busy}
                >
                  <option value="word_typing">Word typing</option>
                  <option value="sentence_typing">Sentence typing</option>
                  <option value="handwriting">Handwriting</option>
                  <option value="tracing">Tracing</option>
                </select>
              </label>
              <label className="assignments-field">
                <span className="assignments-label">Expected answer</span>
                <input
                  type="text"
                  value={cxExpected}
                  onChange={(e) => {
                    setCxExpected(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={busy}
                  placeholder={customExpectedHint}
                />
                <span style={{ color: customExpectedError ? "var(--color-error)" : "var(--color-text-muted)", fontSize: 13 }}>
                  {customExpectedError || customExpectedHint}
                </span>
              </label>
            </div>
            <div className="assignments-actions-row assignments-custom-actions">
              <div className="form-row">
                <button className="primary-button" onClick={handleAddCustom} disabled={busy || !!customExpectedError}>
                  Add to assignment
                </button>
                <button className="primary-button" onClick={handleCreate} disabled={busy || !canCreate}>
                  {busy ? "Creating…" : `Create assignment (${customList.length} exercises)`}
                </button>
              </div>
            </div>
          </div>

          {customList.length > 0 && (
            <div className="card">
              <h3>Exercises in this assignment</h3>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {customList.map((c, idx) => (
                  <li key={idx}>
                    <strong>{c.type}</strong> — {c.expected}{" "}
                    <span style={{ color: "var(--color-text-muted)" }}>
                      (expected: {c.expected})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StudentAssignments() {
  const { user } = useAuth();
  const studentId = user?.student_id ?? null;

  const [list, setList] = useState<AssignmentListItem[]>([]);
  const [selected, setSelected] = useState<AssignmentDetail | null>(null);
  const [mode, setMode] = useState<"list" | "play" | "detail">("list");
  const [playIndex, setPlayIndex] = useState(0);
  const [runResults, setRunResults] = useState<Array<{ exerciseId: string; score: number; feedback?: string; studentResponse?: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [typingResponse, setTypingResponse] = useState("");
  const [handwritingFile, setHandwritingFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    listAssignments()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load assignments"))
      .finally(() => setLoading(false));
  }, []);

  const pendingAssignments = useMemo(
    () => list.filter((a) => (a.completed_exercises ?? 0) < (a.exercise_count ?? 0)),
    [list]
  );
  const completedAssignments = useMemo(
    () => list.filter((a) => (a.exercise_count ?? 0) > 0 && (a.completed_exercises ?? 0) >= (a.exercise_count ?? 0)),
    [list]
  );

  async function openAssignment(id: number, openMode: "play" | "detail") {
    setBusy(true);
    setError(null);
    setSelected(null);
    setTypingResponse("");
    setHandwritingFile(null);
    setResult(null);
    try {
      const detail = await getAssignment(id);
      setSelected(detail);
      setPlayIndex(0);
      setRunResults([]);
      setMode(openMode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open assignment");
    } finally {
      setBusy(false);
    }
  }

  const playExercises = useMemo(() => {
    if (!selected) return [];
    return selected.exercises.filter((e) => !e.completed);
  }, [selected]);

  const currentExercise = playExercises[playIndex] ?? null;
  const avgScore = useMemo(() => {
    if (!runResults.length) return null;
    return runResults.reduce((s, r) => s + r.score, 0) / runResults.length;
  }, [runResults]);

  async function submitForExercise(ex: AssignmentDetailExercise, kind: AssignmentExerciseType) {
    if (!studentId || !selected) return;
    setBusy(true);
    setError(null);
    try {
      const sess = await createSession({
        student_id: studentId,
        exercise_id: ex.id,
        is_handwriting: kind === "handwriting",
        assignment_id: selected.id
      } as any);

      if (kind === "word_typing" || kind === "sentence_typing") {
        const res = await submitTyping(sess.session_id, { student_response: typingResponse.trim() });
        setResult({ score: res.score, feedback: res.feedback });
        setRunResults((p) => [...p, { exerciseId: ex.id, score: res.score, feedback: res.feedback, studentResponse: typingResponse.trim() }]);
      } else if (kind === "handwriting") {
        if (!handwritingFile) throw new Error("Choose a photo first");
        const res = await submitHandwriting(sess.session_id, handwritingFile);
        setResult(res);
        setRunResults((p) => [...p, { exerciseId: ex.id, score: res.score, feedback: res.feedback, studentResponse: (res as any).ocr_text ?? null }]);
      }
      // tracing is handled by canvas callback

      // refresh assignment detail so completion ticks update
      const refreshed = await getAssignment(selected.id);
      setSelected(refreshed);
      setTypingResponse("");
      setHandwritingFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitTracingForExercise(ex: AssignmentDetailExercise, traceScore: number, durationSeconds: number, strokeErrors?: any[]) {
    if (!studentId || !selected) return;
    setBusy(true);
    setError(null);
    try {
      const sess = await createSession({
        student_id: studentId,
        exercise_id: ex.id,
        is_handwriting: false,
        assignment_id: selected.id
      } as any);
      const res = await submitTracing(sess.session_id, {
        trace_score: traceScore,
        duration_seconds: durationSeconds,
        stroke_errors: strokeErrors
      });
      setResult(res);
      setRunResults((p) => [...p, { exerciseId: ex.id, score: res.score, feedback: res.feedback, studentResponse: ex.expected }]);
      const refreshed = await getAssignment(selected.id);
      setSelected(refreshed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  if (!studentId) {
    return (
      <div className="page-stack">
        <div className="error-banner">No student profile is linked to this account.</div>
      </div>
    );
  }

  // Assignment Mode (full-screen, sequential, like Game Mode)
  if (mode === "play" && selected) {
    if (!currentExercise) {
      return (
        <div className="as-player">
          <div className="as-player-card">
            <div className="as-badge">Assignment complete</div>
            <h2 className="as-title">{selected.title}</h2>
            <p className="as-subtitle">
              Average score: <strong>{avgScore != null ? `${Math.round(avgScore * 100)}%` : "—"}</strong>
            </p>
            <div className="as-results">
              {runResults.map((r, idx) => (
                <div key={idx} className="as-result-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <span><strong>#{idx + 1}</strong> {Math.round(r.score * 100)}%</span>
                    {r.studentResponse ? <span className="as-muted">Answer: {r.studentResponse}</span> : null}
                  </div>
                  {r.feedback ? (
                    <div className="as-muted" style={{ marginTop: 6 }}>
                      <strong>Feedback:</strong> {r.feedback}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="form-row" style={{ justifyContent: "center" }}>
              <button
                onClick={async () => {
                  setMode("list");
                  setSelected(null);
                  setResult(null);
                  setTypingResponse("");
                  setHandwritingFile(null);
                  setList(await listAssignments());
                }}
                disabled={busy}
                className="primary-button"
              >
                Back to assignments
              </button>
            </div>
          </div>
        </div>
      );
    }

    const isTyping = currentExercise.type === "word_typing" || currentExercise.type === "sentence_typing";
    const isHandwriting = currentExercise.type === "handwriting";
    const isTracing = currentExercise.type === "tracing";

    return (
      <div className="as-player">
        <div className="as-player-card">
          <div className="as-header">
            <div>
              <div className="as-badge">Assignment</div>
              <h2 className="as-title">{selected.title}</h2>
              <div className="as-subtitle">Exercise {playIndex + 1} / {playExercises.length}</div>
            </div>
            <button className="as-exit" onClick={() => { setMode("list"); setSelected(null); setResult(null); }} disabled={busy}>
              Exit
            </button>
          </div>

          <div className="as-prompt">
            {cleanAssignmentPrompt(currentExercise.type, currentExercise.content, currentExercise.expected)}
          </div>

          {isTyping && (
            <div className="as-input-row">
              <input
                className="as-input"
                type="text"
                placeholder="Type your answer…"
                value={typingResponse}
                onChange={(e) => setTypingResponse(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitForExercise(currentExercise, currentExercise.type)}
                disabled={busy}
                autoFocus
              />
              <button className="primary-button" onClick={() => submitForExercise(currentExercise, currentExercise.type)} disabled={busy || !typingResponse.trim()}>
                Submit
              </button>
            </div>
          )}

          {isHandwriting && (
            <div className="as-input-row" style={{ justifyContent: "space-between" }}>
              <label className="file-label" style={{ marginRight: 0 }}>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => setHandwritingFile(e.target.files?.[0] ?? null)}
                  disabled={busy}
                />
                Choose photo
              </label>
              <button className="primary-button" onClick={() => submitForExercise(currentExercise, "handwriting")} disabled={busy || !handwritingFile}>
                Submit
              </button>
            </div>
          )}

          {isTracing && (
            <TracingCanvas
              expected={currentExercise.expected}
              disabled={busy}
              onComplete={(traceScore, durationSeconds, strokeErrors) =>
                submitTracingForExercise(currentExercise, traceScore, durationSeconds, strokeErrors as any)
              }
            />
          )}

          <div className="as-footer">
            <button
              className="primary-button"
              onClick={() => {
                // Move forward after a successful submit; results shown at the end
                setResult(null);
                setTypingResponse("");
                setHandwritingFile(null);
                setPlayIndex((i) => i + 1);
              }}
              disabled={busy || runResults.length < playIndex + 1}
            >
              {playIndex + 1 >= playExercises.length ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Completed assignment detail (read-only)
  if (mode === "detail" && selected) {
    const completed = selected.exercises.filter((e) => e.completed);
    const scores = completed.map((e) => e.last_result?.score).filter((s): s is number => typeof s === "number");
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    return (
      <div className="page-stack">
        <section className="hero">
          <div>
            <span className="hero-badge">Assignment Details</span>
            <h1>{selected.title}</h1>
            <p>
              Average score: <strong>{avg != null ? `${Math.round(avg * 100)}%` : "—"}</strong>
            </p>
          </div>
        </section>

        <div className="card">
          <div className="form-row" style={{ justifyContent: "space-between" }}>
            <div style={{ color: "var(--color-text-secondary)" }}>
              Deadline: <strong>{formatDue(selected.due_at)}</strong>
            </div>
            <button
              className="primary-button"
              onClick={() => {
                setMode("list");
                setSelected(null);
              }}
              disabled={busy}
            >
              Back
            </button>
          </div>
        </div>

        {selected.exercises.map((e) => (
          <div key={e.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ margin: 0 }}>{e.type}</h3>
                <p style={{ color: "var(--color-text-secondary)", marginTop: 6, marginBottom: 0 }}>
                  {cleanAssignmentPrompt(e.type, e.content, e.expected)}
                </p>
              </div>
              <div style={{ color: "var(--color-text-secondary)" }}>
                {e.last_result?.score != null ? (
                  <span>
                    Score: <strong>{Math.round(e.last_result.score * 100)}%</strong>
                  </span>
                ) : (
                  <span>Status: <strong>{e.completed ? "Completed" : "Pending"}</strong></span>
                )}
              </div>
            </div>
            <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
              <div>
                <strong>Expected:</strong> {e.expected}
              </div>
              {e.last_result?.student_response ? (
                <div>
                  <strong>Written:</strong> {e.last_result.student_response}
                </div>
              ) : null}
              {e.last_result?.feedback ? (
                <div>
                  <strong>Feedback:</strong> {e.last_result.feedback}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="hero">
        <div>
          <span className="hero-badge">Student</span>
          <h1>My Assignments</h1>
          <p>Complete assignments before their deadline.</p>
        </div>
      </section>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <h3>Pending assignments</h3>
        {loading ? (
          <div style={{ textAlign: "center", padding: 12 }}>Loading…</div>
        ) : pendingAssignments.length === 0 ? (
          <div style={{ color: "var(--color-text-muted)" }}>No assignments yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {pendingAssignments.map((a) => (
              <button
                key={a.id}
                className="student-dropdown-item"
                onClick={() => openAssignment(a.id, "play")}
                disabled={busy}
                style={{ textAlign: "left" }}
              >
                <strong>{a.title}</strong>
                <div style={{ color: "var(--color-text-secondary)", marginTop: 4 }}>
                  Due: {formatDue(a.due_at)} · Progress: {a.completed_exercises}/{a.exercise_count}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Completed assignments</h3>
        {loading ? (
          <div style={{ textAlign: "center", padding: 12 }}>Loading…</div>
        ) : completedAssignments.length === 0 ? (
          <div style={{ color: "var(--color-text-muted)" }}>No completed assignments yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {completedAssignments.map((a) => (
              <button
                key={a.id}
                className="student-dropdown-item"
                onClick={() => openAssignment(a.id, "detail")}
                disabled={busy}
                style={{ textAlign: "left" }}
              >
                <strong>{a.title}</strong>
                <div style={{ color: "var(--color-text-secondary)", marginTop: 4 }}>
                  Completed · {a.exercise_count}/{a.exercise_count}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Clicking a pending assignment starts Assignment Mode above */}
    </div>
  );
}

export function AssignmentsPage() {
  const { user } = useAuth();
  if (user?.role === "teacher") return <TeacherAssignments />;
  return <StudentAssignments />;
}


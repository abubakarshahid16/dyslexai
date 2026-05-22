import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { MetricsCards } from "../components/MetricsCards";
import { PerformanceChart } from "../components/PerformanceChart";
import { StudentStatsCard } from "../components/StudentStatsCard";
import {
  fetchHistory,
  fetchOverview,
  fetchStudentProgress,
  submitReview,
  fetchExerciseStats,
  fetchMyAttendance,
  listAssignments,
  fetchGameProgress,
  type GameProgressResponse
} from "../lib/api";
import { phaseDayRange, phaseForDay } from "../features/game-mode/gamePhase";
import type { DashboardOverview, HistoryItem, StudentProgress } from "../types";
import type { ExerciseStats } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { TeacherDashboardPage } from "./TeacherDashboardPage";
import { KidIcon } from "../components/KidIcon";

export function DashboardPage() {
  const { user } = useAuth();
  const isStudent = user?.role === "student";

  // ── Student dashboard state ───────────────────────────────────────────────
  const [exerciseStats, setExerciseStats] = useState<ExerciseStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [attendanceDates, setAttendanceDates] = useState<string[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsSummary, setAssignmentsSummary] = useState<{
    total: number;
    completed: number;
    typeCounts: Record<string, number>;
    avgScoreCompleted: number | null;
  }>({ total: 0, completed: 0, typeCounts: {}, avgScoreCompleted: null });

  const [gameProgress, setGameProgress] = useState<GameProgressResponse | null>(null);
  const [gameLoading, setGameLoading] = useState(false);

  // ── Teacher / OCR dashboard state ─────────────────────────────────────────
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [progress, setProgress] = useState<StudentProgress[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBuffer, setEditBuffer] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Load student exercise stats
  useEffect(() => {
    if (!isStudent || !user?.student_id) return;
    setStatsLoading(true);
    fetchExerciseStats(user.student_id)
      .then((data) => { setExerciseStats(data); setStatsError(null); })
      .catch((e) => setStatsError(e instanceof Error ? e.message : "Failed to load stats"))
      .finally(() => setStatsLoading(false));
  }, [isStudent, user?.student_id]);

  // Load student attendance (last 30 days)
  useEffect(() => {
    if (!isStudent) return;
    setAttendanceLoading(true);
    fetchMyAttendance()
      .then((row) => setAttendanceDates(row.dates ?? []))
      .catch(() => setAttendanceDates([]))
      .finally(() => setAttendanceLoading(false));
  }, [isStudent]);

  // Load student assignments summary
  useEffect(() => {
    if (!isStudent) return;
    setAssignmentsLoading(true);
    listAssignments()
      .then((items) => {
        const total = items.length;
        const completedItems = items.filter((a) => (a.completed_exercises ?? 0) >= (a.exercise_count ?? 0) && (a.exercise_count ?? 0) > 0);
        const completed = completedItems.length;
        const typeCounts: Record<string, number> = {};
        for (const a of items) {
          for (const t of a.types ?? []) {
            typeCounts[t] = (typeCounts[t] ?? 0) + 1;
          }
        }
        const scores = completedItems.map((a) => a.avg_score).filter((s): s is number => typeof s === "number");
        const avgScoreCompleted = scores.length ? Math.round((scores.reduce((x, y) => x + y, 0) / scores.length) * 1000) / 1000 : null;
        setAssignmentsSummary({ total, completed, typeCounts, avgScoreCompleted });
      })
      .catch(() => setAssignmentsSummary({ total: 0, completed: 0, typeCounts: {}, avgScoreCompleted: null }))
      .finally(() => setAssignmentsLoading(false));
  }, [isStudent]);

  useEffect(() => {
    if (!isStudent) return;
    setGameLoading(true);
    fetchGameProgress()
      .then(setGameProgress)
      .catch(() => setGameProgress(null))
      .finally(() => setGameLoading(false));
  }, [isStudent]);

  const gameSummary = useMemo(() => {
    if (!gameProgress) return null;
    const { progress, completions } = gameProgress;
    const currentDay = progress.current_day ?? 1;
    const phase = phaseForDay(currentDay);
    const [lo, hi] = phaseDayRange(phase);
    const piecesThisPhase = completions.filter((c) => c.day_number >= lo && c.day_number <= hi).length;
    const phaseTotal = hi - lo + 1;
    const last = completions.length ? completions[completions.length - 1] : null;
    return {
      streak: progress.streak ?? 0,
      currentDay,
      phase,
      daysDone: completions.length,
      piecesThisPhase,
      phaseTotal,
      lastScore: last?.score ?? null,
      lastDayDone: last?.day_number ?? null
    };
  }, [gameProgress]);

  const last30Days = useMemo(() => {
    const days: string[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }, []);

  // Load teacher OCR dashboard
  const loadTeacherData = () => {
    if (isStudent) return;
    setError(null);
    void Promise.all([
      fetchOverview().catch((e) => { throw e; }),
      fetchHistory().catch((e) => { throw e; }),
      fetchStudentProgress().catch(() => []),
    ])
      .then(([overviewResponse, historyResponse, progressResponse]) => {
        setOverview(overviewResponse);
        setHistory(historyResponse);
        setProgress(progressResponse);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      });
  };

  useEffect(() => {
    if (!isStudent) loadTeacherData();
  }, [isStudent]);

  const handleReview = async (runId: number, status: string, text?: string) => {
    try {
      await submitReview(runId, { review_status: status, reviewed_text: text });
      setEditingId(null);
      loadTeacherData();
    } catch {
      alert("Failed to update review status");
    }
  };

  // ── Student view ──────────────────────────────────────────────────────────
  if (isStudent) {
    const dateSet = new Set(attendanceDates);
    const activeDays = last30Days.filter((d) => dateSet.has(d)).length;
    return (
      <div className="page-stack">
        <section className="hero">
          <div>
            <span className="hero-badge">My Progress</span>
            <h1>
              Hello, {user?.name}! <KidIcon name="wave" />
            </h1>
            <p>Here's your exercise progress and performance summary.</p>
          </div>
        </section>

        {statsLoading && <div className="card" style={{ textAlign: "center" }}>Loading your stats…</div>}
        {statsError && <div className="error-banner">{statsError}</div>}
        {exerciseStats && <StudentStatsCard stats={exerciseStats} />}

        <div className="card dashboard-game-card">
          <h3>Daily Lessons</h3>
          {gameLoading ? (
            <div style={{ textAlign: "center", padding: 12 }}>Loading Daily Lessons…</div>
          ) : gameSummary ? (
            <>
              <p style={{ color: "var(--color-text-secondary)", marginTop: 0, marginBottom: 12 }}>
                90-day reading path — complete today&apos;s 4 challenges to earn a puzzle piece.
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 12,
                  marginBottom: 12
                }}
              >
                <div className="dashboard-game-stat">
                  <span className="dashboard-game-stat-label">Streak</span>
                  <strong className="dashboard-game-stat-value">
                    {gameSummary.streak} <KidIcon name="flame" />
                  </strong>
                </div>
                <div className="dashboard-game-stat">
                  <span className="dashboard-game-stat-label">Next day</span>
                  <strong className="dashboard-game-stat-value">Day {gameSummary.currentDay}</strong>
                </div>
                <div className="dashboard-game-stat">
                  <span className="dashboard-game-stat-label">Days finished</span>
                  <strong className="dashboard-game-stat-value">
                    {gameSummary.daysDone}/90
                  </strong>
                </div>
                <div className="dashboard-game-stat">
                  <span className="dashboard-game-stat-label">Phase {gameSummary.phase} pieces</span>
                  <strong className="dashboard-game-stat-value">
                    {gameSummary.piecesThisPhase}/{gameSummary.phaseTotal} <KidIcon name="puzzle" />
                  </strong>
                </div>
              </div>
              {gameSummary.lastScore != null && (
                <p style={{ color: "var(--color-text-secondary)", fontSize: "0.95rem", marginBottom: 12 }}>
                  Last saved day: <strong>Day {gameSummary.lastDayDone}</strong> — score{" "}
                  <strong>{gameSummary.lastScore}%</strong>
                </p>
              )}
              <Link to="/game" className="btn primary" style={{ minHeight: 44, padding: "10px 18px", fontSize: "1rem" }}>
                Open Daily Lessons
              </Link>
            </>
          ) : (
            <p style={{ color: "var(--color-text-muted)" }}>Daily Lessons progress unavailable. Open Daily Lessons once while logged in.</p>
          )}
        </div>

        <div className="card">
          <h3>Assignments</h3>
          {assignmentsLoading ? (
            <div style={{ textAlign: "center", padding: 12 }}>Loading assignments…</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <span style={{ color: "var(--color-text-secondary)" }}>
                  Completed: <strong>{assignmentsSummary.completed}</strong>/{assignmentsSummary.total}
                </span>
                <span style={{ color: "var(--color-text-secondary)" }}>
                  Avg score (completed):{" "}
                  <strong>
                    {assignmentsSummary.avgScoreCompleted != null ? `${Math.round(assignmentsSummary.avgScoreCompleted * 100)}%` : "—"}
                  </strong>
                </span>
                <span style={{ color: "var(--color-text-secondary)" }}>
                  Types assigned:{" "}
                  <strong>
                    {Object.keys(assignmentsSummary.typeCounts).length
                      ? Object.entries(assignmentsSummary.typeCounts)
                        .map(([t, n]) => `${t} (${n})`)
                        .join(", ")
                      : "None"}
                  </strong>
                </span>
              </div>
              <p style={{ color: "var(--color-text-secondary)", marginTop: 10, marginBottom: 0 }}>
                Go to <strong>My Assignments</strong> to complete your pending work.
              </p>
            </>
          )}
        </div>

        <div className="card">
          <h3>Attendance — Last 30 Days</h3>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: 12 }}>
            You are marked present on days you complete at least one exercise.
          </p>
          {attendanceLoading ? (
            <div style={{ textAlign: "center", padding: 12 }}>Loading attendance…</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                <span style={{ color: "var(--color-text-secondary)" }}>
                  Active: <strong>{activeDays}</strong>/30 days
                </span>
                <span style={{ color: "var(--color-text-secondary)" }}>
                  Today: <strong>{dateSet.has(new Date().toISOString().slice(0, 10)) ? "Present" : "Not yet"}</strong>
                </span>
              </div>
              <div className="attendance-days-col" style={{ gridTemplateColumns: `repeat(${last30Days.length}, 1fr)` }}>
                {last30Days.map((d) => (
                  <div
                    key={d}
                    className={`attendance-cell ${dateSet.has(d) ? "attendance-cell-active" : ""}`}
                    title={`${d}${dateSet.has(d) ? " — Present" : ""}`}
                  />
                ))}
              </div>
              <div className="attendance-legend" style={{ marginTop: 10 }}>
                <span className="attendance-legend-item">
                  <span className="attendance-cell attendance-cell-active" style={{ width: 12, height: 12 }} /> Present
                </span>
                <span className="attendance-legend-item">
                  <span className="attendance-cell" style={{ width: 12, height: 12 }} /> Absent
                </span>
              </div>
            </>
          )}
        </div>

        {!statsLoading && !exerciseStats && !statsError && (
          <div className="card" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
            <p>
              No exercise data yet. Go to <strong>Exercises</strong> to get started! <KidIcon name="rocket" />
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Teacher view ──────────────────────────────────────────────────────────
  return <TeacherDashboardPage />;
}


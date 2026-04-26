import { useEffect, useState, useMemo, useCallback, useRef } from "react";

import { StudentStatsCard } from "../components/StudentStatsCard";
import { KidIcon } from "../components/KidIcon";
import {
  fetchTeacherSummary,
  fetchAllAttendance,
  fetchExerciseStudents,
  fetchExerciseStats,
} from "../lib/api";
import type { TeacherSummary, StudentAttendance, ExerciseStats } from "../lib/api";
import type { ExerciseStudent } from "../types";
import { useAuth } from "../contexts/AuthContext";

export function TeacherDashboardPage() {
  const { user } = useAuth();
  const searchWrapRef = useRef<HTMLDivElement>(null);

  // Collective stats
  const [summary, setSummary] = useState<TeacherSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Students list + search
  const [students, setStudents] = useState<ExerciseStudent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Selected student stats
  const [selectedStudent, setSelectedStudent] = useState<ExerciseStudent | null>(null);
  const [stats, setStats] = useState<ExerciseStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Attendance
  const [attendance, setAttendance] = useState<StudentAttendance[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) {
      setSummaryLoading(true);
      setAttendanceLoading(true);
    }
    setError(null);
    try {
      const [sum, studs, att] = await Promise.all([
        fetchTeacherSummary().catch((e) => {
          console.error(e);
          return null;
        }),
        fetchExerciseStudents().catch(() => []),
        fetchAllAttendance().catch(() => []),
      ]);
      if (sum) setSummary(sum);
      setStudents(studs);
      setAttendance(att);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      if (!silent) {
        setSummaryLoading(false);
        setAttendanceLoading(false);
      }
    }
  }, []);

  // Load all data on mount + auto-refresh for "live" attendance
  useEffect(() => {
    void loadDashboard();

    // Only poll for teachers; students shouldn't be hitting teacher analytics repeatedly.
    if (user?.role !== "teacher") return;

    const intervalMs = 20_000;
    const id = window.setInterval(() => {
      void loadDashboard({ silent: true });
    }, intervalMs);

    const onFocus = () => void loadDashboard({ silent: true });
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadDashboard, user?.role]);

  // Close student dropdown on outside click
  useEffect(() => {
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const el = searchWrapRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (!el.contains(target)) {
        setDropdownOpen(false);
      }
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("touchstart", onPointerDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("touchstart", onPointerDown);
    };
  }, []);

  // Search filtering
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter((s) => s.name.toLowerCase().includes(q));
  }, [students, searchQuery]);

  // Select a student
  async function handleSelectStudent(student: ExerciseStudent) {
    setSelectedStudent(student);
    setDropdownOpen(false);
    setSearchQuery(student.name);
    setStats(null);
    setStatsLoading(true);
    try {
      const data = await fetchExerciseStats(String(student.id));
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load student stats");
    } finally {
      setStatsLoading(false);
    }
  }

  // Generate last 30 days
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

  return (
    <div className="page-stack">
      {/* Hero */}
      <section className="hero">
        <div>
          <span className="hero-badge">Teacher Dashboard</span>
          <h1>
            Hello, {user?.name}! <KidIcon name="wave" />
          </h1>
          <p>
            Overview of all students, their progress, and attendance tracking.
          </p>
        </div>
      </section>

      {error && <div className="error-banner">{error}</div>}

      {/* ── Collective Metrics ── */}
      {summaryLoading ? (
        <div className="card" style={{ textAlign: "center" }}>Loading summary…</div>
      ) : summary ? (
        <div className="teacher-metrics-grid">
          <div className="teacher-metric-card">
            <span className="teacher-metric-icon" style={{ color: "var(--color-primary)" }}>
              <KidIcon name="users" />
            </span>
            <span className="teacher-metric-value">{summary.total_students}</span>
            <span className="teacher-metric-label">Total Students</span>
          </div>
          <div className="teacher-metric-card">
            <span className="teacher-metric-icon" style={{ color: "#f59e0b" }}>
              <KidIcon name="clipboard" />
            </span>
            <span className="teacher-metric-value">{summary.total_sessions}</span>
            <span className="teacher-metric-label">Total Sessions</span>
          </div>
          <div className="teacher-metric-card">
            <span className="teacher-metric-icon" style={{ color: "var(--color-primary)" }}>
              <KidIcon name="chart" />
            </span>
            <span className="teacher-metric-value">{(summary.average_score * 100).toFixed(0)}%</span>
            <span className="teacher-metric-label">Average Score</span>
          </div>
          <div className="teacher-metric-card">
            <span className="teacher-metric-icon" style={{ color: "var(--color-success)" }}>
              <KidIcon name="dot" />
            </span>
            <span className="teacher-metric-value">{summary.active_today}</span>
            <span className="teacher-metric-label">Active Today</span>
          </div>
        </div>
      ) : null}

      {/* ── Student Selector ── */}
      <div className="card">
        <h3>View Student Progress</h3>
        <p style={{ color: "var(--color-text-secondary)", marginBottom: 12 }}>
          Search and select a student to view their detailed exercise dashboard.
        </p>
        <div className="student-search-wrap" ref={searchWrapRef}>
          <div className="student-search-box">
          <span className="student-search-icon">
            <KidIcon name="search" />
          </span>
            <input
              type="text"
              className="student-search-input"
              placeholder="Search students by name…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setDropdownOpen(true);
                if (!e.target.value.trim()) {
                  setSelectedStudent(null);
                  setStats(null);
                }
              }}
              onFocus={() => setDropdownOpen(true)}
            />
            {searchQuery && (
              <button
                className="student-search-clear"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedStudent(null);
                  setStats(null);
                  setDropdownOpen(false);
                }}
                aria-label="Clear search"
              >
                <KidIcon name="x" />
              </button>
            )}
          </div>

          {dropdownOpen && filteredStudents.length > 0 && (
            <div className="student-dropdown">
              {filteredStudents.map((s) => (
                <button
                  key={s.id}
                  className={`student-dropdown-item ${selectedStudent?.id === s.id ? "student-dropdown-item-active" : ""}`}
                  onClick={() => handleSelectStudent(s)}
                >
                  <strong>{s.name}</strong>
                  <span>
                    Level {s.difficulty_level} · {s.total_sessions} sessions · <KidIcon name="flame" />{" "}
                    {s.streak_days}
                  </span>
                </button>
              ))}
            </div>
          )}

          {dropdownOpen && filteredStudents.length === 0 && searchQuery.trim() && (
            <div className="student-dropdown">
              <div className="student-dropdown-empty">No students found matching "{searchQuery}"</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Selected Student Stats ── */}
      {statsLoading && (
        <div className="card" style={{ textAlign: "center" }}>Loading student stats…</div>
      )}
      {selectedStudent && stats && (
        <>
          <div className="card">
            <h3>{selectedStudent.name}'s Dashboard</h3>
            <p style={{ color: "var(--color-text-secondary)", marginTop: 4 }}>
              {selectedStudent.age ? `Age ${selectedStudent.age} · ` : ""}
              Level {selectedStudent.difficulty_level} · {selectedStudent.total_sessions} total sessions ·{" "}
              <KidIcon name="flame" /> {selectedStudent.streak_days} day streak
            </p>
          </div>
          <StudentStatsCard stats={stats} />
        </>
      )}

      {/* ── Attendance Section ── */}
      <div className="card">
        <h3>Attendance — Last 30 Days</h3>
        <p style={{ color: "var(--color-text-secondary)", marginBottom: 16 }}>
          Shows which days each student was active (had exercise sessions).
        </p>

        {attendanceLoading ? (
          <div style={{ textAlign: "center", padding: 16 }}>Loading attendance…</div>
        ) : attendance.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--color-text-muted)", padding: 16 }}>
            No students found.
          </div>
        ) : (
          <div className="attendance-table">
            {/* Date headers */}
            <div className="attendance-header-row">
              <div className="attendance-name-col">Student</div>
              <div className="attendance-days-col">
                {last30Days.map((d) => {
                  const day = new Date(d + "T00:00:00");
                  const label = day.toLocaleDateString("en-US", { day: "numeric" });
                  const weekday = day.toLocaleDateString("en-US", { weekday: "narrow" });
                  return (
                    <div key={d} className="attendance-day-header" title={d}>
                      <span className="attendance-weekday">{weekday}</span>
                      <span className="attendance-date-num">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Student rows */}
            {attendance.map((a) => {
              const dateSet = new Set(a.dates);
              const activeDays = last30Days.filter((d) => dateSet.has(d)).length;
              return (
                <div key={a.student_id} className="attendance-row">
                  <div className="attendance-name-col">
                    <span className="attendance-student-name">{a.student_name}</span>
                    <span className="attendance-active-count">{activeDays}/30 days</span>
                  </div>
                  <div className="attendance-days-col">
                    {last30Days.map((d) => (
                      <div
                        key={d}
                        className={`attendance-cell ${dateSet.has(d) ? "attendance-cell-active" : ""}`}
                        title={`${a.student_name} — ${d}${dateSet.has(d) ? " — Active" : ""}`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Legend */}
            <div className="attendance-legend">
              <span className="attendance-legend-item">
                <span className="attendance-cell attendance-cell-active" style={{ width: 12, height: 12 }} /> Active
              </span>
              <span className="attendance-legend-item">
                <span className="attendance-cell" style={{ width: 12, height: 12 }} /> Inactive
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

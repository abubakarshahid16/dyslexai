import { useEffect, useMemo, useState } from "react";

import { KidIcon } from "../components/KidIcon";
import { listAssignments } from "../lib/api";
import type { AssignmentListItem } from "../lib/api";

function formatDue(dueAt?: string | null): string {
  if (!dueAt) return "No deadline";
  return new Date(dueAt).toLocaleString();
}

function getStatus(item: AssignmentListItem): "Completed" | "Pending" {
  const total = item.exercise_count ?? 0;
  const completed = item.completed_exercises ?? 0;
  return total > 0 && completed >= total ? "Completed" : "Pending";
}

export function AssignmentStatusPage() {
  const [items, setItems] = useState<AssignmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listAssignments()
      .then((list) => setItems(list))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load assignments"))
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    const total = items.length;
    const completed = items.filter((item) => getStatus(item) === "Completed").length;
    const pending = total - completed;
    return { total, completed, pending };
  }, [items]);

  return (
    <div className="page-stack">
      <section className="hero">
        <div>
          <span className="hero-badge">Teacher</span>
          <h1>
            Assignment Status <KidIcon name="check" />
          </h1>
          <p>See which assignments are completed and which are still pending.</p>
        </div>
      </section>

      {error && <div className="error-banner">{error}</div>}

      <div className="teacher-metrics-grid">
        <div className="teacher-metric-card">
          <span className="teacher-metric-icon" style={{ color: "var(--color-primary)" }}>
            <KidIcon name="assignments" />
          </span>
          <span className="teacher-metric-value">{loading ? "…" : summary.total}</span>
          <span className="teacher-metric-label">Total Assignments</span>
        </div>
        <div className="teacher-metric-card">
          <span className="teacher-metric-icon" style={{ color: "var(--color-success)" }}>
            <KidIcon name="check" />
          </span>
          <span className="teacher-metric-value">{loading ? "…" : summary.completed}</span>
          <span className="teacher-metric-label">Completed</span>
        </div>
        <div className="teacher-metric-card">
          <span className="teacher-metric-icon" style={{ color: "#f59e0b" }}>
            <KidIcon name="clipboard" />
          </span>
          <span className="teacher-metric-value">{loading ? "…" : summary.pending}</span>
          <span className="teacher-metric-label">Pending</span>
        </div>
      </div>

      <div className="card">
        <h3>All Assignments</h3>
        {loading ? (
          <div style={{ textAlign: "center", padding: 12 }}>Loading assignments…</div>
        ) : items.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)", marginBottom: 0 }}>No assignments created yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {items.map((assignment) => {
              const total = assignment.exercise_count ?? 0;
              const completed = assignment.completed_exercises ?? 0;
              const status = getStatus(assignment);
              return (
                <div key={assignment.id} className="student-dropdown-item" style={{ cursor: "default", textAlign: "left" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <strong>{assignment.title}</strong>
                    <span style={{ fontWeight: 700, color: status === "Completed" ? "var(--color-success)" : "var(--color-warning)" }}>
                      {status}
                    </span>
                  </div>
                  <div style={{ color: "var(--color-text-secondary)", marginTop: 4 }}>
                    Student: {assignment.student_name || assignment.student_id} · Progress: {completed}/{total}
                    {assignment.due_at ? ` · Due: ${formatDue(assignment.due_at)}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
import { useEffect, useState } from "react";
import { fetchHistory, toAssetUrl } from "../lib/api";
import type { HistoryItem } from "../types";
import { useAuth } from "../contexts/AuthContext";

type Props = {
  limit?: number;
  refreshKey?: string | number | null;
};

export function OcrHistoryPanel({ limit = 8, refreshKey }: Props) {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedRun, setSelectedRun] = useState<HistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function toggleSelectedRun(item: HistoryItem) {
    setSelectedRun((prev) => (prev?.run_id === item.run_id ? null : item));
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchHistory()
      .then((items) => {
        if (cancelled) return;
        const normalized = items
          .map((item) => {
            const corrected = (item.corrected_text || item.reviewed_text || "").trim();
            return {
              ...item,
              corrected_text: corrected,
            };
          })
          .filter((item) => item.corrected_text);
        const next = normalized.slice(0, limit);
        setHistory(next);
        setSelectedRun((prev) => (prev && next.some((h) => h.run_id === prev.run_id) ? prev : null));
      })
      .catch((e) => {
        if (cancelled) return;
        setHistory([]);
        setError(e instanceof Error ? e.message : "Failed to load OCR history");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [limit, refreshKey]);

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>OCR History</h3>
      <p style={{ color: "var(--color-text-secondary)", marginTop: 0, marginBottom: 12 }}>
        {isTeacher ? "Review and audit your OCR runs." : "Your recent OCR runs on this device."}
      </p>
      {loading ? <div style={{ textAlign: "center" }}>Loading history…</div> : null}
      {error ? (
        <div className="error" role="alert">
          {error}
        </div>
      ) : null}
      {!loading && !error && history.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No OCR runs yet.</p>
      ) : null}

      {!loading && !error ? (
        <div style={{ display: "grid", gap: 10 }}>
          {history.map((item) => (
            <div
              key={item.run_id}
              role="button"
              tabIndex={0}
              onClick={() => toggleSelectedRun(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleSelectedRun(item);
                }
              }}
              style={{
                padding: 12,
                borderRadius: 14,
                border: selectedRun?.run_id === item.run_id
                  ? "2px solid var(--color-primary)"
                  : "1px solid var(--color-divider)",
                background: "var(--color-surface-soft)",
                cursor: "pointer"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontWeight: 800 }}>
                  {item.student_name || "Unassigned"}
                  {item.review_status ? (
                    <span
                      style={{
                        marginLeft: 10,
                        fontSize: 11,
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: "rgba(16,185,129,0.12)",
                        border: "1px solid rgba(16,185,129,0.25)",
                        color: "#065f46",
                        fontWeight: 800
                      }}
                    >
                      {item.review_status.toUpperCase()}
                    </span>
                  ) : null}
                </div>
                <div style={{ color: "var(--color-text-secondary)", fontSize: 12 }}>{new Date(item.created_at).toLocaleString()}</div>
              </div>

              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>Corrected</div>
                <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{(item.corrected_text || "").slice(0, 180) || "—"}</div>
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--color-text-secondary)" }}>
                  Click to view original image and full corrected text
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && !error && selectedRun ? (
        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 800 }}>Selected Run Details</div>
          <div>
            {toAssetUrl(selectedRun.original_image_path, selectedRun.original_image_url) ? (
              <img
                src={toAssetUrl(selectedRun.original_image_path, selectedRun.original_image_url) ?? undefined}
                alt="OCR run original"
                style={{ width: "100%", maxWidth: 760, borderRadius: 14, border: "1px solid var(--color-divider)" }}
              />
            ) : (
              <p style={{ color: "var(--color-text-secondary)" }}>Original image not available.</p>
            )}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.85, marginBottom: 6 }}>Corrected</div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{selectedRun.corrected_text || "—"}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


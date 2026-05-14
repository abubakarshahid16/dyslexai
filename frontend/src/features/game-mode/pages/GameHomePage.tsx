import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { useGame } from "../GameContext";
import { KidIcon } from "../../../components/KidIcon";

export default function GameHomePage() {
  const { today, progress, loading, error, loadToday, loadProgress } = useGame();

  useEffect(() => {
    void loadToday();
    void loadProgress();
  }, [loadToday, loadProgress]);

  const dayNumber = today?.day?.day_number ?? progress?.progress?.current_day;
  const phaseNumber = today?.day?.phase_number;

  return (
    <div className="page game-mode-kids">
      <div className="card gm-hero-card">
        <div className="gm-mascot" aria-hidden>
          <KidIcon name="sparkles" />
        </div>
        <h2 style={{ marginTop: 0 }}>Daily Lessons</h2>
        <p className="gm-lead">
          Your 90-day reading adventure — 4 quick challenges a day. Finish the day to earn a <strong>puzzle piece</strong>!
        </p>
        {error ? (
          <div className="error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="gm-stats-row">
          <div className="card gm-stat-bubble" style={{ margin: 0 }}>
            <div className="gm-stat-label">Today&apos;s mission</div>
            <div className="gm-stat-title">{today?.day?.title ?? (loading ? "Loading…" : "—")}</div>
            <div className="gm-stat-sub">
              Day {dayNumber ?? "—"} {phaseNumber ? `• Phase ${phaseNumber}` : ""}
            </div>
          </div>
          <div className="card gm-stat-bubble" style={{ margin: 0 }}>
            <div className="gm-stat-label">Your streak</div>
            <div className="gm-big-score" style={{ fontSize: 36 }}>
              {progress?.progress?.streak ?? 0} <KidIcon name="flame" />
            </div>
            <div className="gm-stat-sub">Next day to play: {progress?.progress?.current_day ?? "—"}</div>
          </div>
        </div>

        <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link to="/game/session" className="btn primary gm-btn-play" aria-disabled={loading ? "true" : "false"}>
            ▶ Let&apos;s play!
          </Link>
          <Link to={`/game/puzzle/${phaseNumber ?? 1}`} className="btn gm-btn-big">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <KidIcon name="puzzle" />
              My puzzle
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

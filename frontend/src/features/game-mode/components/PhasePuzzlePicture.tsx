import React, { useId, useMemo } from "react";

const VB_W = 100;
const VB_H = 62;

function gridForPieceCount(n: number): { cols: number; rows: number } {
  if (n <= 7) return { cols: n, rows: 1 };
  if (n <= 14) return { cols: 7, rows: 2 };
  if (n <= 21) return { cols: 7, rows: 3 };
  return { cols: 9, rows: Math.ceil(n / 9) };
}

/** Phase-specific picture — each phase is a completely different scene. */
function PhaseScene({ phase, uid }: { phase: number; uid: string }) {
  const gid = `puzzle-scene-${uid}`;
  const skyId = `sky-${uid}`;
  const sunId = `sun-${uid}`;

  const themes: Record<
    number,
    { sky0: string; sky1: string; ground0: string; ground1: string; accent: string; sun: string }
  > = {
    1: { sky0: "#bae6fd", sky1: "#e0f2fe", ground0: "#86efac", ground1: "#4ade80", accent: "#16a34a", sun: "#fbbf24" },
    2: { sky0: "#0ea5e9", sky1: "#38bdf8", ground0: "#06b6d4", ground1: "#0891b2", accent: "#0e7490", sun: "#fde047" },
    3: { sky0: "#f97316", sky1: "#fb923c", ground0: "#ea580c", ground1: "#c2410c", accent: "#9a3412", sun: "#fef08a" },
    4: { sky0: "#a78bfa", sky1: "#c4b5fd", ground0: "#8b5cf6", ground1: "#6d28d9", accent: "#5b21b6", sun: "#fcd34d" },
    5: { sky0: "#f9a8d4", sky1: "#fbcfe8", ground0: "#ec4899", ground1: "#db2777", accent: "#9d174d", sun: "#fef9c3" },
    6: { sky0: "#1e1b4b", sky1: "#312e81", ground0: "#312e81", ground1: "#4c1d95", accent: "#3730a3", sun: "#e9d5ff" }
  };

  const t = themes[phase] ?? themes[1];

  return (
    <g id={gid}>
      <defs>
        <linearGradient id={skyId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={t.sky0} />
          <stop offset="55%" stopColor={t.sky1} />
          <stop offset="55%" stopColor={t.ground0} />
          <stop offset="100%" stopColor={t.ground1} />
        </linearGradient>
        <radialGradient id={sunId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={t.sun} stopOpacity={1} />
          <stop offset="70%" stopColor={t.sun} stopOpacity={0.85} />
          <stop offset="100%" stopColor={t.sun} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width={VB_W} height={VB_H} fill={`url(#${skyId})`} />

      {/* Phase 1: Meadow — sun, house, tree, path */}
      {phase === 1 && (
        <>
          <circle cx="78" cy="14" r="11" fill={`url(#${sunId})`} opacity={0.95} />
          <ellipse cx="22" cy="16" rx="9" ry="5" fill="#fff" opacity={0.85} />
          <ellipse cx="45" cy="22" rx="8" ry="4.5" fill="#fff" opacity={0.75} />
          <path d="M0 48 Q25 38 50 46 T100 44 L100 62 L0 62 Z" fill={t.accent} opacity={0.75} />
          <path d="M0 52 Q35 46 70 50 T100 48 L100 62 L0 62 Z" fill={t.ground1} opacity={0.9} />
          <rect x="18" y="36" width="10" height="14" fill="#78350f" rx={0.5} />
          <path d="M16 36 L23 29 L30 36 Z" fill="#b91c1c" />
          <rect x="72" y="32" width="3" height="18" fill="#422006" />
          <circle cx="73.5" cy="28" r="9" fill="#15803d" />
          <path d="M40 52 Q52 48 64 52" stroke="#fff" strokeWidth={1.2} fill="none" opacity={0.5} strokeLinecap="round" />
        </>
      )}

      {/* Phase 2: Ocean / beach — waves, boat, sun on water */}
      {phase === 2 && (
        <>
          <circle cx="80" cy="16" r="10" fill={`url(#${sunId})`} opacity={0.9} />
          <ellipse cx="25" cy="18" rx="12" ry="5" fill="#fff" opacity={0.8} />
          <path d="M0 42 Q20 38 40 42 T80 40 T100 44 L100 62 L0 62 Z" fill="#0e7490" opacity={0.9} />
          <path d="M0 46 Q15 44 30 46 T60 44 T100 48 L100 62 L0 62 Z" fill="#06b6d4" opacity={0.85} />
          <path d="M0 50 Q25 48 50 50 T100 52 L100 62 L0 62 Z" fill="#22d3ee" opacity={0.9} />
          <path d="M50 38 L58 50 L66 38 L74 50 L82 38" stroke="#fef3c7" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.9} />
          <ellipse cx="62" cy="44" rx="14" ry="6" fill="#fcd34d" opacity={0.6} />
          <path d="M55 42 L62 38 L69 42 L62 48 Z" fill="#fef08a" opacity={0.95} />
        </>
      )}

      {/* Phase 3: Sunset mountains — peaks, low sun */}
      {phase === 3 && (
        <>
          <circle cx="85" cy="48" r="14" fill={`url(#${sunId})`} opacity={0.9} />
          <path d="M0 62 L0 35 L25 50 L45 28 L65 45 L85 32 L100 42 L100 62 Z" fill="#9a3412" opacity={0.9} />
          <path d="M0 62 L15 42 L35 55 L55 38 L75 52 L100 38 L100 62 Z" fill="#c2410c" opacity={0.85} />
          <path d="M0 62 L30 48 L50 58 L70 45 L100 55 L100 62 Z" fill="#ea580c" opacity={0.8} />
          <ellipse cx="20" cy="52" rx="8" ry="3" fill="#fef08a" opacity={0.4} />
          <ellipse cx="60" cy="48" rx="6" ry="2.5" fill="#fed7aa" opacity={0.5} />
        </>
      )}

      {/* Phase 4: Castle and garden — towers, flowers */}
      {phase === 4 && (
        <>
          <circle cx="78" cy="12" r="9" fill={`url(#${sunId})`} opacity={0.9} />
          <rect x="12" y="28" width="14" height="34" fill="#5b21b6" rx={1} />
          <rect x="26" y="22" width="18" height="40" fill="#6d28d9" rx={1} />
          <rect x="44" y="18" width="12" height="44" fill="#7c3aed" rx={1} />
          <rect x="56" y="22" width="18" height="40" fill="#6d28d9" rx={1} />
          <rect x="74" y="28" width="14" height="34" fill="#5b21b6" rx={1} />
          {[18, 32, 46, 60, 74].map((x, i) => (
            <rect key={i} x={x} y={16} width={6} height={8} fill="#4c1d95" rx={0.5} />
          ))}
          <path d="M0 52 Q30 48 50 52 T100 50 L100 62 L0 62 Z" fill="#5b21b6" opacity={0.7} />
          <circle cx="22" cy="48" r="5" fill="#fbbf24" />
          <circle cx="50" cy="52" r="4" fill="#f472b6" />
          <circle cx="78" cy="48" r="5" fill="#a78bfa" />
        </>
      )}

      {/* Phase 5: Candy / garden — pink, flowers, soft shapes */}
      {phase === 5 && (
        <>
          <circle cx="75" cy="14" r="10" fill={`url(#${sunId})`} opacity={0.95} />
          <ellipse cx="20" cy="18" rx="10" ry="5" fill="#fce7f3" opacity={0.9} />
          <ellipse cx="50" cy="22" rx="11" ry="5" fill="#fbcfe8" opacity={0.85} />
          <path d="M0 50 Q25 44 50 48 T100 46 L100 62 L0 62 Z" fill="#ec4899" opacity={0.85} />
          <path d="M0 54 Q30 50 60 54 T100 52 L100 62 L0 62 Z" fill="#f472b6" opacity={0.9} />
          <circle cx="25" cy="44" r="8" fill="#f9a8d4" />
          <circle cx="25" cy="44" r="4" fill="#fef9c3" />
          <circle cx="55" cy="48" r="7" fill="#fbcfe8" />
          <circle cx="55" cy="48" r="3.5" fill="#fff" opacity={0.9} />
          <circle cx="82" cy="42" r="6" fill="#f472b6" />
          <circle cx="82" cy="42" r="3" fill="#fef9c3" />
          <path d="M40 56 Q50 52 60 56" stroke="#fce7f3" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.8} />
        </>
      )}

      {/* Phase 6: Night sky — stars, moon */}
      {phase === 6 && (
        <>
          <circle cx="78" cy="14" r="9" fill="#e9d5ff" opacity={0.95} />
          <circle cx="78" cy="14" r="6" fill="#f5f3ff" opacity={0.9} />
          {[0, 45, 90, 135].map((deg, i) => (
            <line
              key={i}
              x1="78"
              y1="14"
              x2={78 + 12 * Math.cos((deg * Math.PI) / 180)}
              y2={14 + 12 * Math.sin((deg * Math.PI) / 180)}
              stroke="#c4b5fd"
              strokeWidth={0.6}
              strokeLinecap="round"
              opacity={0.6}
            />
          ))}
          {[8, 22, 35, 52, 65, 88].map((x, i) => (
            <circle key={i} cx={x} cy={12 + (i % 3) * 8} r={0.8} fill="#fef9c3" opacity={0.9} />
          ))}
          {[15, 42, 70].map((x, i) => (
            <circle key={i} cx={x} cy={28 + (i % 2) * 6} r={0.5} fill="#e2e8f0" opacity={0.8} />
          ))}
          <path d="M0 48 Q20 42 40 46 T80 44 T100 48 L100 62 L0 62 Z" fill="#312e81" opacity={0.9} />
          <path d="M0 54 Q30 50 60 54 T100 52 L100 62 L0 62 Z" fill="#1e1b4b" opacity={0.95} />
        </>
      )}
    </g>
  );
}

type Props = {
  phase: number;
  startDay: number;
  totalSlots: number;
  earnedDayNumbers: number[];
};

export function PhasePuzzlePicture({ phase, startDay, totalSlots, earnedDayNumbers }: Props) {
  const reactId = useId().replace(/:/g, "");
  const uid = `p${phase}-${reactId}`;
  const earnedSet = useMemo(() => new Set(earnedDayNumbers), [earnedDayNumbers]);
  const { cols, rows } = useMemo(() => gridForPieceCount(totalSlots), [totalSlots]);

  const gap = 0.55;
  const cellW = VB_W / cols;
  const cellH = VB_H / rows;

  const pieces = useMemo(() => {
    const out: Array<{ index: number; day: number; col: number; row: number; x: number; y: number; w: number; h: number }> = [];
    for (let i = 0; i < totalSlots; i += 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * cellW + gap / 2;
      const y = row * cellH + gap / 2;
      const w = cellW - gap;
      const h = cellH - gap;
      out.push({ index: i, day: startDay + i, col, row, x, y, w, h });
    }
    return out;
  }, [totalSlots, cols, rows, cellW, cellH, startDay, gap]);

  const sceneRef = `puzzle-scene-${uid}`;

  return (
    <figure className="gm-puzzle-figure">
      <svg
        className="gm-puzzle-svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label={`Phase ${phase} puzzle picture. ${earnedSet.size} of ${totalSlots} pieces revealed.`}
      >
        <title>Phase {phase} reading puzzle — complete days to reveal the picture</title>
        <defs>
          {pieces.map((p) => (
            <clipPath key={`c-${p.index}`} id={`clip-${uid}-${p.index}`} clipPathUnits="userSpaceOnUse">
              <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={1.8} ry={1.8} />
            </clipPath>
          ))}
          <PhaseScene phase={phase} uid={uid} />
        </defs>

        {pieces.map((p) => {
          const earned = earnedSet.has(p.day);
          return (
            <g key={p.day} clipPath={`url(#clip-${uid}-${p.index})`} className={earned ? "gm-puzzle-piece-earned" : "gm-puzzle-piece-locked"}>
              <use href={`#${sceneRef}`} />
              {!earned ? (
                <rect x="0" y="0" width={VB_W} height={VB_H} fill="#374151" />
              ) : null}
              {!earned ? (
                <text
                  x={p.x + p.w / 2}
                  y={p.y + p.h / 2 + 2}
                  textAnchor="middle"
                  fill="#e2e8f0"
                  fontSize={Math.min(p.w, p.h) * 0.35}
                  fontWeight={800}
                  fontFamily="Nunito, system-ui, sans-serif"
                  style={{ pointerEvents: "none" }}
                >
                  {p.day}
                </text>
              ) : null}
              {/* Piece edge highlight */}
              <rect
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                rx={1.8}
                fill="none"
                stroke={earned ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.2)"}
                strokeWidth={0.35}
              />
            </g>
          );
        })}

        {/* Frame on top so border stays visible */}
        <rect
          x={0.25}
          y={0.25}
          width={VB_W - 0.5}
          height={VB_H - 0.5}
          rx={3}
          fill="none"
          stroke="#7c3aed"
          strokeWidth={0.75}
          opacity={0.65}
          pointerEvents="none"
        />
      </svg>
      <figcaption className="gm-puzzle-caption">
        Each tile is a <strong>day</strong> in this phase. Finish that day in Daily Lessons to reveal that part of the picture.
      </figcaption>
    </figure>
  );
}

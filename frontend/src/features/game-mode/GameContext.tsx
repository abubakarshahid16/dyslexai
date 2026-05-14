import React, { createContext, useContext, useMemo, useState } from "react";
import {
  completeGameDay,
  fetchGameProgress,
  fetchGamePuzzle,
  fetchGameToday,
  GameCompleteDayResponse,
  GameProgressResponse,
  GamePuzzleResponse,
  GameTodayResponse
} from "../../lib/api";
import { phaseForDay } from "./gamePhase";

type GameState = {
  today: GameTodayResponse | null;
  progress: GameProgressResponse | null;
  puzzleByPhase: Record<number, GamePuzzleResponse | undefined>;
  loading: boolean;
  error: string | null;
};

type GameActions = {
  loadToday: () => Promise<GameTodayResponse>;
  loadProgress: () => Promise<GameProgressResponse>;
  loadPuzzle: (phase: number) => Promise<GamePuzzleResponse>;
  submitDay: (dayNumber: number, exerciseScores: number[]) => Promise<GameCompleteDayResponse>;
  resetError: () => void;
};

const GameContext = createContext<(GameState & GameActions) | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [today, setToday] = useState<GameTodayResponse | null>(null);
  const [progress, setProgress] = useState<GameProgressResponse | null>(null);
  const [puzzleByPhase, setPuzzleByPhase] = useState<Record<number, GamePuzzleResponse | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actions: GameActions = useMemo(
    () => ({
      async loadToday() {
        setLoading(true);
        setError(null);
        try {
          const res = await fetchGameToday();
          setToday(res);
          return res;
        } catch (e: any) {
          const msg = e?.message ?? "Failed to load Daily Lessons.";
          setError(msg);
          throw e;
        } finally {
          setLoading(false);
        }
      },
      async loadProgress() {
        setLoading(true);
        setError(null);
        try {
          const res = await fetchGameProgress();
          setProgress(res);
          return res;
        } catch (e: any) {
          const msg = e?.message ?? "Failed to load progress.";
          setError(msg);
          throw e;
        } finally {
          setLoading(false);
        }
      },
      async loadPuzzle(phase: number) {
        setLoading(true);
        setError(null);
        try {
          const res = await fetchGamePuzzle(phase);
          setPuzzleByPhase((prev) => ({ ...prev, [phase]: res }));
          return res;
        } catch (e: any) {
          const msg = e?.message ?? "Failed to load puzzle.";
          setError(msg);
          throw e;
        } finally {
          setLoading(false);
        }
      },
      async submitDay(dayNumber: number, exerciseScores: number[]) {
        setLoading(true);
        setError(null);
        try {
          const asIntegers = exerciseScores.map((s) =>
            typeof s === "number" && s <= 1 ? Math.round(s * 100) : Math.round(Number(s))
          );
          const res = await completeGameDay({ day_number: dayNumber, exercise_scores: asIntegers });
          const phase = phaseForDay(dayNumber);
          // Refresh UI state (avoid `this.*` inside arrow functions).
          const [prog, todays, puzzle] = await Promise.all([
            fetchGameProgress().then((r) => {
              setProgress(r);
              return r;
            }),
            fetchGameToday().then((r) => {
              setToday(r);
              return r;
            }),
            fetchGamePuzzle(phase).then((r) => {
              setPuzzleByPhase((prev) => ({ ...prev, [phase]: r }));
              return r;
            })
          ]);
          void prog;
          void todays;
          void puzzle;
          return res;
        } catch (e: any) {
          const msg = e?.message ?? "Failed to submit day completion.";
          setError(msg);
          throw e;
        } finally {
          setLoading(false);
        }
      },
      resetError() {
        setError(null);
      }
    }),
    []
  );

  const value = useMemo(
    () => ({
      today,
      progress,
      puzzleByPhase,
      loading,
      error,
      ...actions
    }),
    [today, progress, puzzleByPhase, loading, error, actions]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside <GameProvider />");
  return ctx;
}


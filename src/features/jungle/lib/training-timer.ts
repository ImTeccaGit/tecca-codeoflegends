/**
 * Practice stopwatch as a pure reducer. Time is always passed in (`now`, from
 * `performance.now()` in the UI), so every transition is testable.
 *
 * This is a TRAINING timer the user starts and splits by hand. It never reads
 * the game and is not a live in-game timer.
 */

export type TimerStatus = "idle" | "running" | "paused" | "finished";

export interface TimerState {
  status: TimerStatus;
  /** `now` of the last start/resume while running, otherwise null. */
  runningSince: number | null;
  /** Time accumulated before the current running segment. */
  accumulatedMs: number;
  /** Cumulative ms at the completion of each camp, in route order. */
  splits: number[];
  totalSteps: number;
}

export type TimerAction =
  /** `totalSteps` = camps of the route being started (defaults to current). */
  | { type: "start"; now: number; totalSteps?: number }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number }
  | { type: "split"; now: number }
  | { type: "undo" }
  | { type: "reset"; totalSteps: number };

export function createTimer(totalSteps: number): TimerState {
  return {
    status: "idle",
    runningSince: null,
    accumulatedMs: 0,
    splits: [],
    totalSteps,
  };
}

export function elapsedMs(state: TimerState, now: number): number {
  const running =
    state.status === "running" && state.runningSince !== null
      ? Math.max(0, now - state.runningSince)
      : 0;
  return Math.round(state.accumulatedMs + running);
}

export function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case "start": {
      const totalSteps = action.totalSteps ?? state.totalSteps;
      if (state.status !== "idle" || totalSteps <= 0) return state;
      return {
        ...state,
        status: "running",
        runningSince: action.now,
        accumulatedMs: 0,
        splits: [],
        totalSteps,
      };
    }

    case "pause":
      if (state.status !== "running") return state;
      return {
        ...state,
        status: "paused",
        accumulatedMs: elapsedMs(state, action.now),
        runningSince: null,
      };

    case "resume":
      if (state.status !== "paused") return state;
      return { ...state, status: "running", runningSince: action.now };

    case "split": {
      if (state.status !== "running") return state;
      const at = elapsedMs(state, action.now);
      const previous = state.splits.at(-1) ?? 0;
      // Two splits in the same millisecond (double click) are ignored.
      if (at <= previous) return state;
      const splits = [...state.splits, at];
      if (splits.length >= state.totalSteps) {
        return { ...state, status: "finished", splits, accumulatedMs: at, runningSince: null };
      }
      return { ...state, splits };
    }

    case "undo": {
      if (state.splits.length === 0) return state;
      const splits = state.splits.slice(0, -1);
      if (state.status === "finished") {
        // Back to a paused clear at the time of the removed split.
        return { ...state, status: "paused", splits };
      }
      return { ...state, splits };
    }

    case "reset":
      return createTimer(action.totalSteps);
  }
}

/** "1:23.4" (minutes:seconds.tenths). */
export function formatClearTime(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const tenths = Math.floor((safe % 1000) / 100);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

/** "+1.2 s" / "−0.8 s" / "±0.0 s" for comparisons. */
export function formatDelta(ms: number): string {
  // Sign follows the displayed (rounded) value: 40 ms reads "±0.0 s".
  const tenths = Math.round(Math.abs(ms) / 100);
  const sign = tenths === 0 ? "±" : ms > 0 ? "+" : "−";
  return `${sign}${(tenths / 10).toFixed(1)} s`;
}

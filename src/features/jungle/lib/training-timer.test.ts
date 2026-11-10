import { describe, expect, it } from "vitest";
import {
  createTimer,
  elapsedMs,
  formatClearTime,
  formatDelta,
  timerReducer,
  type TimerAction,
  type TimerState,
} from "@/features/jungle/lib/training-timer";

function run(state: TimerState, ...actions: TimerAction[]): TimerState {
  return actions.reduce(timerReducer, state);
}

describe("training timer", () => {
  it("measures time from start with a simulated clock", () => {
    const state = run(createTimer(3), { type: "start", now: 1000 });
    expect(state.status).toBe("running");
    expect(elapsedMs(state, 1000)).toBe(0);
    expect(elapsedMs(state, 13_500)).toBe(12_500);
  });

  it("records cumulative splits and finishes on the last camp", () => {
    const state = run(
      createTimer(3),
      { type: "start", now: 0 },
      { type: "split", now: 25_000 },
      { type: "split", now: 52_000 },
    );
    expect(state.splits).toEqual([25_000, 52_000]);
    expect(state.status).toBe("running");

    const finished = timerReducer(state, { type: "split", now: 80_100 });
    expect(finished.status).toBe("finished");
    expect(finished.splits).toEqual([25_000, 52_000, 80_100]);
    // The clock stops: later reads return the final time.
    expect(elapsedMs(finished, 999_999)).toBe(80_100);
  });

  it("excludes paused time", () => {
    const state = run(
      createTimer(2),
      { type: "start", now: 0 },
      { type: "pause", now: 10_000 },
      { type: "resume", now: 40_000 },
      { type: "split", now: 45_000 },
    );
    expect(state.splits).toEqual([15_000]);
    expect(elapsedMs(state, 50_000)).toBe(20_000);
  });

  it("ignores splits while paused, idle, or duplicated in the same instant", () => {
    const idle = timerReducer(createTimer(2), { type: "split", now: 5000 });
    expect(idle.splits).toEqual([]);

    const paused = run(
      createTimer(2),
      { type: "start", now: 0 },
      { type: "pause", now: 1000 },
      { type: "split", now: 2000 },
    );
    expect(paused.splits).toEqual([]);

    const doubled = run(
      createTimer(3),
      { type: "start", now: 0 },
      { type: "split", now: 1000 },
      { type: "split", now: 1000 },
    );
    expect(doubled.splits).toEqual([1000]);
  });

  it("undo removes the last split and reopens a finished clear", () => {
    const finished = run(
      createTimer(2),
      { type: "start", now: 0 },
      { type: "split", now: 1000 },
      { type: "split", now: 3000 },
    );
    const undone = timerReducer(finished, { type: "undo" });
    expect(undone.status).toBe("paused");
    expect(undone.splits).toEqual([1000]);

    const resumed = run(
      undone,
      { type: "resume", now: 10_000 },
      { type: "split", now: 10_500 },
    );
    expect(resumed.status).toBe("finished");
    expect(resumed.splits).toEqual([1000, 3500]);
  });

  it("reset returns to an empty idle timer for a new route length", () => {
    const state = run(
      createTimer(2),
      { type: "start", now: 0 },
      { type: "split", now: 1000 },
      { type: "reset", totalSteps: 5 },
    );
    expect(state).toEqual(createTimer(5));
  });

  it("takes the route length at start, whatever it was created with", () => {
    const state = run(
      createTimer(0),
      { type: "start", now: 0, totalSteps: 2 },
      { type: "split", now: 1000 },
      { type: "split", now: 2000 },
    );
    expect(state.totalSteps).toBe(2);
    expect(state.status).toBe("finished");
  });

  it("cannot start a route without camps", () => {
    expect(timerReducer(createTimer(0), { type: "start", now: 0 }).status).toBe(
      "idle",
    );
  });
});

describe("formatting", () => {
  it("formats clear times and deltas", () => {
    expect(formatClearTime(83_456)).toBe("1:23.4");
    expect(formatClearTime(5_000)).toBe("0:05.0");
    expect(formatDelta(1_240)).toBe("+1.2 s");
    expect(formatDelta(-800)).toBe("−0.8 s");
    expect(formatDelta(0)).toBe("±0.0 s");
    expect(formatDelta(-40)).toBe("±0.0 s");
    expect(formatDelta(60)).toBe("+0.1 s");
  });
});

import { describe, expect, it } from "vitest";
import {
  formatGameMode,
  formatGameTime,
  formatKda,
  formatMap,
  formatPosition,
  formatUpdatedAt,
} from "@/features/live/lib/live-format";
import { liveSnapshotSchema, overlayPatchSchema } from "@/types/live";

describe("live formatting", () => {
  it("formats the game clock", () => {
    expect(formatGameTime(0)).toBe("0:00");
    expect(formatGameTime(754.9)).toBe("12:34");
    expect(formatGameTime(3725)).toBe("1:02:05");
    expect(formatGameTime(-5)).toBe("0:00");
  });

  it("formats labels with a raw fallback", () => {
    expect(formatKda(2, 1, 3)).toBe("2 / 1 / 3");
    expect(formatGameMode("CLASSIC")).toBe("Classica");
    expect(formatGameMode("NEWMODE")).toBe("NEWMODE");
    expect(formatMap(11, "Map11")).toBe("Landa degli evocatori");
    expect(formatMap(99, "Map99")).toBe("Map99");
    expect(formatPosition("UTILITY")).toBe("Support");
    expect(formatPosition(null)).toBeNull();
    expect(formatUpdatedAt(0)).toBe("mai");
  });
});

describe("live contracts", () => {
  it("rejects snapshots with unknown status", () => {
    const result = liveSnapshotSchema.safeParse({
      status: "spying",
      game: null,
      player: null,
      message: null,
      updatedAtMs: 0,
    });
    expect(result.success).toBe(false);
  });

  it("validates overlay patches with the backend limits", () => {
    expect(overlayPatchSchema.safeParse({}).success).toBe(false);
    expect(overlayPatchSchema.safeParse({ width: 9000 }).success).toBe(false);
    expect(overlayPatchSchema.safeParse({ opacity: 0.1 }).success).toBe(false);
    expect(overlayPatchSchema.safeParse({ mode: "fullscreen" }).success).toBe(false);
    expect(overlayPatchSchema.safeParse({ visible: true, width: 320 }).success).toBe(true);
  });
});

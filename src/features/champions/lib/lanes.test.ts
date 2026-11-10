import { describe, expect, it } from "vitest";
import { isLane, laneLabel, toggleLane } from "@/features/champions/lib/lanes";

describe("toggleLane", () => {
  it("adds and removes lanes keeping Riot order", () => {
    expect(toggleLane([], "UTILITY")).toEqual(["UTILITY"]);
    expect(toggleLane(["UTILITY"], "TOP")).toEqual(["TOP", "UTILITY"]);
    expect(toggleLane(["TOP", "UTILITY"], "TOP")).toEqual(["UTILITY"]);
  });
});

describe("lane helpers", () => {
  it("validates and labels lanes in Italian", () => {
    expect(isLane("JUNGLE")).toBe(true);
    expect(isLane("ADC")).toBe(false);
    expect(laneLabel("UTILITY")).toBe("Supporto");
    expect(laneLabel("MIDDLE")).toBe("Mid");
  });
});

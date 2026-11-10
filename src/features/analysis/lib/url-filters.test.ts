import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS } from "@/features/analysis/lib/analysis";
import { filtersFromParams, filtersToParams } from "@/features/analysis/lib/url-filters";

describe("url filters", () => {
  it("round-trips valid filters and omits defaults", () => {
    const filters = {
      championId: 103,
      role: "MIDDLE",
      patch: "14.23",
      queue: "solo" as const,
      period: "30d" as const,
      limit: "20" as const,
    };
    const params = filtersToParams(new URLSearchParams("player=abc"), filters);
    expect(params.get("player")).toBe("abc");
    expect(filtersFromParams(params)).toEqual(filters);
    expect(filtersToParams(new URLSearchParams(), DEFAULT_FILTERS).toString()).toBe("");
  });

  it("ignores invalid or tampered values", () => {
    const params = new URLSearchParams(
      "champion=-4&role=<script>&patch=latest&queue=urf&period=1y&limit=999",
    );
    expect(filtersFromParams(params)).toEqual(DEFAULT_FILTERS);
  });
});

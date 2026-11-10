import { describe, expect, it } from "vitest";
import { CAMPS, CAMP_IDS, getCamp } from "@/features/jungle/data/camps";
import { MODEL_ROUTES } from "@/features/jungle/data/routes";

describe("jungle layout", () => {
  it("defines every camp exactly once, six per side and two scuttles", () => {
    expect(CAMPS.map((camp) => camp.id).sort()).toEqual([...CAMP_IDS].sort());
    expect(CAMPS.filter((camp) => camp.owner === "blue")).toHaveLength(6);
    expect(CAMPS.filter((camp) => camp.owner === "red")).toHaveLength(6);
    expect(CAMPS.filter((camp) => camp.kind === "scuttle")).toHaveLength(2);
  });

  it("keeps each side's camps on its own half of the river (y = x)", () => {
    const blue = CAMPS.filter((camp) => camp.owner === "blue");
    const red = CAMPS.filter((camp) => camp.owner === "red");
    expect(blue.every((camp) => camp.y > camp.x)).toBe(true);
    expect(red.every((camp) => camp.y < camp.x)).toBe(true);
  });

  it("mirrors the Red side from the Blue side", () => {
    const blue = getCamp("blue-red");
    const red = getCamp("red-red");
    expect(red.x).toBe(600 - blue.x);
    expect(red.y).toBe(600 - blue.y);
  });
});

function ownCamps(route: (typeof MODEL_ROUTES)[number]): number {
  return route.camps.filter((id) => getCamp(id).owner === route.side).length;
}

describe("model routes", () => {
  it("use known, unique camps and unique keys", () => {
    expect(new Set(MODEL_ROUTES.map((route) => route.key)).size).toBe(
      MODEL_ROUTES.length,
    );
    for (const route of MODEL_ROUTES) {
      expect(new Set(route.camps).size).toBe(route.camps.length);
      for (const camp of route.camps) {
        expect(CAMP_IDS).toContain(camp);
      }
    }
  });

  it("match their category and side", () => {
    const expectedLength = { full: 6, five: 5, three: 3 } as const;

    const clears = MODEL_ROUTES.filter((route) => route.category !== "invade");
    expect(
      clears.map((route) => [route.key, route.camps.length]),
    ).toEqual(
      clears.map((route) => [
        route.key,
        expectedLength[route.category as keyof typeof expectedLength],
      ]),
    );
    // Clears stay on their own side…
    expect(clears.every((route) => ownCamps(route) === route.camps.length)).toBe(true);
    // …invasions include at least one enemy camp.
    const invasions = MODEL_ROUTES.filter((route) => route.category === "invade");
    expect(invasions).toHaveLength(2);
    expect(invasions.every((route) => ownCamps(route) < route.camps.length)).toBe(true);
  });

  it("cover both sides with every category", () => {
    for (const side of ["blue", "red"] as const) {
      const categories = new Set(
        MODEL_ROUTES.filter((route) => route.side === side).map((route) => route.category),
      );
      expect([...categories].sort()).toEqual(["five", "full", "invade", "three"]);
    }
  });
});

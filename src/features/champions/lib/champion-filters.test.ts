import { describe, expect, it } from "vitest";
import {
  classLabel,
  DEFAULT_FILTERS,
  filterChampions,
  normalizeSearch,
} from "@/features/champions/lib/champion-filters";
import type { ChampionListItem } from "@/types/catalog";

// Fictional fixtures: shapes match the backend contract, data is not real.
function champion(
  id: number,
  key: string,
  name: string,
  tags: string[],
  extra: Partial<Pick<ChampionListItem, "favorite" | "lanes">> = {},
): ChampionListItem {
  return {
    id,
    key,
    name,
    title: "titolo",
    tags,
    imageUrl: `https://example.invalid/${key}.png`,
    favorite: false,
    lanes: [],
    ...extra,
  };
}

const LIST = [
  champion(1, "Zeta", "Zeta", ["Tank"], { lanes: ["TOP"] }),
  champion(2, "KaiSa", "Kai'Sa", ["Marksman"], {
    favorite: true,
    lanes: ["BOTTOM"],
  }),
  champion(3, "MonkeyKing", "Wukong", ["Fighter", "Tank"], {
    lanes: ["TOP", "JUNGLE"],
  }),
  champion(4, "Eclair", "Éclair", ["Mage", "Assassin"], { favorite: true }),
  champion(5, "DrMundo", "Dr. Mundo", ["Tank", "Fighter"]),
];

function names(query: string): string[] {
  return filterChampions(LIST, { ...DEFAULT_FILTERS, query }).map(
    (c) => c.name,
  );
}

describe("normalizeSearch", () => {
  it("drops accents, punctuation, spaces and case", () => {
    expect(normalizeSearch("Kai'Sa")).toBe("kaisa");
    expect(normalizeSearch("Dr. Mundo")).toBe("drmundo");
    expect(normalizeSearch("Éclair")).toBe("eclair");
  });
});

describe("filterChampions", () => {
  it("sorts alphabetically with Italian collation by default", () => {
    expect(filterChampions(LIST, DEFAULT_FILTERS).map((c) => c.name)).toEqual([
      "Dr. Mundo",
      "Éclair",
      "Kai'Sa",
      "Wukong",
      "Zeta",
    ]);
  });

  it("supports reverse order", () => {
    expect(
      filterChampions(LIST, { ...DEFAULT_FILTERS, sort: "desc" })[0]?.name,
    ).toBe("Zeta");
  });

  it("matches names regardless of accents and punctuation", () => {
    expect(names("kaisa")).toEqual(["Kai'Sa"]);
    expect(names("ecl")).toEqual(["Éclair"]);
    expect(names("dr mundo")).toEqual(["Dr. Mundo"]);
  });

  it("also matches the Data Dragon id", () => {
    expect(
      filterChampions(LIST, { ...DEFAULT_FILTERS, query: "monkey" }).map(
        (c) => c.name,
      ),
    ).toEqual(["Wukong"]);
  });

  it("filters by class and combines with search", () => {
    const tanks = filterChampions(LIST, {
      ...DEFAULT_FILTERS,
      classFilter: "Tank",
    });
    expect(tanks.map((c) => c.name)).toEqual(["Dr. Mundo", "Wukong", "Zeta"]);

    const tankSearch = filterChampions(LIST, {
      ...DEFAULT_FILTERS,
      query: "wu",
      classFilter: "Tank",
    });
    expect(tankSearch.map((c) => c.name)).toEqual(["Wukong"]);
  });

  it("filters by the lanes the user assigned", () => {
    const top = filterChampions(LIST, { ...DEFAULT_FILTERS, laneFilter: "TOP" });
    expect(top.map((c) => c.name)).toEqual(["Wukong", "Zeta"]);

    // Champions without assigned lanes never match a lane filter.
    const mid = filterChampions(LIST, {
      ...DEFAULT_FILTERS,
      laneFilter: "MIDDLE",
    });
    expect(mid).toEqual([]);
  });

  it("shows only favorites and combines with every other filter", () => {
    const favorites = filterChampions(LIST, {
      ...DEFAULT_FILTERS,
      favoritesOnly: true,
    });
    expect(favorites.map((c) => c.name)).toEqual(["Éclair", "Kai'Sa"]);

    const favoriteBot = filterChampions(LIST, {
      ...DEFAULT_FILTERS,
      favoritesOnly: true,
      laneFilter: "BOTTOM",
      classFilter: "Marksman",
    });
    expect(favoriteBot.map((c) => c.name)).toEqual(["Kai'Sa"]);
  });

  it("never mutates the input list", () => {
    const copy = [...LIST];
    filterChampions(LIST, { ...DEFAULT_FILTERS, sort: "desc" });
    expect(LIST).toEqual(copy);
  });
});

describe("classLabel", () => {
  it("translates known classes and keeps unknown ones", () => {
    expect(classLabel("Marksman")).toBe("Tiratore");
    expect(classLabel("Unknown")).toBe("Unknown");
  });
});

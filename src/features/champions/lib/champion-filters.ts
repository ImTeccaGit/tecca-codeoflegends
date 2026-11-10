import type { ChampionListItem, Lane } from "@/types/catalog";

/**
 * Data Dragon publishes champion *classes* (tags), not lane positions. The
 * class filter uses them as they are and labels them in Italian; the lane
 * filter uses the lanes really played (from the matches), set by the page.
 */
export const CHAMPION_CLASSES = [
  { value: "Assassin", label: "Assassino" },
  { value: "Fighter", label: "Combattente" },
  { value: "Mage", label: "Mago" },
  { value: "Marksman", label: "Tiratore" },
  { value: "Support", label: "Supporto" },
  { value: "Tank", label: "Tank" },
] as const;

export type ChampionClass = (typeof CHAMPION_CLASSES)[number]["value"];
export type ClassFilter = ChampionClass | "all";
export type LaneFilter = Lane | "all";
export type SortOrder = "asc" | "desc";

export interface ChampionFilters {
  query: string;
  classFilter: ClassFilter;
  laneFilter: LaneFilter;
  favoritesOnly: boolean;
  sort: SortOrder;
}

export const DEFAULT_FILTERS: ChampionFilters = {
  query: "",
  classFilter: "all",
  laneFilter: "all",
  favoritesOnly: false,
  sort: "asc",
};

export function classLabel(tag: string): string {
  return CHAMPION_CLASSES.find((item) => item.value === tag)?.label ?? tag;
}

export function isChampionClass(value: string): value is ChampionClass {
  return CHAMPION_CLASSES.some((item) => item.value === value);
}

/** Lowercase, no accents, no punctuation or spaces: "Kai'Sa" → "kaisa". */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]/gu, "");
}

const collator = new Intl.Collator("it", { sensitivity: "base" });

export function filterChampions(
  champions: ChampionListItem[],
  { query, classFilter, laneFilter, favoritesOnly, sort }: ChampionFilters,
): ChampionListItem[] {
  const needle = normalizeSearch(query);

  const filtered = champions.filter((champion) => {
    if (favoritesOnly && !champion.favorite) {
      return false;
    }
    if (laneFilter !== "all" && !champion.lanes.includes(laneFilter)) {
      return false;
    }
    if (classFilter !== "all" && !champion.tags.includes(classFilter)) {
      return false;
    }
    if (!needle) {
      return true;
    }
    // Name, plus the Data Dragon id (e.g. "MonkeyKing" for Wukong).
    return (
      normalizeSearch(champion.name).includes(needle) ||
      normalizeSearch(champion.key).includes(needle)
    );
  });

  const direction = sort === "asc" ? 1 : -1;
  return [...filtered].sort(
    (a, b) => direction * collator.compare(a.name, b.name),
  );
}

import type { Lane } from "@/types/catalog";

/** Lanes in Riot order with Italian labels. */
export const LANE_OPTIONS: ReadonlyArray<{ value: Lane; label: string }> = [
  { value: "TOP", label: "Top" },
  { value: "JUNGLE", label: "Giungla" },
  { value: "MIDDLE", label: "Mid" },
  { value: "BOTTOM", label: "Bot" },
  { value: "UTILITY", label: "Supporto" },
];

export function laneLabel(lane: Lane): string {
  return LANE_OPTIONS.find((option) => option.value === lane)?.label ?? lane;
}

export function isLane(value: string): value is Lane {
  return LANE_OPTIONS.some((option) => option.value === value);
}

/** Adds or removes a lane, keeping Riot order. */
export function toggleLane(lanes: readonly Lane[], lane: Lane): Lane[] {
  const next = lanes.includes(lane)
    ? lanes.filter((item) => item !== lane)
    : [...lanes, lane];
  return LANE_OPTIONS.map((option) => option.value).filter((value) =>
    next.includes(value),
  );
}

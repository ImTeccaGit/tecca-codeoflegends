import type { ChampionRoles, Role } from "@/types/global-stats";
import { isLane } from "@/features/champions/lib/lanes";
import type { Lane } from "@/types/catalog";

export const ROLE_LABELS: Record<Role, string> = {
  TOP: "Top",
  JUNGLE: "Jungla",
  MIDDLE: "Mid",
  BOTTOM: "Bot",
  UTILITY: "Supporto",
};

export function roleName(role: string | null): string {
  if (!role) return "Ruolo non indicato";
  return ROLE_LABELS[role as Role] ?? role;
}

/** Below this sample a percentage is marked as indicative. */
export const SMALL_SAMPLE = 30;

const percentFormat = new Intl.NumberFormat("it-IT", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const countFormat = new Intl.NumberFormat("it-IT");

/** Null when there is no denominator (never shown as 0%). */
export function ratio(part: number, total: number): number | null {
  return total > 0 ? part / total : null;
}

export function formatPercent(value: number | null): string {
  return value === null ? "—" : percentFormat.format(value);
}

export function gamesLabel(games: number): string {
  return `${countFormat.format(games)} ${games === 1 ? "partita" : "partite"}`;
}

/** A lane counts as "played" from this share of the champion's games. */
export const PLAYED_LANE_SHARE = 0.15;

/** Lanes the champion really plays, most played first. */
export function playedLanes(entry: ChampionRoles | undefined): Lane[] {
  if (!entry || entry.games === 0) return [];
  return entry.roles
    .filter((role) => role.games / entry.games >= PLAYED_LANE_SHARE)
    .map((role) => role.role)
    .filter(isLane);
}

import { queueGroup, type QueueGroup } from "@/lib/queues";
import type { AnalysisMatch } from "@/types/analysis";

/**
 * Pure post-game aggregations over stored match-v5 data. Every number shown
 * by Match Analysis and Matchups comes from these functions, so cards,
 * tables and charts always agree. Missing values are never replaced by
 * estimates: averages use only the matches where the value exists, and the
 * number of matches used is returned alongside.
 */

/* Filters ---------------------------------------------------------------- */

export const PERIODS = ["7d", "30d", "90d", "all"] as const;
export type Period = (typeof PERIODS)[number];
export const PERIOD_DAYS: Record<Exclude<Period, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export const MATCH_LIMITS = ["10", "20", "50", "all"] as const;
export type MatchLimit = (typeof MATCH_LIMITS)[number];

export interface AnalysisFilters {
  championId: number | null;
  role: string | null;
  patch: string | null;
  queue: QueueGroup | "all";
  period: Period;
  limit: MatchLimit;
}

export const DEFAULT_FILTERS: AnalysisFilters = {
  championId: null,
  role: null,
  patch: null,
  queue: "all",
  period: "all",
  limit: "all",
};

const DAY_MS = 86_400_000;

/**
 * Applies the attribute filters, then keeps the newest `limit` matches.
 * Input order does not matter; output is newest first.
 */
export function applyFilters(
  matches: AnalysisMatch[],
  filters: AnalysisFilters,
  now: Date,
): AnalysisMatch[] {
  const since =
    filters.period === "all" ? null : now.getTime() - PERIOD_DAYS[filters.period] * DAY_MS;

  const kept = matches
    .filter((match) => filters.championId === null || match.champion.championId === filters.championId)
    .filter((match) => filters.role === null || match.teamPosition === filters.role)
    .filter((match) => filters.patch === null || match.patch === filters.patch)
    .filter((match) => filters.queue === "all" || queueGroup(match.queueId) === filters.queue)
    .filter((match) => {
      if (since === null) return true;
      const time = Date.parse(match.playedAt);
      return !Number.isNaN(time) && time >= since;
    })
    .sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt));

  return filters.limit === "all" ? kept : kept.slice(0, Number(filters.limit));
}

/** Distinct values available in the data, for the filter controls. */
export function filterOptions(matches: AnalysisMatch[]) {
  const champions = new Map<number, string>();
  const roles = new Set<string>();
  const patches = new Set<string>();
  const queues = new Set<QueueGroup>();
  for (const match of matches) {
    champions.set(match.champion.championId, match.champion.championName);
    if (match.teamPosition) roles.add(match.teamPosition);
    if (match.patch) patches.add(match.patch);
    queues.add(queueGroup(match.queueId));
  }
  return {
    champions: [...champions.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "it")),
    roles: [...roles].sort(),
    patches: [...patches].sort(comparePatchesDesc),
    queues: [...queues],
  };
}

export function comparePatchesDesc(a: string, b: string): number {
  const [aMajor = 0, aMinor = 0] = a.split(".").map(Number);
  const [bMajor = 0, bMinor = 0] = b.split(".").map(Number);
  return bMajor - aMajor || bMinor - aMinor;
}

/* Per-match metrics ------------------------------------------------------ */

export function kda(kills: number, deaths: number, assists: number): number {
  return (kills + assists) / Math.max(deaths, 1);
}

function perMinute(value: number, seconds: number): number | null {
  return seconds > 0 ? value / (seconds / 60) : null;
}

export function csPerMinute(match: Pick<AnalysisMatch, "creepScore" | "durationSeconds">) {
  return perMinute(match.creepScore, match.durationSeconds);
}

export function goldPerMinute(match: Pick<AnalysisMatch, "goldEarned" | "durationSeconds">) {
  return perMinute(match.goldEarned, match.durationSeconds);
}

/** (kills + assists) / team kills, 0–1. Null when the team scored no kills. */
export function killParticipation(
  match: Pick<AnalysisMatch, "kills" | "assists" | "teamKills">,
): number | null {
  if (match.teamKills <= 0) return null;
  return Math.min(1, (match.kills + match.assists) / match.teamKills);
}

/* Uncertainty ------------------------------------------------------------ */

/** 95% Wilson score interval for a proportion. Null without trials. */
export function wilsonInterval(
  successes: number,
  trials: number,
  z = 1.96,
): { low: number; high: number } | null {
  if (trials <= 0) return null;
  const p = successes / trials;
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const center = (p + z2 / (2 * trials)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))) / denominator;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

/** Below this number of matches a win rate is shown as "insufficient". */
export const MIN_GAMES = 5;

/* Summary ---------------------------------------------------------------- */

export interface Average {
  value: number | null;
  /** Matches that had the value. */
  count: number;
}

function averageOf(values: (number | null)[]): Average {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return { value: null, count: 0 };
  return {
    value: present.reduce((sum, value) => sum + value, 0) / present.length,
    count: present.length,
  };
}

export interface AnalysisSummary {
  games: number;
  wins: number;
  losses: number;
  winRate: number | null;
  interval: { low: number; high: number } | null;
  sufficient: boolean;
  /** Aggregate KDA: total (K + A) / max(total D, 1). */
  kda: number | null;
  avgKills: number | null;
  avgDeaths: number | null;
  avgAssists: number | null;
  /** Total CS / total minutes. */
  csPerMinute: number | null;
  goldPerMinute: number | null;
  avgGold: number | null;
  avgVision: number | null;
  avgDurationSeconds: number | null;
  damageDealt: Average;
  damageTaken: Average;
  /** Total (K + A) / total team kills over matches where the team scored. */
  killParticipation: Average;
}

export function summarize(matches: AnalysisMatch[]): AnalysisSummary {
  const games = matches.length;
  const wins = matches.filter((match) => match.win).length;
  const total = (pick: (match: AnalysisMatch) => number) =>
    matches.reduce((sum, match) => sum + pick(match), 0);
  const seconds = total((match) => match.durationSeconds);
  const minutes = seconds / 60;
  const kills = total((match) => match.kills);
  const deaths = total((match) => match.deaths);
  const assists = total((match) => match.assists);
  const withTeamKills = matches.filter((match) => match.teamKills > 0);
  const teamKills = withTeamKills.reduce((sum, match) => sum + match.teamKills, 0);
  const involved = withTeamKills.reduce((sum, match) => sum + match.kills + match.assists, 0);
  const avg = (value: number) => (games === 0 ? null : value / games);

  return {
    games,
    wins,
    losses: games - wins,
    winRate: games === 0 ? null : wins / games,
    interval: wilsonInterval(wins, games),
    sufficient: games >= MIN_GAMES,
    kda: games === 0 ? null : kda(kills, deaths, assists),
    avgKills: avg(kills),
    avgDeaths: avg(deaths),
    avgAssists: avg(assists),
    csPerMinute: minutes > 0 ? total((match) => match.creepScore) / minutes : null,
    goldPerMinute: minutes > 0 ? total((match) => match.goldEarned) / minutes : null,
    avgGold: avg(total((match) => match.goldEarned)),
    avgVision: avg(total((match) => match.visionScore)),
    avgDurationSeconds: avg(seconds),
    damageDealt: averageOf(matches.map((match) => match.damageDealt)),
    damageTaken: averageOf(matches.map((match) => match.damageTaken)),
    killParticipation: {
      value: teamKills > 0 ? Math.min(1, involved / teamKills) : null,
      count: withTeamKills.length,
    },
  };
}

/* Grouping --------------------------------------------------------------- */

export interface GroupStats {
  key: string;
  label: string;
  imageUrl: string | null;
  summary: AnalysisSummary;
  /** Share of the analysed matches, 0–1. */
  share: number;
}

export function groupBy(
  matches: AnalysisMatch[],
  keyOf: (match: AnalysisMatch) => { key: string; label: string; imageUrl?: string | null } | null,
): GroupStats[] {
  const groups = new Map<string, { label: string; imageUrl: string | null; matches: AnalysisMatch[] }>();
  for (const match of matches) {
    const found = keyOf(match);
    if (!found) continue;
    const group = groups.get(found.key) ?? {
      label: found.label,
      imageUrl: found.imageUrl ?? null,
      matches: [],
    };
    group.matches.push(match);
    groups.set(found.key, group);
  }
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      label: group.label,
      imageUrl: group.imageUrl,
      summary: summarize(group.matches),
      share: matches.length === 0 ? 0 : group.matches.length / matches.length,
    }))
    .sort(
      (a, b) =>
        b.summary.games - a.summary.games ||
        (b.summary.winRate ?? 0) - (a.summary.winRate ?? 0) ||
        a.label.localeCompare(b.label, "it"),
    );
}

export const byChampion = (matches: AnalysisMatch[]) =>
  groupBy(matches, (match) => ({
    key: String(match.champion.championId),
    label: match.champion.championName,
    imageUrl: match.champion.imageUrl,
  }));

export const ROLE_LABELS: Record<string, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "Bot",
  UTILITY: "Support",
};

export function roleLabel(role: string | null): string {
  if (!role) return "Ruolo non indicato";
  return ROLE_LABELS[role] ?? role;
}

export const byRole = (matches: AnalysisMatch[]) =>
  groupBy(matches, (match) =>
    match.teamPosition ? { key: match.teamPosition, label: roleLabel(match.teamPosition) } : null,
  );

/* Time series ------------------------------------------------------------ */

export const ROLLING_WINDOW = 10;

export interface SeriesPoint {
  /** 1-based, oldest first. */
  index: number;
  matchId: string;
  playedAt: string;
  championName: string;
  win: boolean;
  kda: number;
  /** Cumulative win rate, 0–100. */
  winRate: number;
  /** Win rate of the last ROLLING_WINDOW matches (fewer at the start), 0–100. */
  rollingWinRate: number;
  csPerMinute: number | null;
  goldPerMinute: number | null;
  damagePerMinute: number | null;
  visionScore: number;
  /** 0–100. */
  killParticipation: number | null;
}

export function timeSeries(matches: AnalysisMatch[]): SeriesPoint[] {
  const chronological = [...matches].sort(
    (a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt),
  );
  let wins = 0;
  return chronological.map((match, position) => {
    if (match.win) wins += 1;
    const window = chronological.slice(Math.max(0, position - ROLLING_WINDOW + 1), position + 1);
    const windowWins = window.filter((item) => item.win).length;
    const participation = killParticipation(match);
    return {
      index: position + 1,
      matchId: match.matchId,
      playedAt: match.playedAt,
      championName: match.champion.championName,
      win: match.win,
      kda: kda(match.kills, match.deaths, match.assists),
      winRate: (wins / (position + 1)) * 100,
      rollingWinRate: (windowWins / window.length) * 100,
      csPerMinute: csPerMinute(match),
      goldPerMinute: goldPerMinute(match),
      damagePerMinute:
        match.damageDealt === null ? null : perMinute(match.damageDealt, match.durationSeconds),
      visionScore: match.visionScore,
      killParticipation: participation === null ? null : participation * 100,
    };
  });
}

export interface WeekBucket {
  /** Monday of the week, YYYY-MM-DD (UTC). */
  week: string;
  wins: number;
  losses: number;
}

function mondayOf(time: number): string {
  const date = new Date(time);
  const day = (date.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

/** Wins and losses per calendar week (UTC), oldest first. */
export function weeklyResults(matches: AnalysisMatch[]): WeekBucket[] {
  const buckets = new Map<string, WeekBucket>();
  for (const match of matches) {
    const time = Date.parse(match.playedAt);
    if (Number.isNaN(time)) continue;
    const week = mondayOf(time);
    const bucket = buckets.get(week) ?? { week, wins: 0, losses: 0 };
    if (match.win) bucket.wins += 1;
    else bucket.losses += 1;
    buckets.set(week, bucket);
  }
  return [...buckets.values()].sort((a, b) => a.week.localeCompare(b.week));
}

/* Provenance ------------------------------------------------------------- */

export interface Provenance {
  source: string;
  patches: string[];
  games: number;
  /** ISO dates of the oldest and newest analysed match. */
  from: string | null;
  to: string | null;
}

export function provenance(source: string, matches: AnalysisMatch[]): Provenance {
  const times = matches.map((match) => match.playedAt).sort();
  const patches = [
    ...new Set(matches.map((match) => match.patch).filter((patch): patch is string => patch !== null)),
  ].sort(comparePatchesDesc);
  return {
    source,
    patches,
    games: matches.length,
    from: times[0] ?? null,
    to: times.at(-1) ?? null,
  };
}

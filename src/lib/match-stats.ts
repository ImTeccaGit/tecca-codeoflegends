import type { MatchSummary, RankInfo } from "@/types/dashboard";

/** Fields the aggregations need: shared by DEMO and real Riot matches. */
export type StatsMatch = Pick<
  MatchSummary,
  | "matchId"
  | "championName"
  | "win"
  | "kills"
  | "deaths"
  | "assists"
  | "creepScore"
  | "durationSeconds"
  | "playedAt"
>;

/**
 * Pure aggregations over match summaries. They work the same way on DEMO and
 * (future) real data, so every number on the dashboard is derived from the
 * listed matches instead of being typed in separately.
 */

export interface MatchesSummary {
  games: number;
  wins: number;
  losses: number;
  /** 0–1, null without games. */
  winRate: number | null;
  /** (kills + assists) / max(deaths, 1), null without games. */
  kda: number | null;
  avgKills: number | null;
  avgDeaths: number | null;
  avgAssists: number | null;
  csPerMinute: number | null;
  avgDurationSeconds: number | null;
}

export interface ChampionUsage {
  championName: string;
  games: number;
  wins: number;
  /** 0–1 */
  winRate: number;
  kda: number;
  /** Share of all listed games, 0–1. */
  pickShare: number;
}

export interface PerformancePoint {
  /** 1-based, chronological (oldest first). */
  index: number;
  matchId: string;
  championName: string;
  win: boolean;
  kda: number;
  /** Cumulative win rate up to this match, 0–100. */
  winRatePercent: number;
}

export function computeKda(
  kills: number,
  deaths: number,
  assists: number,
): number {
  return (kills + assists) / Math.max(deaths, 1);
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function summarizeMatches(matches: StatsMatch[]): MatchesSummary {
  const games = matches.length;
  const wins = matches.filter((match) => match.win).length;
  const totals = matches.reduce(
    (acc, match) => ({
      kills: acc.kills + match.kills,
      deaths: acc.deaths + match.deaths,
      assists: acc.assists + match.assists,
      creepScore: acc.creepScore + match.creepScore,
      seconds: acc.seconds + match.durationSeconds,
    }),
    { kills: 0, deaths: 0, assists: 0, creepScore: 0, seconds: 0 },
  );

  return {
    games,
    wins,
    losses: games - wins,
    winRate: games === 0 ? null : wins / games,
    kda:
      games === 0
        ? null
        : computeKda(totals.kills, totals.deaths, totals.assists),
    avgKills: average(matches.map((match) => match.kills)),
    avgDeaths: average(matches.map((match) => match.deaths)),
    avgAssists: average(matches.map((match) => match.assists)),
    csPerMinute:
      totals.seconds === 0 ? null : totals.creepScore / (totals.seconds / 60),
    avgDurationSeconds: average(matches.map((match) => match.durationSeconds)),
  };
}

/** Champions ordered by games played, then win rate, then name. */
export function championUsage(matches: StatsMatch[]): ChampionUsage[] {
  const groups = new Map<string, StatsMatch[]>();

  for (const match of matches) {
    const group = groups.get(match.championName) ?? [];
    group.push(match);
    groups.set(match.championName, group);
  }

  return [...groups.entries()]
    .map(([championName, games]) => {
      const summary = summarizeMatches(games);
      return {
        championName,
        games: summary.games,
        wins: summary.wins,
        winRate: summary.winRate ?? 0,
        kda: summary.kda ?? 0,
        pickShare: games.length / matches.length,
      };
    })
    .sort(
      (a, b) =>
        b.games - a.games ||
        b.winRate - a.winRate ||
        a.championName.localeCompare(b.championName),
    );
}

/** Chronological series (oldest first) for the performance chart. */
export function performanceSeries(
  matches: StatsMatch[],
): PerformancePoint[] {
  const chronological = [...matches].sort(
    (a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt),
  );
  let wins = 0;

  return chronological.map((match, position) => {
    if (match.win) {
      wins += 1;
    }
    return {
      index: position + 1,
      matchId: match.matchId,
      championName: match.championName,
      win: match.win,
      kda: computeKda(match.kills, match.deaths, match.assists),
      winRatePercent: (wins / (position + 1)) * 100,
    };
  });
}

const percentFormatter = new Intl.NumberFormat("it-IT", {
  style: "percent",
  maximumFractionDigits: 1,
});

const decimalFormatter = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const oneDecimalFormatter = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatPercent(ratio: number | null): string {
  return ratio === null ? "—" : percentFormatter.format(ratio);
}

export function formatKda(kda: number | null): string {
  return kda === null ? "—" : decimalFormatter.format(kda);
}

export function formatOneDecimal(value: number | null): string {
  return value === null ? "—" : oneDecimalFormatter.format(value);
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

const TIER_LABELS: Record<string, string> = {
  IRON: "Ferro",
  BRONZE: "Bronzo",
  SILVER: "Argento",
  GOLD: "Oro",
  PLATINUM: "Platino",
  EMERALD: "Smeraldo",
  DIAMOND: "Diamante",
  MASTER: "Maestro",
  GRANDMASTER: "Gran Maestro",
  CHALLENGER: "Sfidante",
};

export function formatRank(rank: RankInfo | null): string {
  if (!rank) {
    return "—";
  }
  const tier = TIER_LABELS[rank.tier] ?? rank.tier;
  return rank.division ? `${tier} ${rank.division}` : tier;
}

const relativeFormatter = new Intl.RelativeTimeFormat("it-IT", {
  numeric: "auto",
});

/** "2 ore fa", "ieri"… relative to `now`. */
export function formatRelativeTime(isoDate: string, now: Date): string {
  const timestamp = Date.parse(isoDate);

  if (Number.isNaN(timestamp)) {
    return "Data non disponibile";
  }

  const diffMinutes = Math.round((timestamp - now.getTime()) / 60_000);

  if (Math.abs(diffMinutes) < 60) {
    return relativeFormatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return relativeFormatter.format(diffHours, "hour");
  }

  return relativeFormatter.format(Math.round(diffHours / 24), "day");
}

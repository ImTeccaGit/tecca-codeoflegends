import {
  championUsage,
  summarizeMatches,
  type ChampionUsage,
  type MatchesSummary,
  type StatsMatch,
} from "@/lib/match-stats";
import type { PlayerMatch, RankedEntry } from "@/types/riot";

/**
 * Statistics from the user's own Riot matches. Remakes (early surrender) are
 * shown in the history but excluded from the aggregates, as they are not
 * real games.
 */
export function toStatsMatches(matches: PlayerMatch[]): StatsMatch[] {
  return matches
    .filter((match) => !match.endedEarly)
    .map((match) => ({
      matchId: match.matchId,
      championName: match.championName ?? `Campione ${match.championId}`,
      win: match.win,
      kills: match.kills,
      deaths: match.deaths,
      assists: match.assists,
      creepScore: match.creepScore,
      durationSeconds: match.durationSeconds,
      playedAt: match.playedAt,
    }));
}

export interface PlayerStats {
  summary: MatchesSummary;
  champions: ChampionUsage[];
  remakes: number;
}

export function playerStats(matches: PlayerMatch[]): PlayerStats {
  const counted = toStatsMatches(matches);
  return {
    summary: summarizeMatches(counted),
    champions: championUsage(counted),
    remakes: matches.length - counted.length,
  };
}

/** Win rate of a ranked entry (0–1), null without games. */
export function rankedWinRate(entry: RankedEntry): number | null {
  const games = entry.wins + entry.losses;
  return games === 0 ? null : entry.wins / games;
}

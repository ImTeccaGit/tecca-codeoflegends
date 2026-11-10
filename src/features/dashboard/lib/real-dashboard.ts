import { RANKED_QUEUE_LABELS, queueLabel } from "@/lib/queues";
import type { DashboardData, MatchSummary, TeamPosition } from "@/types/dashboard";
import { teamPositionSchema } from "@/types/dashboard";
import type { PlayerProfile } from "@/types/riot";

function position(value: string | null): TeamPosition | null {
  const parsed = teamPositionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Maps the primary Riot profile to the dashboard contract (source "riot").
 * Returns null when there are no countable matches: the dashboard then shows
 * empty states (or DEMO, if enabled) instead of zeros presented as stats.
 */
export function toDashboardData(profile: PlayerProfile): DashboardData | null {
  const matches: MatchSummary[] = profile.matches
    .filter((match) => !match.endedEarly)
    .map((match) => ({
      matchId: match.matchId,
      championName: match.championName ?? `Campione ${match.championId}`,
      position: position(match.teamPosition),
      queue: queueLabel(match.queueId, match.gameMode),
      win: match.win,
      kills: match.kills,
      deaths: match.deaths,
      assists: match.assists,
      creepScore: match.creepScore,
      durationSeconds: Math.max(1, match.durationSeconds),
      playedAt: match.playedAt,
    }));

  if (matches.length === 0) {
    return null;
  }

  const solo = profile.ranked.find((entry) => entry.queueType === "RANKED_SOLO_5x5");

  return {
    source: "riot",
    sourceLabel: `${profile.source} · ${profile.gameName}#${profile.tagLine}`,
    sourceName: profile.source,
    retrievedAt:
      profile.sync.matchesSyncedAt ?? profile.sync.profileSyncedAt ?? new Date(0).toISOString(),
    matches,
    rank: solo
      ? {
          queue: RANKED_QUEUE_LABELS[solo.queueType] ?? solo.queueType,
          tier: solo.tier,
          division: solo.division,
          leaguePoints: solo.leaguePoints,
        }
      : null,
    // The real patch is shown from the Data Dragon catalog, not from here.
    patch: null,
  };
}

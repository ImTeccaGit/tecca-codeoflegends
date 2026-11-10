import { formatRank } from "@/lib/match-stats";
import type { PlayerProfile } from "@/types/riot";

/** "Oro II · 47 LP" from the real Solo/Duo entry, or an explicit fallback. */
export function soloRankLabel(profile: PlayerProfile): string {
  const solo = profile.ranked.find((entry) => entry.queueType === "RANKED_SOLO_5x5");
  if (!solo) {
    return "Solo/Duo non classificato";
  }
  const rank = formatRank({
    queue: solo.queueType,
    tier: solo.tier,
    division: solo.division,
    leaguePoints: solo.leaguePoints,
  });
  return `${rank} · ${solo.leaguePoints} LP`;
}

/** Second line under the profile name in navigation. */
export function profileSubtitle(profile: PlayerProfile): string {
  return `${profile.region.toUpperCase()} · ${soloRankLabel(profile)}`;
}

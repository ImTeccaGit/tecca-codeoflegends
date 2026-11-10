import { formatRank } from "@/lib/match-stats";
import { RANKED_QUEUE_LABELS } from "@/lib/queues";
import type { RankedEntry } from "@/types/riot";

export function formatRankedEntry(entry: RankedEntry): string {
  const queue = RANKED_QUEUE_LABELS[entry.queueType] ?? entry.queueType;
  const rank = formatRank({
    queue: entry.queueType,
    tier: entry.tier,
    division: entry.division,
    leaguePoints: entry.leaguePoints,
  });
  return `${queue} ${rank} (${entry.leaguePoints} LP)`;
}

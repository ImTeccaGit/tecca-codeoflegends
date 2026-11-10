import { ChampionAvatar } from "@/components/shared/champion-avatar";
import {
  computeKda,
  formatDuration,
  formatKda,
  formatRelativeTime,
} from "@/lib/match-stats";
import { cn } from "@/lib/utils";
import type { MatchSummary } from "@/types/dashboard";

interface MatchSummaryRowProps {
  match: MatchSummary;
  now: Date;
  className?: string;
}

/** Compact row for one match: result, champion, K/D/A, CS and age. */
export function MatchSummaryRow({ match, now, className }: MatchSummaryRowProps) {
  const kda = computeKda(match.kills, match.deaths, match.assists);
  const minutes = match.durationSeconds / 60;
  const csPerMinute = minutes > 0 ? match.creepScore / minutes : 0;

  return (
    <li
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-lg border border-white/[0.05] bg-white/[0.015] py-2 pr-3 pl-4 transition-colors duration-200 hover:border-white/[0.1] hover:bg-white/[0.035]",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-1.5 left-1.5 w-0.5 rounded-full",
          match.win ? "bg-success" : "bg-destructive",
        )}
      />
      <ChampionAvatar name={match.championName} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <span className="truncate">{match.championName}</span>
          <span
            className={cn(
              "font-mono text-[9px] tracking-[0.12em] uppercase",
              match.win ? "text-success" : "text-destructive",
            )}
          >
            {match.win ? "Vittoria" : "Sconfitta"}
          </span>
        </p>
        <p
          className="mt-0.5 truncate text-[10px] text-muted-foreground"
          title={match.queue}
        >
          <time dateTime={match.playedAt}>
            {formatRelativeTime(match.playedAt, now)}
          </time>{" "}
          · {formatDuration(match.durationSeconds)} · {match.queue}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-[11px] text-foreground tabular-nums">
          {match.kills}/{match.deaths}/{match.assists}
        </p>
        <p className="mt-0.5 font-mono text-[9px] text-muted-foreground tabular-nums">
          {formatKda(kda)} KDA · {csPerMinute.toFixed(1)} CS/m
        </p>
      </div>
    </li>
  );
}

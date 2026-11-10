import { ChampionAvatar } from "@/components/shared/champion-avatar";
import { csPerMinute, kda, killParticipation, roleLabel } from "@/features/analysis/lib/analysis";
import { formatDecimal, formatInteger } from "@/features/analysis/lib/format";
import { formatDuration, formatKda, formatPercent } from "@/lib/match-stats";
import { queueLabel } from "@/lib/queues";
import { cn } from "@/lib/utils";
import type { AnalysisMatch } from "@/types/analysis";

const shortDate = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" });

interface MatchTableProps {
  matches: AnalysisMatch[];
  selectedId: string | null;
  onSelect: (matchId: string) => void;
}

/** Analysed matches; selecting a row opens the post-game detail. */
export function MatchTable({ matches, selectedId, onSelect }: MatchTableProps) {
  return (
    <div className="max-h-[560px] overflow-auto">
      <table className="w-full min-w-[720px] text-left text-xs">
        <caption className="sr-only">Partite analizzate, dalla più recente</caption>
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-white/[0.06] text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
            <th scope="col" className="py-2 pr-2 font-semibold">Campione</th>
            <th scope="col" className="px-2 py-2 font-semibold">Esito</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">K/D/A</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">KDA</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">CS/min</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">Oro</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">KP</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">Durata</th>
            <th scope="col" className="py-2 pl-2 font-semibold">Modalità</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => {
            const selected = match.matchId === selectedId;
            return (
              <tr
                key={match.matchId}
                className={cn(
                  "cursor-pointer border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.03]",
                  selected && "bg-primary/[0.07] hover:bg-primary/[0.09]",
                )}
                onClick={() => onSelect(match.matchId)}
              >
                <th scope="row" className="py-1.5 pr-2 font-medium">
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    aria-pressed={selected}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(match.matchId);
                    }}
                  >
                    {match.champion.imageUrl ? (
                      <img src={match.champion.imageUrl} alt="" className="size-7 rounded-md" loading="lazy" />
                    ) : (
                      <ChampionAvatar name={match.champion.championName} size="sm" className="size-7" />
                    )}
                    <span>
                      <span className="block text-foreground">{match.champion.championName}</span>
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        {roleLabel(match.teamPosition)} · {shortDate.format(Date.parse(match.playedAt))}
                      </span>
                    </span>
                  </button>
                </th>
                <td className={cn("px-2 py-1.5 font-semibold", match.win ? "text-success" : "text-destructive")}>
                  {match.win ? "Vittoria" : "Sconfitta"}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {match.kills}/{match.deaths}/{match.assists}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatKda(kda(match.kills, match.deaths, match.assists))}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatDecimal(csPerMinute(match))}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatInteger(match.goldEarned)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatPercent(killParticipation(match))}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatDuration(match.durationSeconds)}</td>
                <td className="py-1.5 pl-2 text-muted-foreground">{queueLabel(match.queueId, match.gameMode)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

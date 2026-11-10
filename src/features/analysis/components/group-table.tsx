import { ChampionAvatar } from "@/components/shared/champion-avatar";
import { MIN_GAMES, type GroupStats } from "@/features/analysis/lib/analysis";
import { formatDecimal } from "@/features/analysis/lib/format";
import { formatKda, formatPercent } from "@/lib/match-stats";
import { cn } from "@/lib/utils";

interface GroupTableProps {
  caption: string;
  firstColumn: string;
  groups: GroupStats[];
  /** Show the share column with this header (e.g. "Uso"). */
  shareLabel?: string;
  showImages?: boolean;
  limit?: number;
  empty: string;
}

/**
 * Win rate table with sample size and 95% interval. Groups below MIN_GAMES
 * keep their raw record but the win rate is marked as unreliable.
 */
export function GroupTable({
  caption,
  firstColumn,
  groups,
  shareLabel,
  showImages = false,
  limit,
  empty,
}: GroupTableProps) {
  const rows = limit ? groups.slice(0, limit) : groups;
  if (rows.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-white/[0.06] text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
            <th scope="col" className="py-2 pr-3 font-semibold">{firstColumn}</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">Partite</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">V–S</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">Win rate</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">IC 95%</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">KDA</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">CS/min</th>
            {shareLabel ? (
              <th scope="col" className="py-2 pl-2 text-right font-semibold">{shareLabel}</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((group) => {
            const { summary } = group;
            return (
              <tr key={group.key} className="border-b border-white/[0.04] last:border-0">
                <th scope="row" className="py-2 pr-3 font-medium text-foreground">
                  <span className="flex items-center gap-2">
                    {showImages ? (
                      group.imageUrl ? (
                        <img src={group.imageUrl} alt="" className="size-6 rounded-md" loading="lazy" />
                      ) : (
                        <ChampionAvatar name={group.label} size="sm" className="size-6 rounded-md" />
                      )
                    ) : null}
                    {group.label}
                  </span>
                </th>
                <td className="px-2 py-2 text-right tabular-nums">{summary.games}</td>
                <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                  {summary.wins}–{summary.losses}
                </td>
                <td
                  className={cn(
                    "px-2 py-2 text-right font-semibold tabular-nums",
                    !summary.sufficient && "text-muted-foreground/70",
                  )}
                  title={summary.sufficient ? undefined : `Meno di ${MIN_GAMES} partite: valore poco affidabile`}
                >
                  {formatPercent(summary.winRate)}
                  {summary.sufficient ? "" : "*"}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                  {summary.interval
                    ? `${Math.round(summary.interval.low * 100)}–${Math.round(summary.interval.high * 100)}%`
                    : "—"}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{formatKda(summary.kda)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatDecimal(summary.csPerMinute)}</td>
                {shareLabel ? (
                  <td className="py-2 pl-2 text-right tabular-nums text-muted-foreground">
                    {formatPercent(group.share)}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.some((group) => !group.summary.sufficient) ? (
        <p className="mt-2 text-[10px] text-muted-foreground">
          * Meno di {MIN_GAMES} partite: il win rate è poco affidabile (vedi l'intervallo di confidenza).
        </p>
      ) : null}
    </div>
  );
}

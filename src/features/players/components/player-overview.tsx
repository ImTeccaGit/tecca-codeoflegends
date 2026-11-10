import { ChampionAvatar } from "@/components/shared/champion-avatar";
import { playerStats } from "@/features/players/lib/player-stats";
import {
  formatDuration,
  formatKda,
  formatOneDecimal,
  formatPercent,
} from "@/lib/match-stats";
import type { PlayerMatch } from "@/types/riot";

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-3.5 py-3">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-lg font-semibold text-foreground tabular-nums">{value}</p>
      {hint ? <p className="text-[10px] text-muted-foreground/70">{hint}</p> : null}
    </div>
  );
}

/** Individual stats and champion performance from the stored matches. */
export function PlayerOverview({ matches }: { matches: PlayerMatch[] }) {
  const { summary, champions, remakes } = playerStats(matches);
  const imageByChampion = new Map(
    matches.map((match) => [match.championName ?? "", match.championImageUrl]),
  );

  return (
    <div className="space-y-5">
      <p className="text-[11px] text-muted-foreground">
        Calcolate sulle {summary.games} partite salvate in locale
        {remakes > 0 ? ` (${remakes} remake esclusi)` : ""}. Fonte: Riot API match-v5.
      </p>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Tile label="Win rate" value={formatPercent(summary.winRate)} hint={`${summary.wins}V · ${summary.losses}S`} />
        <Tile label="KDA" value={formatKda(summary.kda)} />
        <Tile
          label="K / D / A medi"
          value={`${formatOneDecimal(summary.avgKills)} / ${formatOneDecimal(summary.avgDeaths)} / ${formatOneDecimal(summary.avgAssists)}`}
        />
        <Tile label="CS/min" value={formatOneDecimal(summary.csPerMinute)} />
        <Tile
          label="Durata media"
          value={summary.avgDurationSeconds === null ? "—" : formatDuration(summary.avgDurationSeconds)}
        />
        <Tile label="Partite" value={String(summary.games)} />
      </div>

      <div>
        <p className="eyebrow mb-2">Champion performance</p>
        {champions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nessuna partita valida da analizzare.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-[10px] text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-medium">Campione</th>
                  <th scope="col" className="py-2 text-right font-medium">Partite</th>
                  <th scope="col" className="py-2 text-right font-medium">Win rate</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">KDA</th>
                </tr>
              </thead>
              <tbody>
                {champions.slice(0, 8).map((champion) => {
                  const image = imageByChampion.get(champion.championName);
                  return (
                    <tr key={champion.championName} className="border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.02]">
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          {image ? (
                            <img src={image} alt="" className="size-6 rounded-md border border-white/10" loading="lazy" />
                          ) : (
                            <ChampionAvatar name={champion.championName} size="sm" className="size-6" />
                          )}
                          {champion.championName}
                        </span>
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums">{champion.games}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{formatPercent(champion.winRate)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatKda(champion.kda)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

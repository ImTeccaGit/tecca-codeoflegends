import { ChampionAvatar } from "@/components/shared/champion-avatar";
import {
  formatGameMode,
  formatGameTime,
  formatKda,
  formatMap,
  formatPosition,
} from "@/features/live/lib/live-format";
import type { LiveSnapshot } from "@/types/live";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-3 py-2.5">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 font-display text-lg font-semibold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}

/** The local player's own stats, as already shown by the game client. */
export function LiveStats({ snapshot }: { snapshot: LiveSnapshot }) {
  const { game, player } = snapshot;
  if (!game) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {player ? (
          <ChampionAvatar name={player.championName} />
        ) : null}
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-foreground">
            {player ? player.championName : "Nessun giocatore attivo"}
            {player ? (
              <span className="ml-2 text-xs font-medium text-muted-foreground">
                Livello {player.level}
                {formatPosition(player.position)
                  ? ` · ${formatPosition(player.position)}`
                  : ""}
                {player.isDead ? " · in attesa di rinascita" : ""}
              </span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatGameMode(game.mode)} · {formatMap(game.mapNumber, game.mapName)} ·{" "}
            <span className="tabular-nums">{formatGameTime(game.gameTimeSeconds)}</span>
          </p>
        </div>
      </div>

      {player ? (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="K / D / A" value={formatKda(player.kills, player.deaths, player.assists)} />
          <Stat label="CS" value={String(player.creepScore)} />
          <Stat
            label="CS / min"
            value={player.csPerMinute === null ? "—" : player.csPerMinute.toFixed(1)}
          />
          <Stat label="Punteggio visione" value={player.wardScore.toFixed(0)} />
        </dl>
      ) : null}
    </div>
  );
}

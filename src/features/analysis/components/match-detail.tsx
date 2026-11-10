import { ChampionAvatar } from "@/components/shared/champion-avatar";
import { Badge } from "@/components/ui/badge";
import {
  csPerMinute,
  goldPerMinute,
  kda,
  killParticipation,
  roleLabel,
} from "@/features/analysis/lib/analysis";
import { formatDecimal, formatInteger } from "@/features/analysis/lib/format";
import { formatDuration, formatKda, formatPercent } from "@/lib/match-stats";
import { queueLabel } from "@/lib/queues";
import { cn } from "@/lib/utils";
import type { AnalysisMatch, ChampionRef } from "@/types/analysis";

const dateTime = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" });

function Portrait({ champion, className }: { champion: ChampionRef; className?: string }) {
  return champion.imageUrl ? (
    <img src={champion.imageUrl} alt="" className={cn("size-12 rounded-xl", className)} />
  ) : (
    <ChampionAvatar name={champion.championName} className={className} />
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-3 py-2.5">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 font-display text-base font-semibold tabular-nums text-foreground">{value}</dd>
      {hint ? <dd className="text-[10px] text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}

/** Visual you-vs-opponent bar: share of the combined value. */
export function VersusRow({ label, you, them, digits = 0 }: { label: string; you: number | null; them: number | null; digits?: number }) {
  const known = you !== null && them !== null && you + them > 0;
  const share = known ? (you / (you + them)) * 100 : 50;
  const fmt = (value: number | null) =>
    value === null ? "—" : value.toLocaleString("it-IT", { maximumFractionDigits: digits, minimumFractionDigits: digits });
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="font-semibold tabular-nums text-primary">{fmt(you)}</span>
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums text-secondary">{fmt(them)}</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-white/[0.05]" aria-hidden="true">
        {known ? (
          <>
            <span className="bg-primary/80" style={{ width: `${share}%` }} />
            <span className="flex-1 bg-secondary/70" />
          </>
        ) : null}
      </div>
    </div>
  );
}

export function MatchDetail({ match }: { match: AnalysisMatch }) {
  const participation = killParticipation(match);
  const opponent = match.opponent;
  const minutes = match.durationSeconds / 60;
  const completed = match.items.filter((item) => item.completed).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Portrait champion={match.champion} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold text-foreground">
            {match.champion.championName}
            <span className="ml-2 text-xs font-medium text-muted-foreground">
              {roleLabel(match.teamPosition)}
              {match.champLevel ? ` · livello ${match.champLevel}` : ""}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {queueLabel(match.queueId, match.gameMode)} · {dateTime.format(Date.parse(match.playedAt))} · patch{" "}
            {match.patch ?? "non indicata"}
          </p>
        </div>
        <Badge variant={match.win ? "success" : "danger"}>
          {match.endedEarly ? "Resa anticipata · " : ""}
          {match.win ? "Vittoria" : "Sconfitta"}
        </Badge>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="KDA" value={formatKda(kda(match.kills, match.deaths, match.assists))} hint={`${match.kills} / ${match.deaths} / ${match.assists}`} />
        <Metric label="Kill" value={String(match.kills)} />
        <Metric label="Morti" value={String(match.deaths)} />
        <Metric label="Assist" value={String(match.assists)} />
        <Metric label="CS" value={formatInteger(match.creepScore)} hint={`${formatDecimal(csPerMinute(match))} CS/min`} />
        <Metric label="Oro" value={formatInteger(match.goldEarned)} hint={`${formatInteger(goldPerMinute(match))} oro/min`} />
        <Metric
          label="Danni inflitti"
          value={formatInteger(match.damageDealt)}
          hint={match.damageDealt === null ? "Non fornito da Riot" : `${formatInteger(match.damageDealt / minutes)} /min ai campioni`}
        />
        <Metric
          label="Danni subiti"
          value={formatInteger(match.damageTaken)}
          hint={match.damageTaken === null ? "Non fornito da Riot" : undefined}
        />
        <Metric label="Punteggio visione" value={String(match.visionScore)} />
        <Metric
          label="Kill participation"
          value={formatPercent(participation)}
          hint={participation === null ? "Squadra senza uccisioni" : `${match.kills + match.assists} di ${match.teamKills} kill`}
        />
        <Metric label="Durata" value={formatDuration(match.durationSeconds)} />
        <Metric label="Risultato" value={match.win ? "Vittoria" : "Sconfitta"} />
      </dl>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">
          Oggetti finali <span className="font-normal text-muted-foreground">({completed} completati)</span>
        </p>
        {match.items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nessun oggetto registrato.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {match.items.map((item, position) => (
              <li
                key={`${item.id}-${position}`}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-1.5 py-1 text-[11px]",
                  item.completed ? "border-primary/25 bg-primary/[0.06]" : "border-white/[0.06]",
                )}
                title={item.name ?? `Oggetto ${item.id}`}
              >
                {item.imageUrl ? <img src={item.imageUrl} alt="" className="size-6 rounded" loading="lazy" /> : null}
                <span className="max-w-36 truncate">{item.name ?? `Oggetto ${item.id}`}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-white/[0.06] p-4">
        <p className="text-xs font-semibold text-foreground">Confronto con l'avversario di corsia</p>
        {opponent ? (
          <>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2 font-semibold text-primary">
                <Portrait champion={match.champion} className="size-8 rounded-lg" />
                Tu · {match.champion.championName}
              </span>
              <span className="flex items-center gap-2 font-semibold text-secondary">
                {opponent.champion.championName}
                <Portrait champion={opponent.champion} className="size-8 rounded-lg" />
              </span>
            </div>
            <VersusRow label="KDA" you={kda(match.kills, match.deaths, match.assists)} them={kda(opponent.kills, opponent.deaths, opponent.assists)} digits={2} />
            <VersusRow label="CS" you={match.creepScore} them={opponent.creepScore} />
            <VersusRow label="Oro" you={match.goldEarned} them={opponent.goldEarned} />
            <VersusRow label="Danni ai campioni" you={match.damageDealt} them={opponent.damageDealt} />
            <VersusRow label="Visione" you={match.visionScore} them={opponent.visionScore} />
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Avversario diretto non identificabile: Riot non ha assegnato un ruolo univoco
            (es. ARAM, Arena o ruoli non determinati).
          </p>
        )}
      </div>
    </div>
  );
}

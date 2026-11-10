import { useState } from "react";
import { ChampionAvatar } from "@/components/shared/champion-avatar";
import {
  computeKda,
  formatDuration,
  formatKda,
  formatRelativeTime,
} from "@/lib/match-stats";
import { queueLabel } from "@/lib/queues";
import { cn, formatDateTime } from "@/lib/utils";
import type { PlayerMatch } from "@/types/riot";

function Icon({
  url,
  label,
  className,
}: {
  url: string | null;
  label: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <span
        title={label}
        className={cn(
          "flex items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] font-mono text-[7px] text-muted-foreground",
          className,
        )}
      >
        ?
      </span>
    );
  }
  return (
    <img
      src={url}
      alt={label}
      title={label}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("rounded-md border border-white/[0.08] object-cover", className)}
    />
  );
}

/** One real match from match-v5: result, champion, KDA, CS, items, runes. */
export function PlayerMatchRow({ match, now }: { match: PlayerMatch; now: Date }) {
  const kda = computeKda(match.kills, match.deaths, match.assists);
  const minutes = match.durationSeconds / 60;
  const csPerMinute = minutes > 0 ? match.creepScore / minutes : 0;
  const champion = match.championName ?? `Campione ${match.championId}`;
  const result = match.endedEarly ? "Remake" : match.win ? "Vittoria" : "Sconfitta";

  return (
    <li
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-xl border py-3 pr-3 pl-4 transition-colors duration-200 sm:flex-row sm:items-center",
        match.endedEarly
          ? "border-white/[0.06] bg-white/[0.015]"
          : match.win
            ? "border-success/15 bg-success/[0.03] hover:bg-success/[0.05]"
            : "border-destructive/15 bg-destructive/[0.03] hover:bg-destructive/[0.05]",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-2 left-1.5 w-0.5 rounded-full",
          match.endedEarly ? "bg-muted-foreground/40" : match.win ? "bg-success" : "bg-destructive",
        )}
      />

      <div className="flex min-w-0 items-center gap-3 sm:w-56">
        <div className="relative shrink-0">
          {match.championImageUrl ? (
            <img
              src={match.championImageUrl}
              alt=""
              width={44}
              height={44}
              loading="lazy"
              className="size-11 rounded-xl border border-white/10 object-cover"
            />
          ) : (
            <ChampionAvatar name={champion} className="size-11" />
          )}
          {match.champLevel ? (
            <span className="absolute -right-1 -bottom-1 rounded-md border border-white/10 bg-background px-1 font-mono text-[9px] text-foreground">
              {match.champLevel}
            </span>
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">{champion}</p>
          <p
            className={cn(
              "font-mono text-[9px] tracking-[0.12em] uppercase",
              match.endedEarly ? "text-muted-foreground" : match.win ? "text-success" : "text-destructive",
            )}
          >
            {result}
          </p>
          <p className="truncate text-[10px] text-muted-foreground" title={formatDateTime(match.playedAt)}>
            {queueLabel(match.queueId, match.gameMode)} ·{" "}
            <time dateTime={match.playedAt}>{formatRelativeTime(match.playedAt, now)}</time> ·{" "}
            {formatDuration(match.durationSeconds)}
          </p>
        </div>
      </div>

      <div className="flex gap-5 sm:w-44">
        <div>
          <p className="font-mono text-sm text-foreground tabular-nums">
            {match.kills}/<span className="text-destructive">{match.deaths}</span>/{match.assists}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground tabular-nums">{formatKda(kda)} KDA</p>
        </div>
        <div>
          <p className="font-mono text-sm text-foreground tabular-nums">{match.creepScore} CS</p>
          <p className="font-mono text-[10px] text-muted-foreground tabular-nums">
            {csPerMinute.toFixed(1)}/min
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-3">
        <ul className="flex gap-1" aria-label="Oggetti">
          {match.items.map((item, index) => (
            <li key={`${item.id}-${index}`}>
              <Icon url={item.imageUrl} label={`Oggetto ${item.id}`} className="size-7" />
            </li>
          ))}
          {match.items.length === 0 ? (
            <li className="text-[10px] text-muted-foreground">Nessun oggetto</li>
          ) : null}
        </ul>
        {match.keystone || match.secondaryStyle ? (
          <div className="flex items-center gap-1" aria-label="Rune">
            {match.keystone ? (
              <Icon
                url={match.keystone.iconUrl}
                label={match.keystone.name ?? `Runa ${match.keystone.id}`}
                className="size-7 rounded-full bg-black/30"
              />
            ) : null}
            {match.secondaryStyle ? (
              <Icon
                url={match.secondaryStyle.iconUrl}
                label={match.secondaryStyle.name ?? `Albero ${match.secondaryStyle.id}`}
                className="size-5 rounded-full bg-black/30 p-0.5"
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <dl className="flex gap-4 text-[10px] text-muted-foreground sm:flex-col sm:gap-0.5 sm:text-right">
        <div>
          <dt className="sr-only">Visione</dt>
          <dd>Visione {match.visionScore}</dd>
        </div>
        {match.damageToChampions !== null ? (
          <div>
            <dt className="sr-only">Danni ai campioni</dt>
            <dd>{match.damageToChampions.toLocaleString("it-IT")} danni</dd>
          </div>
        ) : null}
        <div>
          <dt className="sr-only">Oro</dt>
          <dd>{match.goldEarned.toLocaleString("it-IT")} oro</dd>
        </div>
      </dl>
    </li>
  );
}

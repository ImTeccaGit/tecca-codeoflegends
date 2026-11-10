import { ChevronRight, ShieldAlert, Swords } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { GameIcon } from "@/features/champions/components/global/game-icon";
import { RunePageView } from "@/features/champions/components/global/rune-page-view";
import {
  SMALL_SAMPLE,
  formatPercent,
  gamesLabel,
  ratio,
  roleName,
} from "@/features/champions/lib/global-format";
import { cn } from "@/lib/utils";
import type { ChampionSpell } from "@/types/catalog";
import type { ChampionGlobalStats, IconStat, ItemSetStat, MatchupStat } from "@/types/global-stats";

export function Panel({
  title,
  children,
  aside,
  className,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
        <h2 className="font-display text-sm font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-3 text-center text-[11px] leading-relaxed text-muted-foreground">{children}</p>;
}

/** Percent and sample under an icon group. */
function Sample({ games, wins, total }: { games: number; wins: number; total: number }) {
  return (
    <p className="mt-2 text-center text-[10px] leading-relaxed text-muted-foreground">
      Popolarità {formatPercent(ratio(games, total))} · Vittorie {formatPercent(ratio(wins, games))}
      <br />
      {gamesLabel(games)}
    </p>
  );
}

function winTone(value: number | null) {
  if (value === null) return "text-muted-foreground";
  return value >= 0.5 ? "text-success" : "text-destructive";
}

/* Overview --------------------------------------------------------------- */

const GAUGE_TONES = {
  secondary: "stroke-secondary",
  success: "stroke-success",
  danger: "stroke-destructive",
  muted: "stroke-muted-foreground",
} as const;

function Gauge({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone: keyof typeof GAUGE_TONES;
}) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const filled = value === null ? 0 : Math.min(1, Math.max(0, value)) * circumference;
  return (
    <figure className="flex flex-col items-center gap-2">
      <div className="relative size-24">
        <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="40" cy="40" r={radius} fill="none" strokeWidth="5" className="stroke-white/[0.07]" />
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            className={cn(GAUGE_TONES[tone], "transition-[stroke-dasharray] duration-500 motion-reduce:transition-none")}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-display text-base font-semibold tabular-nums">
          {formatPercent(value)}
        </span>
      </div>
      <figcaption className="text-center text-[11px] text-muted-foreground">{label}</figcaption>
    </figure>
  );
}

export function OverviewPanel({ stats }: { stats: ChampionGlobalStats }) {
  const winRate = ratio(stats.roleWins, stats.roleGames);
  return (
    <Panel
      title="Panoramica"
      aside={
        stats.roleGames > 0 && stats.roleGames < SMALL_SAMPLE ? (
          <Badge variant="warning">Campione ridotto</Badge>
        ) : null
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <Gauge label="Popolarità" value={ratio(stats.games, stats.totalMatches)} tone="secondary" />
        <Gauge
          label={`Vittorie${stats.role ? ` (${roleName(stats.role)})` : ""}`}
          value={winRate}
          tone={winRate === null ? "muted" : winRate >= 0.5 ? "success" : "danger"}
        />
        <Gauge label="Ban" value={ratio(stats.bans, stats.totalMatches)} tone="danger" />
      </div>
      <p className="mt-4 text-center text-[10px] leading-relaxed text-muted-foreground">
        {gamesLabel(stats.games)} su {gamesLabel(stats.totalMatches)} raccolte
        {stats.role ? ` · ${gamesLabel(stats.roleGames)} come ${roleName(stats.role)}` : ""}
      </p>
    </Panel>
  );
}

/* Matchups --------------------------------------------------------------- */

function MatchupList({ items, label }: { items: MatchupStat[]; label: string }) {
  if (items.length === 0) {
    return <Empty>Nessun avversario di corsia con abbastanza partite.</Empty>;
  }
  return (
    <ul className="flex flex-wrap gap-3" aria-label={label}>
      {items.map((matchup) => {
        const winRate = ratio(matchup.wins, matchup.games);
        const name = matchup.name ?? `Campione ${matchup.championId}`;
        const content = (
          <>
            <GameIcon src={matchup.imageUrl} name={name} className="size-11" />
            <span className={cn("text-[11px] font-semibold tabular-nums", winTone(winRate))}>
              {formatPercent(winRate)}
            </span>
            <span className="text-[9px] text-muted-foreground">{gamesLabel(matchup.games)}</span>
          </>
        );
        return (
          <li key={matchup.championId}>
            {matchup.key ? (
              <Link
                to={`/champions/${encodeURIComponent(matchup.key)}`}
                className="flex flex-col items-center gap-1 rounded-lg p-1 transition-colors hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {content}
              </Link>
            ) : (
              <div className="flex flex-col items-center gap-1 p-1">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function MatchupsPanel({ stats }: { stats: ChampionGlobalStats }) {
  return (
    <Panel
      title="Avversari di corsia"
      aside={
        <span className="text-[10px] text-muted-foreground">
          minimo {stats.matchupMinGames} partite · vittorie del campione
        </span>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-success">
            <Swords className="size-3.5" /> Countera
          </h3>
          <MatchupList items={stats.strongAgainst} label="Avversari battuti più spesso" />
        </div>
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-destructive">
            <ShieldAlert className="size-3.5" /> È counterato da
          </h3>
          <MatchupList items={stats.weakAgainst} label="Avversari contro cui perde più spesso" />
        </div>
      </div>
    </Panel>
  );
}

/* Role and summoner spells ---------------------------------------------- */

export function RolePanel({ stats }: { stats: ChampionGlobalStats }) {
  const share = stats.roles.find((role) => role.role === stats.role);
  return (
    <Panel title="Ruolo">
      {share ? (
        <>
          <p className="text-center font-display text-lg font-semibold">{roleName(share.role)}</p>
          <Sample
            games={share.games}
            wins={share.wins}
            total={stats.roles.reduce((sum, item) => sum + item.games, 0)}
          />
        </>
      ) : (
        <Empty>Nessuna partita con un ruolo indicato.</Empty>
      )}
    </Panel>
  );
}

export function SpellsPanel({ stats }: { stats: ChampionGlobalStats }) {
  const [first, ...others] = stats.summonerSpells;
  return (
    <Panel title="Incantesimi evocatore">
      {first ? (
        <>
          <div className="flex justify-center gap-2">
            {first.spells.map((spell) => (
              <GameIcon key={spell.id} src={spell.iconUrl} name={spell.name} className="size-11" />
            ))}
          </div>
          <Sample games={first.games} wins={first.wins} total={stats.roleGames} />
          {others.length > 0 ? (
            <ul className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
              {others.map((pair) => (
                <li key={pair.spells.map((spell) => spell.id).join("-")} className="flex items-center gap-2">
                  {pair.spells.map((spell) => (
                    <GameIcon key={spell.id} src={spell.iconUrl} name={spell.name} className="size-6" />
                  ))}
                  <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                    {formatPercent(ratio(pair.games, stats.roleGames))} ·{" "}
                    <span className={winTone(ratio(pair.wins, pair.games))}>
                      {formatPercent(ratio(pair.wins, pair.games))}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <Empty>Nessun dato per questo ruolo.</Empty>
      )}
    </Panel>
  );
}

/* Runes ------------------------------------------------------------------- */

export function RunesPanel({ stats }: { stats: ChampionGlobalStats }) {
  const [selected, setSelected] = useState(0);
  const page = stats.runePages[selected] ?? stats.runePages[0];

  return (
    <Panel
      title="Rune più usate"
      aside={
        page ? (
          <span className="text-[10px] text-muted-foreground">
            Popolarità {formatPercent(ratio(page.games, stats.roleGames))} · Vittorie{" "}
            <span className={winTone(ratio(page.wins, page.games))}>
              {formatPercent(ratio(page.wins, page.games))}
            </span>{" "}
            · {gamesLabel(page.games)}
          </span>
        ) : null
      }
    >
      {page ? (
        <>
          <RunePageView page={page} trees={stats.runeTrees} shardRows={stats.shardRows} />
          {stats.runePages.length > 1 ? (
            <div className="mt-5 border-t border-white/[0.06] pt-3">
              <p className="mb-2 text-[11px] font-semibold text-muted-foreground">Pagine alternative</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Scegli la pagina di rune">
                {stats.runePages.map((option, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-pressed={index === selected}
                    onClick={() => setSelected(index)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[10px] transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                      index === selected
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-white/[0.08] bg-white/[0.02] text-muted-foreground hover:border-white/20",
                    )}
                  >
                    <GameIcon
                      src={option.primaryRunes[0]?.iconUrl ?? null}
                      name={option.primaryRunes[0]?.name ?? null}
                      round
                      className="size-6"
                    />
                    <GameIcon
                      src={option.secondaryStyle.iconUrl}
                      name={option.secondaryStyle.name}
                      round
                      className="size-4"
                    />
                    <span className="tabular-nums">
                      {formatPercent(ratio(option.games, stats.roleGames))} ·{" "}
                      {formatPercent(ratio(option.wins, option.games))}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {stats.keystones.length > 1 ? (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-semibold text-muted-foreground">Rune chiave</p>
              <IconStatRow items={stats.keystones} total={stats.roleGames} round />
            </div>
          ) : null}
        </>
      ) : (
        <Empty>Nessuna pagina di rune completa per questo ruolo.</Empty>
      )}
    </Panel>
  );
}

/* Items ------------------------------------------------------------------- */

function IconStatRow({ items, total, round = false }: { items: IconStat[]; total: number; round?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-3">
      {items.map((item) => {
        const winRate = ratio(item.wins, item.games);
        return (
          <li key={item.icon.id} className="flex w-16 flex-col items-center gap-1 text-center">
            <GameIcon src={item.icon.iconUrl} name={item.icon.name} round={round} className="size-10" />
            <span className="text-[10px] text-foreground tabular-nums">{formatPercent(ratio(item.games, total))}</span>
            <span className={cn("text-[9px] tabular-nums", winTone(winRate))}>{formatPercent(winRate)} V</span>
          </li>
        );
      })}
    </ul>
  );
}

function ItemSet({ set, total }: { set: ItemSetStat; total: number }) {
  // Duplicates (e.g. two potions) are shown once with a counter.
  const grouped: { icon: IconStat["icon"]; count: number }[] = [];
  for (const item of set.items) {
    const existing = grouped.find((entry) => entry.icon.id === item.id);
    if (existing) existing.count += 1;
    else grouped.push({ icon: item, count: 1 });
  }
  return (
    <div>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {grouped.map((entry) => (
          <span key={entry.icon.id} className="flex items-center gap-1">
            <GameIcon src={entry.icon.iconUrl} name={entry.icon.name} className="size-10" />
            {entry.count > 1 ? <span className="text-[10px] text-muted-foreground">×{entry.count}</span> : null}
          </span>
        ))}
      </div>
      <Sample games={set.games} wins={set.wins} total={total} />
    </div>
  );
}

function OrderedSet({ set, total }: { set: ItemSetStat; total: number }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1">
        {set.items.map((item, index) => (
          <span key={`${item.id}-${index}`} className="flex items-center gap-1">
            {index > 0 ? <ChevronRight className="size-3 text-muted-foreground" aria-hidden="true" /> : null}
            <GameIcon src={item.iconUrl} name={item.name} className="size-10" />
          </span>
        ))}
      </div>
      <Sample games={set.games} wins={set.wins} total={total} />
    </div>
  );
}

function Stage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-3 border-b border-white/[0.06] pb-2 text-[11px] font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

export function BuildPanel({ stats }: { stats: ChampionGlobalStats }) {
  const timelineNote =
    stats.timelineGames === 0 ? "Servono partite con timeline (raccolta globale)." : "Nessun dato per questo ruolo.";
  const [boots] = stats.boots;
  return (
    <Panel title="Build">
      <div className="grid gap-5 sm:grid-cols-2">
        <Stage title="Build iniziale">
          {stats.startBuilds[0] ? (
            <ItemSet set={stats.startBuilds[0]} total={stats.timelineGames} />
          ) : (
            <Empty>{timelineNote}</Empty>
          )}
        </Stage>
        <Stage title="Build centrale">
          {stats.coreBuilds[0] ? (
            <OrderedSet set={stats.coreBuilds[0]} total={stats.timelineGames} />
          ) : (
            <Empty>{timelineNote}</Empty>
          )}
        </Stage>
        <Stage title="Stivali">
          {boots ? (
            <div>
              <div className="flex justify-center">
                <GameIcon src={boots.icon.iconUrl} name={boots.icon.name} className="size-10" />
              </div>
              <Sample games={boots.games} wins={boots.wins} total={stats.roleGames} />
            </div>
          ) : (
            <Empty>Nessun dato per questo ruolo.</Empty>
          )}
        </Stage>
        <Stage title="Build finale">
          {stats.coreItems.length > 0 ? (
            <IconStatRow items={stats.coreItems.slice(0, 4)} total={stats.roleGames} />
          ) : (
            <Empty>Nessun dato per questo ruolo.</Empty>
          )}
        </Stage>
      </div>
      <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground/80">
        Iniziale: oggetti comprati nei primi 90 secondi. Centrale: primi tre oggetti completi in
        ordine di acquisto (timeline). Finale: oggetti più frequenti nell&apos;inventario a fine
        partita.
      </p>
    </Panel>
  );
}

/* Skill order -------------------------------------------------------------- */

const SLOT_ROWS = ["Q", "W", "E", "R"] as const;

export function SkillOrderPanel({ stats, spells }: { stats: ChampionGlobalStats; spells: ChampionSpell[] }) {
  const [order] = stats.skillOrders;
  const spellFor = (slot: string) => spells.find((spell) => spell.slot === slot);
  return (
    <Panel title="Ordine delle abilità">
      {order ? (
        <>
          <div className="mb-4 flex items-center justify-center gap-1.5">
            {order.priority.map((slot, index) => {
              const spell = spellFor(slot);
              return (
                <span key={slot} className="flex items-center gap-1.5">
                  {index > 0 ? <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" /> : null}
                  <span className="relative">
                    <GameIcon src={spell?.imageUrl ?? null} name={spell?.name ?? slot} className="size-11" />
                    <span className="absolute -right-1 -bottom-1 rounded bg-background px-1 font-mono text-[10px] font-bold">
                      {slot}
                    </span>
                  </span>
                </span>
              );
            })}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0.5 text-center" aria-label="Abilità per livello">
              <thead>
                <tr>
                  <th className="sr-only">Abilità</th>
                  {order.sequence.map((_, level) => (
                    <th key={level} className="text-[9px] font-normal text-muted-foreground">
                      {level + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SLOT_ROWS.map((slot) => {
                  const spell = spellFor(slot);
                  return (
                    <tr key={slot}>
                      <th scope="row" className="pr-1">
                        <GameIcon src={spell?.imageUrl ?? null} name={spell?.name ?? slot} className="size-5" />
                      </th>
                      {order.sequence.map((current, level) => (
                        <td
                          key={level}
                          className={cn(
                            "h-5 min-w-5 rounded-sm text-[10px] font-semibold",
                            current === slot ? "bg-secondary/80 text-background" : "bg-white/[0.04]",
                          )}
                        >
                          {current === slot ? slot : ""}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Sample games={order.games} wins={order.wins} total={stats.timelineGames} />
        </>
      ) : (
        <Empty>
          {stats.personal
            ? "Le tue partite salvate non hanno la timeline: l'ordine delle abilità arriva con la raccolta globale."
            : "Nessuna partita con timeline per questo ruolo."}
        </Empty>
      )}
    </Panel>
  );
}

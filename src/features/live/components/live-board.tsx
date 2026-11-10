import { ChevronRight, Loader2, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { GameIcon } from "@/features/champions/components/global/game-icon";
import { formatPercent, ratio, roleName } from "@/features/champions/lib/global-format";
import { cn } from "@/lib/utils";
import type { ItemSetStat } from "@/types/global-stats";
import type { BoardPlayer, LiveBoard, RankSummary } from "@/types/live";

const TIERS: Record<string, string> = {
  IRON: "Ferro",
  BRONZE: "Bronzo",
  SILVER: "Argento",
  GOLD: "Oro",
  PLATINUM: "Platino",
  EMERALD: "Smeraldo",
  DIAMOND: "Diamante",
  MASTER: "Maestro",
  GRANDMASTER: "Gran Maestro",
  CHALLENGER: "Sfidante",
};

const TIER_TONES: Record<string, string> = {
  IRON: "text-muted-foreground",
  BRONZE: "text-warning/70",
  SILVER: "text-foreground/80",
  GOLD: "text-warning",
  PLATINUM: "text-secondary",
  EMERALD: "text-success",
  DIAMOND: "text-primary-soft",
  MASTER: "text-primary",
  GRANDMASTER: "text-destructive",
  CHALLENGER: "text-warning",
};

export function rankLabel(rank: RankSummary): string {
  const tier = TIERS[rank.tier] ?? rank.tier;
  const apex = ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(rank.tier);
  return `${tier}${rank.division && !apex ? ` ${rank.division}` : ""} · ${rank.leaguePoints} LP`;
}

function winTone(value: number | null) {
  if (value === null) return "text-muted-foreground";
  return value >= 0.5 ? "text-success" : "text-destructive";
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right tabular-nums">{children}</span>
    </div>
  );
}

function PlayerCard({ player, boardMessage }: { player: BoardPlayer; boardMessage: string | null }) {
  const name =
    player.riotId ?? (player.state === "bot" ? "Bot" : "Giocatore anonimo");
  const season = player.rank ? ratio(player.rank.wins, player.rank.wins + player.rank.losses) : null;
  const recent = player.recent;
  const recentRate = recent ? ratio(recent.wins, recent.games) : null;
  const championRate = recent ? ratio(recent.championWins, recent.championGames) : null;
  const loading = player.state === "pending" || player.state === "ranked";

  return (
    <article
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-xl border bg-card/95 p-3",
        player.isMe ? "border-primary/60 shadow-[0_0_0_1px] shadow-primary/30" : "border-white/[0.07]",
      )}
      aria-label={`${name}, ${player.championName}`}
    >
      <header className="flex items-center gap-2">
        <GameIcon src={player.championImageUrl} name={player.championName} className="size-10 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xs font-semibold" title={name}>
            {name}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            {player.championName}
            {player.summonerLevel !== null ? ` · Livello ${player.summonerLevel}` : ""}
          </p>
        </div>
        {player.isMe ? <Badge variant="secondary">Tu</Badge> : null}
      </header>

      {player.state === "anonymous" || player.state === "bot" ? (
        <p className="flex items-center gap-1.5 text-[10px] leading-snug text-muted-foreground">
          <UserRound className="size-3" />
          {player.state === "bot" ? "Bot: nessun profilo." : "Nome nascosto dal gioco: non viene cercato."}
        </p>
      ) : (
        <div className="space-y-1">
          <Line label="Solo/Duo">
            {player.rank ? (
              <span className={cn("font-semibold", TIER_TONES[player.rank.tier])}>{rankLabel(player.rank)}</span>
            ) : player.state === "pending" ? (
              <Loader2 className="inline size-3 animate-spin text-muted-foreground" />
            ) : player.state === "error" ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <span className="text-muted-foreground">Non classificato</span>
            )}
          </Line>
          {player.rank ? (
            <Line label="Stagione">
              <span className={winTone(season)}>{formatPercent(season)}</span>{" "}
              <span className="text-muted-foreground">
                ({player.rank.wins}V / {player.rank.losses}S)
              </span>
            </Line>
          ) : null}
          {recent && recent.games > 0 ? (
            <>
              <Line label={`Ultime ${recent.games}`}>
                <span className={winTone(recentRate)}>{formatPercent(recentRate)}</span>{" "}
                <span className="text-muted-foreground">
                  {(recent.kills / recent.games).toFixed(1)}/{(recent.deaths / recent.games).toFixed(1)}/
                  {(recent.assists / recent.games).toFixed(1)}
                </span>
              </Line>
              <Line label="Ruolo principale">{roleName(recent.mainRole)}</Line>
              <Line label={`Con ${player.championName}`}>
                {recent.championGames > 0 ? (
                  <>
                    {recent.championGames} {recent.championGames === 1 ? "partita" : "partite"} ·{" "}
                    <span className={winTone(championRate)}>{formatPercent(championRate)}</span>
                  </>
                ) : (
                  <span className="text-warning">Nessuna recente</span>
                )}
              </Line>
            </>
          ) : recent ? (
            <Line label="Recenti">
              <span className="text-muted-foreground">Nessuna classificata (30 g)</span>
            </Line>
          ) : loading ? (
            <Line label="Recenti">
              <Loader2 className="inline size-3 animate-spin text-muted-foreground" />
            </Line>
          ) : null}
          {player.message && player.state === "error" && player.message !== boardMessage ? (
            <p className="line-clamp-2 text-[10px] text-destructive">{player.message}</p>
          ) : null}
        </div>
      )}
    </article>
  );
}

function Team({
  title,
  tone,
  players,
  boardMessage,
}: {
  title: string;
  tone: string;
  players: BoardPlayer[];
  boardMessage: string | null;
}) {
  return (
    <section aria-label={title}>
      <h3 className={cn("eyebrow mb-2", tone)}>{title}</h3>
      {players.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 px-3 py-2 text-[11px] text-muted-foreground">
          Il gioco non segnala giocatori in questa squadra (per esempio nello Strumento di allenamento).
        </p>
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {players.map((player, index) => (
            <PlayerCard key={`${player.championName}-${index}`} player={player} boardMessage={boardMessage} />
          ))}
        </div>
      )}
    </section>
  );
}

function Items({ set, ordered = false }: { set: ItemSetStat | undefined; ordered?: boolean }) {
  if (!set) return <p className="text-[10px] text-muted-foreground">Nessun dato</p>;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {set.items.map((item, index) => (
        <span key={`${item.id}-${index}`} className="flex items-center gap-1">
          {ordered && index > 0 ? <ChevronRight className="size-3 text-muted-foreground" /> : null}
          <GameIcon src={item.iconUrl} name={item.name} className="size-8" />
        </span>
      ))}
    </div>
  );
}

function BuildBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-foreground">{title}</p>
      {children}
    </div>
  );
}

function SkillKey({ slot }: { slot: string }) {
  return (
    <span className="flex size-7 items-center justify-center rounded-md border border-secondary/40 bg-secondary/15 font-mono text-xs font-bold text-secondary">
      {slot}
    </span>
  );
}

function BuildColumn({ board }: { board: LiveBoard }) {
  const build = board.build;
  if (!build || build.roleGames === 0) {
    return (
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Nessuna statistica per {board.buildChampion ?? "il tuo campione"}: attiva la raccolta in
        Impostazioni per avere la build più usata.
      </p>
    );
  }
  const [page] = build.runePages;
  const [order] = build.skillOrders;
  const finals = build.coreItems.slice(0, 3);
  return (
    <div className="space-y-3">
      {page ? (
        <BuildBlock title="Rune">
          <div className="flex items-center gap-1.5">
            {page.primaryRunes.map((rune, index) => (
              <GameIcon key={rune.id} src={rune.iconUrl} name={rune.name} round className={index === 0 ? "size-9" : "size-6"} />
            ))}
            <span className="mx-1 h-6 w-px bg-white/10" />
            {page.secondaryRunes.map((rune) => (
              <GameIcon key={rune.id} src={rune.iconUrl} name={rune.name} round className="size-6" />
            ))}
          </div>
        </BuildBlock>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <BuildBlock title="Oggetti iniziali">
          <Items set={build.startBuilds[0]} />
        </BuildBlock>
        <BuildBlock title="Stivali">
          {build.boots[0] ? (
            <GameIcon src={build.boots[0].icon.iconUrl} name={build.boots[0].icon.name} className="size-8" />
          ) : (
            <p className="text-[10px] text-muted-foreground">Nessun dato</p>
          )}
        </BuildBlock>
      </div>
      <BuildBlock title="Oggetti fondamentali">
        <Items set={build.coreBuilds[0]} ordered />
      </BuildBlock>
      <BuildBlock title="Oggetti finali">
        {finals.length > 0 ? (
          <div className="flex gap-1">
            {finals.map((item) => (
              <GameIcon key={item.icon.id} src={item.icon.iconUrl} name={item.icon.name} className="size-8" />
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">Nessun dato</p>
        )}
      </BuildBlock>
      <div className="grid grid-cols-2 gap-3">
        <BuildBlock title="Livello 1-2-3">
          {order ? (
            <div className="flex gap-1">
              {order.sequence.slice(0, 3).map((slot, index) => (
                <SkillKey key={index} slot={slot} />
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">Nessun dato</p>
          )}
        </BuildBlock>
        <BuildBlock title="Ordine abilità">
          {order ? (
            <div className="flex items-center gap-1">
              {order.priority.map((slot, index) => (
                <span key={slot} className="flex items-center gap-1">
                  {index > 0 ? <ChevronRight className="size-3 text-muted-foreground" /> : null}
                  <SkillKey slot={slot} />
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">Nessun dato</p>
          )}
        </BuildBlock>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {build.personal ? "Dalle tue partite" : "Dalle partite raccolte"} · {build.roleGames}{" "}
        {build.roleGames === 1 ? "partita" : "partite"} come {roleName(build.role)}
      </p>
    </div>
  );
}

/** Players of both teams and the build of the user's champion. */
export function LiveBoardContent({ board }: { board: LiveBoard }) {
  if (!board.active) {
    return <p className="text-xs text-muted-foreground">{board.message ?? "Nessuna partita in corso."}</p>;
  }
  const blue = board.players.filter((player) => player.team === "ORDER");
  const red = board.players.filter((player) => player.team !== "ORDER");
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="space-y-3">
        {board.message ? (
          <p role="alert" className="rounded-xl border border-warning/30 bg-warning/[0.08] px-3 py-2 text-[11px] text-warning">
            {board.message} Rank e partite recenti non sono disponibili finché la chiave non viene aggiornata in
            Impostazioni.
          </p>
        ) : null}
        <Team title="Squadra blu" tone="text-secondary" players={blue} boardMessage={board.message} />
        <Team title="Squadra rossa" tone="text-destructive" players={red} boardMessage={board.message} />
      </div>
      <aside className="rounded-xl border border-white/[0.07] bg-card/95 p-3" aria-label="Build consigliata">
        <p className="eyebrow mb-3">Build · {board.buildChampion ?? "—"}</p>
        <BuildColumn board={board} />
      </aside>
    </div>
  );
}

import {
  Crown,
  FlaskConical,
  Gamepad2,
  Percent,
  Radio,
  ShieldCheck,
  Swords,
  Trophy,
} from "lucide-react";
import {
  AVAILABLE_MODULE_COUNT,
  getModuleById,
  MODULES,
  type AppModule,
} from "@/app/navigation";
import { ErrorState } from "@/components/feedback/error-state";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { DataSourceBadge } from "@/components/shared/data-source-badge";
import { formatDateTime } from "@/lib/utils";
import { DemoModeToggle } from "@/components/shared/demo-mode-toggle";
import { ModuleCard } from "@/components/shared/module-card";
import { SectionHeader } from "@/components/shared/section-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/features/dashboard/components/activity-feed";
import {
  ChampionPerformancePanel,
  PatchUpdatesPanel,
  PerformancePanel,
  PersonalStatsPanel,
  RecentMatchesPanel,
  TopChampionsPanel,
} from "@/features/dashboard/components/dashboard-panels";
import { RoadmapCard } from "@/features/dashboard/components/roadmap-card";
import { SystemStatusCard } from "@/features/dashboard/components/system-status-card";
import { WelcomePanel } from "@/features/dashboard/components/welcome-panel";
import { useDashboardData } from "@/features/dashboard/hooks/use-dashboard-data";
import { useCatalogStatus } from "@/hooks/use-catalog";
import { useSystemSnapshot } from "@/hooks/use-system-snapshot";
import { getErrorMessage } from "@/lib/errors";
import {
  formatKda,
  formatOneDecimal,
  formatPercent,
  formatRank,
  summarizeMatches,
} from "@/lib/match-stats";
import { useUiStore } from "@/stores/ui-store";

const featuredModuleIds = [
  "champions",
  "runes",
  "builds",
  "jungle",
  "matches",
  "live",
] as const;

const featuredModules = featuredModuleIds
  .map((id) => getModuleById(id))
  .filter((module): module is AppModule => Boolean(module));

export function DashboardPage() {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useSystemSnapshot();
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);
  // Real Riot data of the primary profile when available, otherwise the
  // labelled DEMO set (if enabled), otherwise null. Never mixed.
  const board = useDashboardData();
  const { data: catalogStatus } = useCatalogStatus();
  const boardSummary = board ? summarizeMatches(board.matches) : null;
  const isDemo = board?.source === "demo";
  const isReal = board?.source === "riot";
  const sourceBadge = board ? <DataSourceBadge source={board.source} name={board.sourceName} /> : undefined;
  const realSource = board?.sourceName ?? "Riot API";

  const matchesCount = data
    ? (data.database.tableCounts.matches ?? 0)
    : undefined;
  const isBrowserPreview = data?.runtime === "browser";
  const riotConfigured = data?.riot.state === "configured";
  const lockedTrend = { label: "Riot API", tone: "locked" } as const;

  return (
    <div className="space-y-9">
      <WelcomePanel />

      {isError ? (
        <ErrorState
          message={getErrorMessage(error)}
          onRetry={() => void refetch()}
        />
      ) : null}

      <section aria-labelledby="competitive-stats-title">
        <SectionHeader
          titleId="competitive-stats-title"
          title="Statistiche competitive"
          description={
            isReal
              ? `Valori reali del tuo profilo principale, calcolati dalle partite lette da: ${realSource}.`
              : isDemo
                ? "Valori DEMO calcolati da un set di partite dimostrative. Lo stato Riot API resta quello reale."
                : "Win Rate, KDA, Rank e LP restano vuoti finché non salvi un profilo da Player Profiles. Partite e stato API sono dati reali."
          }
          action={<DemoModeToggle disabled={isReal} />}
        />

        {isReal && board ? (
          <div
            role="status"
            className="mb-4 flex items-start gap-3 rounded-xl border border-secondary/25 bg-secondary/[0.05] px-4 py-3"
          >
            <Radio className="mt-0.5 size-4 shrink-0 text-secondary" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">{board.sourceLabel}.</span>{" "}
              Dati aggiornati il {formatDateTime(board.retrievedAt)}; aggiornali
              dalla pagina del profilo. I remake sono esclusi dalle statistiche.
            </p>
          </div>
        ) : null}

        {isDemo ? (
          <div
            role="status"
            className="mb-4 flex items-start gap-3 rounded-xl border border-dashed border-warning/35 bg-warning/[0.05] px-4 py-3 motion-safe:animate-fade-in"
          >
            <FlaskConical className="mt-0.5 size-4 shrink-0 text-warning" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">
                Modalità DEMO attiva.
              </span>{" "}
              Ogni valore con l'etichetta{" "}
              <span className="font-mono text-warning">DEMO</span> è
              dimostrativo: non sono le tue partite, non viene salvato e
              scompare al riavvio. Statistiche locali, diagnostica e stato Riot
              API restano reali.
            </p>
          </div>
        ) : null}

        <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <StatCard
            label="Win Rate"
            value={boardSummary ? formatPercent(boardSummary.winRate) : "—"}
            muted={!boardSummary}
            hint={
              boardSummary
                ? `${boardSummary.wins} vittorie e ${boardSummary.losses} sconfitte ${isDemo ? "nel set DEMO" : "nelle partite recenti"}.`
                : "Richiede partite reali: salva il tuo profilo in Player Profiles. Nessuna percentuale inventata."
            }
            icon={Percent}
            tone="primary"
            trend={boardSummary ? undefined : lockedTrend}
            badge={boardSummary ? sourceBadge : undefined}
          />
          <StatCard
            label="KDA"
            value={boardSummary ? formatKda(boardSummary.kda) : "—"}
            muted={!boardSummary}
            hint={
              boardSummary
                ? `Media ${formatOneDecimal(boardSummary.avgKills)} / ${formatOneDecimal(boardSummary.avgDeaths)} / ${formatOneDecimal(boardSummary.avgAssists)} per partita.`
                : "Calcolato solo su match reali. Il client non simula kill, death o assist."
            }
            icon={Swords}
            tone="neutral"
            trend={boardSummary ? undefined : lockedTrend}
            badge={boardSummary ? sourceBadge : undefined}
          />
          <StatCard
            label="Rank"
            value={board?.rank ? formatRank(board.rank) : isReal ? "Non classificato" : "—"}
            muted={!board?.rank}
            valueClassName={!board?.rank && isReal ? "text-xl" : undefined}
            hint={
              board?.rank
                ? `${board.rank.queue}.`
                : isReal
                  ? `Nessun piazzamento Solo/Duo restituito da ${realSource}.`
                  : "Il rank richiede un account Riot collegato e una fonte verificata."
            }
            icon={Crown}
            tone="secondary"
            trend={board ? undefined : lockedTrend}
            badge={board?.rank ? sourceBadge : undefined}
          />
          <StatCard
            label="LP"
            value={board?.rank ? `${board.rank.leaguePoints} LP` : "—"}
            muted={!board?.rank}
            hint={
              board?.rank
                ? isDemo
                  ? "League Points della coda classificata del set DEMO."
                  : `League Points Solo/Duo da ${realSource}.`
                : "League Points richiedono un account Riot collegato e una fonte rank verificata."
            }
            icon={Trophy}
            tone="warning"
            trend={board ? undefined : lockedTrend}
            badge={board?.rank ? sourceBadge : undefined}
          />
          <StatCard
            label="Partite"
            value={
              boardSummary ? (
                boardSummary.games
              ) : matchesCount === undefined ? (
                "—"
              ) : (
                <AnimatedNumber value={matchesCount} />
              )
            }
            muted={!boardSummary && matchesCount === undefined}
            hint={
              boardSummary
                ? isDemo
                  ? `Partite nel set DEMO. Il database locale ne contiene ${matchesCount ?? 0} reali.`
                  : "Partite recenti del profilo principale (remake esclusi)."
                : matchesCount === 0
                  ? "0 partite nel database locale. Il dato è reale e non sincronizzato."
                  : matchesCount === undefined
                    ? "In attesa della diagnostica del database locale."
                    : "Record reali presenti nel database SQLite locale."
            }
            icon={Gamepad2}
            tone="secondary"
            trend={boardSummary ? undefined : { label: "Locale", tone: "flat" }}
            badge={boardSummary ? sourceBadge : undefined}
          />
          <StatCard
            label="Riot API"
            value={
              isLoading ? "…" : riotConfigured ? "Collegata" : "Non collegata"
            }
            muted={!riotConfigured}
            hint={
              data?.riot.message ??
              "Stato dell'integrazione Riot non ancora disponibile."
            }
            icon={Radio}
            tone={riotConfigured ? "success" : "warning"}
            trend={{ label: "Reale", tone: "flat" }}
            valueClassName="text-xl"
          />
        </div>
      </section>

      <section>
        <SectionHeader
          title="Performance e storico"
          description={
            isReal
              ? `Grafico, ultime partite e campioni del profilo principale, da ${realSource}.`
              : isDemo
                ? "Grafico, ultime partite e campioni del set DEMO. Ogni pannello è etichettato."
                : "Grafico, ultime partite e campioni più utilizzati. Ogni pannello dichiara la fonte necessaria e non mostra serie dimostrative."
          }
        />
        <div className="stagger grid gap-5 lg:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr]">
          <PerformancePanel data={board} />
          <RecentMatchesPanel
            data={board}
            localMatchCount={matchesCount}
            isLoading={isLoading}
          />
          <TopChampionsPanel data={board} />
        </div>
      </section>

      <section>
        <SectionHeader
          title="Analisi e aggiornamenti"
          description="Champion performance, statistiche locali reali e ultima patch."
        />
        <div className="stagger grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <ChampionPerformancePanel data={board} />
          <PersonalStatsPanel snapshot={data} data={board} />
          <PatchUpdatesPanel
            data={board}
            realPatch={catalogStatus?.current ?? null}
          />
        </div>
      </section>

      <section>
        <SectionHeader
          title="Piattaforma"
          description="Diagnostica reale, moduli disponibili, attività locale e prossime tappe. Nessun dato di gioco viene simulato."
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCommandOpen(true)}
            >
              Cerca
              <span className="ml-1 font-mono text-[9px] text-muted-foreground/60">
                CTRL K
              </span>
            </Button>
          }
        />

        <div className="stagger grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,1fr)]">
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {featuredModules.map((module) => (
                <ModuleCard key={module.id} module={module} />
              ))}
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-secondary/15 bg-secondary/[0.04] p-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-secondary/20 bg-secondary/[0.08] text-secondary">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Privacy e conformità by design
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Nessuna API key nel frontend o nel repository, nessun accesso
                  alla memoria del gioco, nessuna modifica ai file del client.
                  L&apos;integrazione Riot sarà solo backend e policy-compliant.
                </p>
                <p className="mt-2 font-mono text-[9px] tracking-[0.14em] text-muted-foreground/50 uppercase">
                  {AVAILABLE_MODULE_COUNT} / {MODULES.length} moduli attivi ·
                  storage locale
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <SystemStatusCard
              snapshot={data}
              isLoading={isLoading}
              error={error}
              onRetry={() => void refetch()}
              isFetching={isFetching}
            />
            <ActivityFeed
              entries={data?.activity ?? []}
              isLoading={isLoading}
              isBrowserPreview={isBrowserPreview}
              error={error}
              onRetry={() => void refetch()}
            />
            <RoadmapCard />
          </div>
        </div>
      </section>
    </div>
  );
}

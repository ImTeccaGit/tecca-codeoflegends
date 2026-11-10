import {
  Activity,
  ArrowRight,
  CloudOff,
  Database,
  Gamepad2,
  HardDrive,
  LineChart,
  LockKeyhole,
  MonitorSmartphone,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  Timer,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { lazy, Suspense, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/feedback/empty-state";
import { ChampionAvatar } from "@/components/shared/champion-avatar";
import { DataSourceBadge } from "@/components/shared/data-source-badge";
import { DemoBadge } from "@/components/shared/demo-badge";
import { Panel } from "@/components/shared/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PERFORMANCE_METRIC_ORDER,
  PERFORMANCE_METRICS,
  type PerformanceMetric,
} from "@/features/dashboard/components/performance-metrics";
import { MatchSummaryRow } from "@/features/matches/components/match-summary-row";
import {
  championUsage,
  formatDuration,
  formatKda,
  formatOneDecimal,
  formatPercent,
  formatRelativeTime,
  performanceSeries,
  summarizeMatches,
} from "@/lib/match-stats";
import { cn, formatBytes, formatDateTime } from "@/lib/utils";
import type { PatchSummary as CatalogPatch } from "@/types/catalog";
import type { DashboardData } from "@/types/dashboard";
import { RIOT_REGIONS, type SystemSnapshot } from "@/types/system";

const PerformanceChart = lazy(
  () => import("@/features/dashboard/components/performance-chart"),
);

/** Matches shown in the "Ultime partite" panel. */
const RECENT_MATCH_LIMIT = 5;
/** Champions shown in the "Campioni recenti" panel. */
const TOP_CHAMPION_LIMIT = 4;
/** KDA that fills the whole bar in the champion performance panel. */
const KDA_BAR_CEILING = 6;

function LockedBadge({ label }: { label: string }) {
  return (
    <Badge variant="outline" className="shrink-0">
      <LockKeyhole className="size-2.5" />
      {label}
    </Badge>
  );
}

function SourceBadge({ data, locked }: { data: DashboardData | null; locked: string }) {
  return data ? <DataSourceBadge source={data.source} name={data.sourceName} /> : <LockedBadge label={locked} />;
}

/* -------------------------------------------------------------------------- */
/* Performance                                                                */
/* -------------------------------------------------------------------------- */

interface DataPanelProps {
  data: DashboardData | null;
}

export function PerformancePanel({ data }: DataPanelProps) {
  const [metric, setMetric] = useState<PerformanceMetric>("kda");
  const series = data ? performanceSeries(data.matches) : [];
  const summary = data ? summarizeMatches(data.matches) : null;
  const hasSeries = series.length > 1;

  return (
    <Panel
      eyebrow="Andamento"
      title="Performance"
      action={<SourceBadge data={data} locked="Riot API" />}
    >
      <div
        role="group"
        aria-label="Metrica del grafico"
        className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.015] p-0.5"
      >
        {PERFORMANCE_METRIC_ORDER.map((key) => {
          const selected = metric === key && hasSeries;
          return (
            <button
              key={key}
              type="button"
              disabled={!hasSeries}
              aria-pressed={selected}
              onClick={() => setMetric(key)}
              title={
                hasSeries
                  ? PERFORMANCE_METRICS[key].description
                  : "Richiede una serie di partite reale o la modalità DEMO"
              }
              className={cn(
                "flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors duration-200",
                selected
                  ? "bg-primary/[0.16] text-foreground"
                  : "text-muted-foreground hover:text-foreground disabled:text-muted-foreground/50 disabled:hover:text-muted-foreground/50",
              )}
            >
              {PERFORMANCE_METRICS[key].label}
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "relative mt-3 h-52 overflow-hidden rounded-xl border border-white/[0.05] bg-background/30",
          !hasSeries && "chart-grid",
        )}
      >
        {hasSeries ? (
          <Suspense fallback={<Skeleton className="size-full rounded-none" />}>
            <PerformanceChart series={series} metric={metric} />
          </Suspense>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
            <span className="flex size-10 items-center justify-center rounded-xl border border-white/[0.07] bg-surface-raised text-muted-foreground">
              <LineChart className="size-5" />
            </span>
            <p className="mt-2 text-xs font-semibold text-foreground">
              Nessuna serie disponibile
            </p>
            <p className="mt-1 max-w-[240px] text-[10px] leading-relaxed text-muted-foreground">
              Win Rate e KDA per partita richiedono una sincronizzazione Riot
              reale. Attiva la modalità DEMO per un'anteprima etichettata.
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MetricTile
          label="Win Rate"
          value={formatPercent(summary?.winRate ?? null)}
          muted={!summary}
        />
        <MetricTile
          label="KDA"
          value={formatKda(summary?.kda ?? null)}
          muted={!summary}
        />
      </div>
    </Panel>
  );
}

function MetricTile({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-display text-lg font-semibold tabular-nums",
          muted ? "text-muted-foreground/70" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Recent matches                                                             */
/* -------------------------------------------------------------------------- */

interface RecentMatchesPanelProps extends DataPanelProps {
  /** Real count from the local SQLite database. */
  localMatchCount: number | undefined;
  isLoading: boolean;
}

export function RecentMatchesPanel({
  data,
  localMatchCount,
  isLoading,
}: RecentMatchesPanelProps) {
  if (data) {
    const recent = data.matches.slice(0, RECENT_MATCH_LIMIT);
    // Relative dates are computed against the dataset time, not render time.
    const now = new Date(data.retrievedAt);

    return (
      <Panel
        eyebrow="Storico"
        title="Ultime partite"
        action={<DataSourceBadge source={data.source} name={data.sourceName} detail={String(data.matches.length)} />}
      >
        {recent.length === 0 ? (
          <EmptyState
            icon={Swords}
            title="Nessuna partita"
            description="Il set di dati non contiene partite."
            className="flex-1 border-0 bg-transparent px-2 py-6"
          />
        ) : (
          <ul
            className="flex flex-1 flex-col gap-1.5"
            aria-label={data.source === "demo" ? "Ultime partite DEMO" : "Ultime partite"}
          >
            {recent.map((match) => (
              <MatchSummaryRow key={match.matchId} match={match} now={now} />
            ))}
          </ul>
        )}
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mt-3 self-start text-muted-foreground"
        >
          <Link to="/matches">
            Cronologia partite
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </Panel>
    );
  }

  return (
    <Panel
      eyebrow="Storico"
      title="Ultime partite"
      action={
        <Badge
          variant={localMatchCount ? "secondary" : "outline"}
          className="shrink-0"
        >
          {isLoading ? "…" : `${localMatchCount ?? 0} locali`}
        </Badge>
      }
    >
      {localMatchCount === undefined || isLoading ? (
        <div className="flex flex-1 flex-col gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : localMatchCount === 0 ? (
        <EmptyState
          icon={Swords}
          title="Nessuna partita sincronizzata"
          description="Il database locale contiene 0 partite. La cronologia richiede l'integrazione Riot match-v5."
          className="flex-1 border-0 bg-transparent px-2 py-6"
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/settings">Stato integrazione Riot</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <span className="flex size-10 items-center justify-center rounded-xl border border-secondary/20 bg-secondary/[0.07] text-secondary">
            <Database className="size-5" />
          </span>
          <p className="text-xs font-semibold text-foreground">
            {localMatchCount} partite archiviate
          </p>
          <p className="max-w-[240px] text-[10px] leading-relaxed text-muted-foreground">
            I dettagli partita saranno visibili quando la sincronizzazione Riot
            sarà collegata.
          </p>
        </div>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Recently played champions                                                  */
/* -------------------------------------------------------------------------- */

export function TopChampionsPanel({ data }: DataPanelProps) {
  const champions = data
    ? championUsage(data.matches).slice(0, TOP_CHAMPION_LIMIT)
    : [];

  return (
    <Panel
      eyebrow="Pool personale"
      title="Campioni recenti"
      action={<SourceBadge data={data} locked="Data Dragon" />}
    >
      {champions.length === 0 ? (
        <>
          <EmptyState
            icon={Shield}
            title="Nessun campione disponibile"
            description="L'elenco campioni arriverà da Data Dragon. Le statistiche personali richiedono Riot API."
            className="flex-1 border-0 bg-transparent px-2 py-6"
          />
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2 text-[10px] text-muted-foreground">
            <Sparkles className="size-3 shrink-0 text-primary" />
            Le immagini reali verranno mostrate solo con fonte e patch
            dichiarate.
          </div>
        </>
      ) : (
        <ul className="flex flex-1 flex-col gap-1.5" aria-label="Campioni più giocati">
          {champions.map((champion) => (
            <li
              key={champion.championName}
              className="flex items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2 transition-colors duration-200 hover:border-white/[0.1] hover:bg-white/[0.035]"
            >
              <ChampionAvatar name={champion.championName} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {champion.championName}
                  </p>
                  <p className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
                    {champion.games} partite
                  </p>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <RatioBar ratio={champion.winRate} />
                  <span className="w-10 shrink-0 text-right font-mono text-[10px] text-foreground tabular-nums">
                    {formatPercent(champion.winRate)}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[9px] text-muted-foreground tabular-nums">
                  {formatKda(champion.kda)} KDA
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function RatioBar({ ratio, label }: { ratio: number | null; label?: string }) {
  const percent = ratio === null ? 0 : Math.max(0, Math.min(ratio, 1)) * 100;

  return (
    <div
      className="h-1.5 flex-1 overflow-hidden rounded-full border border-white/[0.04] bg-white/[0.025]"
      role={label ? "meter" : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? Math.round(percent) : undefined}
    >
      <span
        className="block h-full rounded-full bg-primary/70 transition-[width] duration-500 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Champion performance                                                       */
/* -------------------------------------------------------------------------- */

function PerformanceRow({
  label,
  value,
  ratio,
}: {
  label: string;
  value: string;
  ratio: number | null;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="truncate text-muted-foreground">{label}</span>
        <span
          className={cn(
            "font-mono text-[10px] tabular-nums",
            ratio === null ? "text-muted-foreground/60" : "text-foreground",
          )}
        >
          {value}
        </span>
      </div>
      <RatioBar ratio={ratio} label={ratio === null ? undefined : label} />
    </div>
  );
}

export function ChampionPerformancePanel({ data }: DataPanelProps) {
  const summary = data ? summarizeMatches(data.matches) : null;
  const main = data ? (championUsage(data.matches)[0] ?? null) : null;

  return (
    <Panel
      eyebrow="Meta personale"
      title="Champion Performance"
      action={<SourceBadge data={data} locked="Fonte assente" />}
    >
      <div className="space-y-4">
        <PerformanceRow
          label="Win Rate complessivo"
          value={formatPercent(summary?.winRate ?? null)}
          ratio={summary?.winRate ?? null}
        />
        <PerformanceRow
          label={main ? `Pick rate · ${main.championName}` : "Pick Rate"}
          value={formatPercent(main?.pickShare ?? null)}
          ratio={main?.pickShare ?? null}
        />
        <PerformanceRow
          label="KDA medio"
          value={formatKda(summary?.kda ?? null)}
          ratio={
            summary?.kda == null
              ? null
              : Math.min(summary.kda / KDA_BAR_CEILING, 1)
          }
        />
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
        <TrendingUp className="mt-0.5 size-3 shrink-0 text-secondary" />
        {summary
          ? `Calcolato su ${summary.games} partite ${data?.source === "riot" ? "reali salvate in locale" : "del set DEMO"}. Barra KDA piena a ${KDA_BAR_CEILING}.`
          : "Le percentuali saranno calcolate solo su partite reali, con numerosità dichiarata."}
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Personal stats                                                             */
/* -------------------------------------------------------------------------- */

interface PersonalStatsPanelProps extends DataPanelProps {
  snapshot: SystemSnapshot | undefined;
}

function StatRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.04] py-2 last:border-0 last:pb-0">
      <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span className="truncate font-mono text-[10px] text-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}

export function PersonalStatsPanel({ snapshot, data }: PersonalStatsPanelProps) {
  const dbReady = snapshot?.database.state === "ready";
  const regionLabel =
    RIOT_REGIONS.find((region) => region.value === snapshot?.settings.region)
      ?.label ?? "—";
  const summary = data ? summarizeMatches(data.matches) : null;

  return (
    <Panel
      eyebrow="Dati locali reali"
      title="Statistiche personali"
      action={
        <Badge variant={dbReady ? "success" : "outline"} className="shrink-0">
          {dbReady ? "Reali" : "Offline"}
        </Badge>
      }
    >
      <div>
        <StatRow
          icon={Activity}
          label="Eventi locali"
          value={String(snapshot?.activity.length ?? 0)}
        />
        <StatRow
          icon={Gamepad2}
          label="Partite archiviate"
          value={String(snapshot?.database.tableCounts.matches ?? 0)}
        />
        <StatRow
          icon={HardDrive}
          label="Storage SQLite"
          value={dbReady ? formatBytes(snapshot.database.sizeBytes) : "—"}
        />
        <StatRow
          icon={Database}
          label="Schema"
          value={dbReady ? `v${snapshot.database.schemaVersion}` : "—"}
        />
        <StatRow icon={Trophy} label="Regione" value={regionLabel} />
        <StatRow
          icon={MonitorSmartphone}
          label="Runtime"
          value={snapshot?.runtime === "tauri" ? "Desktop" : "Browser"}
        />
      </div>

      {summary && data ? (
        <div
          className={cn(
            "mt-4 rounded-xl border p-3",
            data.source === "demo"
              ? "border-dashed border-warning/30 bg-warning/[0.03]"
              : "border-secondary/20 bg-secondary/[0.03]",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="eyebrow">Medie per partita</p>
            <DataSourceBadge source={data.source} name={data.sourceName} />
          </div>
          <div className="mt-1">
            <StatRow
              icon={Swords}
              label="K / D / A"
              value={`${formatOneDecimal(summary.avgKills)} / ${formatOneDecimal(summary.avgDeaths)} / ${formatOneDecimal(summary.avgAssists)}`}
            />
            <StatRow
              icon={TrendingUp}
              label="CS al minuto"
              value={formatOneDecimal(summary.csPerMinute)}
            />
            <StatRow
              icon={Timer}
              label="Durata media"
              value={
                summary.avgDurationSeconds === null
                  ? "—"
                  : formatDuration(summary.avgDurationSeconds)
              }
            />
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground/60">
        Metriche derivate dal database locale. Nessuna telemetria remota.
        {data?.source === "demo" ? " Le medie nel riquadro DEMO non sono dati tuoi." : ""}
        {data?.source === "riot" ? ` Le medie vengono dalle tue partite reali (${data.sourceName ?? "Riot API"}).` : ""}
      </p>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Patch                                                                      */
/* -------------------------------------------------------------------------- */

interface PatchUpdatesPanelProps extends DataPanelProps {
  /** Newest Data Dragon patch actually imported: real data wins over DEMO. */
  realPatch: CatalogPatch | null;
}

export function PatchUpdatesPanel({ data, realPatch }: PatchUpdatesPanelProps) {
  const patch = data?.patch ?? null;

  if (realPatch) {
    return (
      <Panel
        eyebrow="Aggiornamenti"
        title="Ultima patch"
        action={
          <Badge variant="success" className="shrink-0">
            Reale
          </Badge>
        }
      >
        <div className="rounded-xl border border-white/[0.06] bg-background/30 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Patch corrente</p>
              <p className="mt-1 font-display text-3xl font-semibold text-foreground">
                {realPatch.patch}
              </p>
            </div>
            <Database className="size-5 text-secondary" />
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            {realPatch.source} {realPatch.version} ({realPatch.language}),
            importata il{" "}
            <time dateTime={realPatch.importedAt}>
              {formatDateTime(realPatch.importedAt)}
            </time>
            .
          </p>
        </div>

        <ul className="mt-3 space-y-2 text-[10px] text-muted-foreground">
          {[
            ["Campioni", realPatch.championCount],
            ["Abilità", realPatch.spellCount],
            ["Skin (voci)", realPatch.skinCount],
            ["Oggetti", realPatch.itemCount],
            ["Rune", realPatch.runeCount],
          ].map(([label, value]) => (
            <li
              key={label}
              className="flex items-center justify-between gap-2 border-b border-white/[0.04] pb-2 last:border-0 last:pb-0"
            >
              <span>{label}</span>
              <span className="font-mono text-foreground tabular-nums">
                {value}
              </span>
            </li>
          ))}
        </ul>

        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mt-3 self-start text-muted-foreground"
        >
          <Link to="/champions">
            Apri Champions
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </Panel>
    );
  }

  if (data && patch) {
    const now = new Date(data.retrievedAt);
    return (
      <Panel eyebrow="Aggiornamenti" title="Ultima patch" action={<DemoBadge />}>
        <div className="rounded-xl border border-white/[0.06] bg-background/30 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Versione</p>
              <p className="mt-1 font-display text-3xl font-semibold text-foreground">
                {patch.version}
              </p>
            </div>
            <ScrollText className="size-5 text-warning/80" />
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            Pubblicata{" "}
            <time dateTime={patch.publishedAt}>
              {formatRelativeTime(patch.publishedAt, now)}
            </time>
            . Contenuto d'esempio: le note reali arriveranno da una fonte
            ufficiale con versione e data.
          </p>
        </div>

        <ul className="mt-3 space-y-2">
          {patch.highlights.map((highlight) => (
            <li
              key={highlight.title}
              className="rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2 transition-colors duration-200 hover:border-white/[0.1]"
            >
              <p className="text-[11px] font-semibold text-foreground">
                {highlight.title}
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                {highlight.detail}
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-3 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span>Fonte</span>
          <span className="font-mono text-warning">{data.sourceLabel}</span>
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      eyebrow="Aggiornamenti"
      title="Patch & fonti"
      action={
        <Badge variant="warning" className="shrink-0">
          Non collegata
        </Badge>
      }
    >
      <div className="rounded-xl border border-white/[0.06] bg-background/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Patch corrente</p>
            <p className="mt-1 font-display text-3xl font-semibold text-muted-foreground/70">
              —
            </p>
          </div>
          <CloudOff className="size-5 text-muted-foreground/50" />
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          Nessuna versione Data Dragon sincronizzata. Il numero di patch non
          viene inventato.
        </p>
      </div>

      <ul className="mt-3 space-y-2 text-[10px] text-muted-foreground">
        <li className="flex items-center justify-between gap-2 border-b border-white/[0.04] pb-2">
          <span>Fonte prevista</span>
          <span className="font-mono text-foreground/80">Data Dragon</span>
        </li>
        <li className="flex items-center justify-between gap-2 border-b border-white/[0.04] pb-2">
          <span>Timestamp recupero</span>
          <span className="font-mono text-muted-foreground/60">—</span>
        </li>
        <li className="flex items-center justify-between gap-2">
          <span>Cache locale</span>
          <span className="font-mono text-muted-foreground/60">non presente</span>
        </li>
      </ul>
    </Panel>
  );
}

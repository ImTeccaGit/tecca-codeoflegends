import {
  Coins,
  Crosshair,
  Eye,
  Flame,
  Percent,
  Shield,
  Swords,
  Wheat,
} from "lucide-react";
import { lazy, Suspense, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/feedback/empty-state";
import { DataProvenance } from "@/components/shared/data-provenance";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalysisFiltersBar } from "@/features/analysis/components/analysis-filters";
import { GroupTable } from "@/features/analysis/components/group-table";
import { MatchDetail } from "@/features/analysis/components/match-detail";
import { MatchTable } from "@/features/analysis/components/match-table";
import { PlayerScope } from "@/features/analysis/components/player-scope";
import {
  applyFilters,
  byChampion,
  byRole,
  filterOptions,
  provenance,
  summarize,
  timeSeries,
  weeklyResults,
} from "@/features/analysis/lib/analysis";
import { filtersFromParams, filtersToParams } from "@/features/analysis/lib/url-filters";
import {
  averageDetail,
  formatDecimal,
  formatInteger,
  formatWinRate,
  winRateDetail,
} from "@/features/analysis/lib/format";
import { formatKda, formatPercent } from "@/lib/match-stats";
import type { AnalysisDataset } from "@/types/analysis";

const AnalysisCharts = lazy(() => import("@/features/analysis/components/analysis-charts"));

function Section({
  eyebrow,
  title,
  aside,
  children,
}: {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-1 font-display text-sm font-semibold">{title}</h2>
        </div>
        {aside}
      </div>
      {children}
    </Card>
  );
}

function AnalysisView({ dataset }: { dataset: AnalysisDataset }) {
  const [params, setParams] = useSearchParams();
  const [now] = useState(() => new Date());
  const filters = filtersFromParams(params);
  const options = filterOptions(dataset.matches);
  const matches = applyFilters(dataset.matches, filters, now);
  const summary = summarize(matches);
  const info = provenance(dataset.source, matches);
  const selectedId = params.get("match");
  const selected = matches.find((match) => match.matchId === selectedId) ?? matches[0] ?? null;

  const update = (next: Parameters<typeof filtersToParams>[1], match?: string | null) => {
    const search = filtersToParams(params, next);
    if (match !== undefined) {
      if (match) search.set("match", match);
      else search.delete("match");
    }
    setParams(search, { replace: true });
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <AnalysisFiltersBar
          filters={filters}
          options={options}
          ranked={dataset.ranked}
          onChange={(next) => update({ ...filters, ...next }, null)}
        />
      </Card>

      <DataProvenance
        {...info}
        note={`Profilo ${dataset.gameName}#${dataset.tagLine}. Intervalli di confidenza al 95% (Wilson); sotto 5 partite i win rate sono segnati come poco affidabili.${
          dataset.matchesSyncedAt ? ` Ultima sincronizzazione partite: ${new Date(dataset.matchesSyncedAt).toLocaleString("it-IT")}.` : ""
        }`}
      />

      {matches.length === 0 ? (
        <EmptyState
          icon={Swords}
          title="Nessuna partita con questi filtri"
          description="Allarga il periodo o rimuovi qualche filtro: le statistiche vengono calcolate solo su partite reali salvate."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Win rate"
              value={formatWinRate(summary)}
              hint={winRateDetail(summary)}
              icon={Percent}
              tone="primary"
              badge={summary.sufficient ? undefined : <Badge variant="warning">Pochi dati</Badge>}
            />
            <StatCard
              label="KDA"
              value={formatKda(summary.kda)}
              hint={`${formatDecimal(summary.avgKills)} / ${formatDecimal(summary.avgDeaths)} / ${formatDecimal(summary.avgAssists)} medi`}
              icon={Swords}
              tone="secondary"
            />
            <StatCard
              label="CS/min"
              value={formatDecimal(summary.csPerMinute)}
              hint="CS totali / minuti giocati"
              icon={Wheat}
            />
            <StatCard
              label="Oro/min"
              value={formatInteger(summary.goldPerMinute)}
              hint={`${formatInteger(summary.avgGold)} oro medio a partita`}
              icon={Coins}
            />
            <StatCard
              label="Kill participation"
              value={formatPercent(summary.killParticipation.value)}
              hint={averageDetail(summary.killParticipation, summary.games)}
              icon={Crosshair}
            />
            <StatCard
              label="Visione"
              value={formatDecimal(summary.avgVision)}
              hint="Punteggio visione medio"
              icon={Eye}
            />
            <StatCard
              label="Danni inflitti"
              value={formatInteger(summary.damageDealt.value)}
              hint={averageDetail(summary.damageDealt, summary.games)}
              icon={Flame}
            />
            <StatCard
              label="Danni subiti"
              value={formatInteger(summary.damageTaken.value)}
              hint={averageDetail(summary.damageTaken, summary.games)}
              icon={Shield}
            />
          </div>

          <Section eyebrow="Grafici" title="Andamento nel tempo">
            {matches.length < 2 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Servono almeno 2 partite per tracciare un andamento.
              </p>
            ) : (
              <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}>
                <AnalysisCharts
                  series={timeSeries(matches)}
                  weekly={weeklyResults(matches)}
                  champions={byChampion(matches)}
                  roles={byRole(matches)}
                />
              </Suspense>
            )}
          </Section>

          <div className="grid gap-5 xl:grid-cols-2">
            <Section eyebrow="Tabella" title="Performance per campione">
              <GroupTable
                caption="Statistiche per campione"
                firstColumn="Campione"
                groups={byChampion(matches)}
                shareLabel="Uso"
                showImages
                empty="Nessun campione."
              />
            </Section>
            <Section eyebrow="Tabella" title="Performance per ruolo">
              <GroupTable
                caption="Statistiche per ruolo"
                firstColumn="Ruolo"
                groups={byRole(matches)}
                shareLabel="Uso"
                empty="Nessuna partita con un ruolo assegnato da Riot."
              />
            </Section>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <Section eyebrow="Partite" title={`Partite analizzate (${matches.length})`}>
              <MatchTable
                matches={matches}
                selectedId={selected?.matchId ?? null}
                onSelect={(matchId) => update(filters, matchId)}
              />
            </Section>
            <Section eyebrow="Post-partita" title="Analisi della partita">
              {selected ? <MatchDetail match={selected} /> : null}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

export function MatchAnalysisPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Performance · Fase 06"
        title="Match Analysis"
        description="Analisi post-partita delle tue partite reali salvate: statistiche, andamento nel tempo, campioni e ruoli. Ogni valore indica fonte, patch e numero di partite."
        actions={<Badge variant="outline">Fonte: Riot API match-v5</Badge>}
      />
      <PlayerScope>{(dataset) => <AnalysisView dataset={dataset} />}</PlayerScope>
    </div>
  );
}

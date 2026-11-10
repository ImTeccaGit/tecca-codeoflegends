import { AlertTriangle, BarChart3, Database, Loader2, Play, Settings2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ErrorState } from "@/components/feedback/error-state";
import { StatusDot } from "@/components/shared/status-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BuildPanel,
  MatchupsPanel,
  OverviewPanel,
  RolePanel,
  RunesPanel,
  SkillOrderPanel,
  SpellsPanel,
} from "@/features/champions/components/global/global-panels";
import {
  ROLE_LABELS,
  countFormat,
  formatPercent,
  gamesLabel,
  ratio,
} from "@/features/champions/lib/global-format";
import {
  useChampionGlobalStats,
  useGlobalStatsStatus,
  useUpdateGlobalStatsSettings,
} from "@/hooks/use-global-stats";
import { getErrorMessage } from "@/lib/errors";
import { cn, formatDateTime } from "@/lib/utils";
import { isGlobalStatsAvailable } from "@/services/global-stats-service";
import type { ChampionSpell } from "@/types/catalog";
import {
  ALL_PATCHES,
  ROLES,
  SEED_TIERS,
  globalStatsSettingsSchema,
  type ChampionGlobalStats,
  type GlobalStatsStatus,
  type Role,
} from "@/types/global-stats";

function tierLabel(value: string) {
  if (value === "PERSONAL") return "Le tue partite";
  return SEED_TIERS.find((tier) => tier.value === value)?.label ?? value;
}

function RoleTabs({ stats, onSelect }: { stats: ChampionGlobalStats; onSelect: (role: Role) => void }) {
  // Share among games with a known lane (same basis as the header).
  const withLane = stats.roles.reduce((sum, item) => sum + item.games, 0);
  return (
    <div role="tablist" aria-label="Corsia" className="flex flex-wrap gap-1.5">
      {ROLES.map((role) => {
        const share = stats.roles.find((item) => item.role === role);
        const active = stats.role === role;
        return (
          <button
            key={role}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={!share}
            onClick={() => onSelect(role)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35",
              active
                ? "border-primary/50 bg-primary/15 text-foreground"
                : "border-white/[0.08] bg-white/[0.02] text-muted-foreground hover:border-white/20 hover:text-foreground",
            )}
          >
            {ROLE_LABELS[role]}
            {share ? (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {formatPercent(ratio(share.games, withLane))}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function FilterBar({
  stats,
  onPatch,
  onRole,
}: {
  stats: ChampionGlobalStats;
  onPatch: (patch: string) => void;
  onRole: (role: Role) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-card/70 p-3 lg:flex-row lg:items-center lg:justify-between">
      <RoleTabs stats={stats} onSelect={onRole} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="global-patch">
          Patch
        </label>
        <NativeSelect
          id="global-patch"
          className="w-48"
          value={stats.patch ?? ALL_PATCHES}
          disabled={stats.patches.length === 0}
          onChange={(event) => onPatch(event.target.value)}
        >
          {stats.patches.map((sample) => (
            <option key={sample.patch} value={sample.patch}>
              Patch {sample.patch} ({countFormat.format(sample.matches)})
            </option>
          ))}
          <option value={ALL_PATCHES}>Tutte le patch salvate</option>
        </NativeSelect>
        <span className="text-[11px] text-muted-foreground">
          {stats.personal ? "Le tue partite" : stats.platforms.map((platform) => platform.toUpperCase()).join(", ") || "—"}
          {stats.personal ? "" : ` · ${stats.seedTiers.map(tierLabel).join(", ") || "—"}`} ·{" "}
          {gamesLabel(stats.totalMatches)}
        </span>
      </div>
    </div>
  );
}

/** What is missing for real global numbers, with the one action that fixes it. */
function CollectorBanner({ status, stats }: { status: GlobalStatsStatus | undefined; stats: ChampionGlobalStats }) {
  const update = useUpdateGlobalStatsSettings();
  if (!status) return null;
  const running = status.enabled && status.state !== "error";
  if (running && !stats.personal && stats.totalMatches > 0) return null;

  let title: string;
  let detail: string;
  let action: "enable" | "settings" | null;
  if (!status.keyConfigured) {
    title = "Serve una chiave API Riot";
    detail =
      "Le statistiche globali (rune, build, abilità, counter) si calcolano dalle partite scaricate con la tua chiave. Inseriscila in Impostazioni e attiva la raccolta.";
    action = "settings";
  } else if (status.state === "error") {
    title = "Raccolta ferma";
    detail = status.message ?? "La raccolta si è fermata per un errore.";
    action = "settings";
  } else if (!status.enabled) {
    title = "Raccolta delle statistiche spenta";
    detail = `Attivala per scaricare le partite classificate recenti (${status.platform.toUpperCase()}, ${tierLabel(status.seedTier)}): le prime statistiche compaiono dopo pochi minuti.`;
    action = "enable";
  } else {
    title = "Raccolta in corso";
    detail = `${countFormat.format(status.totalMatches)} partite raccolte finora: questo campione comparirà man mano che arrivano nuove partite.`;
    action = null;
  }

  const enable = () => {
    const parsed = globalStatsSettingsSchema.safeParse({
      enabled: true,
      platform: status.platform,
      seedTier: status.seedTier,
    });
    if (!parsed.success) {
      toast.error("Impostazioni della raccolta non valide.");
      return;
    }
    update.mutate(parsed.data, {
      onSuccess: () => toast.success("Raccolta delle statistiche attivata."),
      onError: (error) => toast.error(getErrorMessage(error)),
    });
  };

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between",
        action === null ? "border-secondary/20 bg-secondary/[0.05]" : "border-warning/25 bg-warning/[0.06]",
      )}
    >
      <div className="flex items-start gap-3">
        {action === null ? (
          <StatusDot tone="success" pulse className="mt-1.5" />
        ) : (
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        )}
        <div>
          <p className="text-xs font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {detail}
            {stats.personal
              ? ` Intanto vedi i dati delle tue ${countFormat.format(stats.totalMatches)} partite salvate.`
              : ""}
          </p>
        </div>
      </div>
      {action === "enable" ? (
        <Button size="sm" onClick={enable} disabled={update.isPending} className="shrink-0">
          {update.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
          Attiva raccolta
        </Button>
      ) : action === "settings" ? (
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link to="/settings#global-stats">
            <Settings2 className="size-3.5" />
            Apri le impostazioni
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="grid gap-5 xl:grid-cols-2" aria-hidden="true">
      <Skeleton className="h-72 rounded-2xl" />
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

/**
 * Champion page in the layout of the stats sites: lanes, overview, skill
 * order, builds, matchups, spells and runes. Always rendered; each panel
 * says when it has no data. Numbers come from the collected matches, or
 * from the user's own saved matches when the collected ones lack the
 * champion (labelled), never estimated.
 */
export function ChampionGlobalSection({
  championId,
  championName,
  spells,
}: {
  championId: number;
  championName: string;
  spells: ChampionSpell[];
}) {
  const [patch, setPatch] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const status = useGlobalStatsStatus();
  const stats = useChampionGlobalStats(championId, { patch, role });

  if (!isGlobalStatsAvailable()) {
    return (
      <p className="rounded-xl border border-white/[0.07] bg-white/[0.015] p-4 text-[11px] text-muted-foreground">
        Le statistiche (rune, build, counter) sono disponibili solo nell&apos;app desktop.
      </p>
    );
  }
  if (stats.isLoading) return <SectionSkeleton />;
  if (stats.isError || !stats.data) {
    return <ErrorState message={getErrorMessage(stats.error)} onRetry={() => void stats.refetch()} />;
  }
  const data = stats.data;
  const scope = `${data.role ?? ""}-${data.patch ?? ALL_PATCHES}`;

  return (
    <div className="space-y-5">
      <CollectorBanner status={status.data} stats={data} />
      <FilterBar stats={data} onPatch={setPatch} onRole={setRole} />

      {data.games === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-white/10 px-4 py-3 text-[11px] text-muted-foreground">
          <BarChart3 className="size-4 shrink-0" />
          {championName} non compare ancora nelle partite disponibili: i riquadri si riempiono appena arrivano
          partite con questo campione.
        </p>
      ) : null}

      <div className="stagger grid gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <OverviewPanel stats={data} />
          <SkillOrderPanel stats={data} spells={spells} />
          <BuildPanel stats={data} />
        </div>
        <div className="space-y-5">
          <MatchupsPanel stats={data} />
          <div className="grid gap-5 sm:grid-cols-2">
            <RolePanel stats={data} />
            <SpellsPanel stats={data} />
          </div>
          <RunesPanel key={scope} stats={data} />
          <div className="flex items-start gap-3 rounded-xl border border-secondary/15 bg-secondary/[0.04] p-4">
            <Database className="mt-0.5 size-4 shrink-0 text-secondary" />
            <div className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
              <p>
                Fonte: {data.source}
                {data.personal ? <Badge variant="outline" className="ml-2">Dati personali</Badge> : null}
                {data.lastFetchedAt && !data.personal ? (
                  <>
                    {" "}
                    · ultima partita il <time dateTime={data.lastFetchedAt}>{formatDateTime(data.lastFetchedAt)}</time>
                  </>
                ) : null}
                .
              </p>
              <p>
                Percentuali calcolate solo su queste partite, remake esclusi; accanto a ogni valore c&apos;è il
                numero di partite. Icone e nomi: Riot Data Dragon.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

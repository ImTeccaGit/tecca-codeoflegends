import {
  ArrowDownAZ,
  ArrowUpAZ,
  Search,
  SearchX,
  Star,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LaneIcon } from "@/components/shared/lane-icon";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CatalogStatusBar } from "@/features/champions/components/catalog-status-bar";
import { ChampionCard } from "@/features/champions/components/champion-card";
import {
  ChampionGridSkeleton,
  DesktopOnlyState,
  EmptyCatalogState,
} from "@/features/champions/components/catalog-states";
import {
  CHAMPION_CLASSES,
  DEFAULT_FILTERS,
  filterChampions,
  isChampionClass,
  type ChampionFilters,
} from "@/features/champions/lib/champion-filters";
import { isLane, laneLabel, LANE_OPTIONS } from "@/features/champions/lib/lanes";
import { playedLanes } from "@/features/champions/lib/global-format";
import { useChampionCatalog } from "@/hooks/use-catalog";
import { useChampionRoles } from "@/hooks/use-global-stats";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { isCatalogAvailable } from "@/services/catalog-service";

/**
 * Filters live in the URL (?q=&lane=&class=&fav=1&sort=desc) so they
 * survive navigation to a champion and back.
 */
function readFilters(params: URLSearchParams): ChampionFilters {
  const classParam = params.get("class") ?? "";
  const laneParam = params.get("lane") ?? "";
  return {
    query: params.get("q") ?? "",
    classFilter: isChampionClass(classParam) ? classParam : "all",
    laneFilter: isLane(laneParam) ? laneParam : "all",
    favoritesOnly: params.get("fav") === "1",
    sort: params.get("sort") === "desc" ? "desc" : "asc",
  };
}

function writeParams(filters: ChampionFilters): URLSearchParams {
  const search = new URLSearchParams();
  if (filters.query) search.set("q", filters.query);
  if (filters.laneFilter !== "all") search.set("lane", filters.laneFilter);
  if (filters.classFilter !== "all") search.set("class", filters.classFilter);
  if (filters.favoritesOnly) search.set("fav", "1");
  if (filters.sort === "desc") search.set("sort", "desc");
  return search;
}

function FilterChip({
  selected,
  onSelect,
  children,
  label,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onSelect}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors duration-200",
        selected
          ? "border-primary/40 bg-primary/[0.14] text-foreground"
          : "border-white/[0.07] bg-white/[0.02] text-muted-foreground hover:border-white/15 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="eyebrow w-14 shrink-0">{label}</span>
      <div role="radiogroup" aria-label={`Filtra per ${label.toLowerCase()}`} className="flex flex-wrap gap-1.5">
        {children}
      </div>
    </div>
  );
}

export function ChampionsPage() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const { data, isLoading, isError, error, refetch } = useChampionCatalog();
  const roles = useChampionRoles();

  // Lanes come from the matches (collected + personal), not from the user.
  const rolesById = new Map((roles.data?.champions ?? []).map((entry) => [entry.championId, entry]));
  const champions = (data?.champions ?? []).map((champion) => ({
    ...champion,
    lanes: playedLanes(rolesById.get(champion.id)),
  }));
  // ~170 entries: filtering on every render is cheaper than memo bookkeeping.
  const results = filterChampions(champions, filters);
  const withLanes = champions.filter((c) => c.lanes.length > 0).length;
  const laneMatches = (roles.data?.globalMatches ?? 0) + (roles.data?.personalMatches ?? 0);
  const favorites = data?.champions.filter((c) => c.favorite).length ?? 0;

  const update = (next: Partial<ChampionFilters>) =>
    setParams(writeParams({ ...filters, ...next }), { replace: true });

  const hasActiveFilters =
    filters.query !== "" ||
    filters.classFilter !== "all" ||
    filters.laneFilter !== "all" ||
    filters.favoritesOnly;

  const emptyDescription =
    filters.laneFilter !== "all" && withLanes === 0
      ? "Le corsie si calcolano dalle partite: non ce ne sono ancora. Attiva la raccolta delle statistiche in Impostazioni."
      : filters.favoritesOnly && favorites === 0
        ? "Non hai ancora preferiti: usa la stella su una card o nella scheda del campione."
        : "Modifica la ricerca o rimuovi i filtri attivi.";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Database · Fase 02"
        title="Champions"
        description="Tutti i campioni della patch corrente con rune, build, abilità e counter. Le corsie sono quelle giocate davvero nelle partite raccolte."
        actions={
          data?.patch ? (
            <Badge variant="secondary">Patch {data.patch.patch}</Badge>
          ) : null
        }
      />

      {!isCatalogAvailable() ? (
        <DesktopOnlyState />
      ) : isLoading ? (
        <ChampionGridSkeleton />
      ) : isError ? (
        <ErrorState
          message={getErrorMessage(error)}
          onRetry={() => void refetch()}
        />
      ) : !data?.patch ? (
        <EmptyCatalogState />
      ) : (
        <>
          <CatalogStatusBar patch={data.patch} />

          <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.012] p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-80">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="search"
                  value={filters.query}
                  onChange={(event) => update({ query: event.target.value })}
                  placeholder="Cerca un campione…"
                  aria-label="Cerca un campione per nome"
                  className="pr-9 pl-9"
                />
                {filters.query ? (
                  <button
                    type="button"
                    onClick={() => update({ query: "" })}
                    aria-label="Cancella ricerca"
                    className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>

              <Button
                variant="outline"
                size="sm"
                aria-pressed={filters.favoritesOnly}
                onClick={() => update({ favoritesOnly: !filters.favoritesOnly })}
                className={cn(
                  filters.favoritesOnly &&
                    "border-warning/40 bg-warning/[0.1] text-warning hover:bg-warning/[0.14]",
                )}
              >
                <Star className={cn("size-3.5", filters.favoritesOnly && "fill-current")} />
                Preferiti
                <span className="font-mono text-[10px] opacity-70">{favorites}</span>
              </Button>



              <Button
                variant="outline"
                size="sm"
                className="sm:ml-auto"
                onClick={() =>
                  update({ sort: filters.sort === "asc" ? "desc" : "asc" })
                }
                aria-label={
                  filters.sort === "asc"
                    ? "Ordine alfabetico A-Z, passa a Z-A"
                    : "Ordine alfabetico Z-A, passa a A-Z"
                }
              >
                {filters.sort === "asc" ? (
                  <ArrowDownAZ className="size-3.5" />
                ) : (
                  <ArrowUpAZ className="size-3.5" />
                )}
                {filters.sort === "asc" ? "A → Z" : "Z → A"}
              </Button>
            </div>

            <FilterRow label="Corsia">
              <FilterChip
                selected={filters.laneFilter === "all"}
                onSelect={() => update({ laneFilter: "all" })}
              >
                Tutte
              </FilterChip>
              {LANE_OPTIONS.map((lane) => (
                <FilterChip
                  key={lane.value}
                  selected={filters.laneFilter === lane.value}
                  onSelect={() => update({ laneFilter: lane.value })}
                >
                  <LaneIcon lane={lane.value} className="size-3.5" />
                  {lane.label}
                </FilterChip>
              ))}
            </FilterRow>

            <FilterRow label="Classe">
              <FilterChip
                selected={filters.classFilter === "all"}
                onSelect={() => update({ classFilter: "all" })}
              >
                Tutte
              </FilterChip>
              {CHAMPION_CLASSES.map((item) => (
                <FilterChip
                  key={item.value}
                  selected={filters.classFilter === item.value}
                  onSelect={() => update({ classFilter: item.value })}
                >
                  {item.label}
                </FilterChip>
              ))}
            </FilterRow>


          </div>

          <p className="text-[11px] text-muted-foreground" aria-live="polite">
            {results.length} di {champions.length} campioni
            {filters.laneFilter !== "all"
              ? ` · corsia ${laneLabel(filters.laneFilter)} giocata in almeno il 15% delle partite (${withLanes} campioni con dati, ${laneMatches} partite)`
              : ""}
            {filters.classFilter !== "all" ? " · classe Data Dragon" : ""}
          </p>

          {results.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Nessun campione corrisponde"
              description={emptyDescription}
              action={
                <div className="flex flex-wrap justify-center gap-2">

                  {hasActiveFilters ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        update({ ...DEFAULT_FILTERS, sort: filters.sort })
                      }
                    >
                      Rimuovi filtri
                    </Button>
                  ) : null}
                </div>
              }
            />
          ) : (
            <ul
              className="grid grid-cols-[repeat(auto-fill,minmax(136px,1fr))] gap-3"
              aria-label="Campioni"
            >
              {results.map((champion) => (
                <li key={champion.id}>
                  <ChampionCard
                    champion={champion}
                    search={params.toString() ? `?${params.toString()}` : ""}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

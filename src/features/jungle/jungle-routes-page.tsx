import { Copy, Pencil, Timer } from "lucide-react";
import { useReducer, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { ErrorState } from "@/components/feedback/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AttemptHistory } from "@/features/jungle/components/attempt-history";
import { JungleChampions } from "@/features/jungle/components/jungle-champions";
import { MonstersInfo } from "@/features/jungle/components/monsters-info";
import { MapLegend, RiftMap } from "@/features/jungle/components/rift-map";
import { RouteEditor, type RouteDraft } from "@/features/jungle/components/route-editor";
import { RoutePanel, RouteSequence } from "@/features/jungle/components/route-panel";
import { TrainingPanel } from "@/features/jungle/components/training-panel";
import { SIDE_LABELS, type CampId, type MapSide } from "@/features/jungle/data/camps";
import {
  CATEGORY_LABELS,
  MODEL_ROUTES,
  type JungleRoute,
} from "@/features/jungle/data/routes";
import { attemptsForRoute, personalBests } from "@/features/jungle/lib/attempt-stats";
import { createTimer, timerReducer } from "@/features/jungle/lib/training-timer";
import { useChampionCatalog } from "@/hooks/use-catalog";
import { useClearAttempts, useCustomRoutes } from "@/hooks/use-jungle";
import { getErrorMessage } from "@/lib/errors";
import { isJungleStorageAvailable } from "@/services/jungle-service";
import type { CustomRoute } from "@/types/jungle";

function toRoute(custom: CustomRoute): JungleRoute {
  return {
    key: custom.id,
    name: custom.name,
    side: custom.side,
    category: "custom",
    camps: custom.camps,
    description: custom.notes ?? "Percorso personalizzato.",
  };
}

function Section({
  eyebrow,
  title,
  children,
  aside,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  aside?: ReactNode;
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

export function JungleRoutesPage() {
  const [params, setParams] = useSearchParams();
  const side: MapSide = params.get("side") === "red" ? "red" : "blue";
  const routeParam = params.get("route");

  const customRoutes = useCustomRoutes();
  const attemptsQuery = useClearAttempts();
  const catalog = useChampionCatalog();
  const attempts = attemptsQuery.data ?? [];

  const [draft, setDraft] = useState<RouteDraft | null>(null);
  const [championId, setChampionId] = useState<number | null>(null);

  const routes: JungleRoute[] = [
    ...MODEL_ROUTES,
    ...(customRoutes.data ?? []).map(toRoute),
  ];
  const selected =
    routes.find((route) => route.key === routeParam && route.side === side) ??
    routes.find((route) => route.side === side) ??
    MODEL_ROUTES[0];

  const [timer, dispatch] = useReducer(
    timerReducer,
    selected?.camps.length ?? 0,
    createTimer,
  );
  const timerActive = timer.status !== "idle";

  if (!selected) {
    return null;
  }

  const bests = personalBests(attempts);
  const routeAttempts = attemptsForRoute(attempts, selected.key);
  const championName =
    catalog.data?.champions.find((champion) => champion.id === championId)?.name ?? null;

  const selectRoute = (key: string, nextSide: MapSide = side) => {
    const route = routes.find((item) => item.key === key);
    dispatch({ type: "reset", totalSteps: route?.camps.length ?? 0 });
    setParams({ side: nextSide, route: key }, { replace: true });
  };

  const changeSide = (nextSide: MapSide) => {
    const first = routes.find((route) => route.side === nextSide);
    if (first) selectRoute(first.key, nextSide);
  };

  const toggleDraftCamp = (id: CampId) => {
    if (!draft) return;
    setDraft({
      ...draft,
      camps: draft.camps.includes(id)
        ? draft.camps.filter((camp) => camp !== id)
        : [...draft.camps, id],
    });
  };

  const closeEditor = (savedId?: string) => {
    const nextSide = draft?.side ?? side;
    setDraft(null);
    if (savedId) {
      dispatch({ type: "reset", totalSteps: 0 });
      setParams({ side: nextSide, route: savedId }, { replace: true });
    }
  };

  const mapRoute = draft ? draft.camps : selected.camps;
  const mapSide = draft ? draft.side : selected.side;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Strumenti · Fase 04"
        title="Jungle & Farming"
        description="Studia i percorsi sulla mappa schematica, cronometra i tuoi clear in allenamento e confronta i tentativi. Nessuna funzione live e nessun tempo di spawn inventato."
        actions={
          <Badge variant="outline">
            <Timer className="size-3" />
            Solo allenamento
          </Badge>
        }
      />

      {!isJungleStorageAvailable() ? (
        <p className="rounded-xl border border-warning/20 bg-warning/[0.05] px-4 py-3 text-[11px] text-muted-foreground">
          Anteprima browser: mappa, percorsi modello e cronometro funzionano, ma
          percorsi personalizzati e tentativi si salvano solo nell'app desktop.
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.7fr)]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div className="min-w-0">
              <p className="eyebrow">Summoner's Rift · schema originale</p>
              <h2 className="mt-1 truncate font-display text-sm font-semibold">
                {draft ? `Editor: ${draft.name || "nuovo percorso"}` : selected.name}
              </h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={mapSide === "blue" ? "secondary" : "danger"}>
                {SIDE_LABELS[mapSide]}
              </Badge>
              {!draft ? (
                <Badge variant="outline">{CATEGORY_LABELS[selected.category]}</Badge>
              ) : null}
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <div className="mx-auto max-w-[620px]">
              <RiftMap
                route={mapRoute}
                routeSide={mapSide}
                completed={draft ? 0 : timer.splits.length}
                showNext={!draft && timer.status === "running"}
                onCampClick={draft ? toggleDraftCamp : undefined}
              />
            </div>
            <div className="mt-3">
              <MapLegend />
            </div>
            {!draft ? (
              <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-4">
                <RouteSequence route={selected} completed={timer.splits.length} />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {selected.description}
                  {selected.category !== "custom"
                    ? " Percorso modello: indica solo l'ordine dei campi, i tempi sono i tuoi."
                    : ""}
                </p>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="p-5">
          {draft ? (
            <RouteEditor draft={draft} onChange={setDraft} onClose={closeEditor} />
          ) : (
            <div className="space-y-4">
              <RoutePanel
                side={side}
                onSideChange={changeSide}
                routes={routes}
                selectedKey={selected.key}
                onSelect={(key) => selectRoute(key)}
                bests={bests}
                locked={timerActive}
                onCreate={
                  isJungleStorageAvailable()
                    ? () => setDraft({ name: "", side, camps: [], notes: "" })
                    : undefined
                }
              />
              {isJungleStorageAvailable() && !timerActive ? (
                <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
                  {selected.category === "custom" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setDraft({
                          id: selected.key,
                          name: selected.name,
                          side: selected.side,
                          camps: [...selected.camps],
                          notes:
                            customRoutes.data?.find((route) => route.id === selected.key)?.notes ?? "",
                        })
                      }
                    >
                      <Pencil className="size-3.5" />
                      Modifica percorso
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setDraft({
                          name: `${selected.name} (mio)`.slice(0, 60),
                          side: selected.side,
                          camps: [...selected.camps],
                          notes: "",
                        })
                      }
                    >
                      <Copy className="size-3.5" />
                      Personalizza questo percorso
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section
          eyebrow="Allenamento"
          title={`Cronometro · ${selected.name}`}
          aside={<Badge variant="outline">{SIDE_LABELS[selected.side]}</Badge>}
        >
          <TrainingPanel
            route={selected}
            championId={championId}
            championName={championName}
            personalBest={bests.get(selected.key) ?? null}
            timer={timer}
            dispatch={dispatch}
          />
        </Section>

        <Section eyebrow="Statistiche personali" title="Storico e confronto">
          {!isJungleStorageAvailable() ? (
            <p className="text-xs text-muted-foreground">
              Lo storico dei tentativi è salvato nel database dell'app desktop.
            </p>
          ) : attemptsQuery.isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : attemptsQuery.isError ? (
            <ErrorState
              compact
              message={getErrorMessage(attemptsQuery.error)}
              onRetry={() => void attemptsQuery.refetch()}
            />
          ) : (
            <AttemptHistory key={selected.key} attempts={routeAttempts} />
          )}
        </Section>
      </div>

      <Section
        eyebrow="I tuoi junglers"
        title="Schede campioni jungle"
        aside={
          <span className="text-[10px] text-muted-foreground">
            Seleziona un campione per associarlo ai prossimi tentativi.
          </span>
        }
      >
        <JungleChampions attempts={attempts} selectedId={championId} onSelect={setChampionId} />
      </Section>

      <Section eyebrow="Mostri e obiettivi" title="Informazioni documentate">
        <MonstersInfo />
      </Section>
    </div>
  );
}

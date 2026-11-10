import { Plus, Swords, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCamp, SIDE_LABELS, type MapSide } from "@/features/jungle/data/camps";
import { CATEGORY_LABELS, type JungleRoute, type RouteCategory } from "@/features/jungle/data/routes";
import { formatClearTime } from "@/features/jungle/lib/training-timer";
import { cn } from "@/lib/utils";
import type { ClearAttempt } from "@/types/jungle";

const CATEGORY_ORDER: RouteCategory[] = ["full", "five", "three", "invade", "custom"];

interface RoutePanelProps {
  side: MapSide;
  onSideChange: (side: MapSide) => void;
  routes: JungleRoute[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  bests: Map<string, ClearAttempt>;
  onCreate?: () => void;
  /** True while a practice clear is in progress: switching would lose it. */
  locked?: boolean;
}

/** Model and custom routes for one side, grouped by category. */
export function RoutePanel({
  side,
  onSideChange,
  routes,
  selectedKey,
  onSelect,
  bests,
  onCreate,
  locked = false,
}: RoutePanelProps) {
  const sideRoutes = routes.filter((route) => route.side === side);

  return (
    <fieldset disabled={locked} className="min-w-0 space-y-4 disabled:opacity-60">
      <legend className="sr-only">Percorsi</legend>
      {locked ? (
        <p className="rounded-lg border border-warning/20 bg-warning/[0.05] px-3 py-2 text-[10px] text-muted-foreground">
          Clear in corso: salva, scarta o azzera il cronometro per cambiare percorso.
        </p>
      ) : null}
      <div role="radiogroup" aria-label="Lato della mappa" className="grid grid-cols-2 gap-1 rounded-lg border border-white/[0.06] bg-white/[0.015] p-1">
        {(["blue", "red"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={side === value}
            onClick={() => onSideChange(value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-200",
              side === value
                ? value === "blue"
                  ? "bg-secondary/[0.16] text-secondary"
                  : "bg-destructive/[0.16] text-destructive"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {SIDE_LABELS[value]}
          </button>
        ))}
      </div>

      {CATEGORY_ORDER.map((category) => {
        const items = sideRoutes.filter((route) => route.category === category);
        if (items.length === 0 && category !== "custom") return null;

        return (
          <section key={category} aria-label={CATEGORY_LABELS[category]}>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="eyebrow">{category === "custom" ? "Personalizzati" : CATEGORY_LABELS[category]}</p>
              {category === "custom" && onCreate ? (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={onCreate}>
                  <Plus className="size-3" />
                  Nuovo
                </Button>
              ) : null}
            </div>
            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/10 px-3 py-2.5 text-[10px] leading-relaxed text-muted-foreground">
                Nessun percorso personalizzato per il {SIDE_LABELS[side]}.
              </p>
            ) : (
              <ul className="space-y-1">
                {items.map((route) => {
                  const best = bests.get(route.key);
                  const selected = route.key === selectedKey;
                  return (
                    <li key={route.key}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onSelect(route.key)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors duration-200",
                          selected
                            ? "border-primary/40 bg-primary/[0.1]"
                            : "border-white/[0.05] bg-white/[0.015] hover:border-white/[0.12] hover:bg-white/[0.035]",
                        )}
                      >
                        {route.category === "invade" ? (
                          <Swords className="size-3.5 shrink-0 text-warning" />
                        ) : null}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-foreground">
                            {route.name}
                          </span>
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {route.camps.map((id) => getCamp(id).name).join(" → ")}
                          </span>
                        </span>
                        {best ? (
                          <span
                            className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] text-warning tabular-nums"
                            title="Il tuo miglior tempo"
                          >
                            <Trophy className="size-3" />
                            {formatClearTime(best.totalMs)}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </fieldset>
  );
}

/** Ordered chips of a route; enemy camps are marked for invasions. */
export function RouteSequence({
  route,
  completed = 0,
}: {
  route: JungleRoute;
  completed?: number;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label={`Sequenza: ${route.name}`}>
      {route.camps.map((id, index) => {
        const camp = getCamp(id);
        const enemy = camp.owner !== "river" && camp.owner !== route.side;
        return (
          <li key={id} className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-200",
                index < completed
                  ? "border-success/40 bg-success/[0.1] text-success"
                  : camp.owner === "blue"
                    ? "border-secondary/30 bg-secondary/[0.07] text-foreground"
                    : camp.owner === "red"
                      ? "border-destructive/30 bg-destructive/[0.07] text-foreground"
                      : "border-primary/30 bg-primary/[0.07] text-foreground",
                enemy && "border-dashed",
              )}
            >
              <span className="font-mono text-[9px] text-muted-foreground">{index + 1}</span>
              {camp.name}
              {enemy ? <span className="font-mono text-[8px] tracking-wider text-warning uppercase">nemico</span> : null}
            </span>
            {index < route.camps.length - 1 ? (
              <span aria-hidden="true" className="text-muted-foreground/50">→</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

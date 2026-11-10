import {
  Flag,
  Pause,
  Play,
  RotateCcw,
  Save,
  Timer,
  Trophy,
  Undo2,
} from "lucide-react";
import { useEffect, useState, type Dispatch } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCamp } from "@/features/jungle/data/camps";
import type { JungleRoute } from "@/features/jungle/data/routes";
import {
  elapsedMs,
  formatClearTime,
  formatDelta,
  type TimerAction,
  type TimerState,
} from "@/features/jungle/lib/training-timer";
import { useSaveAttempt } from "@/hooks/use-jungle";
import { cn } from "@/lib/utils";
import { isJungleStorageAvailable } from "@/services/jungle-service";
import type { ClearAttempt } from "@/types/jungle";

/** Re-renders ~10 times per second while `active`, to show tenths. */
function useTicker(active: boolean): number {
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let last = 0;
    const tick = (time: number) => {
      if (time - last >= 100) {
        last = time;
        setNow(time);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return now;
}

interface TrainingPanelProps {
  route: JungleRoute;
  championId: number | null;
  championName: string | null;
  personalBest: ClearAttempt | null;
  /** Owned by the page so the map can show progress; reset on route change. */
  timer: TimerState;
  dispatch: Dispatch<TimerAction>;
}

/** Practice stopwatch with one split per camp. */
export function TrainingPanel({
  route,
  championId,
  championName,
  personalBest,
  timer,
  dispatch,
}: TrainingPanelProps) {
  const now = useTicker(timer.status === "running");
  const save = useSaveAttempt();
  const canSave = isJungleStorageAvailable();

  const current = timer.status === "running" ? elapsedMs(timer, now) : elapsedMs(timer, 0);
  const nextCamp = route.camps[timer.splits.length];
  const comparableBest =
    personalBest && personalBest.camps.join() === route.camps.join() ? personalBest : null;

  const handleSave = () => {
    save.mutate(
      {
        routeKey: route.key,
        routeName: route.name,
        side: route.side,
        camps: route.camps,
        splitsMs: timer.splits,
        championId,
      },
      {
        onSuccess: (saved) => {
          const isRecord = !comparableBest || saved.totalMs < comparableBest.totalMs;
          toast.success(
            isRecord
              ? `Nuovo record personale: ${formatClearTime(saved.totalMs)}`
              : `Tentativo salvato: ${formatClearTime(saved.totalMs)}`,
          );
          dispatch({ type: "reset", totalSteps: route.camps.length });
        },
      },
    );
  };

  const finalDelta =
    timer.status === "finished" && comparableBest
      ? (timer.splits.at(-1) ?? 0) - comparableBest.totalMs
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="outline">
          <Timer className="size-3" />
          Cronometro di allenamento
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {championName ? `Campione: ${championName} · ` : "Nessun campione selezionato · "}
          registri tu i campi: non legge la partita e non è un timer live.
        </span>
      </div>

      <div
        className={cn(
          "rounded-2xl border px-5 py-6 text-center transition-colors duration-300",
          timer.status === "running"
            ? "border-primary/35 bg-primary/[0.06]"
            : timer.status === "finished"
              ? "border-success/35 bg-success/[0.05]"
              : "border-white/[0.07] bg-white/[0.015]",
        )}
      >
        <p
          className="font-display text-5xl font-semibold tracking-tight text-foreground tabular-nums sm:text-6xl"
          aria-live="off"
        >
          {formatClearTime(current)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
          {timer.status === "idle"
            ? `Pronto: ${route.camps.length} campi`
            : timer.status === "finished"
              ? "Clear completato"
              : nextCamp
                ? `Prossimo campo: ${getCamp(nextCamp).name} (${timer.splits.length + 1}/${route.camps.length})`
                : ""}
          {timer.status === "paused" ? " · in pausa" : ""}
        </p>
        {finalDelta !== null ? (
          <p
            className={cn(
              "mt-1 font-mono text-sm tabular-nums",
              finalDelta < 0 ? "text-success" : "text-destructive",
            )}
          >
            {formatDelta(finalDelta)} rispetto al record
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {timer.status === "idle" ? (
          <Button
            onClick={() =>
              dispatch({
                type: "start",
                now: performance.now(),
                totalSteps: route.camps.length,
              })
            }
          >
            <Play className="size-4" />
            Avvia clear
          </Button>
        ) : null}
        {timer.status === "running" ? (
          <>
            <Button onClick={() => dispatch({ type: "split", now: performance.now() })}>
              <Flag className="size-4" />
              {nextCamp ? `${getCamp(nextCamp).name} completato` : "Campo completato"}
            </Button>
            <Button variant="outline" onClick={() => dispatch({ type: "pause", now: performance.now() })}>
              <Pause className="size-4" />
              Pausa
            </Button>
          </>
        ) : null}
        {timer.status === "paused" ? (
          <Button onClick={() => dispatch({ type: "resume", now: performance.now() })}>
            <Play className="size-4" />
            Riprendi
          </Button>
        ) : null}
        {timer.status === "finished" ? (
          <Button onClick={handleSave} disabled={!canSave || save.isPending}>
            <Save className="size-4" />
            {save.isPending ? "Salvataggio…" : "Salva tentativo"}
          </Button>
        ) : null}
        {timer.splits.length > 0 ? (
          <Button variant="outline" onClick={() => dispatch({ type: "undo" })}>
            <Undo2 className="size-4" />
            Annulla ultimo campo
          </Button>
        ) : null}
        {timer.status !== "idle" ? (
          <Button
            variant="ghost"
            onClick={() => dispatch({ type: "reset", totalSteps: route.camps.length })}
          >
            <RotateCcw className="size-4" />
            {timer.status === "finished" ? "Scarta" : "Azzera"}
          </Button>
        ) : null}
      </div>
      {!canSave ? (
        <p className="text-center text-[10px] text-muted-foreground">
          Il salvataggio dei tentativi è disponibile nell'app desktop.
        </p>
      ) : null}

      <table className="w-full text-xs">
        <caption className="sr-only">Tempi per campo del tentativo in corso</caption>
        <thead>
          <tr className="border-b border-white/[0.06] text-left text-[10px] text-muted-foreground">
            <th scope="col" className="py-1.5 font-medium">#</th>
            <th scope="col" className="py-1.5 font-medium">Campo</th>
            <th scope="col" className="py-1.5 text-right font-medium">Parziale</th>
            <th scope="col" className="py-1.5 text-right font-medium">Cumulativo</th>
            <th scope="col" className="py-1.5 text-right font-medium">
              <Trophy className="inline size-3 align-[-1px]" /> vs record
            </th>
          </tr>
        </thead>
        <tbody>
          {route.camps.map((id, index) => {
            const split = timer.splits[index];
            const segment = split !== undefined ? split - (timer.splits[index - 1] ?? 0) : undefined;
            const bestSplit = comparableBest?.splits[index]?.splitMs;
            const delta = split !== undefined && bestSplit !== undefined ? split - bestSplit : undefined;
            const isNext = index === timer.splits.length && timer.status !== "finished";
            return (
              <tr
                key={id}
                className={cn(
                  "border-b border-white/[0.04] last:border-0",
                  isNext && timer.status !== "idle" && "bg-warning/[0.05]",
                )}
              >
                <td className="py-1.5 font-mono text-[10px] text-muted-foreground">{index + 1}</td>
                <td className="py-1.5">{getCamp(id).name}</td>
                <td className="py-1.5 text-right font-mono tabular-nums">
                  {segment !== undefined ? formatClearTime(segment) : "—"}
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums">
                  {split !== undefined ? formatClearTime(split) : "—"}
                </td>
                <td
                  className={cn(
                    "py-1.5 text-right font-mono tabular-nums",
                    delta === undefined
                      ? "text-muted-foreground"
                      : delta <= 0
                        ? "text-success"
                        : "text-destructive",
                  )}
                >
                  {delta !== undefined ? formatDelta(delta) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {comparableBest ? null : (
        <p className="text-[10px] text-muted-foreground">
          Nessun record per questo percorso: il primo tentativo salvato diventa il riferimento.
        </p>
      )}
    </div>
  );
}

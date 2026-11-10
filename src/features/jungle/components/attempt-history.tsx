import { GitCompareArrows, History, Trash2, Trophy } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getCamp } from "@/features/jungle/data/camps";
import { compareAttempts, routeStats } from "@/features/jungle/lib/attempt-stats";
import { formatClearTime, formatDelta } from "@/features/jungle/lib/training-timer";
import { useDeleteAttempt } from "@/hooks/use-jungle";
import { cn, formatDateTime } from "@/lib/utils";
import type { ClearAttempt } from "@/types/jungle";

const AttemptChart = lazy(() => import("@/features/jungle/components/attempt-chart"));

function StatTile({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-display text-lg font-semibold tabular-nums",
          tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/** Personal statistics, chart, history and comparison for one route. */
export function AttemptHistory({ attempts }: { attempts: ClearAttempt[] }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [toDelete, setToDelete] = useState<ClearAttempt | null>(null);
  const remove = useDeleteAttempt();

  if (attempts.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Nessun tentativo registrato"
        description="Completa un clear con il cronometro e salvalo: qui troverai record, media, grafico e confronto tra tentativi."
        className="py-8"
      />
    );
  }

  const stats = routeStats(attempts);
  const bestMs = stats.best?.totalMs ?? 0;
  const newestFirst = [...attempts].reverse();
  const toggle = (id: number) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id].slice(-2),
    );

  const pair = selected
    .map((id) => attempts.find((attempt) => attempt.id === id))
    .filter((attempt): attempt is ClearAttempt => Boolean(attempt))
    .sort((a, b) => a.id - b.id);
  const [first, second] = pair;
  const comparison = first && second ? compareAttempts(first, second) : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <StatTile label="Tentativi" value={String(stats.count)} />
        <StatTile label="Record personale" value={stats.best ? formatClearTime(stats.best.totalMs) : "—"} />
        <StatTile label="Media" value={stats.averageMs !== null ? formatClearTime(stats.averageMs) : "—"} />
        <StatTile label="Ultimo" value={stats.latest ? formatClearTime(stats.latest.totalMs) : "—"} />
        <StatTile
          label="Dal primo all'ultimo"
          value={stats.improvementMs !== null ? formatDelta(-stats.improvementMs) : "—"}
          tone={
            stats.improvementMs === null || stats.improvementMs === 0
              ? undefined
              : stats.improvementMs > 0
                ? "good"
                : "bad"
          }
        />
      </div>

      {attempts.length > 1 ? (
        <Suspense fallback={<Skeleton className="h-56 rounded-xl" />}>
          <AttemptChart attempts={attempts} bestMs={bestMs} />
        </Suspense>
      ) : null}

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">Storico</p>
          <p className="text-[10px] text-muted-foreground">
            <GitCompareArrows className="mr-1 inline size-3 align-[-2px]" />
            Seleziona due tentativi per confrontarli campo per campo.
          </p>
        </div>
        <div className="max-h-80 overflow-y-auto rounded-xl border border-white/[0.06]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-white/[0.06] text-left text-[10px] text-muted-foreground">
                <th scope="col" className="w-8 px-3 py-2 font-medium"><span className="sr-only">Confronta</span></th>
                <th scope="col" className="py-2 font-medium">Data</th>
                <th scope="col" className="py-2 font-medium">Campione</th>
                <th scope="col" className="py-2 text-right font-medium">Tempo</th>
                <th scope="col" className="py-2 text-right font-medium">vs record</th>
                <th scope="col" className="w-10 px-3 py-2"><span className="sr-only">Azioni</span></th>
              </tr>
            </thead>
            <tbody>
              {newestFirst.map((attempt) => {
                const isBest = attempt.id === stats.best?.id;
                return (
                  <tr key={attempt.id} className="border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.02]">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.includes(attempt.id)}
                        onChange={() => toggle(attempt.id)}
                        aria-label={`Confronta il tentativo del ${formatDateTime(attempt.createdAt)}`}
                        className="size-3.5 accent-[var(--primary)]"
                      />
                    </td>
                    <td className="py-2 text-muted-foreground">
                      <time dateTime={attempt.createdAt}>{formatDateTime(attempt.createdAt)}</time>
                    </td>
                    <td className="py-2">{attempt.championName ?? "—"}</td>
                    <td className="py-2 text-right font-mono tabular-nums">
                      {isBest ? <Trophy className="mr-1 inline size-3 align-[-1px] text-warning" /> : null}
                      {formatClearTime(attempt.totalMs)}
                    </td>
                    <td
                      className={cn(
                        "py-2 text-right font-mono tabular-nums",
                        isBest ? "text-warning" : "text-muted-foreground",
                      )}
                    >
                      {isBest ? "record" : formatDelta(attempt.totalMs - bestMs)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setToDelete(attempt)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Elimina il tentativo del ${formatDateTime(attempt.createdAt)}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {first && second ? (
        <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
          <p className="text-xs font-semibold text-foreground">
            Confronto: {formatDateTime(first.createdAt)} (A) → {formatDateTime(second.createdAt)} (B)
          </p>
          {comparison ? (
            <table className="mt-3 w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-[10px] text-muted-foreground">
                  <th scope="col" className="py-1.5 font-medium">Campo</th>
                  <th scope="col" className="py-1.5 text-right font-medium">A</th>
                  <th scope="col" className="py-1.5 text-right font-medium">B</th>
                  <th scope="col" className="py-1.5 text-right font-medium">Differenza</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.stepIndex} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-1.5">{getCamp(row.campId).name}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{formatClearTime(row.aSegmentMs)}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{formatClearTime(row.bSegmentMs)}</td>
                    <td
                      className={cn(
                        "py-1.5 text-right font-mono tabular-nums",
                        row.segmentDeltaMs < 0 ? "text-success" : row.segmentDeltaMs > 0 ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {formatDelta(row.segmentDeltaMs)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="pt-2 text-left font-semibold">Totale</th>
                  <td className="pt-2 text-right font-mono tabular-nums">{formatClearTime(first.totalMs)}</td>
                  <td className="pt-2 text-right font-mono tabular-nums">{formatClearTime(second.totalMs)}</td>
                  <td
                    className={cn(
                      "pt-2 text-right font-mono font-semibold tabular-nums",
                      second.totalMs < first.totalMs ? "text-success" : second.totalMs > first.totalMs ? "text-destructive" : "",
                    )}
                  >
                    {formatDelta(second.totalMs - first.totalMs)}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="mt-2 text-[11px] text-muted-foreground">
              I due tentativi hanno sequenze di campi diverse: si possono confrontare solo i totali (
              {formatDelta(second.totalMs - first.totalMs)}).
            </p>
          )}
        </div>
      ) : null}

      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminare il tentativo?</DialogTitle>
            <DialogDescription>
              {toDelete
                ? `Il tentativo del ${formatDateTime(toDelete.createdAt)} (${formatClearTime(toDelete.totalMs)}) verrà eliminato definitivamente.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setToDelete(null)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={remove.isPending}
              onClick={() => {
                if (!toDelete) return;
                remove.mutate(toDelete.id, {
                  onSuccess: () => {
                    setSelected((current) => current.filter((id) => id !== toDelete.id));
                    setToDelete(null);
                  },
                });
              }}
            >
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

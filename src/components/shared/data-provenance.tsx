import { Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataProvenanceProps {
  source: string;
  patches: string[];
  games: number;
  from: string | null;
  to: string | null;
  /** Extra note, e.g. the uncertainty method. */
  note?: string;
  className?: string;
}

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const time = Date.parse(iso);
  return Number.isNaN(time) ? "—" : dateFormatter.format(time);
}

function formatPatches(patches: string[]): string {
  if (patches.length === 0) return "non indicata";
  if (patches.length <= 3) return patches.join(", ");
  return `${patches[0]} … ${patches.at(-1)} (${patches.length})`;
}

/** Source, patch, sample size and period of a set of statistics. */
export function DataProvenance({
  source,
  patches,
  games,
  from,
  to,
  note,
  className,
}: DataProvenanceProps) {
  const items = [
    ["Fonte", source],
    ["Patch", formatPatches(patches)],
    ["Partite analizzate", String(games)],
    ["Periodo", games === 0 ? "—" : `${formatDate(from)} – ${formatDate(to)}`],
  ] as const;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-2.5 text-[11px]",
        className,
      )}
    >
      <Database className="size-3.5 shrink-0 text-secondary" aria-hidden="true" />
      <dl className="flex flex-wrap gap-x-5 gap-y-1">
        {items.map(([label, value]) => (
          <div key={label} className="flex gap-1.5">
            <dt className="text-muted-foreground">{label}:</dt>
            <dd className="font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      {note ? <p className="w-full text-muted-foreground">{note}</p> : null}
    </div>
  );
}

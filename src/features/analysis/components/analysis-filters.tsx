import { Info, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  DEFAULT_FILTERS,
  MATCH_LIMITS,
  PERIODS,
  roleLabel,
  type AnalysisFilters,
  type MatchLimit,
  type Period,
  type filterOptions,
} from "@/features/analysis/lib/analysis";
import { formatRankedEntry } from "@/features/analysis/lib/ranked";
import type { QueueGroup } from "@/lib/queues";
import type { RankedEntry } from "@/types/riot";

const QUEUE_LABELS: Record<QueueGroup | "all", string> = {
  all: "Tutte le modalità",
  solo: "Classificata Solo/Duo",
  flex: "Classificata Flex",
  normal: "Normali",
  aram: "ARAM",
  other: "Altre",
};

const PERIOD_LABELS: Record<Period, string> = {
  "7d": "Ultimi 7 giorni",
  "30d": "Ultimi 30 giorni",
  "90d": "Ultimi 90 giorni",
  all: "Tutto lo storico",
};

const LIMIT_LABELS: Record<MatchLimit, string> = {
  "10": "Ultime 10",
  "20": "Ultime 20",
  "50": "Ultime 50",
  all: "Tutte",
};

interface AnalysisFiltersBarProps {
  filters: AnalysisFilters;
  options: ReturnType<typeof filterOptions>;
  ranked: RankedEntry[];
  onChange: (next: Partial<AnalysisFilters>) => void;
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className="text-[11px] text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function AnalysisFiltersBar({ filters, options, ranked, onChange }: AnalysisFiltersBarProps) {
  const active = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  const rank = ranked.map(formatRankedEntry).join(" · ");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <Field id="filter-champion" label="Campione">
          <NativeSelect
            id="filter-champion"
            value={filters.championId ?? ""}
            onChange={(event) =>
              onChange({ championId: event.currentTarget.value ? Number(event.currentTarget.value) : null })
            }
          >
            <option value="">Tutti</option>
            {options.champions.map((champion) => (
              <option key={champion.id} value={champion.id}>
                {champion.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="filter-role" label="Ruolo">
          <NativeSelect
            id="filter-role"
            value={filters.role ?? ""}
            onChange={(event) => onChange({ role: event.currentTarget.value || null })}
          >
            <option value="">Tutti</option>
            {options.roles.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="filter-patch" label="Patch">
          <NativeSelect
            id="filter-patch"
            value={filters.patch ?? ""}
            onChange={(event) => onChange({ patch: event.currentTarget.value || null })}
          >
            <option value="">Tutte</option>
            {options.patches.map((patch) => (
              <option key={patch} value={patch}>
                {patch}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="filter-queue" label="Modalità">
          <NativeSelect
            id="filter-queue"
            value={filters.queue}
            onChange={(event) => {
              const value = event.currentTarget.value;
              const queue = (Object.keys(QUEUE_LABELS) as (QueueGroup | "all")[]).find((key) => key === value);
              onChange({ queue: queue ?? "all" });
            }}
          >
            <option value="all">{QUEUE_LABELS.all}</option>
            {options.queues.map((queue) => (
              <option key={queue} value={queue}>
                {QUEUE_LABELS[queue]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="filter-tier" label="Fascia classificata">
          <NativeSelect id="filter-tier" disabled value="" aria-describedby="filter-tier-note">
            <option value="">Non disponibile</option>
          </NativeSelect>
        </Field>
        <Field id="filter-period" label="Periodo">
          <NativeSelect
            id="filter-period"
            value={filters.period}
            onChange={(event) => {
              const value = event.currentTarget.value;
              onChange({ period: PERIODS.find((period) => period === value) ?? "all" });
            }}
          >
            {PERIODS.map((period) => (
              <option key={period} value={period}>
                {PERIOD_LABELS[period]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="filter-limit" label="Numero di partite">
          <NativeSelect
            id="filter-limit"
            value={filters.limit}
            onChange={(event) => {
              const value = event.currentTarget.value;
              onChange({ limit: MATCH_LIMITS.find((limit) => limit === value) ?? "all" });
            }}
          >
            {MATCH_LIMITS.map((limit) => (
              <option key={limit} value={limit}>
                {LIMIT_LABELS[limit]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p id="filter-tier-note" className="flex max-w-3xl items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          La fascia classificata non è filtrabile: match-v5 non indica il rank dei giocatori
          al momento della partita, e non lo stimiamo.
          {rank ? ` Rank attuale (league-v4): ${rank}.` : ""}
        </p>
        {active ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(DEFAULT_FILTERS)}>
            <RotateCcw className="size-3.5" />
            Azzera filtri
          </Button>
        ) : null}
      </div>
    </div>
  );
}

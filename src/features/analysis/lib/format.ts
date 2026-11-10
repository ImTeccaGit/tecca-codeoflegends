import type { AnalysisSummary, Average } from "@/features/analysis/lib/analysis";
import { formatPercent } from "@/lib/match-stats";

const integer = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatInteger(value: number | null): string {
  return value === null ? "—" : integer.format(value);
}

export function formatDecimal(value: number | null): string {
  return value === null ? "—" : oneDecimal.format(value);
}

/** "52,4% (IC 95%: 41–63%)" or a clear "insufficient data" text. */
export function winRateDetail(summary: AnalysisSummary): string {
  if (summary.games === 0) return "Nessuna partita";
  const interval = summary.interval
    ? `IC 95%: ${Math.round(summary.interval.low * 100)}–${Math.round(summary.interval.high * 100)}%`
    : "";
  const base = `${summary.wins}V ${summary.losses}S · ${interval}`;
  return summary.sufficient ? base : `${base} · campione ridotto`;
}

export function averageDetail(average: Average, total: number): string {
  if (average.count === 0) return "Dato non fornito da Riot";
  return average.count === total
    ? `Media su ${average.count} partite`
    : `Media su ${average.count} di ${total} partite`;
}

export function formatWinRate(summary: AnalysisSummary): string {
  return formatPercent(summary.winRate);
}

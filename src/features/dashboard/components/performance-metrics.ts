/**
 * Metric definitions shared by the performance panel (eager) and the chart
 * (lazy). Kept apart so importing them never pulls Recharts into the main
 * bundle.
 */
export type PerformanceMetric = "kda" | "winRatePercent";

export const PERFORMANCE_METRICS: Record<
  PerformanceMetric,
  { label: string; description: string }
> = {
  kda: {
    label: "KDA",
    description: "KDA di ogni partita, dalla più vecchia alla più recente.",
  },
  winRatePercent: {
    label: "Win rate",
    description: "Win rate cumulativo dopo ogni partita.",
  },
};

export const PERFORMANCE_METRIC_ORDER: readonly PerformanceMetric[] = [
  "kda",
  "winRatePercent",
];

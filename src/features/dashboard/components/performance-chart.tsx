import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  PERFORMANCE_METRICS,
  type PerformanceMetric,
} from "@/features/dashboard/components/performance-metrics";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { formatKda, type PerformancePoint } from "@/lib/match-stats";
import { cn } from "@/lib/utils";

interface PerformanceChartProps {
  series: PerformancePoint[];
  metric: PerformanceMetric;
}

function formatValue(metric: PerformanceMetric, value: number): string {
  return metric === "kda" ? formatKda(value) : `${value.toFixed(0)}%`;
}

/**
 * Single-series area chart (one axis, one color). Loaded lazily so Recharts
 * stays out of the initial bundle.
 */
export default function PerformanceChart({
  series,
  metric,
}: PerformanceChartProps) {
  const reducedMotion = useReducedMotion();
  const gradientId = `performance-fill-${metric}`;

  const renderTooltip = (active: boolean | undefined, label: unknown) => {
    const point = series.find((item) => item.index === label);

    if (!active || !point) {
      return null;
    }

    return (
      <div className="rounded-lg border border-white/10 bg-popover px-3 py-2 text-xs shadow-xl shadow-black/40">
        <p className="font-semibold text-foreground">
          Partita {point.index} · {point.championName}
        </p>
        <p className="mt-1 flex items-center gap-2 text-muted-foreground">
          <span
            className={cn(
              "font-mono text-[9px] tracking-[0.12em] uppercase",
              point.win ? "text-success" : "text-destructive",
            )}
          >
            {point.win ? "Vittoria" : "Sconfitta"}
          </span>
          <span className="font-mono text-foreground tabular-nums">
            {PERFORMANCE_METRICS[metric].label}{" "}
            {formatValue(metric, point[metric])}
          </span>
        </p>
      </div>
    );
  };

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={series}
          margin={{ top: 12, right: 12, bottom: 0, left: -12 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="index"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
            tickFormatter={(value: number) => `P${value}`}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
            domain={metric === "kda" ? [0, "auto"] : [0, 100]}
            ticks={metric === "kda" ? undefined : [0, 25, 50, 75, 100]}
            tickFormatter={(value: number) =>
              metric === "kda" ? value.toFixed(1) : `${value}%`
            }
          />
          {metric === "winRatePercent" ? (
            <ReferenceLine
              y={50}
              stroke="var(--chart-reference)"
              strokeDasharray="4 4"
            />
          ) : null}
          <Tooltip
            content={(props) => renderTooltip(props.active, props.label)}
            cursor={{ stroke: "var(--chart-reference)", strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey={metric}
            stroke="var(--primary)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{
              r: 4,
              fill: "var(--primary)",
              stroke: "var(--surface)",
              strokeWidth: 2,
            }}
            isAnimationActive={!reducedMotion}
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>

      <table className="sr-only">
        <caption>{PERFORMANCE_METRICS[metric].description}</caption>
        <thead>
          <tr>
            <th scope="col">Partita</th>
            <th scope="col">Campione</th>
            <th scope="col">Esito</th>
            <th scope="col">{PERFORMANCE_METRICS[metric].label}</th>
          </tr>
        </thead>
        <tbody>
          {series.map((point) => (
            <tr key={point.matchId}>
              <td>{point.index}</td>
              <td>{point.championName}</td>
              <td>{point.win ? "Vittoria" : "Sconfitta"}</td>
              <td>{formatValue(metric, point[metric])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

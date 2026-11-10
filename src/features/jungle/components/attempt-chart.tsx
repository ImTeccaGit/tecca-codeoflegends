import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatClearTime } from "@/features/jungle/lib/training-timer";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { formatDateTime } from "@/lib/utils";
import type { ClearAttempt } from "@/types/jungle";

interface AttemptChartProps {
  /** Attempts of one route, oldest first. */
  attempts: ClearAttempt[];
  bestMs: number;
}

/** Total clear time per attempt (single series, one axis). Loaded lazily. */
export default function AttemptChart({ attempts, bestMs }: AttemptChartProps) {
  const reducedMotion = useReducedMotion();
  const data = attempts.map((attempt, index) => ({
    index: index + 1,
    totalMs: attempt.totalMs,
    createdAt: attempt.createdAt,
    champion: attempt.championName,
  }));

  const renderTooltip = (active: boolean | undefined, label: unknown) => {
    const point = data.find((item) => item.index === label);
    if (!active || !point) return null;
    return (
      <div className="rounded-lg border border-white/10 bg-popover px-3 py-2 text-xs shadow-xl shadow-black/40">
        <p className="font-semibold text-foreground">
          Tentativo #{point.index} · {formatClearTime(point.totalMs)}
        </p>
        <p className="mt-0.5 text-muted-foreground">
          {formatDateTime(point.createdAt)}
          {point.champion ? ` · ${point.champion}` : ""}
        </p>
      </div>
    );
  };

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="index"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
            tickFormatter={(value: number) => `#${value}`}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            domain={["auto", "auto"]}
            tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
            tickFormatter={(value: number) => formatClearTime(value)}
          />
          <ReferenceLine
            y={bestMs}
            stroke="var(--warning)"
            strokeDasharray="4 4"
            label={{ value: "record", fill: "var(--warning)", fontSize: 10, position: "insideTopRight" }}
          />
          <Tooltip
            cursor={{ stroke: "var(--chart-reference)" }}
            content={(props) => renderTooltip(props.active, props.label)}
          />
          <Line
            type="monotone"
            dataKey="totalMs"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--primary)", stroke: "var(--surface)", strokeWidth: 1.5 }}
            activeDot={{ r: 5, fill: "var(--primary)", stroke: "var(--surface)", strokeWidth: 2 }}
            isAnimationActive={!reducedMotion}
          />
        </LineChart>
      </ResponsiveContainer>

      <table className="sr-only">
        <caption>Tempi totali dei tentativi, dal più vecchio</caption>
        <tbody>
          {data.map((point) => (
            <tr key={point.index}>
              <td>{point.index}</td>
              <td>{formatClearTime(point.totalMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

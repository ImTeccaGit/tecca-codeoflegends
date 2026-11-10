import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { ROLLING_WINDOW, type GroupStats, type SeriesPoint, type WeekBucket } from "@/features/analysis/lib/analysis";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

/** Loaded lazily so Recharts stays out of the initial bundle. */

type TrendMetric =
  | "winRate"
  | "kda"
  | "csPerMinute"
  | "goldPerMinute"
  | "damagePerMinute"
  | "visionScore"
  | "killParticipation";

const TREND_METRICS: Record<TrendMetric, { label: string; unit: string; digits: number }> = {
  winRate: { label: "Win rate", unit: "%", digits: 0 },
  kda: { label: "KDA", unit: "", digits: 2 },
  csPerMinute: { label: "CS/min", unit: "", digits: 1 },
  goldPerMinute: { label: "Oro/min", unit: "", digits: 0 },
  damagePerMinute: { label: "Danni/min", unit: "", digits: 0 },
  visionScore: { label: "Visione", unit: "", digits: 0 },
  killParticipation: { label: "Kill participation", unit: "%", digits: 0 },
};

const AXIS = { fill: "var(--chart-axis)", fontSize: 10 };

function ChartFrame({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <figure className="space-y-2">
      <figcaption>
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </figcaption>
      <div className="h-56 w-full">{children}</div>
    </figure>
  );
}

function TooltipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-popover px-3 py-2 text-xs shadow-xl shadow-black/40">
      {children}
    </div>
  );
}

function format(value: number | null | undefined, digits: number, unit: string): string {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("it-IT", { maximumFractionDigits: digits, minimumFractionDigits: digits })}${unit}`;
}

function renderTrendTooltip(
  active: boolean | undefined,
  label: unknown,
  series: SeriesPoint[],
  metric: TrendMetric,
) {
  const info = TREND_METRICS[metric];
  const point = series.find((item) => item.index === label);
  if (!active || !point) return null;
  return (
    <TooltipBox>
      <p className="font-semibold text-foreground">
        Partita {point.index} · {point.championName}
      </p>
      <p className={cn("font-mono text-[10px] uppercase", point.win ? "text-success" : "text-destructive")}>
        {point.win ? "Vittoria" : "Sconfitta"}
      </p>
      {metric === "winRate" ? (
        <p className="text-muted-foreground">
          Cumulativo {format(point.winRate, 0, "%")} · Ultime {ROLLING_WINDOW} {format(point.rollingWinRate, 0, "%")}
        </p>
      ) : (
        <p className="text-muted-foreground">
          {info.label} {format(point[metric], info.digits, info.unit)}
        </p>
      )}
    </TooltipBox>
  );
}

function renderWeekTooltip(active: boolean | undefined, payload: readonly { payload?: unknown }[] | undefined) {
  const bucket = payload?.[0]?.payload as WeekBucket | undefined;
  if (!active || !bucket) return null;
  return (
    <TooltipBox>
      <p className="font-semibold text-foreground">Settimana del {bucket.week}</p>
      <p className="text-muted-foreground">
        {bucket.wins} vittorie · {bucket.losses} sconfitte
      </p>
    </TooltipBox>
  );
}

interface GroupRow {
  label: string;
  winRate: number;
  games: number;
  sufficient: boolean;
}

function renderGroupTooltip(active: boolean | undefined, payload: readonly { payload?: unknown }[] | undefined) {
  const row = payload?.[0]?.payload as GroupRow | undefined;
  if (!active || !row) return null;
  return (
    <TooltipBox>
      <p className="font-semibold text-foreground">{row.label}</p>
      <p className="text-muted-foreground">
        Win rate {format(row.winRate, 0, "%")} su {row.games} partite
        {row.sufficient ? "" : " · campione ridotto"}
      </p>
    </TooltipBox>
  );
}

function TrendChart({ series, animate }: { series: SeriesPoint[]; animate: boolean }) {
  const [metric, setMetric] = useState<TrendMetric>("winRate");
  const info = TREND_METRICS[metric];
  const percent = info.unit === "%";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Statistica del grafico">
        {(Object.keys(TREND_METRICS) as TrendMetric[]).map((key) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={key === metric ? "secondary" : "outline"}
            aria-pressed={key === metric}
            onClick={() => setMetric(key)}
          >
            {TREND_METRICS[key].label}
          </Button>
        ))}
      </div>
      <ChartFrame
        title={metric === "winRate" ? "Andamento del win rate" : `Evoluzione: ${info.label}`}
        description={
          metric === "winRate"
            ? `Cumulativo e media mobile delle ultime ${ROLLING_WINDOW} partite, dalla più vecchia alla più recente.`
            : "Valore di ogni partita, dalla più vecchia alla più recente. I punti mancanti sono dati non forniti da Riot."
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="index" tickLine={false} axisLine={false} tick={AXIS} tickFormatter={(v: number) => `P${v}`} minTickGap={16} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tick={AXIS}
              domain={percent ? [0, 100] : [0, "auto"]}
              tickFormatter={(v: number) => (percent ? `${v}%` : String(v))}
            />
            {metric === "winRate" ? <ReferenceLine y={50} stroke="var(--chart-reference)" strokeDasharray="4 4" /> : null}
            <Tooltip
              cursor={{ stroke: "var(--chart-reference)" }}
              content={(props) => renderTrendTooltip(props.active, props.label, series, metric)}
            />
            {metric === "winRate" ? (
              <>
                <Line type="monotone" dataKey="winRate" name="Cumulativo" stroke="var(--primary)" strokeWidth={2} dot={false} isAnimationActive={animate} />
                <Line type="monotone" dataKey="rollingWinRate" name={`Ultime ${ROLLING_WINDOW}`} stroke="var(--secondary)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} isAnimationActive={animate} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </>
            ) : (
              <Line type="monotone" dataKey={metric} name={info.label} stroke="var(--primary)" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={animate} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}

function WeeklyChart({ weekly, animate }: { weekly: WeekBucket[]; animate: boolean }) {
  return (
    <ChartFrame title="Vittorie e sconfitte" description="Per settimana (lunedì, UTC).">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={weekly} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="week" tickLine={false} axisLine={false} tick={AXIS} tickFormatter={(v: string) => v.slice(5)} minTickGap={12} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS} width={36} />
          <Tooltip
            cursor={{ fill: "var(--chart-grid)" }}
            content={(props) => renderWeekTooltip(props.active, props.payload)}
          />
          <Bar dataKey="wins" name="Vittorie" stackId="r" fill="var(--success)" isAnimationActive={animate} />
          <Bar dataKey="losses" name="Sconfitte" stackId="r" fill="var(--destructive)" radius={[4, 4, 0, 0]} isAnimationActive={animate} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function GroupChart({
  title,
  description,
  groups,
  animate,
}: {
  title: string;
  description: string;
  groups: GroupStats[];
  animate: boolean;
}) {
  const data: GroupRow[] = groups.slice(0, 8).map((group) => ({
    label: group.label,
    winRate: group.summary.winRate === null ? 0 : group.summary.winRate * 100,
    games: group.summary.games,
    sufficient: group.summary.sufficient,
  }));
  return (
    <ChartFrame title={title} description={description}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
          <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={AXIS} tickFormatter={(v: number) => `${v}%`} />
          <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} tick={AXIS} width={84} />
          <ReferenceLine x={50} stroke="var(--chart-reference)" strokeDasharray="4 4" />
          <Tooltip
            cursor={{ fill: "var(--chart-grid)" }}
            content={(props) => renderGroupTooltip(props.active, props.payload)}
          />
          <Bar dataKey="winRate" radius={[0, 4, 4, 0]} isAnimationActive={animate}>
            {data.map((row) => (
              <Cell key={row.label} fill="var(--primary)" fillOpacity={row.sufficient ? 0.9 : 0.35} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

interface AnalysisChartsProps {
  series: SeriesPoint[];
  weekly: WeekBucket[];
  champions: GroupStats[];
  roles: GroupStats[];
}

export default function AnalysisCharts({ series, weekly, champions, roles }: AnalysisChartsProps) {
  const animate = !useReducedMotion();
  return (
    <div className="space-y-8">
      <TrendChart series={series} animate={animate} />
      <div className="grid gap-8 lg:grid-cols-3">
        <WeeklyChart weekly={weekly} animate={animate} />
        <GroupChart
          title="Performance per campione"
          description="Win rate dei campioni più giocati; barre chiare = meno di 5 partite."
          groups={champions}
          animate={animate}
        />
        <GroupChart
          title="Performance per ruolo"
          description="Win rate per ruolo assegnato da Riot (teamPosition)."
          groups={roles}
          animate={animate}
        />
      </div>
    </div>
  );
}

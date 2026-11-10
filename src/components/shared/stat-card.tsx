import {
  ArrowDownRight,
  ArrowUpRight,
  LockKeyhole,
  Minus,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatTone = "primary" | "secondary" | "neutral" | "warning" | "success";
type TrendTone = "up" | "down" | "flat" | "locked";

interface StatTrend {
  label: string;
  tone: TrendTone;
}

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  tone?: StatTone;
  trend?: StatTrend;
  badge?: ReactNode;
  muted?: boolean;
  className?: string;
  /** Overrides the value typography, e.g. a smaller size for text values. */
  valueClassName?: string;
}

const toneStyles: Record<StatTone, string> = {
  primary: "border-primary/20 bg-primary/[0.09] text-primary",
  secondary: "border-secondary/20 bg-secondary/[0.09] text-secondary",
  neutral: "border-white/[0.07] bg-white/[0.03] text-muted-foreground",
  warning: "border-warning/20 bg-warning/[0.08] text-warning",
  success: "border-success/20 bg-success/[0.08] text-success",
};

const trendIcon: Record<TrendTone, LucideIcon> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
  locked: LockKeyhole,
};

const trendStyles: Record<TrendTone, string> = {
  up: "border-success/20 bg-success/[0.08] text-success",
  down: "border-destructive/20 bg-destructive/[0.08] text-destructive",
  flat: "border-white/[0.07] bg-white/[0.03] text-muted-foreground",
  locked: "border-warning/20 bg-warning/[0.07] text-warning",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  trend,
  badge,
  muted = false,
  className,
  valueClassName,
}: StatCardProps) {
  const TrendIcon = trend ? trendIcon[trend.tone] : null;

  return (
    <div
      className={cn(
        "card-lift group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-surface-raised/70 via-surface to-surface p-5",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -top-16 -right-10 size-36 rounded-full opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100",
          tone === "primary"
            ? "bg-primary/20"
            : tone === "secondary"
              ? "bg-secondary/15"
              : "bg-white/10",
        )}
      />

      <div className="relative flex items-center justify-between gap-3">
        <span className="eyebrow">{label}</span>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg border",
            toneStyles[tone],
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>

      <div className="relative mt-4 flex items-end justify-between gap-3">
        <p
          className={cn(
            "font-display text-3xl leading-none font-semibold tracking-tight tabular-nums",
            muted ? "text-muted-foreground/70" : "text-foreground",
            valueClassName,
          )}
        >
          {value}
        </p>
        {trend && TrendIcon ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              trendStyles[trend.tone],
            )}
          >
            <TrendIcon className="size-3" />
            {trend.label}
          </span>
        ) : null}
      </div>

      <p className="relative mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
        {hint}
      </p>

      {badge ? <div className="relative mt-3">{badge}</div> : null}
    </div>
  );
}

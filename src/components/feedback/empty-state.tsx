import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="flex size-10 items-center justify-center rounded-xl border border-white/[0.07] bg-surface-raised text-muted-foreground">
          <Icon className="size-5" />
        </span>
      ) : null}
      <div className="space-y-1">
        <h3 className="font-display text-sm font-semibold text-foreground">
          {title}
        </h3>
        <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

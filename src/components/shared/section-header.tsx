import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  /** id for the heading, to label the surrounding <section>. */
  titleId?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  titleId,
  description,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-end justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h2
          id={titleId}
          className="font-display text-sm font-semibold tracking-wide text-foreground"
        >
          {title}
        </h2>
        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PanelProps {
  eyebrow: string;
  title: string;
  /** Right side of the header: badges, buttons, toggles. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Card with a titled header, used by dashboard and data modules. */
export function Panel({
  eyebrow,
  title,
  action,
  children,
  className,
}: PanelProps) {
  return (
    <Card
      className={cn(
        "card-lift flex min-h-0 flex-col overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div className="min-w-0">
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-1 truncate font-display text-sm font-semibold">
            {title}
          </h2>
        </div>
        {action ? (
          <div className="flex shrink-0 items-center gap-1.5">{action}</div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">{children}</div>
    </Card>
  );
}

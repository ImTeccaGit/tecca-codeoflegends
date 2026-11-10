import { cn } from "@/lib/utils";

export type StatusTone =
  | "success"
  | "warning"
  | "danger"
  | "primary"
  | "secondary"
  | "muted";

const toneClasses: Record<StatusTone, string> = {
  success: "bg-success shadow-success/60",
  warning: "bg-warning shadow-warning/60",
  danger: "bg-destructive shadow-destructive/60",
  primary: "bg-primary shadow-primary/60",
  secondary: "bg-secondary shadow-secondary/60",
  muted: "bg-muted-foreground/50 shadow-transparent",
};

interface StatusDotProps {
  tone: StatusTone;
  pulse?: boolean;
  className?: string;
}

export function StatusDot({ tone, pulse = false, className }: StatusDotProps) {
  return (
    <span className={cn("relative flex size-2", className)} aria-hidden="true">
      {pulse ? (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-50",
            toneClasses[tone],
          )}
        />
      ) : null}
      <span
        className={cn(
          "relative inline-flex size-2 rounded-full shadow-[0_0_10px]",
          toneClasses[tone],
        )}
      />
    </span>
  );
}

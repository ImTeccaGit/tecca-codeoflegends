import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({
  title = "Impossibile caricare i dati",
  message,
  onRetry,
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={
        compact
          ? "flex flex-col items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/[0.06] p-4"
          : "flex flex-col items-center gap-4 rounded-2xl border border-destructive/20 bg-destructive/[0.05] px-6 py-12 text-center"
      }
    >
      <span className="flex size-10 items-center justify-center rounded-xl border border-destructive/25 bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </span>
      <div className="space-y-1.5">
        <h3 className="font-display text-sm font-semibold text-foreground">
          {title}
        </h3>
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          {message}
        </p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw className="size-3.5" />
          Riprova
        </Button>
      ) : null}
    </div>
  );
}

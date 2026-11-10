import { RefreshCw } from "lucide-react";

interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = "Caricamento dati…" }: LoadingStateProps) {
  return (
    <div
      className="flex items-center gap-2 text-xs text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <RefreshCw className="size-3.5 animate-spin text-primary" />
      {label}
    </div>
  );
}

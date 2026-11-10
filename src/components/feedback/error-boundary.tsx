import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "@/components/feedback/error-state";
import { LogoMark } from "@/components/brand/logo-mark";
import { logFrontendError } from "@/services/log-service";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last line of defence for rendering failures.
 * Async/backend errors are handled by TanStack Query and surfaced via toasts.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void logFrontendError(
      "Errore di rendering",
      `${error.stack ?? error.message}\nComponent stack:${info.componentStack ?? " n/d"}`,
    );
  }

  private readonly handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="app-backdrop flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/10 bg-surface p-8 shadow-2xl shadow-black/50">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div>
              <p className="eyebrow">Errore critico</p>
              <p className="font-display text-sm font-semibold">
                Tecca CodeOfLegends
              </p>
            </div>
          </div>
          <ErrorState
            title="L'interfaccia ha incontrato un errore"
            message="Ricarica l'applicazione. Il dettaglio tecnico è stato registrato nei log locali (percorso visibile in Impostazioni → Database locale)."
            onRetry={this.handleReload}
          />
        </div>
      </div>
    );
  }
}

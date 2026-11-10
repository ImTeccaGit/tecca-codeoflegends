import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { ErrorBoundary } from "@/components/feedback/error-boundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useCatalogUpdateListener } from "@/hooks/use-catalog";
import { useClientAccountListener } from "@/hooks/use-client-account";
import { useSystemSnapshot } from "@/hooks/use-system-snapshot";
import { queryClient } from "@/lib/query-client";

function RuntimePreferences() {
  const { data } = useSystemSnapshot();
  const reduceMotion = data?.settings.reduceMotion ?? false;

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = reduceMotion
      ? "true"
      : "false";
  }, [reduceMotion]);

  useCatalogUpdateListener();
  useClientAccountListener();

  return null;
}

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={250}>
          {children}
          <RuntimePreferences />
          <Toaster
            theme="dark"
            position="bottom-right"
            closeButton
            toastOptions={{
              classNames: {
                toast:
                  "!rounded-xl !border-white/10 !bg-surface !text-foreground !shadow-2xl !shadow-black/50",
                description: "!text-muted-foreground",
                actionButton: "!bg-primary !text-primary-foreground",
                cancelButton: "!bg-white/10 !text-foreground",
              },
            }}
          />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { normalizeError } from "@/lib/errors";
import { logFrontendError } from "@/services/log-service";

function reportGlobalError(error: unknown) {
  const normalized = normalizeError(error);
  // Backend failures are already logged by Rust; this also records frontend
  // contract (Zod) and unexpected errors. The browser preview has no backend.
  if (normalized.code !== "BACKEND_UNAVAILABLE") {
    void logFrontendError(
      `Operazione non riuscita (${normalized.code})`,
      normalized.cause ?? normalized,
    );
  }
  toast.error(normalized.message, {
    id: `global-error:${normalized.code}`,
  });
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: reportGlobalError,
  }),
  mutationCache: new MutationCache({
    onError: reportGlobalError,
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

export { queryClient };

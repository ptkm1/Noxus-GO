import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "./api-error";
import { notifyError } from "./app-notifications";

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.meta?.silentError) return;
        notifyError(getErrorMessage(error));
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.silentError || mutation.meta?.inlineError) return;
        notifyError(getErrorMessage(error));
      },
    }),
  });
}

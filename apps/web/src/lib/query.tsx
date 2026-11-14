import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { ApiError } from "@/api/errors"
import { toastApiError } from "./errors"

/** Retry network and server errors, never client errors (a 403 or 422 will not fix itself). */
export const makeQueryClient = () =>
  new QueryClient({
    // Failed mutations and queries tell the user with a reference id. A screen with its own error state sets meta: { silent: true } on its query.
    queryCache: new QueryCache({ onError: (e, q) => { if (!q.meta?.silent) toastApiError(e) } }),
    mutationCache: new MutationCache({ onError: (e) => toastApiError(e) }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
      },
    },
  })

const client = makeQueryClient()
export const QueryProvider = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>

/** One key factory per feature keeps cache invalidation predictable: qk.invoices.list(filters). */
export const qk = {
  health: { live: ["health"] as const },
}

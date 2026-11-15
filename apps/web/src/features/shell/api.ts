import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { request } from "@/api/http"

export type Frame = { organization: { name: string }; user: { name: string; email: string }; counts: { reconciliation: number; investigations: number; approvals: number } }
export type SearchResults = {
  customers: { id: string; name: string }[]; invoices: { id: string; number: string; customer: string; balance: string; currency: string }[]
  payments: { id: string; number: string; payer: string | null; amount: string; currency: string }[]; investigations: { id: string; number: string; title: string }[]
}
/** Under the "dashboard" key so every change that moves money or work refreshes the badge counts too. */
export const useFrame = (enabled: boolean) => useQuery({ queryKey: ["dashboard", "shell"], queryFn: () => request<Frame>("/shell"), enabled, staleTime: 15_000 })
export const useSearch = (q: string, enabled: boolean) => useQuery({ queryKey: ["search", q], queryFn: () => request<SearchResults>("/search", { query: { q } }), enabled: enabled && q.trim().length >= 2, placeholderData: keepPreviousData })

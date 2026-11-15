import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { request } from "@/api/http"
import type { PageOf } from "@/features/ledger/api"

export type Suggestion = {
  id: string; rule: string; confidence: "exact" | "high" | "medium"; reason: string; created_at: string
  payment: { id: string; number: string; amount: string; unallocated: string; currency: string; date: string; reference: string | null; payer: string | null }
  allocations: { invoice_id: string; invoice_number: string; amount: string; balance: string | null; customer: string | null }[]
}
export type AutoApplied = { id: string; amount: string; currency: string; created_at: string; payment_number: string; payer: string | null; invoice_number: string }
export type Discrepancy = { id: string; type: string; exposure: string; detail: string; status: string; created_at: string; payment_number: string | null; payment_id: string | null; invoice_number: string | null; resolution_note: string | null }
export type Run = { id: string; started_at: string; by: string | null; counts: Record<string, number> }

const K = ["reconciliation"] as const
export const useSuggestions = () => useQuery({ queryKey: [...K, "suggestions"], queryFn: () => request<PageOf<Suggestion>>("/reconciliation/suggestions", { query: { limit: 100 } }), placeholderData: keepPreviousData })
export const useAutoApplied = () => useQuery({ queryKey: [...K, "auto"], queryFn: () => request<PageOf<AutoApplied>>("/reconciliation/auto-applied", { query: { limit: 100 } }) })
export const useDiscrepancies = () => useQuery({ queryKey: [...K, "discrepancies"], queryFn: () => request<PageOf<Discrepancy>>("/reconciliation/discrepancies", { query: { limit: 100 } }) })
export const useRuns = () => useQuery({ queryKey: [...K, "runs"], queryFn: () => request<{ data: Run[] }>("/reconciliation/runs") })

function useRecMutation<V, R = unknown>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSettled: () => { ["reconciliation", "invoices", "payments", "customers", "audit", "dashboard"].forEach((k) => void qc.invalidateQueries({ queryKey: [k] })) } })
}
export const useRunReconciliation = () => useRecMutation(() => request<Record<string, number>>("/reconciliation/runs", { method: "POST" }))
export const useAccept = () => useRecMutation((id: string) => request(`/reconciliation/suggestions/${id}/accept`, { method: "POST" }))
export const useReject = () => useRecMutation((v: { id: string; reason: string }) => request(`/reconciliation/suggestions/${v.id}/reject`, { method: "POST", body: { reason: v.reason } }))
export const useUndoAuto = () => useRecMutation((v: { id: string; reason: string }) => request(`/allocations/${v.id}/void`, { method: "POST", body: { reason: v.reason } }))
export const useResolve = () => useRecMutation((v: { id: string; reason: string }) => request(`/reconciliation/discrepancies/${v.id}/resolve`, { method: "POST", body: { reason: v.reason } }))

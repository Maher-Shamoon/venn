import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { request } from "@/api/http"

export type Status = "new" | "in_progress" | "ready_for_review" | "awaiting_approval" | "monitoring" | "resolved" | "dismissed"
export type Priority = "critical" | "high" | "medium" | "low"
export type Card = {
  id: string; number: string; type: string; title: string; status: Status; priority: Priority; exposure: string; currency: string; analysis_status: string; analysis_version: number
  customer: string | null; invoice_number: string | null; assignee: string | null; assignee_id: string | null; approval_status: string | null; created_at: string; updated_at: string
}
export type Finding = { kind: "confirmed" | "calculated" | "possible" | "claim" | "missing"; text: string; cites: string[] }
export type Recommendation = { action: string; label: string; gate: string; amount: string | null; why: string }
export type Detail = Card & {
  invoice_id: string | null; payment_id: string | null; approval_id: string | null; resolution: string | null; dismiss_reason: string | null; priority_overridden: boolean; version: number
  analysis: { version: number; status: string; summary: string; findings: Finding[]; recommendation: Recommendation | null; at: string; stale: boolean } | null
  versions: { version: number; status: string; summary: string; at: string }[]
  events: { kind: string; text: string; at: string; by: string | null }[]
  evidence: { id: string; type: string; ref_id: string | null; label: string; tier: string; at: string }[]
  actions: { action: string; label: string; gate: string }[]
}

const K = ["investigations"] as const
export const useCases = (filter: string, q: string) => useQuery({ queryKey: [...K, "list", filter, q], queryFn: () => request<{ data: Card[] }>("/investigations", { query: { filter, q: q || undefined } }).then((r) => r.data), placeholderData: keepPreviousData })
export const useCase = (id: string) => useQuery({ queryKey: [...K, id], queryFn: () => request<Detail>(`/investigations/${id}`) })

function useCaseMutation<V, R = unknown>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSettled: () => { ["investigations", "approvals", "invoices", "reconciliation", "audit"].forEach((k) => void qc.invalidateQueries({ queryKey: [k] })) } })
}
const post = (id: string, path: string, body?: unknown) => request<Detail>(`/investigations/${id}/${path}`, { method: "POST", body })
export const useMove = () => useCaseMutation((v: { id: string; status?: Status; priority?: Priority; assignee_id?: string; clear_assignee?: boolean; version?: number }) =>
  request<Detail>(`/investigations/${v.id}`, { method: "PATCH", body: { status: v.status, priority: v.priority, assignee_id: v.assignee_id, clear_assignee: v.clear_assignee }, version: v.version }))
export const useNote = () => useCaseMutation((v: { id: string; text: string }) => post(v.id, "notes", { text: v.text }))
export const useAddEvidence = () => useCaseMutation((v: { id: string; type: "document" | "email" | "manual"; label: string; tier: string }) => post(v.id, "evidence", { type: v.type, label: v.label, tier: v.tier }))
export const useRemoveEvidence = () => useCaseMutation((v: { id: string; evidence: string }) => request<Detail>(`/investigations/${v.id}/evidence/${v.evidence}`, { method: "DELETE" }))
export const useRerun = () => useCaseMutation((id: string) => post(id, "analysis"))
export const useAct = () => useCaseMutation((v: { id: string; action: string; amount?: string }) => post(v.id, "actions", { action: v.action, amount: v.amount }))
export const useResolveCase = () => useCaseMutation((v: { id: string; outcome: string }) => post(v.id, "resolve", { outcome: v.outcome }))
export const useDismissCase = () => useCaseMutation((v: { id: string; reason: string }) => post(v.id, "dismiss", { reason: v.reason }))

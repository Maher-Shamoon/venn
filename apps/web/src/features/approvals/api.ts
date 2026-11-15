import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { request } from "@/api/http"
import type { PageOf } from "@/features/ledger/api"

export type AdjType = "write_off" | "credit" | "refund_due"
export type ApprovalStatus = "pending" | "info_requested" | "approved" | "rejected" | "withdrawn" | "expired"
export type Approval = {
  id: string; number: string; type: AdjType; status: ApprovalStatus; amount: string; currency: string; reason: string; invoice_id: string; invoice_number: string; customer: string
  requested_by: string; requested_by_id: string; requested_at: string; expires_at: string; decided_at: string | null; version: number
}
export type ApprovalDetail = Approval & {
  impact: { balance_at_request: string; balance_now: string; balance_after: string; stale: boolean; affects_balance: boolean }
  decisions: { decision: string; comment: string | null; at: string; by: string | null }[]
}
export type Policy = { type: AdjType; auto_approve_below: string; expiry_days: number }

export const TYPE_LABEL: Record<AdjType, string> = { write_off: "Write-off", credit: "Credit", refund_due: "Refund due" }
const K = ["approvals"] as const
export const useApprovals = (tab: string) => useQuery({ queryKey: [...K, "list", tab], queryFn: () => request<PageOf<Approval>>("/approvals", { query: { tab, limit: 100 } }), placeholderData: keepPreviousData })
export const useApproval = (id: string) => useQuery({ queryKey: [...K, id], queryFn: () => request<ApprovalDetail>(`/approvals/${id}`) })
export const usePolicies = () => useQuery({ queryKey: [...K, "policies"], queryFn: () => request<{ data: Policy[] }>("/settings/approval-policies").then((r) => r.data) })

function useApprovalMutation<V, R = unknown>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSettled: () => { ["approvals", "invoices", "payments", "customers", "audit", "dashboard"].forEach((k) => void qc.invalidateQueries({ queryKey: [k] })) } })
}
export const useRequestAdjustment = () => useApprovalMutation((b: { type: AdjType; invoice_id: string; amount: string; reason: string }) => request<ApprovalDetail>("/approvals", { method: "POST", body: b, idempotent: true }))
export const useDecide = () => useApprovalMutation((v: { id: string; decision: "approve" | "reject" | "request_info"; comment?: string; confirm_stale?: boolean }) => request<ApprovalDetail>(`/approvals/${v.id}/decision`, { method: "POST", body: { decision: v.decision, comment: v.comment, confirm_stale: v.confirm_stale ?? false } }))
export const useReply = () => useApprovalMutation((v: { id: string; comment: string }) => request<ApprovalDetail>(`/approvals/${v.id}/reply`, { method: "POST", body: { comment: v.comment } }))
export const useWithdraw = () => useApprovalMutation((id: string) => request<ApprovalDetail>(`/approvals/${id}/withdraw`, { method: "POST" }))
export const useSetPolicy = () => useApprovalMutation((p: Policy) => request("/settings/approval-policies", { method: "PUT", body: p }))

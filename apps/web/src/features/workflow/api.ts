import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { request } from "@/api/http"

export type Notice = { id: string; kind: string; title: string; body: string | null; link: string | null; read: boolean; created_at: string }
export type TaskItem = { id: string; title: string; due_date: string | null; link: string | null; system: boolean; done: boolean; assignee: string | null }
export type Event = { kind: string; text: string; at: string; by: string | null }
export type CaseRow = {
  id: string; number: string; customer_id: string; customer: string; stage: string; next_action_date: string | null; promise_date: string | null; promise_amount: string | null; broken_promise: boolean
  paused_reason: string | null; final_approved: boolean; last_sent_at: string | null; balance: string; overdue_invoices: number; days_late: number; priority: string; version: number; has_email: boolean
}
export type CaseDetail = CaseRow & {
  invoices: { id: string; number: string; total: string; balance: string; currency: string; due_date: string; days_late: number; disputed: boolean }[]
  events: Event[]; priority_note: string; final_approval_id: string | null; contact_email: string | null
}
export type Dispute = {
  id: string; number: string; category: string; amount: string; currency: string; explanation: string; status: string; outcome: string | null; outcome_note: string | null; approval_id: string | null; approval_status: string | null
  due_date: string | null; overdue: boolean; created_at: string; resolved_at: string | null; invoice_id: string; invoice_number: string; customer_id: string; customer: string
}
export type DisputeDetail = Dispute & { events: Event[]; documents: { id: string; filename: string }[] }

export const CATEGORIES: [string, string][] = [["pricing", "Pricing"], ["quantity", "Quantity or hours"], ["quality", "Quality or service"], ["duplicate_billing", "Duplicate billing"], ["missing_po", "Missing PO"], ["not_received", "Goods not received"], ["tax", "Tax"], ["already_paid", "Payment already made"], ["other", "Other"]]

export const useNotifications = (unread = false, enabled = true) => useQuery({ queryKey: ["inbox", "notifications", unread], queryFn: () => request<{ data: Notice[]; total: number; unread: number }>("/notifications", { query: { unread, limit: 50 } }), refetchInterval: 60_000, enabled })
export const useTasks = () => useQuery({ queryKey: ["inbox", "tasks"], queryFn: () => request<{ data: TaskItem[] }>("/tasks").then((r) => r.data) })
export const useCases = (filter: string) => useQuery({ queryKey: ["collections", "list", filter], queryFn: () => request<{ data: CaseRow[] }>("/collections", { query: { filter } }).then((r) => r.data) })
export const useCase = (id: string) => useQuery({ queryKey: ["collections", id], queryFn: () => request<CaseDetail>(`/collections/${id}`) })
export const useDisputes = (filter: string, q: string) => useQuery({ queryKey: ["disputes", "list", filter, q], queryFn: () => request<{ data: Dispute[] }>("/disputes", { query: { filter, q: q || undefined } }).then((r) => r.data) })
export const useDispute = (id: string) => useQuery({ queryKey: ["disputes", id], queryFn: () => request<DisputeDetail>(`/disputes/${id}`) })

function useWorkMutation<V, R = unknown>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSettled: () => { ["inbox", "collections", "disputes", "approvals", "invoices", "dashboard", "audit"].forEach((k) => void qc.invalidateQueries({ queryKey: [k] })) } })
}
export const useMarkRead = () => useWorkMutation((ids?: string[]) => request("/notifications/read", { method: "POST", body: { ids } }))
export const useAddTask = () => useWorkMutation((v: { title: string; due_date?: string }) => request<TaskItem>("/tasks", { method: "POST", body: v }))
export const useToggleTask = () => useWorkMutation((id: string) => request<TaskItem>(`/tasks/${id}/toggle`, { method: "POST" }))
export const useDraft = () => useWorkMutation((v: { id: string; tone: string }) => request<{ subject: string; body: string }>(`/collections/${v.id}/drafts`, { method: "POST", body: { tone: v.tone } }))
export const useSend = () => useWorkMutation((v: { id: string; subject: string; body: string; mode: "email" | "mark_sent" }) => request<CaseDetail>(`/collections/${v.id}/send`, { method: "POST", body: { subject: v.subject, body: v.body, mode: v.mode } }))
export const usePromise = () => useWorkMutation((v: { id: string; promise_date: string; promise_amount: string }) => request<CaseDetail>(`/collections/${v.id}/promise`, { method: "POST", body: { promise_date: v.promise_date, promise_amount: v.promise_amount } }))
export const useCaseNote = () => useWorkMutation((v: { id: string; text: string }) => request<CaseDetail>(`/collections/${v.id}/notes`, { method: "POST", body: { text: v.text } }))
export const useFinalNotice = () => useWorkMutation((id: string) => request<CaseDetail>(`/collections/${id}/final-notice`, { method: "POST" }))
export const useOpenDispute = () => useWorkMutation((v: { invoice_id: string; category: string; amount: string; explanation: string; due_date?: string }) => request<DisputeDetail>("/disputes", { method: "POST", body: v }))
export const useDisputeNote = () => useWorkMutation((v: { id: string; text: string }) => request<DisputeDetail>(`/disputes/${v.id}/notes`, { method: "POST", body: { text: v.text } }))
export const useDisputeStatus = () => useWorkMutation((v: { id: string; status: "open" | "awaiting_customer" }) => request<DisputeDetail>(`/disputes/${v.id}/status`, { method: "POST", body: { status: v.status } }))
export const useResolveDispute = () => useWorkMutation((v: { id: string; outcome: string; note: string; credit_amount?: string }) => request<DisputeDetail>(`/disputes/${v.id}/resolve`, { method: "POST", body: { outcome: v.outcome, note: v.note, credit_amount: v.credit_amount } }))

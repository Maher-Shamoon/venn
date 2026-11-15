import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { downloadFile, request } from "@/api/http"
import type { Range } from "@/components/app/ranges"

export type Aging = { bucket: string; amount: string; count: number }
export type TrendPoint = { date: string; label: string; total: string; overdue: string }
export type OwnerDashboard = {
  range: string; currency: string; has_data: boolean
  kpis: { total_ar: string; open_invoices: number; overdue: string; overdue_invoices: number; unmatched: string; unmatched_payments: number; open_exposure: string; open_investigations: number; other_currencies: number; recovered: string; total_ar_change: string }
  aging: Aging[]; trend: TrendPoint[]
  approvals: { id: string; number: string; type: string; amount: string; currency: string; customer: string; requested_by: string }[]
  investigations_by_status: Record<string, number>
  top_exposure: { id: string; number: string; title: string; exposure: string; currency: string; priority: string }[]
  overdue_by_customer: { customer_id: string; customer: string; invoices: number; amount: string; oldest_days: number }[]
  activity: { action: string; at: string; by: string | null }[]
  setup: { customers: boolean; invoices: boolean; payments: boolean; reconciliation: boolean; team: boolean }
}
export type ArDashboard = {
  currency: string
  needs_review: { count: number; items: { id: string; rule: string; payment: string; amount: string; currency: string; payer: string | null }[] }
  my_investigations: { id: string; number: string; title: string; exposure: string; currency: string; status: string; priority: string }[]
  unmatched: { id: string; number: string; payer: string | null; amount: string; currency: string; date: string }[]
  attention: { id: string; number: string; customer: string; balance: string; currency: string; days_late: number }[]
  my_requests: { id: string; number: string; type: string; amount: string; currency: string; status: string }[]
  last_run: { at: string; counts: Record<string, number> } | null
  kpis: { overdue: string; overdue_invoices: number; unmatched_payments: number }
}
export type ReportInfo = { slug: string; title: string; kind: string; definition: string }
export type ReportData = { slug: string; title: string; definition: string; range: string; currency: string; columns: { key: string; label: string; money?: boolean; right?: boolean }[]; rows: Record<string, string | number>[]; total?: string }

export const rangeKey = (r: Range) => r.toLowerCase()
export const useOwnerDashboard = (r: Range) => useQuery({ queryKey: ["dashboard", "owner", r], queryFn: () => request<OwnerDashboard>("/dashboard/owner", { query: { range: rangeKey(r) } }), placeholderData: keepPreviousData })
export const useArDashboard = () => useQuery({ queryKey: ["dashboard", "ar"], queryFn: () => request<ArDashboard>("/dashboard/ar") })
export const useReports = () => useQuery({ queryKey: ["reports", "list"], queryFn: () => request<{ data: ReportInfo[] }>("/reports").then((r) => r.data) })
export const useReport = (slug: string, r: Range, customer: string) => useQuery({ queryKey: ["reports", slug, r, customer], queryFn: () => request<ReportData>(`/reports/${slug}`, { query: { range: rangeKey(r), customer_id: customer || undefined } }), placeholderData: keepPreviousData })
export const exportReport = (slug: string, r: Range, customer: string) => downloadFile(`/reports/${slug}.csv?range=${rangeKey(r)}${customer ? `&customer_id=${customer}` : ""}`, `${slug}-${rangeKey(r)}.csv`)

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { request } from "@/api/http"
import type { components } from "@/types/api"

type S = components["schemas"]
export type Customer = S["CustomerOut"]
export type Invoice = S["InvoiceOut"]
export type InvoiceDetail = S["InvoiceDetail"]
export type Payment = S["PaymentOut"]
export type PaymentDetail = S["PaymentDetail"]
export type Allocation = S["AllocationOut"]
export type CustomerInput = S["CustomerIn"]
export type InvoiceInput = S["InvoiceIn"]
export type PageOf<T> = { data: T[]; total: number; page: number; limit: number }
export type ListParams = { q?: string; sort?: string; desc?: boolean; page?: number; limit?: number; [k: string]: string | number | boolean | undefined }

/** One key per resource: a mutation invalidates the lists and the details it can change. */
export const lk = {
  customers: ["customers"] as const, invoices: ["invoices"] as const, payments: ["payments"] as const,
}

const list = <T>(path: string, p: ListParams) => request<PageOf<T>>(path, { query: p })

export const useCustomers = (p: ListParams) => useQuery({ queryKey: [...lk.customers, "list", p], queryFn: () => list<Customer>("/customers", p), placeholderData: keepPreviousData })
export const useCustomer = (id: string) => useQuery({ queryKey: [...lk.customers, id], queryFn: () => request<Customer>(`/customers/${id}`) })
export const useInvoices = (p: ListParams) => useQuery({ queryKey: [...lk.invoices, "list", p], queryFn: () => list<Invoice>("/invoices", p), placeholderData: keepPreviousData })
export const useInvoice = (id: string) => useQuery({ queryKey: [...lk.invoices, id], queryFn: () => request<InvoiceDetail>(`/invoices/${id}`) })
export const usePayments = (p: ListParams) => useQuery({ queryKey: [...lk.payments, "list", p], queryFn: () => list<Payment>("/payments", p), placeholderData: keepPreviousData })
export const usePayment = (id: string) => useQuery({ queryKey: [...lk.payments, id], queryFn: () => request<PaymentDetail>(`/payments/${id}`) })

/** Anything that moves money touches all three resources, plus the audit log and dashboards. */
function useLedgerMutation<V, R = unknown>(fn: (v: V) => Promise<R>, extra: readonly (readonly string[])[] = []) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { [lk.customers, lk.invoices, lk.payments, ["audit"], ["dashboard"], ...extra].forEach((k) => void qc.invalidateQueries({ queryKey: k })) },
  })
}

export const useCreateCustomer = () => useLedgerMutation((b: CustomerInput) => request<Customer>("/customers", { method: "POST", body: b, idempotent: true }))
export const useUpdateCustomer = () => useLedgerMutation((v: { id: string; version: number; body: Partial<CustomerInput> }) => request<Customer>(`/customers/${v.id}`, { method: "PATCH", body: v.body, version: v.version }))
export const useCreateInvoice = () => useLedgerMutation((b: InvoiceInput) => request<InvoiceDetail>("/invoices", { method: "POST", body: b, idempotent: true }))
export const useCancelInvoice = () => useLedgerMutation((v: { id: string; reason: string }) => request<InvoiceDetail>(`/invoices/${v.id}/cancel`, { method: "POST", body: { reason: v.reason } }))
export const useRecordPayment = () => useLedgerMutation((v: { invoiceId: string; amount: string; method?: string; reference?: string }) => request<PaymentDetail>(`/invoices/${v.invoiceId}/payments`, { method: "POST", body: { amount: v.amount, method: v.method, reference: v.reference }, idempotent: true }))
export const useCreatePayment = () => useLedgerMutation((b: S["PaymentIn"]) => request<PaymentDetail>("/payments", { method: "POST", body: b, idempotent: true }))
export const useAllocate = () => useLedgerMutation((v: { paymentId: string; invoiceId: string; amount: string }) => request<PaymentDetail>(`/payments/${v.paymentId}/allocations`, { method: "POST", body: { invoice_id: v.invoiceId, amount: v.amount }, idempotent: true }))
export const useVoidAllocation = () => useLedgerMutation((v: { id: string; reason: string }) => request<PaymentDetail>(`/allocations/${v.id}/void`, { method: "POST", body: { reason: v.reason } }))
export const useReversePayment = () => useLedgerMutation((v: { id: string; reason: string }) => request<PaymentDetail>(`/payments/${v.id}/reverse`, { method: "POST", body: { reason: v.reason } }))
export const useReviewPayment = () => useLedgerMutation((v: { id: string; under_review: boolean }) => request<PaymentDetail>(`/payments/${v.id}/review`, { method: "POST", body: { under_review: v.under_review } }))

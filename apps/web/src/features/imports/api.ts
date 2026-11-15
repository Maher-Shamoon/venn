import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { downloadFile, request } from "@/api/http"
import { lk } from "@/features/ledger/api"

export type Kind = "invoices" | "payments"
export type Counts = { total: number; valid: number; warning: number; error: number; duplicate: number; ambiguous_dates: number }
export type ImportJob = { id: string; kind: Kind; filename: string; status: "validated" | "committed" | "discarded"; headers: string[]; mapping: Record<string, string>; date_format: string; counts: Counts; missing: string[]; targets: string[]; required: string[] }
export type ImportRow = { row_number: number; class: "valid" | "warning" | "error" | "duplicate"; messages: string[]; raw: Record<string, string> }
export type CommitResult = { created: number; skipped_duplicates: number; errors: number; customers_created?: number }

export const useImportRows = (id: string | undefined, cls: string, page: number) =>
  useQuery({ queryKey: ["imports", id, "rows", cls, page], enabled: !!id, queryFn: () => request<{ data: ImportRow[]; total: number }>(`/imports/${id}/rows`, { query: { cls, page, limit: 10 } }), meta: { silent: true } })

export const useUpload = () => useMutation({
  mutationFn: ({ kind, file, dateFormat }: { kind: Kind; file: File; dateFormat?: string }) => {
    const body = new FormData()
    body.set("kind", kind)
    body.set("file", file)
    if (dateFormat) body.set("date_format", dateFormat)
    return request<ImportJob>("/imports", { method: "POST", body })
  },
})

export const useRemap = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; mapping?: Record<string, string>; date_format?: string }) => request<ImportJob>(`/imports/${v.id}/mapping`, { method: "POST", body: { mapping: v.mapping, date_format: v.date_format } }),
    onSuccess: (_d, v) => void qc.invalidateQueries({ queryKey: ["imports", v.id] }),
  })
}

export const useCommit = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => request<CommitResult>(`/imports/${id}/commit`, { method: "POST" }),
    onSuccess: () => { [lk.customers, lk.invoices, lk.payments, ["audit"], ["dashboard"]].forEach((k) => void qc.invalidateQueries({ queryKey: k })) },
  })
}

export const useDiscard = () => useMutation({ mutationFn: (id: string) => request<void>(`/imports/${id}/discard`, { method: "POST" }) })

/** Downloads the rows that were not imported, with the reason, as a CSV. */
export const downloadProblems = (id: string) => downloadFile(`/imports/${id}/problems.csv`, "problem-rows.csv")

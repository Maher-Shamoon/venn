import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { downloadFile, request } from "@/api/http"
import type { PageOf } from "@/features/ledger/api"

export type Doc = { id: string; filename: string; content_type: string; size_bytes: number; extraction: "done" | "none" | "failed"; extraction_note: string | null; page_count: number | null; uploaded_by: string | null; created_at: string }
export type DocDetail = Doc & { text_preview: string; linked_cases: { id: string; number: string; title: string }[] }

const K = ["documents"] as const
export const useDocuments = (q: string, page: number) => useQuery({ queryKey: [...K, "list", q, page], queryFn: () => request<PageOf<Doc>>("/documents", { query: { q: q || undefined, page, limit: 25 } }), placeholderData: keepPreviousData })
export const useDocument = (id: string | null) => useQuery({ queryKey: [...K, id], queryFn: () => request<DocDetail>(`/documents/${id}`), enabled: !!id })

export const useUploadDocument = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { file: File; investigationId?: string }) => {
      const body = new FormData()
      body.set("file", v.file)
      return request<Doc & { linked?: boolean }>("/documents", { method: "POST", body, query: { investigation_id: v.investigationId } })
    },
    onSettled: () => { ["documents", "investigations", "audit"].forEach((k) => void qc.invalidateQueries({ queryKey: [k] })) },
  })
}
export const useDeleteDocument = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => request(`/documents/${id}`, { method: "DELETE" }), onSettled: () => { ["documents", "audit"].forEach((k) => void qc.invalidateQueries({ queryKey: [k] })) } })
}
export const downloadDocument = (d: Doc) => downloadFile(`/documents/${d.id}/download`, d.filename)
export const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

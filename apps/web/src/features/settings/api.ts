import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { request } from "@/api/http"

export type Company = { name: string; legal_name: string | null; website: string | null; industry: string; company_size: string; country: string }
export type Financial = { default_currency: string; timezone: string; default_terms_days: number; auto_apply_exact: boolean; short_grace_days: number; claim_grace_days: number; ai_enabled: boolean }
export type OrgSettings = { company: Company; financial: Financial; version: number }

export const settingsKey = ["settings"] as const
export const useOrgSettings = () => useQuery({ queryKey: settingsKey, queryFn: () => request<OrgSettings>("/settings"), meta: { silent: true } })

function useSave<T>(section: "company" | "financial") {
  const qc = useQueryClient()
  return useMutation({
    // If-Match carries the version we read: a concurrent change comes back as 409 instead of silently winning.
    mutationFn: ({ body, version }: { body: Partial<T>; version: number }) => request<OrgSettings>(`/settings/${section}`, { method: "PATCH", body, version }),
    onSuccess: (data) => {
      qc.setQueryData(settingsKey, data)
      void qc.invalidateQueries({ queryKey: ["audit"] })
    },
  })
}
export const useSaveCompany = () => useSave<Company>("company")
export const useSaveFinancial = () => useSave<Financial>("financial")

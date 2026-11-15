import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { request } from "@/api/http"

export type Integration = { provider: "stripe" | "gmail" | "quickbooks"; name: string; available: boolean; connected: boolean; status: string; account: string | null; connected_at: string | null; last_sync_at: string | null; last_error: string | null }
export type Mail = { id: string; subject: string; from: string; date: string; snippet: string }

export const useIntegrations = (enabled = true) => useQuery({ queryKey: ["integrations"], queryFn: () => request<{ data: Integration[] }>("/integrations").then((r) => r.data), enabled })
function useIntMutation<V, R = unknown>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSettled: () => { ["integrations", "payments", "dashboard", "audit"].forEach((k) => void qc.invalidateQueries({ queryKey: [k] })) } })
}
export const useConnectStripe = () => useIntMutation((key: string) => request("/integrations/stripe/connect", { method: "POST", body: { key } }))
export const useSyncStripe = () => useIntMutation(() => request<{ seen: number; new: number; skipped: number; already_here: number }>("/integrations/stripe/sync", { method: "POST" }))
export const useDisconnect = () => useIntMutation((p: string) => request(`/integrations/${p}`, { method: "DELETE" }))
export const useSyncQbo = () => useIntMutation(() => request<{ seen: number; new: number; updated: number; skipped: number }>("/integrations/quickbooks/sync", { method: "POST" }))
export const startQbo = () => request<{ url: string }>("/integrations/quickbooks/start").then((r) => r.url)
export const startGmail = () => request<{ url: string }>("/integrations/gmail/start").then((r) => r.url)
export const useCaseEmails = () => useMutation({ mutationFn: (id: string) => request<{ data: Mail[] }>(`/investigations/${id}/emails`).then((r) => r.data) })

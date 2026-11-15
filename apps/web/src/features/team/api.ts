import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { request } from "@/api/http"

export type Member = { id: string; user_id: string; full_name: string; email: string; role_key: string; role_name: string; status: string; joined_at: string }
export type Invitation = { id: string; email: string; role_key: string; status: string; expires_at: string; last_sent_at: string; send_count: number }
export type PermRow = { key: string; granted: boolean; locked: boolean; reason: string | null }

export const teamKeys = { members: ["team", "members"] as const, invitations: ["team", "invitations"] as const, perms: ["team", "ar-permissions"] as const }

export const useMembers = () => useQuery({ queryKey: teamKeys.members, queryFn: () => request<{ data: Member[] }>("/members").then((r) => r.data) })
export const useInvitations = () => useQuery({ queryKey: teamKeys.invitations, queryFn: () => request<{ data: Invitation[] }>("/members/invitations").then((r) => r.data) })
export const useArPermissions = () => useQuery({ queryKey: teamKeys.perms, queryFn: () => request<{ data: PermRow[] }>("/roles/ar/permissions").then((r) => r.data) })

/** Every mutation refreshes what it changed, and the audit log. */
function useTeamMutation<V>(fn: (v: V) => Promise<unknown>, keys: readonly (readonly string[])[]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      keys.forEach((k) => void qc.invalidateQueries({ queryKey: k }))
      void qc.invalidateQueries({ queryKey: ["audit"] })
    },
  })
}
export const useInvite = () => useTeamMutation((v: { email: string; role_key: string }) => request("/members/invitations", { method: "POST", body: v, idempotent: true }), [teamKeys.invitations])
export const useResend = () => useTeamMutation((id: string) => request(`/members/invitations/${id}/resend`, { method: "POST", idempotent: true }), [teamKeys.invitations])
export const useRevoke = () => useTeamMutation((id: string) => request(`/members/invitations/${id}`, { method: "DELETE" }), [teamKeys.invitations])
export const useChangeMember = () => useTeamMutation((v: { id: string; role_key?: string; status?: string }) => request(`/members/${v.id}`, { method: "PATCH", body: { role_key: v.role_key, status: v.status } }), [teamKeys.members])
export const useSetArPermissions = () => useTeamMutation((permissions: string[]) => request("/roles/ar/permissions", { method: "PUT", body: { permissions } }), [teamKeys.perms])

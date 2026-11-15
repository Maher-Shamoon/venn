import { request } from "@/api/http"

export type Membership = { organization_id: string; organization_name: string; role_key: string; role_name: string; status: string }
export type Me = { id: string; email: string; email_verified: boolean; full_name: string; memberships: Membership[] }
export type OrgContext = { organization_id: string; role_key: string; permissions: string[] }

const ORG_KEY = "venn.org"
/** The organization the user is working in. Sent as X-Organization-Id; the server verifies membership on every request. */
export const activeOrg = () => localStorage.getItem(ORG_KEY)
export const setActiveOrg = (id: string | null) => (id ? localStorage.setItem(ORG_KEY, id) : localStorage.removeItem(ORG_KEY))

export const fetchMe = () => request<Me>("/me")
export const fetchContext = () => request<OrgContext>("/me/context")
export const createOrganization = (body: { name: string; industry?: string; company_size?: string; website?: string }) =>
  request<{ id: string; name: string }>("/organizations", { method: "POST", body })

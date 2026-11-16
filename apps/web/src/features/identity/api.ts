import { request } from "@/api/http"
import { config } from "@/config"

export type Membership = { organization_id: string; organization_name: string; role_key: string; role_name: string; status: string }
export type Me = { id: string; email: string; email_verified: boolean; full_name: string; memberships: Membership[] }
export type OrgContext = { organization_id: string; role_key: string; permissions: string[] }

const ORG_KEY = "venn.org"
/** The organization the user is working in. Sent as X-Organization-Id; the server verifies membership on every request. */
const DEMO_KEY = "venn.demo"
/** "See a demo" opens the sample workspace for this tab only; nobody's real organization is read or changed while it is open. */
export const inDemo = () => sessionStorage.getItem(DEMO_KEY) === "1"
export const startDemo = () => sessionStorage.setItem(DEMO_KEY, "1")
export const activeOrg = () => (inDemo() ? null : localStorage.getItem(ORG_KEY))
/** Choosing a real organization (signing in, creating one) ends any demo. */
export const setActiveOrg = (id: string | null) => { if (id) { sessionStorage.removeItem(DEMO_KEY); localStorage.setItem(ORG_KEY, id) } else localStorage.removeItem(ORG_KEY) }
export const endDemo = () => sessionStorage.removeItem(DEMO_KEY)

export const fetchMe = () => request<Me>("/me")
export const fetchContext = () => request<OrgContext>("/me/context")
export const createOrganization = (body: { name: string; industry?: string; company_size?: string; website?: string }) =>
  request<{ id: string; name: string }>("/organizations", { method: "POST", body })

/** True when this person works in a real organization: screens read the API. Sandbox and sample workspaces stay local. */
export const remote = () => config.authSource === "supabase" && !!activeOrg()

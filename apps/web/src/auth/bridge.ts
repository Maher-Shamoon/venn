import { bindSession } from "@/api/http"
import { A, getState } from "@/components/app/store"
import { config } from "@/config"
import { supabase } from "./supabaseAuth"

let token: string | null = null

/**
 * Connects Supabase sessions to the app: the API client gets the access token, and the interface store learns who is signed in.
 * Until each module reads from the API, a different person signing in starts from an empty workspace instead of someone else's data.
 */
export function startAuthBridge() {
  if (config.authSource !== "supabase") return
  let open: () => void = () => {}
  const ready = new Promise<void>((r) => { open = r; setTimeout(r, 4000) }) // never hold requests for long if the first auth event is lost
  bindSession({ token: () => token, org: () => localStorage.getItem("venn.org"), ready })
  supabase().auth.onAuthStateChange((event, session) => {
    open()
    token = session?.access_token ?? null
    const u = session?.user
    if (u?.email && u.email_confirmed_at) {
      const name = String(u.user_metadata?.full_name ?? u.email)
      if (getState().session?.email !== u.email) A.startFresh(name, u.email)
    } else if (event === "SIGNED_OUT") A.signOut()
  })
}

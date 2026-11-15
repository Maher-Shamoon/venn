import { createClient, type AuthError as SbError, type SupabaseClient } from "@supabase/supabase-js"
import { config } from "@/config"
import { AuthError } from "./localAuth"

let client: SupabaseClient | null = null
/** One client per page. Sessions live in Supabase's own storage; the API receives the access token as a bearer. */
export const supabase = (): SupabaseClient => (client ??= createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }))

/** Maps Supabase errors to the same plain messages the local service uses. Unknown accounts and wrong passwords look identical. */
export function toAuthError(e: SbError): AuthError {
  const code = e.code ?? ""
  if (code === "invalid_credentials" || code === "user_not_found") return new AuthError("invalid_credentials", "The email or password is incorrect.")
  if (code === "email_not_confirmed") return new AuthError("invalid_credentials", "Verify your email address first. Check your inbox for the link.")
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || e.status === 429) return new AuthError("locked", "Too many attempts. Try again in a few minutes.")
  if (code === "weak_password") return new AuthError("invalid_credentials", "Choose a stronger password.")
  if (code === "same_password") return new AuthError("invalid_credentials", "Choose a password you have not used before.")
  return new AuthError("invalid_credentials", "Something went wrong. Try again.")
}

export type Account = { name: string; email: string }
const nameOf = (u: { email?: string; user_metadata?: Record<string, unknown> }) => String(u.user_metadata?.full_name ?? u.email ?? "")

export async function signUp(name: string, email: string, password: string): Promise<Account & { needsVerification: boolean }> {
  const { data, error } = await supabase().auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: `${location.origin}/onboarding/organization` } })
  if (error) throw toAuthError(error)
  // Supabase answers the same way for an address that already exists (no account enumeration), so never say "already registered".
  return { name, email, needsVerification: !data.session }
}

export async function signIn(email: string, password: string): Promise<Account> {
  const { data, error } = await supabase().auth.signInWithPassword({ email, password })
  if (error) throw toAuthError(error)
  return { name: nameOf(data.user), email: data.user.email ?? email }
}

export const signOut = async () => { await supabase().auth.signOut({ scope: "local" }) }
export const resendVerification = async (email: string) => {
  const { error } = await supabase().auth.resend({ type: "signup", email, options: { emailRedirectTo: `${location.origin}/onboarding/organization` } })
  if (error) throw toAuthError(error)
}
export const requestReset = async (email: string) => {
  // The result is ignored on purpose: the page always says "if an account exists".
  await supabase().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset-password` })
}
export const completeReset = async (password: string) => {
  const { error } = await supabase().auth.updateUser({ password })
  if (error) throw toAuthError(error)
  await supabase().auth.signOut({ scope: "others" })
  await supabase().auth.signOut({ scope: "local" })
}
/** True once Supabase has turned the emailed recovery link into a session. */
export const hasRecoverySession = async () => !!(await supabase().auth.getSession()).data.session
export const accessToken = async () => (await supabase().auth.getSession()).data.session?.access_token ?? null

export type SessionEvent = { signedIn: Account | null; signedOut: boolean }
export function onAuthChange(cb: (e: SessionEvent) => void): () => void {
  const { data } = supabase().auth.onAuthStateChange((event, session) => {
    if (session?.user) cb({ signedIn: { name: nameOf(session.user), email: session.user.email ?? "" }, signedOut: false })
    else if (event === "SIGNED_OUT") cb({ signedIn: null, signedOut: true })
  })
  return () => data.subscription.unsubscribe()
}

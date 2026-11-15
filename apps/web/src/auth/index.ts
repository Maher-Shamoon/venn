import { useEffect, useState } from "react"
import { config } from "@/config"
import * as local from "./localAuth"
import * as sb from "./supabaseAuth"

/** One call surface for sign-up, sign-in and reset. Real accounts when Supabase is configured, browser-only accounts otherwise. */
export { AuthError } from "./localAuth"
export type { Account } from "./supabaseAuth"

const real = config.authSource === "supabase"

export const signUp = async (name: string, email: string, password: string) =>
  real ? sb.signUp(name, email, password) : { ...(await local.register(name, email, password)), needsVerification: false }
export const signIn = (email: string, password: string) => (real ? sb.signIn(email, password) : local.verify(email, password))
export const signOut = async () => { localStorage.removeItem("venn.org"); if (real) await sb.signOut() }
export const resendVerification = (email: string) => (real ? sb.resendVerification(email) : Promise.resolve())
export const requestReset = async (email: string) => { if (real) await sb.requestReset(email); else local.requestReset(email) }
export const completeReset = (password: string) => (real ? sb.completeReset(password) : local.completeReset(password))

/** undefined while checking, then whether this page was opened from a valid reset link. */
export function useResetReady(): boolean | undefined {
  const [ok, setOk] = useState<boolean | undefined>(real ? undefined : local.hasPendingReset())
  useEffect(() => { if (real) void sb.hasRecoverySession().then(setOk) }, [])
  return ok
}

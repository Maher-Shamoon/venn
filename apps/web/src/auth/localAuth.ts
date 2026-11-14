/** Browser-only accounts used until the real auth service exists. Same call shapes the API-backed version will use. */
export class AuthError extends Error {
  code: "invalid_credentials" | "email_taken" | "locked" | "invalid_reset"
  constructor(code: AuthError["code"], message: string) { super(message); this.name = "AuthError"; this.code = code }
}
type Account = { name: string; salt: string; hash: string }
const KEY = "venn.auth.v1", RESET = "venn.auth.reset"
export const MAX_ATTEMPTS = 5, LOCK_MS = 15 * 60_000

const read = (): Record<string, Account> => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") } catch { return {} } }
const write = (a: Record<string, Account>) => { try { localStorage.setItem(KEY, JSON.stringify(a)) } catch { /* storage blocked */ } }
const norm = (e: string) => e.trim().toLowerCase()
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("")

async function derive(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"])
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 100_000 }, key, 256))
}

const fails = new Map<string, { n: number; at: number }>()
const locked = (email: string, now: number) => { const f = fails.get(email); return !!f && f.n >= MAX_ATTEMPTS && now - f.at < LOCK_MS }

export async function register(name: string, email: string, password: string) {
  const e = norm(email), all = read()
  if (all[e]) throw new AuthError("email_taken", "An account with that email already exists. Sign in instead.")
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer)
  all[e] = { name, salt, hash: await derive(password, salt) }
  write(all)
  return { name, email: e }
}

export async function verify(email: string, password: string, now = Date.now()) {
  const e = norm(email)
  if (locked(e, now)) throw new AuthError("locked", "Too many attempts. Try again in 15 minutes.")
  const a = read()[e]
  // Derive even for unknown emails so response time does not reveal whether an account exists.
  const ok = a ? (await derive(password, a.salt)) === a.hash : (await derive(password, "x"), false)
  if (!ok) { const f = fails.get(e); fails.set(e, { n: (f && now - f.at < LOCK_MS ? f.n : 0) + 1, at: now }); throw new AuthError("invalid_credentials", "The email or password is incorrect.") }
  fails.delete(e)
  return { name: a.name, email: e }
}

export const accountExists = (email: string) => !!read()[norm(email)]

/** Starts a reset for an existing account. Returns whether one existed; callers must not reveal that to the user. */
export function requestReset(email: string, now = Date.now()) {
  const e = norm(email), ok = accountExists(e)
  try { if (ok) localStorage.setItem(RESET, JSON.stringify({ email: e, exp: now + 30 * 60_000 })) } catch { /* storage blocked */ }
  return ok
}
export const hasPendingReset = (now = Date.now()) => { try { const r = JSON.parse(localStorage.getItem(RESET) ?? "null"); return !!r && r.exp > now } catch { return false } }

export async function completeReset(password: string, now = Date.now()) {
  let r: { email: string; exp: number } | null = null
  try { r = JSON.parse(localStorage.getItem(RESET) ?? "null") } catch { /* ignore */ }
  const all = read()
  if (!r || r.exp <= now || !all[r.email]) throw new AuthError("invalid_reset", "This reset link is invalid or has expired.")
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer)
  all[r.email] = { ...all[r.email], salt, hash: await derive(password, salt) }
  write(all)
  fails.delete(r.email)
  try { localStorage.removeItem(RESET) } catch { /* ignore */ }
}

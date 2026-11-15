import { config } from "@/config"
import { ApiError, toApiError } from "./errors"

type Session = { token: () => string | null; org: () => string | null }
let session: Session = { token: () => null, org: () => null }
/** The auth layer registers how to read the access token and active organization. */
export const bindSession = (s: Session) => { session = s }

export type Page<T> = { data: T[]; meta: { next_cursor?: string; has_more: boolean; total?: number } }
type Opts = { method?: string; body?: unknown; query?: Record<string, string | number | boolean | undefined>; idempotent?: boolean; version?: number | string; signal?: AbortSignal }

const qs = (q: Opts["query"]) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(q ?? {})) if (v !== undefined && v !== "") p.set(k, String(v))
  const s = p.toString()
  return s ? "?" + s : ""
}

/** Sends one request following the API conventions: bearer token, tenant header, idempotency key, optimistic concurrency. */
export async function request<T>(path: string, o: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" }
  const token = session.token(), org = session.org()
  if (token) headers.Authorization = `Bearer ${token}`
  if (org) headers["X-Organization-Id"] = org
  const form = typeof FormData !== "undefined" && o.body instanceof FormData
  // Uploads are sent as multipart: the browser must set the boundary itself, so no Content-Type here.
  if (o.body !== undefined && !form) headers["Content-Type"] = "application/json"
  if (o.idempotent) headers["Idempotency-Key"] = crypto.randomUUID()
  if (o.version !== undefined) headers["If-Match"] = String(o.version)
  const res = await fetch(config.apiBase + path + qs(o.query), { method: o.method ?? "GET", headers, body: o.body === undefined ? undefined : form ? (o.body as FormData) : JSON.stringify(o.body), signal: o.signal })
  if (!res.ok) throw await toApiError(res)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

/** Fetches a file from the API (authenticated) and saves it through the browser. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const headers: Record<string, string> = {}
  const token = session.token(), org = session.org()
  if (token) headers.Authorization = `Bearer ${token}`
  if (org) headers["X-Organization-Id"] = org
  const res = await fetch(config.apiBase + path, { headers })
  if (!res.ok) throw await toApiError(res)
  const url = URL.createObjectURL(await res.blob())
  Object.assign(document.createElement("a"), { href: url, download: filename }).click()
  URL.revokeObjectURL(url)
}

export const api = {
  get: <T>(path: string, query?: Opts["query"], signal?: AbortSignal) => request<{ data: T }>(path, { query, signal }).then((r) => r.data),
  list: <T>(path: string, query?: Opts["query"], signal?: AbortSignal) => request<Page<T>>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<{ data: T }>(path, { method: "POST", body, idempotent: true }).then((r) => r.data),
  patch: <T>(path: string, body: unknown, version: number | string) => request<{ data: T }>(path, { method: "PATCH", body, version }).then((r) => r.data),
  del: (path: string) => request<void>(path, { method: "DELETE" }),
}

/** Walks every page of a list endpoint. Use sparingly; prefer cursor-driven UI. */
export async function* paginate<T>(path: string, query: Opts["query"] = {}) {
  let cursor: string | undefined
  do {
    const page = await api.list<T>(path, { ...query, cursor, limit: 100 })
    yield* page.data
    cursor = page.meta.has_more ? page.meta.next_cursor : undefined
  } while (cursor)
}

export { ApiError }

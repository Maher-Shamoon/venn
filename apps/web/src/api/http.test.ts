import { afterEach, describe, expect, it, vi } from "vitest"
import { api, ApiError, bindSession, paginate } from "./http"

const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
afterEach(() => vi.restoreAllMocks())

describe("http client", () => {
  it("sends the token and tenant headers and unwraps data", async () => {
    bindSession({ token: () => "t0k", org: () => "org-1" })
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok({ data: { id: 1 } }))
    expect(await api.get("/invoices/1")).toEqual({ id: 1 })
    const [url, init] = f.mock.calls[0]
    expect(url).toBe("/api/v1/invoices/1")
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer t0k")
    expect((init!.headers as Record<string, string>)["X-Organization-Id"]).toBe("org-1")
  })
  it("adds an idempotency key to posts and If-Match to patches", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockImplementation(async () => ok({ data: {} }))
    await api.post("/allocations", { amount: "10.00" })
    await api.patch("/invoices/1", { po: "x" }, 3)
    expect((f.mock.calls[0][1]!.headers as Record<string, string>)["Idempotency-Key"]).toMatch(/[0-9a-f-]{36}/)
    expect((f.mock.calls[1][1]!.headers as Record<string, string>)["If-Match"]).toBe("3")
  })
  it("turns problem+json into an ApiError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(ok({ code: "version_conflict", detail: "stale", request_id: "req_1" }, 409))
    const e = await api.get("/x").catch((x) => x)
    expect(e).toBeInstanceOf(ApiError)
    expect(e).toMatchObject({ status: 409, code: "version_conflict", requestId: "req_1", isConflict: true })
  })
  it("survives a non-JSON error body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>", { status: 502 }))
    expect(await api.get("/x").catch((x) => x)).toMatchObject({ status: 502, code: "internal_error" })
  })
  it("walks every page by cursor", async () => {
    const f = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(ok({ data: [1, 2], meta: { has_more: true, next_cursor: "c2" } }))
      .mockResolvedValueOnce(ok({ data: [3], meta: { has_more: false } }))
    const got: number[] = []
    for await (const n of paginate<number>("/invoices")) got.push(n)
    expect(got).toEqual([1, 2, 3])
    expect(String(f.mock.calls[1][0])).toContain("cursor=c2")
  })
})

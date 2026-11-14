// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { makeQueryClient } from "@/lib/query"
import { http, HttpResponse, server } from "@/test/server"
import { useHealth } from "./api"

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>

describe("useHealth", () => {
  it("loads from the API", async () => {
    const { result } = renderHook(() => useHealth(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ status: "ok" })
  })
  it("surfaces a problem+json error with its code and request id", async () => {
    server.use(http.get("*/api/v1/health", () => HttpResponse.json({ code: "internal_error", detail: "boom", request_id: "req_1" }, { status: 500 })))
    const { result } = renderHook(() => useHealth(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 })
    expect(result.current.error).toMatchObject({ status: 500, code: "internal_error", requestId: "req_1" })
  })
})

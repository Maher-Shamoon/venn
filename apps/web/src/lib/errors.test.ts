import { beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/api/errors"
import { errorMessage, toastApiError } from "./errors"

const toast = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock("sonner", () => ({ toast }))
beforeEach(() => toast.error.mockClear())

describe("API error messages", () => {
  it("explains auth, permission, conflict and server errors in plain words", () => {
    expect(errorMessage(new ApiError(401, "token_expired", "x"))).toMatch(/Sign in again/)
    expect(errorMessage(new ApiError(403, "permission_denied", "x"))).toMatch(/permission/)
    expect(errorMessage(new ApiError(409, "version_conflict", "x"))).toMatch(/Someone else/)
    expect(errorMessage(new ApiError(500, "internal_error", "stack trace"))).not.toMatch(/stack/)
  })
  it("passes validation messages through", () => {
    expect(errorMessage(new ApiError(422, "validation_error", "amount must be greater than 0"))).toBe("amount must be greater than 0")
  })
  it("shows the request id as a reference", () => {
    toastApiError(new ApiError(500, "internal_error", "x", [], "req_abc"))
    expect(toast.error).toHaveBeenCalledWith(expect.any(String), { description: "Reference req_abc" })
  })
  it("handles non-API errors", () => {
    toastApiError(new TypeError("Failed to fetch"))
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/connection/), undefined)
  })
})

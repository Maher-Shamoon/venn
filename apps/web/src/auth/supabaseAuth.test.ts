import { describe, expect, it } from "vitest"
import { toAuthError } from "./supabaseAuth"

const err = (code: string, status = 400) => ({ code, status, name: "AuthApiError", message: code }) as never

describe("Supabase error mapping", () => {
  it("makes wrong password and unknown account identical", () => {
    expect(toAuthError(err("invalid_credentials")).message).toBe(toAuthError(err("user_not_found")).message)
  })
  it("asks for verification without revealing anything else", () => {
    expect(toAuthError(err("email_not_confirmed")).message).toMatch(/Verify your email/)
  })
  it("reports rate limits as too many attempts", () => {
    expect(toAuthError(err("over_request_rate_limit", 429)).code).toBe("locked")
    expect(toAuthError(err("anything", 429)).code).toBe("locked")
  })
  it("never leaks unknown server messages", () => {
    expect(toAuthError(err("some_internal_thing")).message).toBe("Something went wrong. Try again.")
  })
})

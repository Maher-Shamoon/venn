// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { AuthError, completeReset, MAX_ATTEMPTS, register, requestReset, verify } from "./localAuth"

beforeEach(() => localStorage.clear())
const fail = (p: Promise<unknown>) => p.then(() => null, (e) => e as AuthError)

describe("local auth", () => {
  it("registers once per email, ignoring case", async () => {
    await register("Maya", "Maya@Example.com", "Correct-Horse-9!")
    expect((await fail(register("Maya", "maya@example.com", "x")))?.code).toBe("email_taken")
  })
  it("accepts the right password and rejects a wrong one", async () => {
    await register("Maya", "maya@example.com", "Correct-Horse-9!")
    expect(await verify("MAYA@example.com", "Correct-Horse-9!")).toEqual({ name: "Maya", email: "maya@example.com" })
    expect((await fail(verify("maya@example.com", "nope")))?.code).toBe("invalid_credentials")
  })
  it("treats unknown emails like wrong passwords", async () => {
    expect((await fail(verify("ghost@example.com", "whatever-1")))?.code).toBe("invalid_credentials")
  })
  it("locks after repeated failures, even for the right password, then unlocks", async () => {
    await register("Maya", "maya@example.com", "Correct-Horse-9!")
    const t = 1_000_000
    for (let i = 0; i < MAX_ATTEMPTS; i++) await fail(verify("maya@example.com", "bad", t))
    expect((await fail(verify("maya@example.com", "Correct-Horse-9!", t + 1000)))?.code).toBe("locked")
    expect((await verify("maya@example.com", "Correct-Horse-9!", t + 16 * 60_000)).email).toBe("maya@example.com")
  })
  it("resets a password only through a pending reset", async () => {
    await register("Maya", "maya@example.com", "Correct-Horse-9!")
    expect((await fail(completeReset("New-Password-1!")))?.code).toBe("invalid_reset")
    expect(requestReset("ghost@example.com")).toBe(false)
    expect(requestReset("maya@example.com")).toBe(true)
    await completeReset("New-Password-1!")
    expect((await verify("maya@example.com", "New-Password-1!")).name).toBe("Maya")
    expect((await fail(verify("maya@example.com", "Correct-Horse-9!")))?.code).toBe("invalid_credentials")
    expect((await fail(completeReset("Again-Password-1!")))?.code).toBe("invalid_reset")
  })
  it("never stores the password in plain text", async () => {
    await register("Maya", "maya@example.com", "Correct-Horse-9!")
    expect(localStorage.getItem("venn.auth.v1")).not.toContain("Correct-Horse")
  })
})

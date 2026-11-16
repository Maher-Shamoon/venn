import { existsSync, readFileSync } from "node:fs"
import type { Page } from "@playwright/test"

const file = "e2e/.test-user.local"
/** Credentials of the Supabase test user created by services/api/scripts/create_test_user.py, or null. */
export const testUser = existsSync(file) && existsSync(".env.local") ? (JSON.parse(readFileSync(file, "utf8")) as { email: string; password: string }) : null

/** The browser storage of the first successful sign-in. Later tests reuse it, so a long run does not trip the auth provider's sign-in rate limit. */
let saved: [string, string][] | null = null

export async function signIn(page: Page, next = /\/app/) {
  if (saved) {
    await page.addInitScript((items) => { if (sessionStorage.getItem("e2e.seeded")) return; sessionStorage.setItem("e2e.seeded", "1"); for (const [k, v] of items) localStorage.setItem(k, v) }, saved)
    await page.goto("/app")
    try { await page.waitForURL(next, { timeout: 15_000 }); return } catch { saved = null }
  }
  await page.goto("/login")
  await page.getByLabel("Work email").fill(testUser!.email)
  await page.getByLabel("Password", { exact: true }).fill(testUser!.password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL(next)
  saved = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith("sb-") || k.startsWith("venn.org")) as [string, string][])
}

import { existsSync, readFileSync } from "node:fs"
import type { Page } from "@playwright/test"

const file = "e2e/.test-user.local"
/** Credentials of the Supabase test user created by services/api/scripts/create_test_user.py, or null. */
export const testUser = existsSync(file) && existsSync(".env.local") ? (JSON.parse(readFileSync(file, "utf8")) as { email: string; password: string }) : null

export async function signIn(page: Page, next = /\/app/) {
  await page.goto("/login")
  await page.getByLabel("Work email").fill(testUser!.email)
  await page.getByLabel("Password", { exact: true }).fill(testUser!.password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL(next)
}

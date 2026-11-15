import { expect, test } from "@playwright/test"
import { signIn, testUser } from "./helpers"

test.skip(!testUser, "Supabase test user is not configured")

test("company name saves to the server, survives a reload and appears in the audit log", async ({ page }) => {
  await signIn(page)
  await page.goto("/app/settings/company")
  const name = `QA Organization ${Date.now() % 100000}`
  await page.getByLabel("Name", { exact: true }).fill(name)
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("Settings saved")).toBeVisible()

  await page.reload()
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(name)

  await page.goto("/app/audit-log")
  await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible()
  await expect(page.getByRole("row", { name: /settings\.company_updated/ }).first()).toBeVisible()
  await page.getByRole("row", { name: /settings\.company_updated/ }).first().click()
  await expect(page.getByText(name).last()).toBeVisible()
})

test("an empty company name and invalid payment terms are refused", async ({ page }) => {
  await signIn(page)
  await page.goto("/app/settings/company")
  await page.getByLabel("Name", { exact: true }).fill("   ")
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("A company name is required.")).toBeVisible()

  await page.goto("/app/settings/financial")
  await page.getByLabel("Default payment terms (days)").fill("0")
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("Payment terms must be above zero.")).toBeVisible()
})

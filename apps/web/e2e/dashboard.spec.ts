import { expect, test } from "@playwright/test"
import { signIn, testUser } from "./helpers"

test.skip(!testUser, "Supabase test user is not configured")
test.beforeEach(({}, info) => { test.skip(info.project.name === "mobile", "desktop only") })

test("the dashboard of a real organization shows figures from its own records, and reports export", async ({ page }) => {
  test.setTimeout(300_000)
  await signIn(page)
  const s = Date.now() % 1_000_000
  await page.goto("/app/invoices/import")
  await page.getByLabel("Choose CSV file").setInputFiles({ name: "i.csv", mimeType: "text/csv", buffer: Buffer.from(["invoice_number,customer,issue_date,due_date,total_amount,currency", `QD-${s},QA Dash ${s},2026-08-01,2026-09-01,1234.56,USD`].join("\n")) })
  await page.getByRole("button", { name: /Confirm and save/ }).click()
  await expect(page.getByRole("heading", { name: /saved$/ })).toBeVisible()

  await page.goto("/app")
  await expect(page.getByRole("link", { name: /^Total receivable/ })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText("Brightpath")).toHaveCount(0)  // none of the prototype's sample company or people
  await expect(page.getByText("Dana")).toHaveCount(0)
  await expect(page.getByRole("link", { name: /^Total receivable \$[\d,]+\.\d{2}/ })).toBeVisible()
  await expect(page.getByText("Receivables aging")).toBeVisible()
  await expect(page.getByText("Outstanding balance trend")).toBeVisible()
  await page.getByRole("tab", { name: "table" }).first().click()
  await expect(page.getByRole("row", { name: /Over 90 days|61 to 90 days|31 to 60 days/ }).first()).toBeVisible()

  await page.keyboard.press("Control+k")
  await page.getByPlaceholder(/Search invoices/).fill(`QD-${s}`)
  await expect(page.getByRole("option", { name: new RegExp(`QD-${s}`) })).toBeVisible({ timeout: 20_000 })
  await page.keyboard.press("Escape")

  await page.goto("/app/reports")
  await expect(page.getByText("Receivables aging").first()).toBeVisible({ timeout: 30_000 })
  await page.getByRole("link", { name: /Receivables aging/ }).click()
  await expect(page.getByRole("heading", { name: "Receivables aging" })).toBeVisible()
  await expect(page.getByText("How this is calculated")).toBeVisible()
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export CSV" }).click()
  expect((await download).suggestedFilename()).toBe("aging-30d.csv")
})

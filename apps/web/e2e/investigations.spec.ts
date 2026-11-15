import { expect, test } from "@playwright/test"
import { signIn, testUser } from "./helpers"

test.skip(!testUser, "Supabase test user is not configured")
test.beforeEach(({}, info) => { test.skip(info.project.name === "mobile", "desktop only") })

test("a short payment opens a case with cited findings; the recommendation goes to approval; the case can be dismissed", async ({ page }) => {
  test.setTimeout(480_000)
  await signIn(page)
  const s = Date.now() % 1_000_000, cust = `QA Case ${s}`, inv = `QC-${s}`
  const upload = async (kind: string, csv: string) => {
    await page.goto(`/app/${kind}/import`)
    await page.getByLabel("Choose CSV file").setInputFiles({ name: `${kind}.csv`, mimeType: "text/csv", buffer: Buffer.from(csv) })
    await page.getByRole("button", { name: /Confirm and save/ }).click()
    await expect(page.getByRole("heading", { name: /saved$/ })).toBeVisible()
  }
  await upload("invoices", ["invoice_number,customer,issue_date,due_date,total_amount,currency", `${inv},${cust},2026-10-01,2026-11-01,5000.00,USD`].join("\n"))
  await upload("payments", ["date,amount,currency,reference,payer_name,external_id", `2026-11-01,4900.00,USD,${inv},${cust},QX-${s}`].join("\n"))
  await page.goto("/app/reconciliation")
  await page.getByRole("button", { name: "Run reconciliation" }).click()
  await expect(page.getByText(/Run finished:/)).toBeVisible({ timeout: 90_000 })

  await page.goto("/app/investigations")
  await page.getByRole("button", { name: new RegExp(`Short payment on ${inv}`) }).click()
  await expect(page.getByRole("heading", { name: `Short payment on ${inv}` })).toBeVisible()
  await expect(page.getByText("CONFIRMED FACT").first()).toBeVisible()
  await expect(page.getByText("CALCULATED BY venn, NOT BY AI").first()).toBeVisible()
  await expect(page.getByText("analysis v1")).toBeVisible()
  await expect(page.getByText("Request a write-off")).toBeVisible()

  await page.getByRole("button", { name: "Add note" }).click()
  await page.getByRole("textbox", { name: "Note" }).fill("Spoke to the customer")
  await page.getByRole("button", { name: "Add note" }).last().click()
  await page.getByRole("tab", { name: "activity" }).click()
  await expect(page.getByText("Spoke to the customer")).toBeVisible()
  await page.getByRole("tab", { name: "findings" }).click()

  await page.getByRole("button", { name: "Submit for approval" }).click()
  await expect(page.getByText("Open the request")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText("awaiting approval").first()).toBeVisible()

  await page.getByRole("button", { name: "Dismiss" }).first().click()
  await page.getByRole("textbox", { name: "Reason" }).fill("Test cleanup")
  await page.getByRole("button", { name: "Dismiss" }).last().click()
  await expect(page.getByText(/This investigation is dismissed/)).toBeVisible({ timeout: 30_000 })
})

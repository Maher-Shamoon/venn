import { expect, test } from "@playwright/test"
import { signIn, testUser } from "./helpers"

test.skip(!testUser, "Supabase test user is not configured")
test.beforeEach(({}, info) => { test.skip(info.project.name === "mobile", "desktop only") })

test("reconciliation applies an exact match, can undo it, and a person confirms a partial one", async ({ page }) => {
  test.setTimeout(420_000)
  await signIn(page)
  const s = Date.now() % 1_000_000, cust = `QA Recon ${s}`
  const upload = async (kind: string, csv: string) => {
    await page.goto(`/app/${kind}/import`)
    await page.getByLabel("Choose CSV file").setInputFiles({ name: `${kind}.csv`, mimeType: "text/csv", buffer: Buffer.from(csv) })
    await page.getByRole("button", { name: /Confirm and save/ }).click()
    await expect(page.getByRole("heading", { name: /saved$/ })).toBeVisible()
  }
  await upload("invoices", ["invoice_number,customer,issue_date,due_date,total_amount,currency", `QR-${s}-A,${cust},2026-10-01,2026-11-01,750.00,USD`, `QR-${s}-B,${cust},2026-10-01,2026-11-01,900.00,USD`].join("\n"))
  await upload("payments", ["date,amount,currency,reference,payer_name,external_id", `2026-11-10,750.00,USD,ACH QR-${s}-A,${cust},QX-${s}-1`, `2026-11-10,400.00,USD,QR-${s}-B,${cust},QX-${s}-2`].join("\n"))

  await page.goto("/app/reconciliation")
  await page.getByRole("button", { name: "Run reconciliation" }).click()
  await expect(page.getByText(/Run finished:/)).toBeVisible({ timeout: 60_000 })

  await page.getByRole("tab", { name: /^Auto-applied/ }).click()
  const row = page.getByRole("row", { name: new RegExp(`QR-${s}-A`) })
  await expect(row).toBeVisible()
  await row.getByRole("button", { name: "Undo" }).click()
  await page.getByLabel("Reason").fill("Applied to the wrong job")
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByRole("row", { name: new RegExp(`QR-${s}-A`) })).toHaveCount(0)

  await page.getByRole("tab", { name: /^Needs review/ }).click()
  await expect(page.getByText(/is 500.00 short|\$500\.00 short|short of the balance/).first()).toBeVisible()
  await page.getByRole("button", { name: "Confirm match" }).click()
  await expect(page.getByText(/applied$/)).toBeVisible()
})

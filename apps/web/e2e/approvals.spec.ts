import { expect, test } from "@playwright/test"
import { signIn, testUser } from "./helpers"

test.skip(!testUser, "Supabase test user is not configured")
test.beforeEach(({}, info) => { test.skip(info.project.name === "mobile", "desktop only") })

test("an adjustment is requested, cannot be self-approved, can be withdrawn, and a policy limit applies it directly", async ({ page }) => {
  test.setTimeout(420_000)
  await signIn(page)
  // an aborted earlier run can leave the write-off limit raised; start from "no auto-approval"
  await page.goto("/app/settings/approvals")
  const base = page.locator("div", { has: page.getByText("Write-off", { exact: true }) }).filter({ has: page.getByLabel("Auto-approve up to") }).last()
  await base.getByLabel("Auto-approve up to").fill("0")
  await base.getByRole("button", { name: "Save" }).click()
  await expect(page.getByText("Write-off policy saved")).toBeVisible()
  const s = Date.now() % 1_000_000, cust = `QA Approvals ${s}`
  await page.goto("/app/invoices/import")
  await page.getByLabel("Choose CSV file").setInputFiles({ name: "i.csv", mimeType: "text/csv", buffer: Buffer.from(["invoice_number,customer,issue_date,due_date,total_amount,currency", `QP-${s},${cust},2026-10-01,2026-11-01,700.00,USD`].join("\n")) })
  await page.getByRole("button", { name: /Confirm and save/ }).click()
  await expect(page.getByRole("heading", { name: /saved$/ })).toBeVisible()
  await page.goto("/app/invoices")
  await page.getByLabel("Search table").fill(`QP-${s}`)
  await page.getByRole("row", { name: new RegExp(`QP-${s}`) }).click()

  const request = async (amount: string) => {
    await page.getByRole("button", { name: "Request adjustment" }).click()
    await page.getByLabel("Amount").fill(amount)
    await page.getByLabel("Reason").fill("Customer short-paid on purpose")
    await page.getByRole("button", { name: "Submit request" }).click()
  }
  await request("50.00")
  await expect(page.getByRole("heading", { name: /Write-off · \$50\.00/ })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText("$650.00")).toBeVisible()
  await page.getByRole("button", { name: "Approve", exact: true }).click()
  await expect(page.getByText("You cannot decide your own request.")).toBeVisible()
  await page.getByRole("button", { name: "Reject" }).click()
  await expect(page.getByText(/Give a reason for rejecting/)).toBeVisible()
  await page.getByRole("button", { name: "Withdraw request" }).click()
  await expect(page.getByText("withdrawn").first()).toBeVisible()

  await page.goto("/app/settings/approvals")
  const row = page.locator("div", { has: page.getByText("Write-off", { exact: true }) }).filter({ has: page.getByLabel("Auto-approve up to") }).last()
  await row.getByLabel("Auto-approve up to").fill("100")
  await row.getByRole("button", { name: "Save" }).click()
  await expect(page.getByText("Write-off policy saved")).toBeVisible()

  await page.goto("/app/invoices")
  await page.getByLabel("Search table").fill(`QP-${s}`)
  await page.getByRole("row", { name: new RegExp(`QP-${s}`) }).click()
  await request("25.00")
  await expect(page.getByText("Approved within the auto-approve limit")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText("$675.00").first()).toBeVisible()

  await page.goto("/app/settings/approvals")  // leave the organization the way it was found
  const again = page.locator("div", { has: page.getByText("Write-off", { exact: true }) }).filter({ has: page.getByLabel("Auto-approve up to") }).last()
  await again.getByLabel("Auto-approve up to").fill("0")
  await again.getByRole("button", { name: "Save" }).click()
  await expect(page.getByText("Write-off policy saved")).toBeVisible()
})

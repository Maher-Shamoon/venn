import { expect, test, type Page } from "@playwright/test"
import { signIn, testUser } from "./helpers"

test.skip(!testUser, "Supabase test user is not configured")
test.beforeEach(({}, info) => { test.skip(info.project.name === "mobile", "desktop only") })

const dialog = (page: Page) => page.getByRole("dialog")

test("customer, invoice, payment, allocation, void, reversal and cancel on the real ledger", async ({ page }) => {
  test.setTimeout(120_000)
  await signIn(page)
  const stamp = Date.now() % 1_000_000
  const name = `QA Customer ${stamp}`

  // --- customer (validation first)
  await page.goto("/app/customers")
  await page.getByRole("button", { name: "New customer" }).click()
  await dialog(page).getByRole("button", { name: "Add customer" }).click()
  await expect(dialog(page).getByRole("alert")).toHaveText("Customer name is required.")
  await dialog(page).getByLabel("Customer name *").fill(name)
  await dialog(page).getByRole("button", { name: "Add customer" }).click()
  await expect(page.getByText("Customer added")).toBeVisible()
  await page.getByLabel("Search table").fill(name)
  await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible()

  // --- invoice (validation, then overdue by date)
  await page.goto("/app/invoices")
  await page.getByRole("button", { name: "New invoice" }).click()
  await dialog(page).getByRole("button", { name: "Create invoice" }).click()
  await expect(dialog(page).getByRole("alert")).toHaveText("Choose a customer.")
  await dialog(page).getByLabel("Customer *").selectOption({ label: name })
  await dialog(page).getByLabel("Due date").fill("2020-01-01")
  await dialog(page).getByLabel("Issue date").fill("2020-02-01")
  await dialog(page).getByRole("button", { name: "Create invoice" }).click()
  await expect(dialog(page).getByRole("alert")).toHaveText("The due date cannot be before the issue date.")
  await dialog(page).getByLabel("Issue date").fill("2020-01-01")
  await dialog(page).getByLabel("Due date").fill("2020-01-31")
  await dialog(page).getByLabel("Description 1").fill("Retainer")
  await dialog(page).getByLabel("Price 1").fill("1200.00")
  await dialog(page).getByRole("button", { name: "Create invoice" }).click()
  await expect(page.getByRole("heading", { name: /INV-\d+/ })).toBeVisible()
  await expect(page.getByText("overdue").first()).toBeVisible()
  const invoiceUrl = page.url()

  // --- manual payment on the invoice, bounded by the balance
  await page.getByRole("button", { name: "Record payment" }).click()
  await dialog(page).getByLabel("Amount").fill("999999")
  await dialog(page).getByRole("button", { name: "Record payment" }).click()
  await expect(dialog(page).getByRole("alert")).toContainText("cannot exceed the balance")
  await dialog(page).getByLabel("Amount").fill("500")
  await dialog(page).getByRole("button", { name: "Record payment" }).click()
  await expect(page.getByText("Payment recorded")).toBeVisible()
  await expect(page.getByText("$700.00").first()).toBeVisible()
  await expect(page.getByText("partially paid").first()).toBeVisible()

  // --- void that allocation from the payment screen: the invoice reopens in full
  await page.getByRole("link", { name: /PAY-\d+/ }).first().click()
  await page.getByRole("button", { name: "Void", exact: true }).click()
  await expect(page.getByText("Allocation voided")).toBeVisible()
  await page.goto(invoiceUrl)
  await expect(page.getByText("$1,200.00").first()).toBeVisible()

  // --- a standalone payment, allocated by hand
  await page.goto("/app/payments")
  await page.getByRole("button", { name: "Record payment" }).click()
  await dialog(page).getByLabel("Amount").fill("1200")
  await dialog(page).getByLabel("Customer (if known)").selectOption({ label: name })
  await dialog(page).getByRole("button", { name: "Record payment" }).click()
  await expect(page.getByRole("heading", { name: /PAY-\d+/ })).toBeVisible()
  await page.getByLabel("Invoice", { exact: true }).selectOption({ index: 1 })
  await page.getByRole("button", { name: "Allocate" }).click()
  await expect(page.getByText("Payment applied")).toBeVisible()
  await expect(page.getByText("fully allocated").first()).toBeVisible()
  const paymentUrl = page.url()

  // --- reversal needs a reason and reopens the invoice
  await page.getByRole("button", { name: "Mark reversed" }).click()
  await dialog(page).getByRole("button", { name: "Reverse payment" }).click()
  await expect(dialog(page).getByRole("alert")).toHaveText("A reason is required.")
  await dialog(page).getByLabel("Reason").fill("Bounced")
  await dialog(page).getByRole("button", { name: "Reverse payment" }).click()
  await expect(page.getByText("Payment reversed")).toBeVisible()
  await expect(page.getByText("reversed").first()).toBeVisible()
  await page.goto(invoiceUrl)
  await expect(page.getByText("$1,200.00").first()).toBeVisible()

  // --- cancel the invoice; it needs a reason
  await page.getByRole("button", { name: "Cancel invoice" }).first().click()
  await dialog(page).getByRole("button", { name: "Cancel invoice" }).click()
  await expect(dialog(page).getByRole("alert")).toHaveText("A reason is required.")
  await dialog(page).getByLabel("Reason").fill("Test data")
  await dialog(page).getByRole("button", { name: "Cancel invoice" }).click()
  await expect(page.getByText("Invoice cancelled")).toBeVisible()
  await expect(page.getByText("cancelled").first()).toBeVisible()

  // --- everything is in the audit log
  await page.goto("/app/audit-log")
  for (const action of ["allocation.created", "allocation.voided", "payment.reversed", "invoice.cancelled"]) {
    await expect(page.getByRole("row", { name: new RegExp(action.replace(".", "\\.")) }).first()).toBeVisible()
  }
  expect(paymentUrl).toContain("/app/payments/")
})

test("lists page, sort and search through the URL", async ({ page }) => {
  await signIn(page)
  await page.goto("/app/invoices?tab=overdue&sort=-total")
  await expect(page.getByRole("heading", { name: "Invoices", exact: true })).toBeVisible()
  await page.getByLabel("Search table").fill("zzzz-no-match")
  await expect(page).toHaveURL(/q=zzzz-no-match/)
  await expect(page.getByText("No rows match your search.")).toBeVisible()
})

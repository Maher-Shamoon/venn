import { expect, test } from "@playwright/test"
import { signIn, testUser } from "./helpers"

test.beforeEach(({}, info) => { test.skip(info.project.name === "mobile", "desktop only") })

test("visitors: public navigation, protected routes, sign-up and sign-in validation, password reset form", async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto("/")
  await expect(page.locator("h1").first()).toBeVisible()
  for (const [name, path] of [["Pricing", "/pricing"]] as const) {
    await page.getByRole("link", { name, exact: true }).first().click()
    await expect(page).toHaveURL(new RegExp(path))
    await expect(page.locator("h1").first()).toBeVisible()
  }
  await page.goto("/about"); await expect(page.locator("h1")).toBeVisible()
  await page.goto("/contact"); await expect(page.locator("h1")).toBeVisible()
  await page.goto("/no-such-page"); await expect(page.getByRole("heading", { name: /wrong turn/i }).first()).toBeVisible()

  await page.goto("/app/invoices")  // a signed-out visitor is sent to sign in
  await expect(page).toHaveURL(/\/login/)

  await page.goto("/signup")
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page.getByRole("alert")).toContainText(/name/i)
  await page.getByLabel("Full name").fill("Test Person")
  await page.getByLabel("Work email").fill("not-an-email")
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page.getByRole("alert")).toContainText(/email/i)
  await page.getByLabel("Work email").fill("person@example.com")
  await page.getByLabel("Password", { exact: true }).fill("short")
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page.getByRole("alert")).toContainText(/stronger password/i)

  await page.goto("/forgot-password")
  await page.getByLabel(/email/i).first().fill("someone@example.com")
  await page.getByRole("button", { name: /reset|send/i }).first().click()
  await expect(page.getByText(/check your email|sent|if an account/i).first()).toBeVisible({ timeout: 30_000 })
})

test("a signed-in owner: wrong password is refused, sign-in lands on the dashboard, every main screen opens, sign-out closes the app", async ({ page }) => {
  test.skip(!testUser, "Supabase test user is not configured")
  test.setTimeout(420_000)
  await page.goto("/login")
  await page.getByLabel("Work email").fill(testUser!.email)
  await page.getByLabel("Password", { exact: true }).fill("definitely-wrong-password")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 30_000 })
  await signIn(page)
  await expect(page).toHaveURL(/\/app/)
  const screens: [string, RegExp][] = [["/app/customers", /Customers/], ["/app/invoices", /Invoices/], ["/app/payments", /Payments/], ["/app/reconciliation", /Reconciliation/], ["/app/investigations", /Investigations/], ["/app/approvals", /Approvals|My requests/],
    ["/app/collections", /Collections/], ["/app/disputes", /Disputes/], ["/app/reports", /Analytics/], ["/app/documents", /Documents/], ["/app/tasks", /Tasks/], ["/app/notifications", /Notifications/], ["/app/integrations", /Integrations/], ["/app/team", /Team/], ["/app/settings", /Settings/], ["/app/audit-log", /Audit/], ["/app/profile", /Profile/]]
  for (const [path, title] of screens) {
    await page.goto(path)
    await expect(page.locator("main h1").first()).toHaveText(title, { timeout: 30_000 })
  }
  await page.goto("/app/audit-log")
  await expect(page.getByText(/integration|import|investigation|approval|allocation|payment/i).first()).toBeVisible({ timeout: 30_000 })
  await page.getByRole("button", { name: "Account menu" }).click()
  await page.getByRole("button", { name: /Sign out/ }).click()
  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 })
  await page.goto("/app/invoices")
  await expect(page).toHaveURL(/\/login/)
})

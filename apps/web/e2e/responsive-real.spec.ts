import { expect, test, type Page } from "@playwright/test"
import { signIn, testUser } from "./helpers"
import { detect, SIZES } from "./overflow"

const ROUTES = ["/app", "/app/customers", "/app/invoices", "/app/payments", "/app/reconciliation", "/app/investigations", "/app/approvals", "/app/collections", "/app/disputes", "/app/reports", "/app/reports/aging", "/app/documents", "/app/tasks", "/app/integrations", "/app/team", "/app/audit-log", "/app/notifications", "/app/settings", "/app/profile", "/app/invoices/import", "/app/payments/import"]

async function seed(page: Page) {
  const g = await page.evaluate(() => ({ org: localStorage.getItem("venn.org"), token: JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("auth-token"))!)!).access_token as string }))
  const h = { Authorization: `Bearer ${g.token}`, "X-Organization-Id": g.org!, "Content-Type": "application/json" }
  const post = async (path: string, data: object) => (await page.request.post("/api/v1" + path, { headers: { ...h, "Idempotency-Key": crypto.randomUUID() }, data })).json()
  const tag = Date.now().toString(36).toUpperCase()
  const c = await post("/customers", { name: `Extraordinarily Long Customer Name & Partners International ${tag}`, contact_email: "accounts.payable.department@extraordinarily-long-company-domain.example" })
  const inv = await post("/invoices", { customer_id: c.id, issue_date: "2026-09-01", due_date: "2026-10-01", invoice_number: `INV-BIG-${tag}-0001-LONG`, lines: [{ description: "Large engagement", quantity: "1", unit_price: "1234567.89" }] })
  await post("/payments", { payment_date: "2026-11-10", amount: "987654.32", payer_name_raw: "EXTRAORDINARILY LONG CUSTOMER NAME PARTNERS INTL", reference: inv.invoice_number })
  await post("/reconciliation/runs", {})
}

test.beforeEach(({}, info) => { test.skip(info.project.name === "mobile", "sizes are set inside the test") })

let seeded = false
for (const w of SIZES) {
  test(`a real organization with long names and large figures fits ${w}px`, async ({ page }) => {
    test.skip(!testUser, "Supabase test user is not configured")
    test.setTimeout(240_000)
    await signIn(page)
    if (!seeded) { await seed(page); seeded = true }
    const bad: string[] = []
    await page.setViewportSize({ width: w, height: w < 700 ? 800 : 900 })
    for (const route of ROUTES) {
      try {
        await page.goto(route)
        await expect(page.locator("main h1").first()).toBeVisible({ timeout: 30_000 })
        await page.waitForLoadState("networkidle").catch(() => undefined)
        await page.waitForTimeout(300)
        for (const o of await page.evaluate(detect)) bad.push(`${route}: ${o}`)
      } catch (e) { bad.push(`${route}: could not be checked (${String(e).slice(0, 80)})`) }
    }
    expect([...new Set(bad)]).toEqual([])
  })
}

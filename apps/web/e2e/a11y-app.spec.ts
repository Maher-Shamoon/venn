import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { signIn, testUser } from "./helpers"

test.skip(!testUser, "Supabase test user is not configured")
test.beforeEach(({}, info) => { test.skip(info.project.name === "mobile", "desktop only") })

const routes = ["/app", "/app/customers", "/app/invoices", "/app/payments", "/app/reconciliation", "/app/investigations", "/app/approvals", "/app/collections", "/app/disputes", "/app/reports", "/app/reports/aging",
  "/app/documents", "/app/tasks", "/app/notifications", "/app/integrations", "/app/team", "/app/settings", "/app/audit-log", "/app/invoices/import"]

test("every signed-in screen has no serious or critical accessibility violations, one h1 and no horizontal scroll", async ({ page }) => {
  test.setTimeout(600_000)
  await signIn(page)
  const problems: string[] = []
  for (const route of routes) {
    await page.goto(route)
    await expect(page.locator("main h1").first()).toBeVisible({ timeout: 90_000 })
    await page.waitForLoadState("networkidle").catch(() => undefined)
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze()
    for (const v of violations.filter((x) => x.impact === "serious" || x.impact === "critical")) problems.push(`${route} ${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(" ")}`)
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) problems.push(`${route} scrolls horizontally`)
    if ((await page.locator("main h1").count()) !== 1) problems.push(`${route} has ${await page.locator("main h1").count()} h1`)
  }
  expect(problems).toEqual([])
})

test("every signed-in screen fits a phone without sideways scrolling", async ({ page }) => {
  test.setTimeout(600_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page)
  const wide: string[] = []
  for (const route of routes) {
    await page.goto(route)
    await expect(page.locator("main h1").first()).toBeVisible({ timeout: 90_000 })
    await page.waitForLoadState("networkidle").catch(() => undefined)
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    if (over > 1) wide.push(`${route} is ${over}px too wide`)
  }
  expect(wide).toEqual([])
})

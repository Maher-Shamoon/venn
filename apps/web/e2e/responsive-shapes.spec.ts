import { expect, test } from "@playwright/test"
import { detect } from "./overflow"

test.beforeEach(({}, info) => { test.skip(info.project.name === "mobile", "sizes are set inside the test") })

/** Screens that are short or very wide for their width: phones and tablets on their side, small laptops, ultrawide and cinema displays. */
const SHAPES: [number, number][] = [[667, 375], [844, 390], [915, 412], [1024, 600], [1180, 820], [1024, 768], [1280, 600], [1366, 657], [1536, 730], [2560, 1080], [2560, 1440], [3440, 1440], [3840, 2160]]
const PUBLIC = ["/", "/pricing", "/about", "/contact", "/p/reconciliation", "/p/engine", "/login", "/signup", "/forgot-password"]
const APP = ["/app", "/app/customers", "/app/invoices", "/app/payments", "/app/reconciliation", "/app/investigations", "/app/approvals", "/app/collections", "/app/disputes", "/app/reports", "/app/documents", "/app/tasks", "/app/integrations", "/app/team", "/app/settings"]
const STEPS = ["organization", "sources", "email", "import", "team", "preferences"]

for (const [w, h] of SHAPES) {
  test(`every screen fits a ${w}x${h} display`, async ({ page }) => {
    test.setTimeout(300_000)
    await page.setViewportSize({ width: w, height: h })
    const bad: string[] = []
    const check = async (route: string) => {
      await page.waitForTimeout(300)
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)) } window.scrollTo(0, 0) })
      for (const o of await page.evaluate(detect)) bad.push(`${route}: ${o}`)
    }
    for (const route of PUBLIC) {
      try { await page.goto(route); await expect(page.locator("h1").first()).toBeVisible(); await check(route) } catch (e) { bad.push(`${route}: could not be checked (${String(e).slice(0, 80)})`) }
    }
    try {
      await page.goto("/demo?to=/app"); await expect(page.locator("main h1").first()).toBeVisible()
      for (const route of [...APP, ...STEPS.map((s) => `/onboarding/${s}`)]) {
        await page.goto(route); await expect(page.locator("main h1").first()).toBeVisible(); await check(route)
      }
    } catch (e) { bad.push(`app: could not be checked (${String(e).slice(0, 100)})`) }
    expect([...new Set(bad)]).toEqual([])
  })
}

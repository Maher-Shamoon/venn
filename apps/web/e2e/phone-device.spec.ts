import { devices, expect, test } from "@playwright/test"
import { detect } from "./overflow"

/** Real phone behaviour, not just a narrow window: touch input, mobile viewport rules, high pixel density, and the page's animations actually running. */
const { defaultBrowserType: _d, ...android } = devices["Pixel 7"]
const PHONES: [string, number, number, number][] = [["Oppo F17 class", 393, 851, 2.75], ["small Android", 360, 640, 3], ["iPhone SE class", 375, 667, 2], ["large phone", 430, 932, 3]]
const PUBLIC = ["/", "/pricing", "/about", "/contact", "/p/engine", "/login", "/signup", "/onboarding/organization"]
const APP = ["/app", "/app/customers", "/app/invoices", "/app/payments", "/app/reconciliation", "/app/investigations", "/app/approvals", "/app/settings"]

for (const [name, w, h, dpr] of PHONES) {
  test.describe(name, () => {
    test.use({ ...android, viewport: { width: w, height: h }, deviceScaleFactor: dpr })
    test(`${name}: fits, and animations run`, async ({ page }) => {
      test.setTimeout(240_000)
      const bad: string[] = []
      const errors: string[] = []
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)))
      await page.goto("/")
      await expect(page.locator("h1").first()).toBeVisible()
      await page.waitForTimeout(2500)
      const live = await page.evaluate(() => ({ running: document.getAnimations().filter((a) => a.playState === "running").length, canvas: document.querySelectorAll("canvas").length, touch: matchMedia("(pointer:coarse)").matches }))
      expect(live.touch, "touch device").toBe(true)
      expect(live.running, "running animations on the landing page").toBeGreaterThan(5)
      expect(live.canvas, "the hero venn is drawn").toBeGreaterThan(0)
      for (const route of PUBLIC) {
        await page.goto(route); await expect(page.locator("h1").first()).toBeVisible(); await page.waitForTimeout(300)
        for (const o of await page.evaluate(detect)) bad.push(`${route}: ${o}`)
      }
      await page.goto("/demo?to=/app"); await expect(page.locator("main h1").first()).toBeVisible()
      for (const route of APP) {
        await page.goto(route); await expect(page.locator("main h1").first()).toBeVisible(); await page.waitForTimeout(300)
        for (const o of await page.evaluate(detect)) bad.push(`${route}: ${o}`)
      }
      expect([...new Set(bad)]).toEqual([])
      expect(errors).toEqual([])
    })
  })
}

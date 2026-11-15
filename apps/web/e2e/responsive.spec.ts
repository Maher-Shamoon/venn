import { expect, test } from "@playwright/test"
import { signIn, testUser } from "./helpers"

/** Finds anything drawn past the right edge of the screen that the person cannot scroll to (not inside a scrolling or clipping box). */
const offenders = () => {
  const vw = window.innerWidth
  const out: string[] = []
  const scrolls = (el: Element | null) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") return true } return false }
  document.querySelectorAll("body *").forEach((el) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
    if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.05 || cs.position === "fixed" && r.right <= vw + 1) return
    if (r.right > vw + 1 && !scrolls(el.parentElement) && !el.closest("[aria-hidden='true'], .sr-only")) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)} right=${Math.round(r.right)}`)
  })
  return out.slice(0, 5)
}
const SIZES = [{ w: 320, h: 640 }, { w: 360, h: 740 }, { w: 390, h: 844 }, { w: 412, h: 915 }, { w: 768, h: 1024 }, { w: 1024, h: 768 }, { w: 1280, h: 800 }, { w: 1920, h: 1080 }]
const PUBLIC = ["/", "/pricing", "/about", "/contact", "/login", "/signup", "/p/engine"]
const APP = ["/app", "/app/customers", "/app/invoices", "/app/payments", "/app/reconciliation", "/app/investigations", "/app/approvals", "/app/collections", "/app/disputes", "/app/reports", "/app/reports/aging", "/app/documents", "/app/tasks", "/app/integrations", "/app/team", "/app/settings"]

test.beforeEach(({}, info) => { test.skip(info.project.name === "mobile", "sizes are set inside the test") })

test("public pages fit every screen size", async ({ page }) => {
  test.setTimeout(300_000)
  const bad: string[] = []
  for (const s of SIZES) {
    await page.setViewportSize({ width: s.w, height: s.h })
    for (const route of PUBLIC) {
      await page.goto(route)
      await expect(page.locator("h1").first()).toBeVisible()
      await page.waitForTimeout(400)
      for (const o of await page.evaluate(offenders)) bad.push(`${s.w}px ${route}: ${o}`)
    }
  }
  expect(bad).toEqual([])
})

test("the sample workspace fits every screen size", async ({ page }) => {
  test.setTimeout(420_000)
  const bad: string[] = []
  await page.goto("/demo?to=/app")
  await expect(page.locator("main h1").first()).toBeVisible()
  for (const s of SIZES) {
    await page.setViewportSize({ width: s.w, height: s.h })
    for (const route of APP) {
      await page.goto(route)
      await expect(page.locator("main h1").first()).toBeVisible()
      await page.waitForTimeout(300)
      for (const o of await page.evaluate(offenders)) bad.push(`${s.w}px ${route}: ${o}`)
    }
  }
  expect(bad).toEqual([])
})

test("a real organization's screens fit every screen size", async ({ page }) => {
  test.skip(!testUser, "Supabase test user is not configured")
  test.setTimeout(900_000)
  const bad: string[] = []
  await signIn(page)
  for (const s of SIZES.filter((x) => [320, 390, 768, 1280].includes(x.w))) {
    await page.setViewportSize({ width: s.w, height: s.h })
    for (const route of APP) {
      await page.goto(route)
      await expect(page.locator("main h1").first()).toBeVisible({ timeout: 30_000 })
      await page.waitForLoadState("networkidle").catch(() => undefined)
      for (const o of await page.evaluate(offenders)) bad.push(`${s.w}px ${route}: ${o}`)
    }
  }
  expect(bad).toEqual([])
})

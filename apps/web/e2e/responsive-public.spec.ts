import { expect, test } from "@playwright/test"
import { detect, SIZES } from "./overflow"

test.beforeEach(({}, info) => { test.skip(info.project.name === "mobile", "sizes are set inside the test") })

const PUBLIC = ["/", "/pricing", "/about", "/contact", "/privacy", "/terms", "/p/reconciliation", "/p/owners", "/p/security", "/p/engine", "/login", "/signup", "/forgot-password", "/verify-email"]
const STEPS = ["organization", "sources", "email", "import", "team", "preferences"]
const LONG = "Northwestern Pacific Consulting and Managed Services International Holdings"

for (const w of SIZES) {
  test(`landing, public pages and onboarding fit ${w}px`, async ({ page }) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width: w, height: w < 700 ? 800 : 900 })
    const bad: string[] = []
    const check = async (label: string) => {
      await page.waitForTimeout(350)
      // scroll through so lazy sections render before measuring
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)) } window.scrollTo(0, 0) })
      for (const o of await page.evaluate(detect)) bad.push(`${label}: ${o}`)
    }
    for (const route of PUBLIC) {
      try { await page.goto(route); await expect(page.locator("h1").first()).toBeVisible(); await check(route) }
      catch (e) { bad.push(`${route}: could not be checked (${String(e).slice(0, 80)})`) }
    }
    // onboarding in the sample workspace: every step, plus the error and filled-in states
    try {
      await page.goto("/demo?to=/onboarding/organization")
      await expect(page.locator("main h1").first()).toBeVisible()
      await page.locator("main input").first().fill(LONG)
      await page.locator("main input").nth(1).fill("https://www.a-very-long-company-website-address-for-testing.example.com/path")
      await check("onboarding/organization filled")
      await page.locator("main input").first().fill("")
      await page.getByRole("button", { name: "Continue" }).click()
      await expect(page.getByRole("alert")).toBeVisible()
      await check("onboarding/organization error")
      for (const step of STEPS) {
        await page.goto(`/onboarding/${step}`) // the sample session survives a reload; stepping with Continue would call the real API
        await expect(page.locator("main h1").first()).toBeVisible()
        if (step === "team") {
          await page.getByRole("button", { name: "Add another" }).click()
          await page.locator("input[aria-label=Email]").first().fill("a-really-long-teammate-address-for-testing@very-long-company-domain-name.example.com")
        }
        await check(`onboarding/${step}`)
      }
    } catch (e) { bad.push(`onboarding: could not be checked (${String(e).slice(0, 100)})`) }
    expect([...new Set(bad)]).toEqual([])
  })
}

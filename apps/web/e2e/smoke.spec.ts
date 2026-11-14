import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

const publicRoutes = ["/", "/pricing", "/about", "/contact", "/p/engine", "/login", "/signup"]

for (const route of publicRoutes) {
  test(`${route} renders, has one h1 and no horizontal scroll`, async ({ page }) => {
    await page.goto(route)
    await expect(page.locator("h1").first()).toBeVisible()
    expect(await page.locator("h1").count()).toBe(1)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
    expect(overflow).toBe(false)
  })
}

test("home has no serious or critical accessibility violations", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator("h1").first()).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze()
  const bad = violations.filter((v) => v.impact === "serious" || v.impact === "critical")
  expect(bad.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
})

test("sample workspace opens the dashboard", async ({ page }) => {
  await page.goto("/demo?to=/app")
  await expect(page.getByRole("heading", { name: /good morning/i })).toBeVisible()
})

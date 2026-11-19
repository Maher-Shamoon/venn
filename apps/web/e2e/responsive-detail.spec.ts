import { expect, test } from "@playwright/test"
import { signIn, testUser } from "./helpers"
import { detect, SIZES } from "./overflow"

test.beforeEach(({}, info) => { test.skip(info.project.name === "mobile", "sizes are set inside the test") })

for (const w of SIZES) {
  test(`invoice, customer, payment, case and approval detail pages fit ${w}px`, async ({ page }) => {
    test.skip(!testUser, "Supabase test user is not configured")
    test.setTimeout(600_000)
    await signIn(page)
    const g = await page.evaluate(() => ({ org: localStorage.getItem("venn.org"), token: JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("auth-token"))!)!).access_token as string }))
    const h = { Authorization: `Bearer ${g.token}`, "X-Organization-Id": g.org! }
    const first = async (path: string, key = "data") => ((await (await page.request.get("/api/v1" + path, { headers: h })).json())[key] ?? [])[0]?.id as string | undefined
    // the biggest, longest-named records first: they are the hardest to fit
    const big = (await (await page.request.get("/api/v1/invoices?limit=100", { headers: h })).json()).data.sort((a: { total_amount: string }, b: { total_amount: string }) => Number(b.total_amount) - Number(a.total_amount))[0]
    const routes = [big && `/app/invoices/${big.id}`, big && `/app/customers/${big.customer_id}`, await first("/payments?limit=1").then((i) => i && `/app/payments/${i}`), await first("/investigations?limit=1").then((i) => i && `/app/investigations/${i}`), await first("/approvals?limit=1").then((i) => i && `/app/approvals/${i}`)].filter(Boolean) as string[]
    expect(routes.length, "records to open").toBeGreaterThanOrEqual(3)
    await page.setViewportSize({ width: w, height: w < 700 ? 800 : 900 })
    const bad: string[] = []
    for (const route of routes) {
      try {
        await page.goto(route)
        await expect(page.locator("main h1").first()).toBeVisible({ timeout: 90_000 })
        await page.waitForLoadState("networkidle").catch(() => undefined)
        await page.waitForTimeout(400)
        for (const o of await page.evaluate(detect)) bad.push(`${route.replace(/[0-9a-f-]{36}/, ":id")}: ${o}`)
      } catch (e) { bad.push(`${route}: could not be checked (${String(e).slice(0, 80)})`) }
    }
    expect([...new Set(bad)]).toEqual([])
  })
}

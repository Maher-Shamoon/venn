import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

test.beforeEach(({}, info) => { test.skip(info.project.name === "mobile", "sizes are set inside the test") })

const PUBLIC = ["/", "/pricing", "/about", "/contact", "/privacy", "/terms", "/p/reconciliation", "/p/engine", "/login", "/signup", "/forgot-password"]
const APP = ["/app", "/app/customers", "/app/invoices", "/app/payments", "/app/reconciliation", "/app/investigations", "/app/approvals", "/app/collections", "/app/disputes", "/app/reports", "/app/documents", "/app/tasks", "/app/integrations", "/app/team", "/app/settings"]
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]

const demo = async (page: Page) => { await page.goto("/demo?to=/app"); await expect(page.locator("main h1").first()).toBeVisible() }
const settle = (page: Page) => page.waitForTimeout(500)

/** What a screen reader would announce for the focused element: its name and role. */
const focused = (page: Page) => page.evaluate(() => {
  const e = document.activeElement as HTMLElement | null
  if (!e || e === document.body) return { tag: "body", name: "", visible: true, role: "" }
  const cs = getComputedStyle(e)
  const labelled = e.getAttribute("aria-label") || (e.getAttribute("aria-labelledby") ? document.getElementById(e.getAttribute("aria-labelledby")!)?.textContent : "") || (e as HTMLInputElement).labels?.[0]?.textContent || e.textContent || e.getAttribute("title") || e.getAttribute("alt") || e.getAttribute("placeholder") || ""
  const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== "none"
  const container = e.closest("[class*='focus-within']") // a field whose surrounding box shows the focus
  return { tag: e.tagName.toLowerCase(), role: e.getAttribute("role") ?? "", name: labelled.trim().replace(/\s+/g, " ").slice(0, 50), visible: ring || !!container || e.tagName === "BODY", cls: String(e.className).slice(0, 40) }
})

test("an automated WCAG 2.2 scan finds nothing on the public pages, on a laptop and on a phone", async ({ page }) => {
  test.setTimeout(400_000)
  const issues: string[] = []
  await page.emulateMedia({ reducedMotion: "reduce" }) // a scan reads colours, so it must not catch a fade half way
  for (const [w, h] of [[1280, 800], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h })
    for (const route of PUBLIC) {
      await page.goto(route); await expect(page.locator("h1").first()).toBeVisible(); await settle(page)
      const { violations } = await new AxeBuilder({ page }).withTags(TAGS).exclude("[data-slot=dialog-header]").exclude("[role=img][aria-label^=\"Looping product demo\"]").analyze()
      for (const v of violations) issues.push(`${w}px ${route} [${v.impact}] ${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(" ").slice(0, 90)}`)
    }
  }
  expect([...new Set(issues)]).toEqual([])
})

test("an automated WCAG 2.2 scan finds nothing in the sample workspace or setup, on a laptop and on a phone", async ({ page }) => {
  test.setTimeout(600_000)
  const issues: string[] = []
  await page.emulateMedia({ reducedMotion: "reduce" }) // a scan reads colours, so it must not catch a fade half way
  for (const [w, h] of [[1280, 800], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h })
    await demo(page)
    for (const route of [...APP, "/onboarding/organization", "/onboarding/team"]) {
      await page.goto(route); await expect(page.locator("main h1").first()).toBeVisible(); await settle(page)
      const { violations } = await new AxeBuilder({ page }).withTags(TAGS).exclude("[data-slot=dialog-header]").exclude("[role=img][aria-label^=\"Looping product demo\"]").analyze()
      for (const v of violations) issues.push(`${w}px ${route} [${v.impact}] ${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(" ").slice(0, 90)}`)
    }
  }
  expect([...new Set(issues)]).toEqual([])
})

test("keyboard only: the skip link works and every stop on the landing page has a visible focus and a name", async ({ page }) => {
  test.setTimeout(200_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto("/"); await expect(page.locator("h1").first()).toBeVisible(); await settle(page)
  await page.keyboard.press("Tab")
  const first = await focused(page)
  expect(first.name.toLowerCase(), "the first stop is the skip link").toContain("skip")
  await page.keyboard.press("Enter")
  await settle(page)
  expect(await page.evaluate(() => !!document.activeElement?.closest("main") || document.activeElement?.id === "main"), "the skip link moves focus into the content").toBe(true)
  await page.goto("/"); await settle(page)
  const bad: string[] = [], seen = new Set<string>()
  let trapped = true
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press("Tab")
    const f = await focused(page)
    if (f.tag === "body") { trapped = false; break }
    const key = `${f.tag}|${f.name}|${f.cls}`
    seen.add(key)
    if (!f.name) bad.push(`stop ${i + 1}: ${f.tag} has no name`)
    if (!f.visible) bad.push(`stop ${i + 1}: ${f.tag} "${f.name}" shows no focus`)
  }
  expect(trapped, "tabbing eventually leaves the page: no keyboard trap").toBe(false)
  expect(seen.size, "many controls are reachable").toBeGreaterThan(15)
  expect([...new Set(bad)]).toEqual([])
})

test("keyboard only: the phone menu opens, keeps focus inside, closes with Escape and returns focus", async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/"); await expect(page.locator("h1").first()).toBeVisible(); await settle(page)
  const trigger = page.getByRole("button", { name: "Open menu" })
  await trigger.focus()
  await page.keyboard.press("Enter")
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  for (let i = 0; i < 25; i++) { await page.keyboard.press("Tab"); expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]")), `Tab ${i + 1} stays inside the menu`).toBe(true) }
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  expect(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute("aria-label")), "focus returns to the menu button").toBe("Open menu")
})

test("keyboard only: the laptop navigation menus open and close, and the email form submits", async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto("/"); await expect(page.locator("h1").first()).toBeVisible(); await settle(page)
  const platform = page.getByRole("button", { name: /platform/i }).first()
  await platform.focus(); await page.keyboard.press("Enter")
  await expect(platform, "the menu reports it is open").toHaveAttribute("aria-expanded", "true")
  await page.keyboard.press("Escape")
  await expect(platform).toHaveAttribute("aria-expanded", "false")
  const field = page.locator("#hero-input")
  await field.focus(); await page.keyboard.type("not-an-email"); await page.keyboard.press("Enter")
  await expect(page.locator("#hero").getByRole("status")).toContainText(/valid/i)
  await expect(field, "the invalid field is flagged").toHaveAttribute("aria-invalid", "true")
  await field.fill("pat@example.com"); await page.keyboard.press("Enter")
  await expect(page.locator("#hero").getByRole("status")).toContainText(/thanks/i)
})

test("keyboard and screen reader: sign-in and sign-up announce their errors and flag the fields", async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto("/login"); await expect(page.locator("h1")).toBeVisible()
  await page.getByLabel("Work email").focus()
  await page.keyboard.press("Enter")
  const alert = page.getByRole("alert")
  await expect(alert, "the error is announced as an alert").toBeVisible()
  await expect(page.getByLabel("Work email")).toHaveAttribute("aria-invalid", "true")
  const order: string[] = []
  await page.getByLabel("Work email").focus()
  for (let i = 0; i < 6; i++) { order.push((await focused(page)).name); await page.keyboard.press("Tab") }
  expect(order.join(" > ").toLowerCase()).toMatch(/email.*password.*(show|hide).*keep me signed in.*forgot/)
  await page.goto("/signup"); await expect(page.locator("h1")).toBeVisible()
  await page.getByLabel("Full name").focus(); await page.keyboard.press("Enter")
  await expect(page.getByRole("alert")).toBeVisible()
})

test("keyboard only: the app's search, menus and navigation work and focus moves to the new page", async ({ page }) => {
  test.setTimeout(200_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await demo(page); await settle(page)
  await page.keyboard.press("Tab")
  expect((await focused(page)).name.toLowerCase(), "skip link first").toContain("skip")
  await page.keyboard.press("Control+k")
  const dlg = page.getByRole("dialog")
  await expect(dlg).toBeVisible()
  expect(await page.evaluate(() => document.activeElement?.tagName), "focus goes to the search box").toBe("INPUT")
  for (let i = 0; i < 8; i++) { await page.keyboard.press("Tab"); await page.waitForTimeout(120) /* the dialog briefly passes focus through its own guard element */; const where = await page.evaluate(() => { const e = document.activeElement as HTMLElement; return `${e.tagName} ${e.getAttribute("aria-label") ?? e.textContent?.slice(0, 30)} inDialog=${!!e.closest("[role=dialog]")}` }); expect(where, `Tab ${i + 1} keeps focus inside search`).toContain("inDialog=true") }
  await page.keyboard.press("Escape")
  await expect(dlg).toBeHidden()
  const bell = page.getByRole("button", { name: "Notifications" })
  await bell.focus(); await page.keyboard.press("Enter")
  await expect(bell).toHaveAttribute("aria-expanded", "true")
  await page.keyboard.press("Escape")
  await expect(bell).toHaveAttribute("aria-expanded", "false")
  expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "focus returns to the bell").toBe("Notifications")
  const before = await page.title()
  await page.getByRole("link", { name: "Invoices", exact: true }).first().focus(); await page.keyboard.press("Enter")
  await expect(page.locator("main h1").first()).toHaveText(/invoices/i)
  await settle(page)
  expect(await page.title(), "the page title changes with the page").not.toBe(before)
  expect(await page.evaluate(() => !!document.activeElement?.closest("main") || document.activeElement?.id === "main" || document.activeElement === document.body), "focus is not left on a removed control").toBe(true)
})

test("screen reader: every page has a language, a unique title, landmarks, one h1 and an orderly outline", async ({ page }) => {
  test.setTimeout(400_000)
  const issues: string[] = [], titles = new Map<string, string>()
  const audit = async (route: string, area: "site" | "app") => {
    const r = await page.evaluate(() => {
      const hs = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter((h) => (h as HTMLElement).offsetParent !== null).map((h) => +h.tagName[1])
      let skip = ""; for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) { skip = `h${hs[i - 1]} to h${hs[i]}`; break }
      const count = (s: string) => document.querySelectorAll(s).length
      const noAlt = [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt") && i.getAttribute("role") !== "presentation").length
      const unnamed = [...document.querySelectorAll("button,a[href],[role=button],[role=link]")].filter((e) => { const el = e as HTMLElement; if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") return false; return !(el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.textContent?.trim() || el.getAttribute("title") || el.querySelector("img[alt]:not([alt=''])")) }).map((e) => e.tagName.toLowerCase() + "." + String((e as HTMLElement).className).slice(0, 30))
      const navs = [...document.querySelectorAll("nav")].filter((n) => (n as HTMLElement).offsetParent !== null || getComputedStyle(n).position === "fixed")
      return { lang: document.documentElement.lang, title: document.title, h1: hs.filter((n) => n === 1).length, skip, main: count("main"), banner: count("header,[role=banner]"), footer: count("footer,[role=contentinfo]"), noAlt, unnamed, unlabelledNavs: navs.length > 1 ? navs.filter((n) => !n.getAttribute("aria-label") && !n.getAttribute("aria-labelledby")).length : 0 }
    })
    if (!r.lang) issues.push(`${route}: no lang`)
    if (!r.title.trim()) issues.push(`${route}: empty title`)
    if (titles.has(r.title)) issues.push(`${route}: same title as ${titles.get(r.title)} ("${r.title}")`)
    titles.set(r.title, route)
    if (r.h1 !== 1) issues.push(`${route}: ${r.h1} h1`)
    if (r.skip) issues.push(`${route}: heading levels skip ${r.skip}`)
    if (r.main !== 1) issues.push(`${route}: ${r.main} main landmarks`)
    if (area === "site" && r.footer < 1) issues.push(`${route}: no footer landmark`)
    if (r.noAlt) issues.push(`${route}: ${r.noAlt} images without alt`)
    if (r.unnamed.length) issues.push(`${route}: unnamed controls ${r.unnamed.slice(0, 3).join(", ")}`)
    if (r.unlabelledNavs) issues.push(`${route}: ${r.unlabelledNavs} navigation landmarks without a label`)
  }
  await page.setViewportSize({ width: 1280, height: 800 })
  for (const route of PUBLIC) { await page.goto(route); await expect(page.locator("h1").first()).toBeVisible(); await settle(page); await audit(route, "site") }
  await demo(page)
  for (const route of APP) { await page.goto(route); await expect(page.locator("main h1").first()).toBeVisible(); await settle(page); await audit(route, "app") }
  expect(issues).toEqual([])
})

test("screen reader: status messages and toasts are announced, motion respects the reduce-motion setting", async ({ page }) => {
  test.setTimeout(120_000)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto("/"); await expect(page.locator("h1").first()).toBeVisible(); await settle(page)
  const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && !(a.effect as KeyframeEffect | null)?.target?.closest?.("[aria-hidden='true']")).length)
  expect(running, "no animation runs when the person asked for less motion").toBe(0)
  await demo(page)
  const live = await page.evaluate(() => [...document.querySelectorAll("[aria-live],[role=status],[role=alert],section[aria-label*='otification' i]")].length)
  expect(live, "the page has a live region for announcements (toasts)").toBeGreaterThan(0)
})

test("menus close by themselves when a choice takes you somewhere, on a laptop and on a phone", async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto("/"); await expect(page.locator("h1").first()).toBeVisible(); await settle(page)
  for (const name of [/platform/i, /teams/i, /trust/i]) {
    await page.goto("/"); await expect(page.locator("h1").first()).toBeVisible()
    const trigger = page.getByRole("button", { name }).first()
    await trigger.click()
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    const from = page.url()
    await page.locator("[data-slot=navigation-menu-content] a").first().click()
    await expect.poll(() => page.url(), `${name} link navigates`).not.toBe(from)
    await expect(trigger, `${name} menu closes after the click`).toHaveAttribute("aria-expanded", "false")
    await expect(page.locator("[data-slot=navigation-menu-content]:visible"), "no menu panel is left open").toHaveCount(0)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/"); await expect(page.locator("h1").first()).toBeVisible()
  await page.getByRole("button", { name: "Open menu" }).click()
  const sheet = page.getByRole("dialog")
  await expect(sheet).toBeVisible()
  await sheet.getByRole("link", { name: "Pricing" }).click()
  await expect(page).toHaveURL(/\/pricing/)
  await expect(sheet, "the phone menu closes after the click").toBeHidden()
})

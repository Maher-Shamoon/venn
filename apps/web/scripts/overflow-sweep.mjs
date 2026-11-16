// Finds text that spills out of or is clipped inside its box, at many widths, in the sample workspace. Usage: npx vite preview --port 4173, then: node scripts/overflow-sweep.mjs (env WIDTHS, ROUTES, BASE).
import { chromium } from "@playwright/test"
const BASE = process.env.BASE || "http://localhost:4173"
const W = (process.env.WIDTHS || "320,360,390,430,600,768,820,1024,1180,1280,1440,1920").split(",").map(Number)
const ROUTES = (process.env.ROUTES || "/app,/app/customers,/app/invoices,/app/payments,/app/reconciliation,/app/investigations,/app/approvals,/app/collections,/app/disputes,/app/reports,/app/reports/aging,/app/documents,/app/tasks,/app/integrations,/app/team,/app/settings,/app/audit-log,/app/notifications,/app/profile,/app/invoices/import").split(",")
const detect = () => {
  const out = []
  const vw = document.documentElement.clientWidth
  if (document.documentElement.scrollWidth > vw + 1) out.push(`PAGE scrolls sideways: ${document.documentElement.scrollWidth} > ${vw}`)
  const box = (el) => { for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const c = getComputedStyle(e); if (/auto|scroll|hidden|clip/.test(c.overflowX)) return null; if ((c.backgroundColor !== "rgba(0, 0, 0, 0)" && c.backgroundColor !== "rgb(255, 255, 255)") || parseFloat(c.borderTopWidth) > 0 || parseFloat(c.borderLeftWidth) > 0) return e } return null }
  const seen = new Set()
  document.querySelectorAll("main *, aside *, header *").forEach((el) => {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect()
    if (!r.width || !r.height || cs.display === "none" || cs.visibility === "hidden" || el.closest("[aria-hidden='true'],.sr-only,[hidden]")) return
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    if (!own) return
    const txt = el.textContent.trim().slice(0, 30)
    const tag = `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")}`
    // 1 text wider than its own box
    if (el.scrollWidth > el.clientWidth + 1 && cs.display !== "inline") {
      const clip = cs.overflowX
      if (clip === "visible") out.push(`SPILL ${tag} "${txt}" scroll=${el.scrollWidth} box=${el.clientWidth}`)
      else if ((clip === "hidden" || clip === "clip") ) out.push(`${cs.textOverflow === "ellipsis" ? "ELLIPSIS" : "CLIPPED"} ${tag} "${txt}" scroll=${el.scrollWidth} box=${el.clientWidth}`)
    }
    // 2 text outside the card it sits in
    const range = document.createRange(); range.selectNodeContents(el)
    const t = range.getBoundingClientRect(), b = box(el)
    if (b) { const br = b.getBoundingClientRect(); const bs = getComputedStyle(b)
      if (bs.overflowX === "visible" && (t.right > br.right + 1 || t.left < br.left - 1)) { const k = tag + txt; if (!seen.has(k)) { seen.add(k); out.push(`OUTSIDE-CARD ${tag} "${txt}" text.right=${Math.round(t.right)} card.right=${Math.round(br.right)}`) } } }
    // 3 touch target too small (buttons / links in app chrome), reported separately
  })
  return out
}
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
await page.goto(BASE + "/demo?to=/app"); await page.waitForTimeout(2500)
const all = {}
for (const w of W) {
  await page.setViewportSize({ width: w, height: w < 700 ? 800 : 900 })
  for (const route of ROUTES) {
    await page.goto(BASE + route); await page.waitForSelector("main h1, h1", { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(700)
    const r = await page.evaluate(detect)
    if (process.env.SHOT && r.length) await page.screenshot({ path: `${process.env.SHOT}/${w}${route.replace(/\//g, "_")}.png` })
    for (const x of r) (all[`${route} :: ${x.replace(/ scroll=\d+ box=\d+| text\.right=\d+ card\.right=\d+/, "")}`] ||= []).push(w)
  }
}
for (const [k, v] of Object.entries(all)) console.log(`${v.join(",")}  ${k}`)
console.log(`DONE ${Object.keys(all).length} distinct issues`)
await browser.close()

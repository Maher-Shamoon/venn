/** Text that spills out of, or is clipped inside, its box; and a page that scrolls sideways. Ellipsis on names is allowed, on figures it is not. */
export const detect = () => {
  const out: string[] = []
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) out.push("page scrolls sideways")
  document.querySelectorAll("body *").forEach((el) => {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect()
    if (!r.width || !r.height || cs.display === "none" || cs.visibility === "hidden" || el.closest("[aria-hidden='true'],.sr-only,[hidden]")) return
    if (cs.position === "sticky" && cs.overflowY === "visible" && r.height > innerHeight - (parseFloat(cs.top) || 0) + 1) out.push(`PINNED taller than the screen ${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 2).join(".")}`)
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) return
    const txt = el.textContent!.trim().slice(0, 30), tag = `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")}`
    if (el.scrollWidth > el.clientWidth + 1 && cs.display !== "inline") {
      const figure = /[$€£]\s?\d|^\d[\d,.]*$/.test(txt)
      if (cs.overflowX === "visible") out.push(`SPILL ${tag} "${txt}"`)
      else if (cs.overflowX !== "auto" && cs.overflowX !== "scroll" && (cs.textOverflow !== "ellipsis" || figure)) out.push(`CLIPPED ${tag} "${txt}"`)
    }
  })
  return out
}
export const SIZES = [280, 320, 360, 390, 430, 600, 768, 820, 1024, 1100, 1280, 1440, 1920, 2560, 3440, 3840]

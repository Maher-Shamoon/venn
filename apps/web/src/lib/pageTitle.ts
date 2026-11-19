let first = true

/** Keeps the tab title and the screen reader's position in step with the page. The title follows the page heading as soon as it renders
 *  (lazy screens render it late, and detail pages change it when their data arrives). After a navigation, focus moves to the heading so
 *  a screen reader announces the new page instead of staying on a control that is gone. Returns a cleanup. */
export function trackPage(home?: string): () => void {
  const isNavigation = !first
  first = false
  let focused = !isNavigation
  const apply = () => {
    const h = document.querySelector("main h1") as HTMLElement | null
    const text = h?.textContent?.trim()
    if (!h || !text) return
    document.title = home ?? `${text.slice(0, 60)} · venn`
    if (!focused) { focused = true; h.tabIndex = -1; h.focus({ preventScroll: true }) }
  }
  apply()
  const mo = new MutationObserver(apply)
  mo.observe(document.body, { childList: true, subtree: true, characterData: true })
  const stop = setTimeout(() => mo.disconnect(), 8000)
  return () => { mo.disconnect(); clearTimeout(stop) }
}

import { Suspense, useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { SiteFooter } from "./Footer"
import { SiteHeader } from "./Header"
import { SkipLink } from "@/components/venn/SkipLink"

export function SiteLayout() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    // Page title follows the page heading once it has rendered. The home page keeps the full tagline.
    const t = setTimeout(() => { const h = document.querySelector("main h1")?.textContent?.trim(); document.title = pathname === "/" || !h ? "venn: find the revenue slipping through the cracks" : `${h.slice(0, 60)} · venn` }, 60)
    return () => clearTimeout(t)
  }, [pathname])
  return (
    <>
      <SkipLink />
      <SiteHeader />
      {/* The header and footer stay on screen while a page's code arrives, so moving around never shows a blank page. */}
      <Suspense fallback={<main className="min-h-[70vh]" role="status" aria-label="Loading" />}><Outlet /></Suspense>
      <SiteFooter />
    </>
  )
}

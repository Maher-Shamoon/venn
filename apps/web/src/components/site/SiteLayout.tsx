import { Suspense, useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { SiteFooter } from "./Footer"
import { SiteHeader } from "./Header"
import { SkipLink } from "@/components/venn/SkipLink"
import { Skeleton } from "@/components/ui/skeleton"

/** Page-shaped placeholder shown while a public page's code arrives; the header and footer stay put. */
const SiteSkeleton = () => (
  <main role="status" aria-busy="true" aria-label="Loading" className="mx-auto min-h-[70vh] max-w-[1180px] px-5 py-16 md:px-8 md:py-24">
    <Skeleton className="h-12 w-3/4 max-w-[640px]" /><Skeleton className="mt-5 h-5 w-2/3 max-w-[520px]" /><Skeleton className="mt-3 h-5 w-1/2 max-w-[420px]" />
    <div className="mt-12 grid gap-4 md:grid-cols-3"><Skeleton className="h-56 rounded-xl" /><Skeleton className="h-56 rounded-xl" /><Skeleton className="h-56 rounded-xl" /></div>
  </main>
)

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
      <Suspense fallback={<SiteSkeleton />}><Outlet /></Suspense>
      <SiteFooter />
    </>
  )
}

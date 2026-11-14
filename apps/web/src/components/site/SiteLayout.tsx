import { useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { SiteFooter } from "./Footer"
import { SiteHeader } from "./Header"
import { SkipLink } from "@/components/venn/SkipLink"

export function SiteLayout() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return (
    <>
      <SkipLink />
      <SiteHeader />
      <Outlet />
      <SiteFooter />
    </>
  )
}

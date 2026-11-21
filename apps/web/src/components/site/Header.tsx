import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { Link } from "react-router-dom"
import { ArrowRight, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from "@/components/ui/navigation-menu"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Logo } from "@/components/venn/kit"
import { cn } from "@/lib/utils"
import { PLATFORM, TEAMS, TRUST, type NavItem } from "./nav"

const trigger = "h-10 rounded-md bg-transparent px-3 text-sm font-normal text-foreground transition-colors duration-[240ms] hover:bg-black/[.04] hover:text-foreground focus:bg-black/[.04] data-[popup-open]:bg-black/[.04]"

function Grid({ items, cols = 2, feature }: { items: NavItem[]; cols?: 1 | 2; feature?: { t: string; d: string; to: string } }) {
  return (
    <div className="flex w-[min(640px,90vw)] gap-2 p-2">
      <ul className={cn("grid flex-1 gap-1", cols === 2 ? "grid-cols-2" : "grid-cols-1")}>
        {items.map(({ icon: Icon, t, d, to }) => (
          <li key={t}>
            <NavigationMenuLink render={<Link to={to} />} className="flex items-start gap-3 rounded-lg p-3 transition-colors duration-300 hover:bg-muted">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted"><Icon className="size-4" /></span>
              <span><span className="block text-sm text-foreground">{t}</span><span className="block text-sm text-hushed">{d}</span></span>
            </NavigationMenuLink>
          </li>
        ))}
      </ul>
      {feature && (
        <Link to={feature.to} className="group hidden w-[190px] shrink-0 flex-col justify-between rounded-lg bg-lime p-4 text-foreground md:flex">
          <div className="text-lg leading-6 tracking-[-0.01em]">{feature.t}</div>
          <div><p className="text-sm">{feature.d}</p><ArrowRight className="mt-3 size-4 transition-transform duration-300 group-hover:translate-x-1" /></div>
        </Link>
      )}
    </div>
  )
}

export function SiteHeader() {
  const { pathname } = useLocation()
  const [menu, setMenu] = useState<string | null>(null), [sheet, setSheet] = useState(false)
  // Every dropdown and the phone menu close as soon as a choice takes you somewhere.
  useEffect(() => { setMenu(null); setSheet(false) }, [pathname])
  const [bar, setBar] = useState(true)
  useEffect(() => { document.documentElement.style.setProperty("--bar", bar ? "40px" : "0px") }, [bar])
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 8)
    f(); window.addEventListener("scroll", f, { passive: true })
    return () => window.removeEventListener("scroll", f)
  }, [])
  const menus: [string, NavItem[], { t: string; d: string; to: string }?][] = [
    ["Platform", PLATFORM, { t: "See an investigation end to end", d: "A short payment, explained.", to: "/demo?to=/app/investigations/INVG-0001" }],
    ["Teams", TEAMS],
    ["Trust", TRUST],
  ]
  return (
    <>
      {bar && (
        <aside aria-label="Announcement" className="sticky top-0 z-[60] flex h-10 items-center justify-center bg-[#1a1919] px-10 text-[0.8125rem] text-white">
          <span className="truncate">venn is in early access. Book a walkthrough with your own CSV exports.</span>
          <Link to="/pricing" className="ml-3 hidden underline underline-offset-4 sm:inline">See pricing</Link>
          <button aria-label="Dismiss announcement" onClick={() => setBar(false)} className="absolute right-3 flex size-7 items-center justify-center rounded-md hover:bg-white/10"><X className="size-4" /></button>
        </aside>
      )}
      <header className="sticky top-[var(--bar)] z-50 h-[62px]">
        {/* glass layer: transparent at the top, white 50% + 25px blur after scrolling, with a 0.8px hairline (measured on ramp.com) */}
        <div aria-hidden="true" className={cn("absolute inset-0 border-b-[0.8px] transition-[background-color,backdrop-filter,border-color,box-shadow] duration-300", scrolled ? "border-[rgba(33,33,33,.08)] bg-white/50 shadow-[inset_0_-1px_0_rgba(255,255,255,.7),0_10px_30px_-12px_rgba(12,10,8,.08)] backdrop-blur-[25px] backdrop-saturate-[1.8]" : "border-[rgba(33,33,33,.05)] bg-transparent")} />
        <div className="relative mx-auto flex h-full max-w-[clamp(1280px,82vw,1600px)] items-center gap-2 px-[clamp(1.25rem,3.2vw,3rem)]">
          <Link to="/" aria-label="venn home" className="mr-6 text-foreground"><Logo size={28} /></Link>
          <NavigationMenu className="hidden lg:flex" value={menu} onValueChange={(v) => setMenu((v as string | null) ?? null)}>
            <NavigationMenuList className="gap-0">
              {menus.map(([label, items, feature]) => (
                <NavigationMenuItem key={label} value={label}>
                  <NavigationMenuTrigger className={trigger}>{label}</NavigationMenuTrigger>
                  <NavigationMenuContent><Grid items={items} cols={feature ? 2 : 1} feature={feature} /></NavigationMenuContent>
                </NavigationMenuItem>
              ))}
              {[["Integrations", "/p/integrations"], ["Pricing", "/pricing"]].map(([t, to]) => (
                <NavigationMenuItem key={t}><NavigationMenuLink render={<Link to={to} />} className={cn(trigger, "inline-flex items-center")}>{t}</NavigationMenuLink></NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/login" className="mr-2 hidden rounded-md px-3 py-2 text-sm text-foreground transition-colors duration-[240ms] hover:bg-black/[.04] sm:inline">Sign in</Link>
            <Button variant="lime" render={<Link to="/demo" />} className="hidden sm:inline-flex">See a demo</Button>
            <Button render={<Link to="/signup" />}>Get started</Button>
            <Sheet open={sheet} onOpenChange={setSheet}>
              <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open menu" className="lg:hidden" />}><Menu className="size-5" /></SheetTrigger>
              <SheetContent side="right" className="w-[320px] overflow-y-auto">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <div className="mt-10 flex flex-col px-4 text-base">
                  {menus.map(([label, items]) => (
                    <div key={label} className="mb-3"><div className="px-3 pb-1 font-mono text-[0.75rem] uppercase text-hushed">{label}</div>{items.map((i) => <Link key={i.t} to={i.to} className="block rounded-md px-3 py-2 hover:bg-muted">{i.t}</Link>)}</div>
                  ))}
                  <Link to="/p/integrations" className="rounded-md px-3 py-2 hover:bg-muted">Integrations</Link>
                  <Link to="/pricing" className="rounded-md px-3 py-2 hover:bg-muted">Pricing</Link>
                  <Link to="/login" className="rounded-md px-3 py-2 hover:bg-muted">Sign in</Link>
                  <Button variant="lime" size="lg" render={<Link to="/demo" />} className="mt-4">See a demo</Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </>
  )
}

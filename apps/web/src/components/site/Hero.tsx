import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import Balatro from "@/components/Balatro"
import { Mark, Odometer, money, prefersReducedMotion, useTicker } from "@/components/venn/kit"
import { cn } from "@/lib/utils"

export function EmailForm({ id, cta = "Request early access" }: { id?: string; cta?: string }) {
  const [done, setDone] = useState(false)
  const [err, setErr] = useState(false)
  return (
    <form
      id={id}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        const v = new FormData(e.currentTarget).get("email") as string
        const ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)
        setErr(!ok)
        setDone(ok)
      }}
      className="w-full max-w-[560px]"
    >
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted p-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,.6)] transition-colors focus-within:border-foreground sm:flex-row sm:items-center">
        <label htmlFor={`${id ?? "e"}-input`} className="sr-only">Work email</label>
        <input id={`${id ?? "e"}-input`} name="email" type="email" autoComplete="email" placeholder="What's your work email?" aria-invalid={err} className="h-11 min-w-0 flex-1 bg-transparent px-3 text-base text-foreground outline-none placeholder:text-hushed focus-visible:shadow-none sm:h-auto" />
        <Button variant="lime" size="lg" type="submit" className="shrink-0">{done ? <><Check className="size-4" />Received</> : cta}</Button>
      </div>
      <p className="mt-2 h-5 px-1 text-sm text-hushed" role="status">{err ? "Enter a valid work email address." : done ? "Thanks. We will be in touch shortly." : ""}</p>
    </form>
  )
}

/* ---------- the walkthrough "video": a looping, choreographed case ---------- */
const NAV_OFFSET = 78 // sticky top of the pinned panel, in px

function Card({ n, s, at, children }: { n: number; s: number; at: string; children: ReactNode }) {
  return (
    <div className={cn("transition-[opacity,transform] duration-700 ease-[var(--ease-out-soft)] lg:absolute", at, s >= n ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-8 scale-95 opacity-0")}>{children}</div>
  )
}
function Corner({ className }: { className: string }) { return <span className={`absolute size-[7px] bg-foreground ${className}`} /> }
function Line({ d, on }: { d: string; on: boolean }) {
  return <path d={d} pathLength={1} fill="none" stroke="#0c0a08" strokeOpacity=".55" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="1" style={{ strokeDashoffset: on ? 0 : 1, transition: "stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)" }} />
}

function FlowVideo() {
  // The flow is scrubbed by scroll: the panel pins under the nav and each step appears as you scroll down, and reverses as you scroll up.
  // Below 1024px nothing is pinned: the stacked cards appear one after another as the panel scrolls up the screen. With reduced motion every step is shown.
  const wrap = useRef<HTMLDivElement>(null)
  const bar = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bar")) || 0
  // Pinning needs the whole 600px panel to fit under the nav; on a short screen (a small laptop, a phone on its side) it flows with the page instead.
  const pinned = () => window.matchMedia("(min-width: 1024px)").matches && !prefersReducedMotion() && window.innerHeight - NAV_OFFSET - bar() >= 612
  const [s, setS] = useState(() => (prefersReducedMotion() ? 5 : 0))
  const [pin, setPin] = useState(false)
  useEffect(() => {
    const on = () => {
      const el = wrap.current
      if (!el) return
      if (prefersReducedMotion()) return setS(5)
      setPin(pinned())
      if (!pinned()) { const r = el.getBoundingClientRect(); return setS(Math.min(5, Math.max(0, Math.floor(((window.innerHeight * 0.9 - r.top) / Math.max(1, r.height)) * 6)))) }
      const r = el.getBoundingClientRect(), panel = (el.firstElementChild as HTMLElement).offsetHeight
      const p = (NAV_OFFSET + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bar")) || 0) - r.top) / Math.max(1, r.height - panel)
      setS(Math.min(5, Math.max(0, Math.floor(p * 6))))
    }
    on(); window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on)
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on) }
  }, [])
  const tilt = (r: string) => ({ "--r": r }) as CSSProperties

  return (
    <div ref={wrap} className={cn("mt-6", pin && "lg:h-[1750px]")}>
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-muted", pin && "lg:sticky lg:top-[calc(78px+var(--bar))]")}>
      <div className="relative">
        <div className="dotgrid absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]" />
        <svg className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full lg:block" viewBox="0 0 1200 600" preserveAspectRatio="none" aria-hidden="true">
          <Line on={s >= 2} d="M 200 262 C 200 330, 290 352, 392 356" />
          <Line on={s >= 4} d="M 1010 196 C 1010 270, 985 300, 960 352" />
          <Line on={s >= 4} d="M 712 396 C 780 404, 800 436, 830 456" />
        </svg>
        <div className="relative z-10 grid gap-3 p-4 sm:grid-cols-2 lg:block lg:h-[600px] lg:p-0">
          <Card n={0} s={s} at="lg:left-[4%] lg:top-[7%] lg:w-[270px]">
            <div className="animate-float rounded-md border border-border bg-white p-4 font-mono text-[10.5px] leading-4 text-hushed shadow-sm" style={tilt("-2deg")}>
              <div className="flex justify-between"><span>INVOICE</span><span className="text-foreground">INV-1042</span></div>
              <div className="mt-1 text-foreground">Northwind Labs</div>
              <div className="mt-3 space-y-1.5">{[70, 90, 55].map((w, i) => <div key={i} className="flex justify-between"><span className="h-2 rounded-sm bg-gray-medium/60" style={{ width: `${w}px` }} /><span className="h-2 w-10 rounded-sm bg-gray-medium/60" /></div>)}</div>
              <div className="mt-3 flex items-end justify-between border-t border-border pt-2 text-foreground"><span>TOTAL</span><span className="text-[15px]">$5,000.00</span></div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className={cn("inline-flex rounded-sm px-1.5 py-0.5 text-[10px] transition-colors duration-500", s >= 2 ? "bg-[#fff1c7] text-[#8a5a00]" : "bg-[#fbe9dd] text-[#a24a10]")}>{s >= 2 ? "$1,000.00 STILL OPEN" : "43 DAYS OVERDUE"}</span>
                {s >= 2 && <span className="inline-flex animate-[rise-in_.5s_both] rounded-sm bg-lime px-1.5 py-0.5 text-[10px] text-foreground">− $4,000.00 MATCHED</span>}
              </div>
            </div>
          </Card>

          <Card n={1} s={s} at="lg:left-[30%] lg:top-[46%] lg:w-[330px]">
            <div className="grain animate-float-slow relative overflow-hidden rounded-2xl bg-[#14110f] p-5 text-white shadow-xl" style={tilt("3deg")}>
              <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1 text-lg font-medium tracking-[-0.05em]">venn<Mark className="size-4" /></span><span className="font-mono text-[10px] text-white/60">BANK FEED</span></div>
              <div className="mt-5 font-mono text-[11px] text-white/60">PAY-0005 · WIRE · 9 OCT</div>
              <div className="mt-1 text-[34px] leading-[38px] tracking-[-0.02em]">$4,000.00</div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1"><span className="size-1.5 animate-pulse-dot rounded-full bg-lime" />bank verified</span>
                {s >= 2 && <span className="inline-flex animate-[rise-in_.5s_both] items-center gap-1 rounded-full bg-lime px-2.5 py-1 text-foreground"><Check className="size-3" />allocated to INV-1042</span>}
              </div>
            </div>
          </Card>

          <Card n={3} s={s} at="lg:right-[4%] lg:top-[6%] lg:w-[260px]">
            <div className="animate-float-slow rounded-lg border border-white/70 bg-white/80 p-4 text-sm shadow-sm backdrop-blur-md" style={tilt("2deg")}>
              <div className="flex items-center justify-between text-xs text-hushed"><span>Hannah Cole · 28 Oct</span><span className="rounded-sm bg-[#fff1c7] px-1.5 py-0.5 font-mono text-[10px] text-[#8a5a00]">UNVERIFIED</span></div>
              <p className="mt-2 text-foreground">“We sent the remaining $1,000 by wire last Friday.”</p>
              <p className="mt-2 text-xs text-hushed">Email is evidence, not a payment.</p>
            </div>
          </Card>

          <Card n={4} s={s} at="lg:bottom-[9%] lg:right-[7%] lg:w-[300px]">
            <div className="relative rounded-md border border-foreground bg-white p-4 shadow-sm">
              <Corner className="-left-[4px] -top-[4px]" /><Corner className="-right-[4px] -top-[4px]" /><Corner className="-bottom-[4px] -left-[4px]" /><Corner className="-bottom-[4px] -right-[4px]" />
              <div className="font-mono text-[10px] text-hushed">FINDING · CALCULATED BY venn</div>
              <div className="mt-1 text-[32px] leading-9 tracking-[-0.02em]">$1,000.00</div>
              <div className="text-sm text-hushed">still outstanding on INV-1042. No bank record of a second wire.</div>
              <div className={cn("mt-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors duration-500", s >= 5 ? "bg-foreground text-white" : "bg-lime text-foreground")}>{s >= 5 ? <><Check className="size-3.5" />Request sent</> : "Request proof of payment"}</div>
              <svg viewBox="0 0 20 20" aria-hidden="true" className={cn("pointer-events-none absolute left-[34px] top-[150px] z-20 size-6 drop-shadow transition-[transform,opacity] duration-[1100ms] ease-[var(--ease-out-soft)]", s >= 4 ? "translate-x-0 translate-y-0 opacity-100" : "translate-x-24 -translate-y-24 opacity-0", s === 5 && "animate-click")}><path d="M3 2l13 7-6 1.6L7.6 17z" fill="#0c0a08" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" /></svg>
            </div>
          </Card>

          <Card n={5} s={s} at="lg:bottom-[8%] lg:left-[5%] lg:w-[260px]">
            <div className="rounded-xl border border-border bg-white p-4 text-sm shadow-md">
              <div className="flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-full bg-lime"><Check className="size-3.5" /></span>Owner approved</div>
              <div className="mt-1 text-xs text-hushed">Logged to the audit trail · 09:12</div>
            </div>
          </Card>
        </div>
      </div>

    </div>
    </div>
  )
}

export function Hero() {
  const exposure = useTicker(44250.37, 0.21, 3.9, 2000)
  // On a phone the sphere is small and the screen dense: draw it finer so it does not look soft.
  const sharp = typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches
  return (
    <section className="relative mx-auto max-w-[clamp(1280px,82vw,1600px)] px-[clamp(1.25rem,3.2vw,3rem)] pb-6 pt-10 md:pt-14">
      <div className="inline-flex items-center gap-2 font-mono text-[0.75rem] uppercase tracking-[0.02em] text-hushed">
        <span>Exposure under review:</span>
        <Odometer value={money(exposure)} className="rounded-sm bg-muted px-1.5 py-0.5 text-foreground" />
      </div>
      <h1 className="mt-5 max-w-[1050px] xl:max-w-[min(60%,960px)] tracking-[-0.02em] text-d1">Find the revenue slipping through the cracks.</h1>
      <p className="mt-4 max-w-[760px] text-lg text-hushed sm:text-xl sm:leading-8">Invoices, payments and email, <span className="border-b border-dotted border-hushed">investigated</span>, explained and approved by your team. <span className="whitespace-nowrap">In the blink of an eye.</span></p>
      <div className="mt-8"><EmailForm id="hero" /></div>
      <div className="relative z-0 mx-auto mt-8 size-[min(74vw,320px)] overflow-hidden rounded-full xl:absolute xl:right-10 xl:top-11 xl:mt-0 xl:size-[clamp(400px,24vw,540px)]">
        <Balatro color1="#f9a8d4" color2="#000000" color3="#000000" swirl={0.25} pixelSize={sharp ? 0.8 : 1.5} maxDevicePixelRatio={sharp ? 2.5 : 2} mouseInteraction contrast={3.5} lighting={0.4} speed={1} rotationSpeed={0} scale={1} detail={5} crt={0} mouseStrength={1} intro lightMode={false} sphere />
      </div>
      <FlowVideo />
    </section>
  )
}

/* fixed bottom bar: a continuously moving strip of live counters (ramp's "agents at work" bar) */
export function LiveBar() {
  const a = useTicker(1646, 1, 6, 1100), b = useTicker(355, 0, 3, 1700), c = useTicker(286, 0, 2, 2300), d = useTicker(93, 0, 2, 2600), e = useTicker(12408, 3, 19, 900)
  const items: [string, number][] = [["Records reconciled", a], ["Evidence items linked", b], ["Discrepancies flagged", c], ["Calculations checked", d], ["Invoice lines read", e]]
  const group = (k: string) => (
    <div key={k} className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={k === "b"}>
      {items.map(([l, v]) => <span key={l} className="flex items-center gap-2 whitespace-nowrap uppercase">{l}:<Odometer value={Math.round(v).toLocaleString("en-US")} className="rounded-sm bg-muted px-1.5 py-0.5 text-foreground" /></span>)}
    </div>
  )
  return (
    // sticky bottom: pinned to the bottom of the screen while the hero is on screen; once you scroll to its natural spot (end of the hero) it stays there
    <div className="sticky bottom-0 z-40 mt-12 bg-white/60 backdrop-blur-[25px] backdrop-saturate-150">
      <div className="mx-auto flex h-12 max-w-[clamp(1280px,82vw,1600px)] items-center gap-5 overflow-hidden px-5 font-mono text-[0.75rem] tracking-[0.02em] text-hushed md:px-10">
        <span className="flex shrink-0 items-center gap-2.5 uppercase text-foreground">
          <svg viewBox="0 0 14 14" className="size-3.5" aria-hidden="true" fill="currentColor">{[[3, 2], [7, 2], [11, 2], [3, 7], [7, 7], [11, 7], [5, 12], [9, 12]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.25" />)}</svg>Agents at work today:
        </span>
        <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]">
          <div className="flex w-max animate-marquee-fast hover:[animation-play-state:paused]">{group("a")}{group("b")}</div>
        </div>
      </div>
    </div>
  )
}

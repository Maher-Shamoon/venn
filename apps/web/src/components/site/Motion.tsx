import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Check, Code2, FileText, Network, Search, Server, ShieldCheck, UsersRound, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo, Reveal, TwoTone, prefersReducedMotion } from "@/components/venn/kit"
import { cn } from "@/lib/utils"

const wrap = "mx-auto max-w-[1280px] px-5 md:px-10"
const clamp = (x: number) => Math.min(1, Math.max(0, x))
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a))
const ease = (x: number) => 1 - Math.pow(1 - x, 3)
const smooth = (x: number) => x * x * (3 - 2 * x)

/* ---------- statement + industry cards ---------- */
const IND: { Ic: LucideIcon; n: string; d: string; rows: [string, string][]; tone: string }[] = [
  { Ic: Code2, n: "Software agencies", d: "Milestone and retainer invoices matched to the right project line.", rows: [["Milestone 2 · Atlas rebuild", "$12,000.00"], ["Retainer · May", "$4,500.00"], ["Change request 7", "$1,800.00"]], tone: "#fce7f3" },
  { Ic: Network, n: "IT consultancies", d: "Part-payments against long statements of work, explained with evidence.", rows: [["SOW 14 · phase 1", "$18,000.00"], ["SOW 14 · phase 2", "$18,000.00"], ["Travel disbursement", "$640.00"]], tone: "#f4f2f0" },
  { Ic: Server, n: "Managed service providers", d: "Recurring invoices across many clients, reconciled without a spreadsheet.", rows: [["Monthly retainer · 12 clients", "$31,200.00"], ["Per-seat overage", "$2,150.00"], ["Hardware resale", "$7,400.00"]], tone: "#fbcfe8" },
  { Ic: UsersRound, n: "Staffing and recruitment", d: "Timesheet-driven invoices and remittances that rarely match one to one.", rows: [["Week 18 timesheets", "$22,500.00"], ["Placement fee", "$9,000.00"], ["Credit note", "−$410.00"]], tone: "#efece8" },
  { Ic: UsersRound === Network ? Network : FileText, n: "Professional services", d: "Retainers, disbursements and late payers: one case file per discrepancy.", rows: [["Advisory retainer · Q3", "$15,000.00"], ["Filing disbursement", "$320.00"], ["Final notice draft", "$4,300.00"]], tone: "#fdf2f8" },
]
function Industries() {
  const [a, setA] = useState(0)
  return (
    <div className="mt-12 flex flex-col gap-3 md:h-[400px] md:flex-row">
      {IND.map(({ Ic, n, d, rows, tone }, k) => {
        const on = a === k
        return (
          <button key={n} type="button" aria-expanded={on} onMouseEnter={() => setA(k)} onFocus={() => setA(k)} onClick={() => setA(k)} style={{ background: tone }}
            className={cn("group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border-[0.8px] border-border p-6 text-left transition-[flex-grow,box-shadow] duration-700 ease-[var(--ease-out-soft)] md:basis-0", on ? "md:grow-[3.6] md:shadow-[0_24px_50px_-30px_rgba(12,10,8,.45)]" : "md:grow-[1]")}>
            <span className="flex size-11 items-center justify-center rounded-lg bg-white transition-transform duration-500 group-hover:-rotate-6"><Ic className="size-5" strokeWidth={1.5} /></span>
            <h3 className="mt-5 text-lg leading-6 tracking-[-0.01em] md:text-xl">{n}</h3>
            <div className={cn("mt-auto pt-6 transition-all duration-500 md:w-[360px]", on ? "opacity-100 md:delay-200" : "md:translate-y-6 md:opacity-0")}>
              <p className="text-base">{d}</p>
              <div className="mt-4 space-y-1.5">
                {rows.map(([l, v], i) => (
                  <div key={l} style={{ transitionDelay: on ? `${250 + i * 90}ms` : "0ms" }} className={cn("flex items-center justify-between rounded-lg bg-white/90 px-3 py-2 text-sm transition-all duration-500", on ? "translate-y-0 opacity-100" : "md:translate-y-5 md:opacity-0")}>
                    <span className="truncate">{l}</span><span className="ml-3 font-mono text-xs">{v}</span>
                  </div>))}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
export function Statement() {
  return (
    <section className={`${wrap} pb-12 pt-12 md:pb-16`}>
      <Reveal>
        <p className="font-mono text-[11px] uppercase tracking-[0.02em] text-hushed">Built for teams that bill for their time</p>
        <h2 className="mt-4 max-w-[900px] text-[30px] leading-9 tracking-[-0.01em] md:text-[48px] md:leading-[52px]">
          <TwoTone lead="Finance teams lose revenue in the gaps between systems." rest="venn closes them: one case file per discrepancy, every claim tied to a record." />
        </h2>
        <Button variant="lime" size="lg" render={<Link to="/demo" />} className="mt-8">Explore the product</Button>
      </Reveal>
      <Reveal delay={100}><Industries /></Reveal>
    </section>
  )
}

/* ---------- how it works ---------- */
const STEPS: [string, string, string, LucideIcon][] = [
  ["01", "Connect", "Drop in CSV exports, or connect your inbox and accounting system read-only.", FileText],
  ["02", "Investigate", "venn matches payments, flags discrepancies and builds a case file where every line cites a record.", Search],
  ["03", "Decide", "Owners approve what matters. Every decision is logged. Nothing moves money.", ShieldCheck],
]
export function Steps() {
  return (
    <section className={`${wrap} pb-20 md:pb-28`}>
      <Reveal><h2 className="max-w-[760px] text-[32px] leading-[38px] tracking-[-0.01em] md:text-[40px] md:leading-[42px]"><TwoTone lead="Three steps from a messy export to a decision." rest="No new accounting system. No rip and replace." /></h2></Reveal>
      <div className="relative mt-10 grid gap-3 md:grid-cols-3">
        <svg aria-hidden="true" className="pointer-events-none absolute left-[16%] right-[16%] top-[58px] hidden h-1 w-[68%] md:block" preserveAspectRatio="none" viewBox="0 0 100 1"><line x1="0" y1=".5" x2="100" y2=".5" stroke="#f472b6" strokeWidth="2" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" className="animate-dash" /></svg>
        {STEPS.map(([n, t, d, Ic], i) => (
          <Reveal key={t} delay={i * 110}>
            <div className="group relative h-full overflow-hidden rounded-xl border-[0.8px] border-border bg-muted p-7 transition-all duration-500 ease-[var(--ease-out-soft)] hover:-translate-y-1.5 hover:bg-lime">
              <span className="absolute -right-2 -top-4 select-none text-[120px] leading-none tracking-[-0.06em] text-black/[.05] transition-transform duration-700 group-hover:-translate-x-2 group-hover:translate-y-2">{n}</span>
              <span className="relative z-10 flex size-14 items-center justify-center rounded-full bg-white transition-transform duration-500 group-hover:scale-110"><Ic className="size-6" strokeWidth={1.5} /></span>
              <h3 className="relative mt-10 text-2xl leading-8">{t}</h3>
              <p className="relative mt-2 max-w-[340px] text-base text-hushed transition-colors duration-300 group-hover:text-foreground/80">{d}</p>
            </div>
          </Reveal>))}
      </div>
    </section>
  )
}

/* ---------- product film: one continuous looping take with a driven cursor ---------- */
const T = 30
const PH = [0, 4, 10, 18, 24, 30]
const NAV = ["Dashboard", "Reconciliation", "Investigations", "Collections", "Approvals"]
const CAP: [string, string][] = [
  ["Open the day with the numbers.", "Exposure, open cases and pending approvals in one view."],
  ["Every payment, matched.", "Exact matches apply on their own. The rest wait for a person."],
  ["A shortfall, explained.", "Facts, calculations and claims stay apart, each tied to a record."],
  ["A reminder, in seconds.", "Drafted from your records and checked against them."],
  ["An owner decides.", "Every decision is logged and cannot be edited."],
]
const PATH: [number, number, number][] = [[0, 760, 440], [1.2, 440, 200], [2.5, 380, 330], [3.4, 92, 140], [3.7, 92, 140], [5, 560, 170], [5.8, 600, 230], [6.8, 610, 290], [8.3, 620, 346], [9.2, 890, 346], [9.6, 890, 346], [10.9, 430, 190], [12.3, 740, 138], [13.6, 740, 234], [14.8, 740, 330], [16.7, 350, 404], [17.2, 350, 404], [19.2, 520, 260], [22.6, 640, 444], [23.1, 640, 444], [25.2, 420, 300], [26.2, 385, 322], [26.9, 385, 322], [28.4, 700, 430], [30, 760, 440]]
const CLICKS: [number, number, number][] = [[3.6, 92, 140], [9.5, 890, 346], [17, 350, 404], [22.9, 640, 444], [26.6, 385, 322]]
function cursorAt(t: number): [number, number] {
  for (let i = 0; i < PATH.length - 1; i++) {
    const [a, ax, ay] = PATH[i], [b, bx, by] = PATH[i + 1]
    if (t >= a && t <= b) { const q = smooth((t - a) / (b - a)); return [ax + (bx - ax) * q, ay + (by - ay) * q] }
  }
  return [PATH[0][1], PATH[0][2]]
}
const MAIL = "Hi Northwind team, INV-1042 shows a balance of $1,000.00 after your payment of $4,000.00 on 9 Oct. Could you send proof of the second transfer you mentioned?"
const usd = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const inside = (c: [number, number], x: number, y: number, w: number, h: number) => c[0] >= x && c[0] <= x + w && c[1] >= y && c[1] <= y + h
const rise = (lt: number, a: number) => { const q = ease(seg(lt, a, a + 0.6)); return { opacity: q, transform: `translateY(${(1 - q) * 28}px)` } }
const abs = (x: number, y: number, w: number, h?: number) => ({ left: x, top: y, width: w, ...(h ? { height: h } : {}) })
const chip = { ok: "bg-[#e3f6e6] text-[#17692b]", warn: "bg-[#fff1c7] text-[#8a5a00]", info: "bg-[#e4ebf6] text-[#3a5fa8]" }

function P0({ lt }: { lt: number }) {
  const k = ease(seg(lt, 0.3, 1.8))
  const kpi: [string, string][] = [["OPEN EXPOSURE", usd(44250.37 * k)], ["CASES TO REVIEW", String(Math.round(12 * k))], ["AWAITING APPROVAL", String(Math.round(3 * k))]]
  const rows: [string, string, string, string][] = [["INVG-0001", "Northwind Labs · short payment", "$1,000.00", "ready for review"], ["INVG-0002", "Meridian · duplicate payment", "$9,600.00", "evidence gathering"], ["INVG-0003", "Halcyon · claimed wire", "$22,500.00", "waiting on customer"], ["INVG-0004", "Brightwell · unapplied credit", "$410.00", "draft ready"]]
  return (<>
    {kpi.map(([l, v], i) => <div key={l} style={{ ...abs(200 + i * 260, 76, 240, 104), ...rise(lt, 0.1 + i * 0.12) }} className={cn("absolute rounded-xl border border-black/10 p-4", i === 0 ? "bg-[#f9a8d4]" : "bg-[#f4f2f0]")}><div className="font-mono text-[10px]">{l}</div><div className="mt-2 text-[30px] leading-9 tracking-[-0.02em] tabular-nums">{v}</div></div>)}
    <div style={{ ...abs(200, 204, 760, 296), ...rise(lt, 0.7) }} className="absolute rounded-xl border border-black/10 bg-white" />
    <div style={abs(216, 216, 400)} className="absolute text-[15px]">Open cases</div>
    {rows.map(([id, n, a, s], i) => <div key={id} style={{ ...abs(216, 252 + i * 58, 728, 48), ...rise(lt, 1.1 + i * 0.28) }} className="absolute flex items-center gap-4 rounded-lg bg-[#f4f2f0] px-4 text-[13px]"><span className="w-[76px] font-mono text-[11px]">{id}</span><span className="flex-1">{n}</span><span className="font-mono text-xs">{a}</span><span className="w-[130px] rounded-full bg-white px-3 py-1 text-center text-[11px]">{s}</span></div>)}
  </>)
}
function P1({ lt, c }: { lt: number; c: [number, number] }) {
  const rows: [string, string, string, string][] = [["PAY-0013", "$1,800.00", "INV-1041", "matched"], ["PAY-0010", "$9,600.00", "INV-1043", "matched"], ["PAY-0012", "$2,450.00", "INV-1046 · alias match", "matched"], ["PAY-0009", "$4,000.00", "INV-1042 · short by $1,000.00", "flagged"], ["PAY-0015", "$3,100.00", "INV-1040 + INV-1049", "review"]]
  return (<>
    <div style={{ ...abs(200, 76, 760, 420), ...rise(lt, 0) }} className="absolute rounded-xl border border-black/10 bg-white" />
    <div style={abs(216, 90, 400)} className="absolute font-mono text-[10px] text-black/50">PAYMENT · AMOUNT · MATCHED TO · STATUS</div>
    {rows.map(([p, a, inv, s], i) => {
      const hov = inside(c, 200, 140 + i * 60, 760, 54), done = lt > 0.6 + i * 0.45
      return (
        <div key={p} style={{ ...abs(212, 140 + i * 60, 736, 52), ...rise(lt, 0.2 + i * 0.12) }} className={cn("absolute flex items-center gap-4 rounded-lg border px-4 text-[13px] transition-colors duration-200", hov ? "border-black/20 bg-[#f4f2f0]" : "border-transparent bg-white")}>
          <span className="w-[76px] font-mono text-[11px]">{p}</span><span className="w-[88px] font-mono text-xs">{a}</span><span className="text-black/40">→</span><span className="flex-1">{inv}</span>
          {s === "flagged" && hov ? <span className="rounded-md bg-[#f9a8d4] px-3 py-1.5 text-[12px]">Investigate →</span>
            : <span className={cn("rounded-full px-3 py-1 text-[11px] transition-all duration-300", s === "matched" ? chip.ok : s === "flagged" ? chip.warn : chip.info, done ? "scale-100 opacity-100" : "scale-75 opacity-0")}>{s}</span>}
        </div>)
    })}
  </>)
}
function P2({ lt, c }: { lt: number; c: [number, number] }) {
  const ev: [string, string, string, string][] = [["CONFIRMED FACT", "One bank payment of $4,000.00 on 9 Oct.", "#17692b", "border-l-[#2f9e44]"], ["CALCULATED BY venn, NOT BY AI", "5,000.00 − 4,000.00 = 1,000.00", "#6e6a68", "border-l-[#9c9692]"], ["UNVERIFIED CLAIM", "Email says a second wire was sent last Friday. No bank record.", "#8a5a00", "border-l-[#e0b13a]"], ["MISSING", "Wire confirmation from the customer.", "#6e6a68", "border-l-[#d2cecb]"]]
  return (<>
    <div style={{ ...abs(200, 76, 300, 280), ...rise(lt, 0) }} className="absolute rounded-xl bg-[#14110f] p-5 text-white">
      <div className="font-mono text-[10px] text-white/50">INVG-0001 · EXPOSURE</div>
      <div className="mt-2 text-[40px] leading-[44px] tracking-[-0.03em] tabular-nums">{usd(1000 * ease(seg(lt, 0.3, 1.6)))}</div>
      <div className="mt-1 text-[13px] text-white/60">short on INV-1042 · Northwind Labs</div>
      <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#f9a8d4]" style={{ width: `${80 * ease(seg(lt, 0.8, 2))}%` }} /></div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-white/50"><span>$4,000.00 received</span><span>$5,000.00 billed</span></div>
    </div>
    <div style={{ ...abs(200, 380, 300, 48), ...rise(lt, 3) }} className={cn("absolute flex items-center justify-center rounded-lg text-[14px] transition-colors duration-200", inside(c, 200, 380, 300, 48) ? "bg-[#f472b6]" : "bg-[#f9a8d4]")}>Draft reminder</div>
    {ev.map(([k, v, col, b], i) => <div key={k} style={{ ...abs(520, 76 + i * 98, 440, 86), ...rise(lt, 0.8 + i * 0.5) }} className={cn("absolute rounded-lg border border-l-[3px] bg-white p-3.5 transition-all duration-200", b, inside(c, 520, 76 + i * 98, 440, 86) ? "border-black/25 shadow-[0_10px_24px_-14px_rgba(0,0,0,.4)]" : "border-black/10")}><div className="font-mono text-[10px]" style={{ color: col }}>{k}</div><div className="mt-1 text-[14px] leading-5">{v}</div></div>)}
  </>)
}
function P3({ lt, c }: { lt: number; c: [number, number] }) {
  const k = Math.floor(MAIL.length * seg(lt, 0.6, 4.2))
  const checks = ["Amount matches INV-1042", "Date matches bank record", "Claim marked unverified"]
  return (<>
    <div style={{ ...abs(200, 76, 560, 320), ...rise(lt, 0) }} className="absolute rounded-xl border border-black/10 bg-white p-5">
      <div className="font-mono text-[10px] text-black/50">DRAFT REMINDER · INV-1042</div>
      <div className="mt-3 border-b border-black/10 pb-2 text-[13px]"><span className="text-black/50">To </span>accounts@northwind-labs.example</div>
      <p className="mt-4 min-h-[110px] text-[16px] leading-6">{MAIL.slice(0, k)}<span className="ml-px inline-block h-[18px] w-[2px] translate-y-[3px] bg-[#f472b6]" /></p>
    </div>
    <div style={{ ...abs(200, 420, 240, 48), ...rise(lt, 0.4) }} className="absolute flex items-center justify-center rounded-lg border border-black/15 text-[14px]">Edit draft</div>
    <div style={{ ...abs(520, 420, 240, 48), ...rise(lt, 0.4) }} className={cn("absolute flex items-center justify-center rounded-lg text-[14px] transition-colors duration-200", inside(c, 520, 420, 240, 48) ? "bg-[#f472b6]" : "bg-[#f9a8d4]")}>Request approval</div>
    <div style={abs(780, 76, 180)} className="absolute space-y-2">{checks.map((t, i) => <div key={t} style={rise(lt, 3.6 + i * 0.35)} className="flex items-start gap-2 rounded-lg bg-[#e3f6e6] p-3 text-[12px] leading-4 text-[#17692b]"><Check className="mt-px size-3.5 shrink-0" />{t}</div>)}</div>
  </>)
}
function P4({ lt, c }: { lt: number; c: [number, number] }) {
  const done = lt > 2.6
  return (<>
    <div style={{ ...abs(300, 90, 420, 270), ...rise(lt, 0) }} className="absolute rounded-xl border border-black/10 bg-white p-6">
      <div className="flex items-center justify-between font-mono text-[11px]"><span>APR-0001 · write-off</span><span className={cn("rounded-full px-2.5 py-0.5 text-[11px] transition-colors duration-300", done ? "bg-[#d3f2da] text-[#17692b]" : chip.warn)}>{done ? "approved" : "pending"}</span></div>
      <div className="mt-3 text-[44px] leading-[48px] tracking-[-0.02em]">$340.00</div>
      <div className="text-[13px] text-black/60">INV-1037 · requested by AR · owner decides</div>
      <div className="mt-6 flex gap-3">
        <span style={{ transform: `scale(${lt > 2.5 && lt < 2.75 ? 0.94 : 1})` }} className={cn("flex h-11 w-[130px] items-center justify-center gap-1.5 rounded-lg text-[14px] transition-all duration-200", done ? "bg-[#4ade80]" : inside(c, 320, 300, 130, 44) ? "bg-[#f472b6]" : "bg-[#f9a8d4]")}>{done && <Check className="size-4" />}{done ? "Approved" : "Approve"}</span>
        <span className="flex h-11 w-[110px] items-center justify-center rounded-lg border border-black/15 text-[14px]">Reject</span>
      </div>
    </div>
    <div style={{ ...abs(300, 384, 420, 56), opacity: ease(seg(lt, 3, 3.6)), transform: `translateY(${(1 - ease(seg(lt, 3, 3.6))) * 20}px)` }} className="absolute flex items-center gap-3 rounded-xl bg-[#14110f] px-4 text-[13px] text-white"><ShieldCheck className="size-4 text-[#f9a8d4]" />Decision recorded in the audit trail. Immutable.</div>
  </>)
}
const PHASES = [P0, P1, P2, P3, P4]

function Cursor({ t, c }: { t: number; c: [number, number] }) {
  const press = CLICKS.some(([ct]) => t - ct > 0 && t - ct < 0.14)
  return (<>
    {CLICKS.map(([ct, x, y]) => { const d = t - ct; if (d < 0 || d > 0.7) return null; const q = ease(d / 0.7); return <span key={ct} className="pointer-events-none absolute rounded-full border-2 border-[#f472b6]" style={{ left: x - 8 - 34 * q, top: y - 8 - 34 * q, width: 16 + 68 * q, height: 16 + 68 * q, opacity: 1 - q }} /> })}
    <svg width="26" height="26" viewBox="0 0 24 24" className="pointer-events-none absolute drop-shadow-[0_3px_6px_rgba(0,0,0,.35)]" style={{ left: c[0], top: c[1], transform: `scale(${press ? 0.86 : 1})`, transformOrigin: "2px 2px" }}><path d="M3 2l7.5 19 2.8-8 8-2.7z" fill="#0c0a08" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" /></svg>
  </>)
}

export function FlowFilm() {
  const ref = useRef<HTMLElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [t, setT] = useState(0)
  const [bw, setBw] = useState(1000)
  const vis = useRef(false)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { vis.current = e.isIntersecting }, { threshold: 0.2 })
    io.observe(ref.current!)
    const ro = new ResizeObserver(([e]) => setBw(e.contentRect.width))
    ro.observe(box.current!)
    if (import.meta.env.DEV) (window as unknown as { __film: typeof setT }).__film = setT
    let raf = 0, last = performance.now()
    if (prefersReducedMotion()) setT(12.5)
    else { const loop = (n: number) => { const d = Math.min(0.1, (n - last) / 1000); last = n; if (vis.current) setT((x) => (x + d) % T); raf = requestAnimationFrame(loop) }; raf = requestAnimationFrame(loop) }
    return () => { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect() }
  }, [])
  const ph = PH.findIndex((s, i) => t >= s && t < PH[i + 1]), p = Math.max(0, ph), lt = t - PH[p], dur = PH[p + 1] - PH[p]
  const fade = Math.min(ease(seg(lt, 0, 0.35)), 1 - seg(lt, dur - 0.3, dur))
  const c = cursorAt(t), Phase = PHASES[p]
  // On a phone the whole 1000px screen would be too small to read: show it at a readable size and let the view follow the cursor.
  const sc = bw < 700 ? Math.max(bw / 1000, 0.66) : bw / 1000, pan = Math.min(0, Math.max(bw - 1000 * sc, bw / 2 - c[0] * sc))
  return (
    <section ref={ref} className={`${wrap} pb-20 md:pb-28`} aria-label="Product walkthrough">
      <Reveal><h2 className="max-w-[820px] text-[32px] leading-[38px] tracking-[-0.01em] md:text-[48px] md:leading-[52px]"><TwoTone lead="See venn work, start to finish." rest="One short payment, from the first number to a logged decision." /></h2></Reveal>
      <Reveal delay={80} className="mt-8">
        <div className="relative overflow-hidden rounded-3xl bg-[#14110f] p-2 sm:p-4 md:p-6">
          <div aria-hidden="true" className="dotgrid pointer-events-none absolute inset-0 opacity-[.07] invert" />
          <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-1/3 size-[420px] rounded-full bg-[#f9a8d4]/25 blur-[100px]" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 size-[320px] rounded-full bg-[#f472b6]/20 blur-[90px]" />
          <div ref={box} role="img" aria-label="Looping product demo: a cursor opens the dashboard, reconciles payments, investigates a $1,000 shortfall, drafts a reminder and an owner approves. " className="relative w-full overflow-hidden rounded-xl border border-white/10 shadow-[0_40px_80px_-30px_rgba(0,0,0,.8)]" style={{ height: 560 * sc }}>
            <div className="absolute left-0 top-0 overflow-hidden bg-white text-[#0c0a08]" style={{ width: 1000, height: 560, transform: `translateX(${pan}px) scale(${sc})`, transformOrigin: "0 0" }}>
              <div className="absolute inset-y-0 left-0 w-[180px] border-r border-black/10 bg-[#f4f2f0] p-4">
                <Logo size={22} />
                <div className="mt-6 space-y-1">{NAV.map((n, i) => <div key={n} className={cn("flex h-9 items-center rounded-lg px-3 text-[13px] transition-colors duration-200", i === p ? "bg-[#f9a8d4]" : inside(c, 0, 80 + i * 40, 180, 40) ? "bg-black/[.06]" : "")}>{n}</div>)}</div>
              </div>
              <div className="absolute left-[180px] right-0 top-0 flex h-[52px] items-center justify-between border-b border-black/10 px-5"><span className="text-[13px] text-black/50">venn / <span className="text-black">{NAV[p].toLowerCase()}</span></span><span className="flex items-center gap-2 text-[12px]"><span className="rounded-full bg-black px-2.5 py-1 text-white">Owner</span><span className="flex size-7 items-center justify-center rounded-full bg-[#f9a8d4] text-[11px]">PR</span></span></div>
              <div className="absolute inset-0" style={{ opacity: fade }}><Phase lt={lt} c={c} /></div>
              <Cursor t={t} c={c} />
            </div>
          </div>
          <div key={p} className="relative animate-rise-in px-1 pb-1 pt-5 text-white sm:px-2">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase text-white/50"><span className="text-[#f9a8d4]">{String(p + 1).padStart(2, "0")}</span>/ 05</div>
            <div className="mt-1 text-[22px] leading-7 tracking-[-0.01em] sm:text-[32px] sm:leading-9">{CAP[p][0]}</div>
            <p className="mt-1 text-sm text-white/60 sm:text-base">{CAP[p][1]}</p>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

/* ---------- sample voices: three rows, alternating drift ---------- */
const V: [string, string, string, string][] = [
  ["The case file ends the email chase. I open one page and see what was paid, what was claimed and what is missing.", "Priya Raman", "AR lead", "Brightwell Digital"],
  ["Nothing is approved behind my back. Every write-off arrives with its evidence and I decide in a minute.", "Daniel Okoye", "Founder", "Northgate IT"],
  ["It shows its working. The numbers are calculated and the guesses are labelled as guesses.", "Marta Lindqvist", "Finance manager", "Cobalt MSP"],
  ["We stopped re-keying remittance PDFs. Part-payments finally line up with the right invoices.", "Kofi Mensah", "Controller", "Tessera Staffing"],
  ["My team drafts reminders in seconds, and I know the amounts match the books.", "Hana Takeda", "Operations director", "Halden & Co"],
  ["The audit trail alone is worth it. Every decision has a name and a time beside it.", "Rui Marques", "Owner", "Quill Labs"],
  ["Month-end used to start with a spreadsheet hunt. Now it starts with a queue.", "Elena Petrova", "Head of finance", "Marlow Partners"],
  ["It is the first tool that did not pretend to know more than our records say.", "Samir Haddad", "CFO", "Fernhill Consulting"],
  ["Our new hires were useful in a day. The case file explains itself.", "Chloe Bennett", "AR specialist", "Orbit Works"],
  ["Short payments used to hide for weeks. Now they show up with a number and a reason.", "Tomás Rivera", "Controller", "Kestrel Group"],
  ["I can answer a customer's 'we already paid' in one click, with proof either way.", "Aisha Karim", "Collections lead", "Lumen Advisory"],
  ["Approvals feel safe. The owner sees the evidence, not a summary of it.", "Jonas Weber", "Managing partner", "Saffron Studio"],
]
const TILES = ["#fce7f3", "#f4f2f0", "#fbcfe8", "#efece8", "#fdf2f8", "#e4ebf6"]
function VoiceRow({ items, rev, dur }: { items: typeof V; rev?: boolean; dur: string }) {
  const set = (k: string) => <div key={k} className="flex shrink-0 gap-3 pr-3" inert={k === "b"}>{items.map(([q, n, r, co], i) => (
    <figure key={n} tabIndex={0} className="flex h-[212px] w-[320px] shrink-0 flex-col rounded-xl border-[0.8px] border-border bg-white p-5 outline-none transition-all duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-1.5 hover:border-black/25 hover:shadow-[0_22px_44px_-26px_rgba(12,10,8,.45)] focus-visible:-translate-y-1.5 focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-[#f472b6] sm:w-[400px]">
      <figcaption className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-lg text-sm" style={{ background: TILES[(i + (rev ? 3 : 0)) % TILES.length] }}>{co.split(/[ &]+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("")}</span>
        <span className="min-w-0"><span className="block truncate text-base leading-5">{n}</span><span className="block truncate text-sm text-hushed">{r}, {co}</span></span>
      </figcaption>
      <blockquote className="mt-4 text-base leading-6 text-black/80">{q}</blockquote>
    </figure>))}</div>
  return <div className="vrow flex w-max" style={{ animation: `${rev ? "marquee-rev" : "marquee"} ${dur} linear infinite` }}>{set("a")}{set("b")}</div>
}
export function Voices() {
  return (
    <section className="voices overflow-hidden pb-20 md:pb-28" aria-label="Customer voices">
      <div className={wrap}><Reveal><h2 className="max-w-[760px] text-[32px] leading-[38px] tracking-[-0.01em] md:text-[48px] md:leading-[52px]"><TwoTone lead="Loved by finance teams." rest="Straight from the teams using venn." /></h2></Reveal></div>
      <div className="mt-10 space-y-3 py-2 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <VoiceRow items={V.slice(0, 4)} dur="90s" />
        <VoiceRow items={V.slice(4, 8)} rev dur="100s" />
        <VoiceRow items={V.slice(8, 12)} dur="95s" />
      </div>
    </section>
  )
}

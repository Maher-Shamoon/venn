import { Children, useEffect, useRef, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, ArrowUpRight, Check, Mail } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Logo, Reveal, TwoTone, prefersReducedMotion } from "@/components/venn/kit"
import { EmailForm } from "./Hero"

const wrap = "mx-auto max-w-[1280px] px-5 md:px-10"

/* ---------- moving sources strip ---------- */
export function Sources() {
  const names = ["CSV import", "PDF remittances", "Gmail", "QuickBooks Online", "Stripe (read-only)", "Bank statements", "Outlook (planned)", "Xero (planned)", "Bank feeds (planned)"]
  const set = (k: string) => <div key={k} className="flex shrink-0 items-center gap-3 pr-3" aria-hidden={k === "b"}>{names.map((n) => <span key={n} className="whitespace-nowrap rounded-full border border-border bg-white px-5 py-2.5 text-base">{n}</span>)}</div>
  return (
    <section aria-label="Sources venn reads" className="overflow-hidden border-y-[0.8px] border-border bg-muted/60 py-6">
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">{set("a")}{set("b")}</div>
    </section>
  )
}

/* ---------- pricing teaser ---------- */
export function PricingBand() {
  return (
    <section className={`${wrap} pb-20 md:pb-28`}>
      <Reveal>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 rounded-3xl bg-[#14110f] p-8 text-white md:p-14 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <h2 className="text-[40px] leading-[42px] tracking-[-0.02em] md:text-[56px] md:leading-[58px]">Start free.<br /><span className="text-white/55">Scale with evidence.</span></h2>
            <p className="mt-4 max-w-[460px] text-lg text-white/70">Begin with a CSV. Add Gmail and QuickBooks when the team is ready.</p>
            <Button variant="lime" size="lg" render={<Link to="/pricing" />} className="mt-8">See pricing</Button>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
            {[["Starter", "$0", "CSV import, exact-match reconciliation"], ["Team", "$31/mo/user", "Investigations, collections, approvals"], ["Business", "Custom", "Multi-entity, review, support"]].map(([n, p, d]) => (
              <Link key={n} to="/pricing" className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-white/10 bg-white/[0.04] p-4 transition-colors duration-300 hover:bg-white/[0.09]"><div className="min-w-[7rem] flex-1 [overflow-wrap:anywhere]"><div className="text-lg">{n}</div><div className="text-sm text-white/60">{d}</div></div><div className="shrink-0 text-lg text-lime">{p}</div></Link>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  )
}

/* ---------- platform bento ---------- */
function Window({ title, children, className = "", divide = true }: { title: string; children: ReactNode; className?: string; divide?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-t-xl border border-b-0 border-border bg-white shadow-sm ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2.5">
        {[0, 1, 2].map((i) => <span key={i} className="size-2 rounded-full bg-gray-medium" />)}
        <span className="mx-auto font-mono text-[10px] text-hushed">{title}</span>
      </div>
      {Children.map(children, (c, i) => <Reveal delay={150 + i * 120} className={divide ? "border-b border-border last:border-0" : undefined}>{c}</Reveal>)}
    </div>
  )
}
function Bento({ lead, rest, className = "", children, to = "/demo" }: { lead: string; rest: string; className?: string; children?: ReactNode; to?: string }) {
  return (
    <Reveal className={className}>
      <Link to={to} className="group relative flex h-full flex-col overflow-hidden rounded-xl border-[0.8px] border-border bg-muted p-6 transition-all duration-500 ease-[var(--ease-out-soft)] hover:-translate-y-1 hover:bg-[#efece8] hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,.35)]">
        <span className="card-arrow absolute right-5 top-5 flex size-9 items-center justify-center overflow-hidden rounded-md bg-white"><ArrowUpRight className="size-4" /></span>
        <h3 className="max-w-[78%] text-2xl leading-8 tracking-[-0.01em]"><TwoTone lead={lead} rest={rest} /></h3>
        <div className="mt-6 flex flex-1 flex-col justify-end">{children}</div>
      </Link>
    </Reveal>
  )
}
function MatchRow({ pay, to, conf, tone }: { pay: string; to: string; conf: string; tone: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 text-sm">
      <span className="font-mono text-xs">{pay}</span><ArrowRight className="size-3.5 text-hushed" />
      <span className="min-w-0 flex-1 truncate">{to}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs ${tone}`}>{conf}</span>
    </div>
  )
}
export function Platform() {
  return (
    <section id="platform" className={`${wrap} scroll-mt-24 pb-20 md:pb-28`}>
      <Reveal>
        <h2 className="max-w-[820px] text-[32px] leading-[38px] tracking-[-0.01em] md:text-[40px] md:leading-[42px]">
          <TwoTone lead="One workspace for every payment discrepancy." rest="Evidence for every finding. Approval for every decision." />
        </h2>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="lime" size="lg" render={<Link to="/demo" />}>See the demo</Button>
        </div>
      </Reveal>
      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
        <Bento lead="Reconciliation" rest="that explains itself" className="min-h-[520px]">
          <Window title="venn · reconciliation" className="mt-4 translate-y-1">
            <MatchRow pay="PAY-0009" to="INV-1047 + INV-1048" conf="high" tone="bg-[#e3f6e6] text-[#17692b]" />
            <MatchRow pay="PAY-0013" to="INV-1050 · alias match" conf="high" tone="bg-[#e3f6e6] text-[#17692b]" />
            <MatchRow pay="PAY-0015" to="INV-1040 + INV-1049" conf="medium" tone="bg-[#fff1c7] text-[#8a5a00]" />
            <MatchRow pay="PAY-0007" to="Duplicate of PAY-0006" conf="review" tone="bg-[#e4ebf6] text-[#3a5fa8]" />
            <div className="px-4 py-3 text-xs text-hushed">Only exact matches apply automatically. Everything else waits for a person.</div>
          </Window>
        </Bento>
        <Bento lead="Investigations" rest="backed by evidence" className="min-h-[520px]" to="/demo?to=/app/investigations/INVG-0001">
          <Window title="venn · INVG-0001" className="mt-4" divide={false}>
            <>
              <div className="mx-4 mt-4 rounded-md border-l-[3px] border-l-[#2f9e44] border border-border p-3"><span className="font-mono text-[10px] text-[#17692b]">CONFIRMED</span><br />One bank payment of $4,000.00 received 9 Oct.</div>
              <div className="mx-4 mt-2 rounded-md border border-dashed border-border-strong p-3 text-sm" style={{ borderColor: "#d2cecb" }}><span className="font-mono text-[10px] text-hushed">POSSIBLE</span><br />Customer intended two instalments.</div>
              <div className="mx-4 my-2 rounded-md border border-dashed bg-[#fff8e1] p-3 text-sm" style={{ borderColor: "#e0b13a" }}><span className="font-mono text-[10px] text-[#8a5a00]">UNVERIFIED CLAIM</span><br />“Wired last Friday.” No bank record.</div>
            </>
          </Window>
        </Bento>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Bento lead="Collections" rest="drafted from your records" className="min-h-[320px]">
          <div className="rounded-lg border border-border bg-white p-3 text-xs"><div className="flex items-center gap-1.5 text-hushed"><Mail className="size-3.5" />Reminder · INV-1050</div><div className="mt-2 text-foreground">…balance of $4,300.00, 6 days overdue…</div><div className="mt-2 flex items-center gap-1 text-[#17692b]"><Check className="size-3.5" />Amounts and dates match records</div></div>
        </Bento>
        <Bento lead="Approvals" rest="with a paper trail" className="min-h-[320px]" to="/demo?to=/app/approvals">
          <div className="rounded-lg border border-border bg-white p-3 text-xs"><div className="flex items-center justify-between"><span className="font-mono">APR-0001 · write-off</span><Badge variant="secondary" className="rounded-full bg-[#fff1c7] text-[#8a5a00]">pending</Badge></div><div className="mt-2 text-hushed">Requested by AR. Owner decides.</div></div>
        </Bento>
        <Bento lead="Sources" rest="you already use" className="min-h-[320px]">
          <div className="flex flex-wrap gap-1.5 text-xs">{["CSV", "PDF", "Gmail", "QuickBooks", "Stripe (read-only)"].map((s) => <span key={s} className="rounded-full border border-border bg-white px-2.5 py-1">{s}</span>)}<span className="rounded-full border border-dashed border-border px-2.5 py-1 text-hushed">more planned</span></div>
        </Bento>
      </div>
    </section>
  )
}

/* ---------- systems that never spoke (scroll-linked) ---------- */
const SYSTEMS = [
  ["Accounting system", "INV-1042 · $5,000.00 · due 1 Oct"], ["Bank", "Wire · $4,000.00 · 9 Oct"], ["Inbox", "“We sent the rest last Friday.”"], ["PDF remittance", "“Payment 1 of 2”"], ["Spreadsheet", "“Chase Northwind?”"],
]
export function Systems() {
  const ref = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(0)
  const [pin, setPin] = useState(true)
  useEffect(() => {
    if (prefersReducedMotion()) { setStep(6); return }
    const on = () => {
      const el = ref.current; if (!el) return
      // Pinned only while the whole story fits on screen (not on a phone held sideways); otherwise it flows with the page.
      const inner = el.firstElementChild?.firstElementChild as HTMLElement | undefined
      const fits = !inner || window.innerHeight - 64 - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bar")) || 0) >= inner.offsetHeight + 24
      setPin((x) => (x === fits ? x : fits))
      const r = el.getBoundingClientRect(), span = fits ? r.height - window.innerHeight : r.height
      const p = Math.min(1, Math.max(0, fits ? -r.top / Math.max(1, span) : (window.innerHeight * 0.85 - r.top) / Math.max(1, span)))
      setStep(Math.min(6, Math.floor(p * 7)))
    }
    on(); window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on)
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on) }
  }, [])
  return (
    <section ref={ref} className={pin ? "relative h-[320vh]" : "relative py-16"} aria-label="Systems that never spoke">
      <div className={pin ? "sticky top-[calc(4rem+var(--bar))] flex h-[calc(100svh-4rem-var(--bar))] items-center" : "flex items-center"}>
        <div className={`${wrap} grid w-full items-center gap-10 lg:grid-cols-[1fr_1.1fr]`}>
          <div>
            <h2 className="text-[40px] leading-[42px] tracking-[-0.015em] md:text-[56px] md:leading-[58px]">Systems that never spoke.</h2>
            <p className="mt-4 max-w-[460px] text-lg text-hushed">This is what five separate places to explain one short payment look like.</p>
            <div className="mt-8 font-mono text-[11px] uppercase text-hushed" aria-live="polite">{step < 6 ? `${Math.min(step, 5)} of 5 systems` : "One case file"}</div>
          </div>
          <div className="relative min-h-[420px]">
            <div className="space-y-2.5">
              {SYSTEMS.map(([n, t], i) => (
                <div key={n} style={{ transitionDelay: `${i * 40}ms` }} className={`flex items-center gap-4 rounded-xl border border-border bg-white p-4 transition-all duration-700 ease-[var(--ease-out-soft)] ${step > i ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"} ${step >= 6 ? "scale-[.97] !opacity-[.1]" : ""}`}>
                  <span className="flex size-10 items-center justify-center rounded-md bg-muted font-mono text-xs">{i + 1}</span>
                  <div><div className="text-sm text-hushed">{n}</div><div className="text-base">{t}</div></div>
                </div>
              ))}
            </div>
            <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-2xl bg-lime p-7 shadow-lg transition-all duration-700 ease-[var(--ease-out-soft)] ${step >= 6 ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"}`}>
              <Logo size={30} />
              <div className="mt-3 text-[28px] leading-8 tracking-[-0.01em]">One case file. Every claim tied to a record.</div>
              <div className="mt-2 text-base">Calculated facts, supporting evidence and a recommendation in one place.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------- dark engine panel ---------- */
export function DarkPanel() {
  return (
    <section className={`${wrap} pb-20 md:pb-28`}>
      <Reveal>
        <div className="grid gap-10 overflow-hidden rounded-3xl bg-[#14110f] p-8 text-white md:p-14 lg:grid-cols-2">
          <div className="flex flex-col">
            <h2 className="text-[32px] leading-[38px] tracking-[-0.01em] md:text-[40px] md:leading-[42px]"><span>Introducing the venn investigation engine.</span> <span className="text-white/55">An evidence-grounded case file, not a chatbot.</span></h2>
            <ul className="mt-8 space-y-3 text-base text-white/80">
              {["Amounts and dates are calculated by code from your records.", "Every statement from the AI cites stored evidence.", "The AI proposes. A person decides. It cannot approve, allocate or send."].map((t) => <li key={t} className="flex gap-3"><Check className="mt-1 size-4 shrink-0 text-lime" />{t}</li>)}
            </ul>
            <Link to="/demo?to=/app/investigations/INVG-0001" className="mt-auto inline-flex items-center gap-2 pt-10 text-base text-white underline-offset-4 hover:underline">Open the live demo <ArrowRight className="size-4" /></Link>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between font-mono text-[11px] text-white/55"><span>INVG-0001</span><span className="rounded-full bg-lime px-2 py-0.5 text-foreground">READY FOR REVIEW</span></div>
            <div className="mt-4 text-[44px] leading-[48px] tracking-[-0.02em]">$1,000.00</div>
            <div className="text-white/60">short on INV-1042 · Northwind Labs</div>
            <div className="mt-6 grid gap-2 text-sm">
              {[["Confirmed", "Bank payment $4,000.00 on 9 Oct", "#4ade80"], ["Calculated", "5,000.00 − 4,000.00 = 1,000.00", "#e5e7eb"], ["Unverified", "Email claims a second wire", "#fbbf24"], ["Missing", "Wire confirmation", "#9ca3af"]].map(([k, v, c]) => (
                <div key={k} className="flex items-center gap-3 rounded-lg bg-white/[0.05] px-3 py-2.5"><span className="size-2 rounded-full" style={{ background: c }} /><span className="w-[84px] font-mono text-[11px] uppercase text-white/55">{k}</span><span>{v}</span></div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

/* ---------- two-up ---------- */
export function TwoUp() {
  return (
    <section className={`${wrap} pb-20 md:pb-28`}>
      <Reveal><h2 className="mx-auto max-w-[760px] text-center text-[40px] leading-[42px] tracking-[-0.015em] md:text-[56px] md:leading-[58px]">Move fast. Keep control.</h2><p className="mx-auto mt-3 max-w-[560px] text-center text-lg text-hushed">Owners decide. AR specialists do the work. The server enforces both.</p></Reveal>
      <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-10 md:grid-cols-2">
        {[
          { t: "Give each role exactly what it needs.", d: "Owners approve and configure. AR specialists investigate and request. Every permission is checked on the server, never just hidden in the interface.", l: "Roles and permissions", v: <div className="space-y-2 p-8">{[["Approve write-offs", true, false], ["Send reminders", false, true], ["Manage integrations", true, false], ["View audit log", true, false]].map(([k, o, a]) => <div key={k as string} className="flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3 text-sm"><span className="flex-1">{k as string}</span><Badge variant="outline" className={o ? "bg-foreground text-white" : ""}>owner</Badge><Badge variant="outline" className={a ? "bg-lime text-foreground" : ""}>ar</Badge></div>)}</div> },
          { t: "Nothing consequential happens alone.", d: "Write-offs, credits and refund decisions wait for an owner, with the evidence attached. Decisions are immutable and every one is logged.", l: "Approval center", v: <div className="flex h-full items-center justify-center p-8"><div className="w-full max-w-[380px] rounded-xl border border-border bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="font-mono text-xs">APR-0001 · write-off</span><Badge className="rounded-full bg-[#fff1c7] text-[#8a5a00]">pending</Badge></div><div className="mt-3 text-[32px] leading-9 tracking-[-0.02em]">$340.00</div><div className="text-sm text-hushed">INV-1037 · requested by Priya R.</div><div className="mt-4 flex gap-2"><Button variant="lime">Approve</Button><Button variant="outline">Reject</Button></div></div></div> },
        ].map((c) => (
          <Reveal key={c.t}>
            <div className="min-h-[360px] overflow-hidden rounded-xl border-[0.8px] border-border bg-muted">{c.v}</div>
            <h3 className="mt-6 text-[28px] leading-8 tracking-[-0.01em]">{c.t}</h3>
            <p className="mt-2 max-w-[520px] text-base text-hushed">{c.d}</p>
            <Link to="/demo" className="mt-3 inline-flex items-center gap-1.5 text-base hover:underline">{c.l}<ArrowRight className="size-4" /></Link>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* ---------- final cta ---------- */
export function FinalCta() {
  return (
    <section id="cta" className={`${wrap} scroll-mt-24 pb-24`}>
      <Reveal>
        <div className="rounded-3xl bg-muted px-6 py-16 text-center md:px-16 md:py-24">
          <h2 className="mx-auto max-w-[820px] text-[40px] leading-[42px] tracking-[-0.02em] md:text-[64px] md:leading-[64px]">Find what's yours.</h2>
          <p className="mx-auto mt-4 max-w-[560px] text-lg text-hushed">Book a walkthrough using your own CSV exports.</p>
          <div className="mx-auto mt-8 flex justify-center"><EmailForm id="cta-form" cta="Book a walkthrough" /></div>
        </div>
      </Reveal>
    </section>
  )
}

import { useState } from "react"
import { Link } from "react-router-dom"
import { Ban, Check, Eye, Landmark, Lock, ShieldCheck, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Mark, Reveal, TwoTone } from "@/components/venn/kit"
import { cn } from "@/lib/utils"

const wrap = "mx-auto max-w-[clamp(1280px,82vw,1600px)] px-[clamp(1.25rem,3.2vw,3rem)]"

/* ---------- engine tabs ---------- */
const SCENARIOS = [
  { tab: "Short payment", amount: "$1,000.00", title: "INV-1042 was paid $4,000.00 of $5,000.00", fact: "One bank payment of $4,000.00 was received on 9 Oct and allocated to the invoice.", calc: "5,000.00 − 4,000.00 = 1,000.00 outstanding", poss: "The second wire may be in transit; the remittance advice says “1 of 2”.", claim: "Email says the remaining $1,000 was wired last Friday.", rec: "Request proof of payment", gate: "No approval needed" },
  { tab: "Duplicate payment", amount: "$9,600.00", title: "Meridian paid INV-1043 twice", fact: "Two bank payments of $9,600.00 reference INV-1043, which is fully paid by the first.", calc: "9,600.00 + 9,600.00 − 9,600.00 = 9,600.00 overpaid", poss: "The second transfer was a bank re-send and a refund is expected.", claim: "Remittance note: “re-sent due to bank error.”", rec: "Record a refund due", gate: "Owner approval required" },
  { tab: "“We already paid”", amount: "$22,500.00", title: "Claimed wire for INV-1044 not found", fact: "INV-1044 for $22,500.00 is 19 days past due with no allocated payment.", calc: "22,500.00 − 0.00 = 22,500.00 outstanding", poss: "The wire may be delayed, rejected, or sent to another account.", claim: "Customer says a wire was released “on Monday”.", rec: "Request wire confirmation", gate: "Final notice needs approval" },
]
export function Engine() {
  const [i, setI] = useState(0)
  const s = SCENARIOS[i]
  return (
    <section className={`${wrap} pb-20 md:pb-28`}>
      <Reveal><h2 className="max-w-[820px] tracking-[-0.01em] text-d3"><TwoTone lead="See how an investigation reads." rest="Facts, calculations and claims never get mixed up." /></h2></Reveal>
      <Reveal delay={80} className="mt-8">
        <div role="tablist" aria-label="Scenarios" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1">
          {SCENARIOS.map((x, k) => <button key={x.tab} role="tab" type="button" aria-selected={i === k} onClick={() => setI(k)} className={cn("whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors duration-300", i === k ? "bg-foreground text-white" : "text-hushed hover:text-foreground")}>{x.tab}</button>)}
        </div>
        <div key={i} role="tabpanel" className="mt-6 grid animate-rise-in gap-3 lg:grid-cols-[1fr_1.3fr]">
          <div className="rounded-xl border-[0.8px] border-border bg-muted p-7">
            <div className="font-mono text-[0.75rem] uppercase text-hushed">Exposure</div>
            <div className="mt-1 tracking-[-0.03em] text-d2">{s.amount}</div>
            <p className="mt-3 text-lg">{s.title}</p>
            <div className="mt-6 rounded-lg border border-border bg-white p-4"><div className="font-mono text-[0.6875rem] text-hushed">RECOMMENDED</div><div className="mt-1 text-base">{s.rec}</div><div className="mt-2 inline-flex items-center gap-1.5 text-sm text-hushed"><Lock className="size-3.5" />{s.gate}</div></div>
          </div>
          <div className="space-y-2 rounded-xl border-[0.8px] border-border p-4 md:p-5">
            {[["CONFIRMED FACT", s.fact, "border-l-[#2f9e44] border-border", "text-[#17692b]", ""], ["CALCULATED BY venn, NOT BY AI", s.calc, "border-transparent", "text-hushed", "bg-muted font-mono text-[0.8125rem]"], ["POSSIBLE EXPLANATION", s.poss, "border-dashed border-[#d2cecb]", "text-hushed", ""], ["UNVERIFIED CLAIM · NOT CONFIRMED BY A PAYMENT RECORD", s.claim, "border-dashed border-[#e0b13a] bg-[#fff8e1]", "text-[#8a5a00]", ""]].map(([k, v, b, c, x], n) => (
              <div key={k} style={{ animationDelay: `${n * 70}ms` }} className={cn("animate-rise-in rounded-lg border p-4 transition-transform duration-300 hover:translate-x-1", n === 0 && "border-l-[3px]", b, x)}><div className={cn("font-mono text-[0.6875rem]", c)}>{k}</div><p className="mt-1">{v}</p></div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  )
}

/* ---------- roles ---------- */
const OWNER: [string, string, string][] = [["APR-0001 · write-off", "$340.00", "INV-1037 · requested by AR"], ["APR-0002 · refund due", "$9,600.00", "Meridian · duplicate payment"], ["APR-0003 · final notice", "$22,500.00", "INV-1044 · 19 days past due"]]
const AR: [string, string, string][] = [["INVG-0001", "Short payment · $1,000.00", "ready for review"], ["INVG-0002", "Duplicate · $9,600.00", "evidence gathering"], ["INVG-0003", "Claimed wire · $22,500.00", "waiting on customer"], ["INVG-0004", "Unapplied credit · $410.00", "draft ready"]]
export function Roles() {
  const [r, setR] = useState<"owner" | "ar">("owner")
  const copy = r === "owner"
    ? ["See exposure across every customer at a glance.", "Approve write-offs, credits and refund decisions with the evidence attached.", "Manage integrations, people and the audit log."]
    : ["Work a prioritised queue of open discrepancies.", "Ask for proof, draft reminders and request approvals.", "Never blocked on spreadsheets, never able to approve your own request."]
  return (
    <section className={`${wrap} pb-20 md:pb-28`}>
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
        <Reveal>
          <h2 className="tracking-[-0.01em] text-d2"><TwoTone lead="One product, two seats." rest="Each role sees exactly what it needs." /></h2>
          <div role="tablist" aria-label="Role" className="mt-8 inline-flex gap-1 rounded-full bg-muted p-1">
            {([["owner", "Business owner"], ["ar", "AR specialist"]] as const).map(([k, n]) => <button key={k} role="tab" type="button" aria-selected={r === k} onClick={() => setR(k)} className={cn("rounded-full px-4 py-2 text-sm transition-colors duration-300", r === k ? "bg-foreground text-white" : "text-hushed hover:text-foreground")}>{n}</button>)}
          </div>
          <ul key={r} className="mt-6 space-y-3">{copy.map((c, i) => <li key={c} style={{ animationDelay: `${i * 80}ms` }} className="flex animate-rise-in gap-3 text-lg"><Check className="mt-1.5 size-4 shrink-0" />{c}</li>)}</ul>
          <Button variant="lime" size="lg" render={<Link to="/demo" />} className="mt-8">Open the {r === "owner" ? "owner" : "AR"} workspace</Button>
        </Reveal>
        <Reveal delay={100}>
          <div className="overflow-hidden rounded-2xl border-[0.8px] border-border bg-muted p-3 sm:p-5">
            <div key={r} className="animate-rise-in rounded-xl border border-border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between"><span className="text-lg">{r === "owner" ? "Needs your approval" : "My queue"}</span><span className="rounded-full bg-lime px-2.5 py-0.5 font-mono text-[0.75rem]">{r === "owner" ? "3 pending" : "4 open"}</span></div>
              <div className="mt-3 divide-y divide-border">
                {(r === "owner" ? OWNER : AR).map(([a, b, c], i) => (
                  <div key={a} style={{ animationDelay: `${i * 70}ms` }} className="group flex animate-rise-in items-center gap-3 py-3 transition-transform duration-300 hover:translate-x-1">
                    <div className="min-w-0 flex-1"><div className="font-mono text-[0.75rem] text-hushed">{a}</div><div className="truncate text-base">{b}</div></div>
                    <div className="hidden text-sm text-hushed sm:block">{c}</div>
                    <span className="rounded-md bg-muted px-3 py-1.5 text-sm transition-colors duration-300 group-hover:bg-lime">{r === "owner" ? "Review" : "Open"}</span>
                  </div>))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ---------- integrations orbit ---------- */
const RING1 = ["CSV", "PDF", "Gmail"], RING2 = ["QuickBooks", "Stripe (read-only)", "Bank statements", "Outlook · planned", "Xero · planned"]
function Ring({ items, inset, dur, rev }: { items: string[]; inset: string; dur: string; rev?: boolean }) {
  return (
    <div className={cn("absolute rounded-full border border-dashed border-border", inset)}>
      <div className="absolute inset-0 hover:[animation-play-state:paused]" style={{ animation: `${rev ? "orbit-rev" : "orbit"} ${dur} linear infinite` }}>
        {items.map((n, i) => (
          <div key={n} className="absolute inset-0" style={{ transform: `rotate(${(360 / items.length) * i}deg)` }}>
            <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2" style={{ transform: `translate(-50%,-50%) rotate(${-(360 / items.length) * i}deg)` }}>
              <span className="block whitespace-nowrap rounded-full border border-border bg-white px-3 py-1.5 text-[0.75rem] shadow-sm transition-colors duration-300 hover:bg-lime sm:text-sm" style={{ animation: `${rev ? "orbit" : "orbit-rev"} ${dur} linear infinite` }}>{n}</span>
            </div>
          </div>))}
      </div>
    </div>
  )
}
export function Orbit() {
  return (
    <section className={`${wrap} pb-20 md:pb-28`}>
      <div className="grid items-center gap-10 overflow-hidden rounded-3xl bg-muted p-6 sm:p-10 lg:grid-cols-[1fr_1fr] lg:p-14">
        <Reveal>
          <h2 className="tracking-[-0.01em] text-d2"><TwoTone lead="Reads where your records already live." rest="Read-only by default." /></h2>
          <p className="mt-4 max-w-[460px] text-lg text-hushed">Start with a CSV export. Connect your inbox and accounting system when the team is ready. This is the planned first-release set.</p>
          <Button variant="lime" size="lg" render={<Link to="/p/integrations" />} className="mt-8">See all sources</Button>
        </Reveal>
        <Reveal delay={100}>
          <div className="relative mx-auto aspect-square w-full max-w-[460px]">
            <Ring items={RING2} inset="inset-0" dur="70s" rev />
            <Ring items={RING1} inset="inset-[24%]" dur="44s" />
            <div className="absolute inset-[40%] flex items-center justify-center rounded-full bg-lime shadow-lg"><Mark className="size-1/2" /></div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ---------- trust ---------- */
const TRUST_ITEMS: [LucideIcon, string, string][] = [
  [ShieldCheck, "Server-enforced roles", "Every permission is checked on the server, never only hidden in the interface."],
  [Landmark, "Immutable audit trail", "Every decision, approval and send is recorded and cannot be edited."],
  [Eye, "Read-only by default", "venn reads invoices and payments. Your accounting system stays the book of record."],
  [Ban, "Never moves money", "venn recommends and records. Payments and refunds stay with you and your bank."],
]
export function Trust() {
  return (
    <section className={`${wrap} pb-20 md:pb-28`}>
      <Reveal><h2 className="max-w-[760px] tracking-[-0.01em] text-d2"><TwoTone lead="Built so a person always decides." rest="Controls you can explain to an auditor." /></h2></Reveal>
      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TRUST_ITEMS.map(([Ic, t, d], i) => (
          <Reveal key={t} delay={i * 70}>
            <div className="group h-full rounded-xl border-[0.8px] border-border bg-muted p-6 transition-all duration-500 ease-[var(--ease-out-soft)] hover:-translate-y-1.5 hover:bg-lime">
              <span className="flex size-11 items-center justify-center rounded-lg bg-white transition-transform duration-500 group-hover:rotate-[-8deg] group-hover:scale-110"><Ic className="size-5" strokeWidth={1.5} /></span>
              <h3 className="mt-6 text-xl leading-6">{t}</h3>
              <p className="mt-2 text-base text-hushed transition-colors duration-300 group-hover:text-foreground/80">{d}</p>
            </div>
          </Reveal>))}
      </div>
    </section>
  )
}


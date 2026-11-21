import { Fragment, useState } from "react"
import { Link } from "react-router-dom"
import { Check, Minus } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Odometer, Reveal } from "@/components/venn/kit"
import { cn } from "@/lib/utils"
import { EmailForm } from "./Hero"

const wrap = "mx-auto max-w-[clamp(1280px,82vw,1600px)] px-[clamp(1.25rem,3.2vw,3rem)]"
const TIERS = [
  { name: "Starter", tag: "Self-serve", tagCls: "bg-muted", price: 0, blurb: "For a one-person finance desk getting started with CSV exports.", cta: "Start free", variant: "outline" as const, items: ["CSV and PDF import", "Exact-match reconciliation", "10 investigations a month", "1 owner and 1 AR seat", "30-day audit log"] },
  { name: "Team", tag: "Most popular", tagCls: "bg-lime", price: 39, blurb: "For teams that want matching, investigations and follow-ups in one place.", cta: "Get started", variant: "lime" as const, featured: true, items: ["Everything in Starter", "Gmail and QuickBooks Online", "Unlimited investigations", "Collections drafts with approvals", "Disputes and refund records", "Reports and scheduled exports", "Unlimited audit log"] },
  { name: "Business", tag: "Custom", tagCls: "bg-foreground text-white", price: null, blurb: "For multi-entity firms that need control, review and support.", cta: "Contact sales", variant: "default" as const, items: ["Everything in Team", "Multi-entity workspaces", "SSO and SCIM (planned)", "Data residency options", "Named support contact", "Security review and DPA"] },
]
const COMPARE: [string, [string, string | boolean, string | boolean, string | boolean][]][] = [
  ["Reconciliation", [["Exact-match auto-allocation", true, true, true], ["Suggested matches with reasons", true, true, true], ["Lump-sum payments across invoices", false, true, true], ["Duplicate and overpayment flags", true, true, true]]],
  ["Investigations", [["Case files with evidence tiers", "10 / month", "Unlimited", "Unlimited"], ["Email claims marked unverified", true, true, true], ["Written summaries with citations", true, true, true]]],
  ["Collections and disputes", [["Reminder drafts from your records", false, true, true], ["Approval before firm notices", false, true, true], ["Dispute tracking", false, true, true]]],
  ["Control and security", [["Owner and AR roles", true, true, true], ["Custom roles", false, true, true], ["Audit log", "30 days", "Unlimited", "Unlimited"], ["Multi-entity workspaces", false, false, true], ["SSO and SCIM (planned)", false, false, true]]],
  ["Support", [["Help center", true, true, true], ["Email support", false, true, true], ["Named support contact", false, false, true]]],
]
const Cell = ({ v }: { v: string | boolean }) => v === true ? <Check className="mx-auto size-4" aria-label="Included" /> : v === false ? <Minus className="mx-auto size-4 text-gray-medium" aria-label="Not included" /> : <span className="text-sm">{v}</span>

const FAQ = [
  ["Can I change plans later?", "Yes. Upgrade, downgrade or cancel at any time from your billing settings."],
  ["What is the platform fee?", "A small fee based on invoice volume, shown at checkout."],
  ["Do you take a percentage of recovered revenue?", "No. venn is priced as software and never moves or collects money."],
  ["Can I start with just a CSV?", "Yes. Starter needs no connections."],
]

export function Pricing() {
  const [annual, setAnnual] = useState(true)
  return (
    <main id="main" tabIndex={-1} className="outline-none">
      <section className={`${wrap} pt-14 text-center md:pt-20`}>
        <h1 className="mx-auto max-w-[900px] tracking-[-0.02em] text-d1s">Start free.<br />Scale with evidence.</h1>
        <p className="mx-auto mt-4 max-w-[600px] text-lg text-hushed sm:text-xl sm:leading-8">Whether you run a one-person desk or a multi-entity finance team, venn is built to explain every dollar.</p>
        <div className="mt-8 inline-flex rounded-full bg-muted p-1" role="group" aria-label="Billing period">
          {[["Monthly", false], ["Annual · save 20%", true]].map(([l, v]) => <button key={l as string} aria-pressed={annual === v} onClick={() => setAnnual(v as boolean)} className={cn("rounded-full px-4 py-2 text-sm transition-colors duration-300", annual === v ? "bg-foreground text-white" : "text-hushed hover:text-foreground")}>{l as string}</button>)}
        </div>
      </section>

      <section className={`${wrap} pt-10`}>
        <div className="grid gap-3 lg:grid-cols-3 lg:items-start">
          {TIERS.map((t, i) => (
            <Reveal key={t.name} delay={i * 80}>
              <div className={cn("relative rounded-xl border-[0.8px] bg-white p-6", t.featured ? "border-lime shadow-[0_0_0_1px_#f9a8d4]" : "border-border")}>
                <span className={cn("absolute -top-3 left-6 rounded-md px-2.5 py-0.5 text-xs", t.tagCls)}>{t.tag}</span>
                <h2 className="text-d4">{t.name}</h2>
                <div className="mt-1 flex items-baseline gap-1 text-2xl tracking-[-0.01em]">
                  {t.price === null ? "Custom" : <><span>$</span><Odometer value={String(annual ? Math.round(t.price * 0.8) : t.price)} /><span className="text-base text-hushed">/mo/user</span></>}
                </div>
                <p className="mt-1 h-5 text-sm text-hushed">{t.price ? (annual ? "Billed annually. Plus a platform fee." : "Plus a platform fee.") : "Annual billing"}</p>
                <p className="mt-4 min-h-12 text-base">{t.blurb}</p>
                <Button variant={t.variant} size="lg" render={<Link to="/signup" />} className="mt-5 w-full">{t.cta}</Button>
                <ul className="mt-6 space-y-2.5 border-t border-border pt-5 text-sm">{t.items.map((x) => <li key={x} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0" />{x}</li>)}</ul>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-hushed">All prices in USD.</p>
      </section>

      <section className={`${wrap} pt-[var(--sec)]`}>
        <Reveal><h2 className="tracking-[-0.01em] text-d2">Compare features</h2></Reveal>
        <div tabIndex={0} role="group" aria-label="Plan comparison, scrolls sideways" className="mt-[var(--gap)] overflow-x-auto rounded-xl border-[0.8px] border-border">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead className="bg-muted"><tr><th className="p-4 font-normal text-hushed"><span className="sr-only">Feature</span></th>{TIERS.map((t) => <th key={t.name} className="w-[18%] p-4 text-center text-lg font-normal">{t.name}</th>)}</tr></thead>
            <tbody>
              {COMPARE.map(([g, rows]) => (
                <Fragment key={g}>
                  <tr className="bg-muted/60"><th colSpan={4} className="px-4 py-3 font-mono text-[0.75rem] font-normal uppercase tracking-[0.02em] text-hushed">{g}</th></tr>
                  {rows.map(([l, a, b, c]) => <tr key={l} className="border-t border-border"><td className="p-4 text-sm">{l}</td>{[a, b, c].map((v, i) => <td key={i} className="p-4 text-center"><Cell v={v} /></td>)}</tr>)}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${wrap} grid gap-10 py-[var(--sec)] lg:grid-cols-[1fr_1.6fr]`}>
        <Reveal><h2 className="tracking-[-0.015em] text-d2">Pricing questions.</h2></Reveal>
        <Reveal delay={80}>
          <Accordion defaultValue={["q0"]} className="rounded-xl border-[0.8px] border-border px-1">
            {FAQ.map(([q, a], i) => <AccordionItem key={q} value={`q${i}`} className="border-b border-border px-4 last:border-0"><AccordionTrigger className="py-5 text-lg font-normal hover:no-underline">{q}</AccordionTrigger><AccordionContent className="pb-5 text-base text-hushed">{a}</AccordionContent></AccordionItem>)}
          </Accordion>
        </Reveal>
      </section>

      <section className={`${wrap} pb-[var(--sec)]`}>
        <Reveal><div className="rounded-3xl bg-muted px-6 py-16 text-center md:px-16 md:py-24"><h2 className="mx-auto max-w-[820px] tracking-[-0.02em] text-d2">Find what's yours.</h2><div className="mx-auto mt-8 flex justify-center"><EmailForm id="pricing-cta" cta="Book a walkthrough" /></div></div></Reveal>
      </section>
    </main>
  )
}

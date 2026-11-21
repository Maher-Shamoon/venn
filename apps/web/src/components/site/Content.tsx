import { Link, useParams } from "react-router-dom"
import { ArrowRight, ArrowUpRight, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Reveal, TwoTone } from "@/components/venn/kit"
import { cn } from "@/lib/utils"
import { EmailForm } from "./Hero"
import { PAGES, type Row, type Tone } from "./pagesData"
import { PLATFORM } from "./nav"

const wrap = "mx-auto max-w-[clamp(1280px,82vw,1600px)] px-[clamp(1.25rem,3.2vw,3rem)]"
const PILL: Record<Tone, string> = { green: "bg-[#e3f6e6] text-[#17692b]", amber: "bg-[#fff1c7] text-[#8a5a00]", red: "bg-[#fbe9dd] text-[#a24a10]", blue: "bg-[#e4ebf6] text-[#3a5fa8]", grey: "bg-muted text-hushed" }

export function Window({ title, rows, className }: { title: string; rows: Row[]; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-white shadow-sm", className)}>
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2.5">{[0, 1, 2].map((i) => <span key={i} className="size-2 rounded-full bg-gray-medium" />)}<span className="mx-auto font-mono text-[0.6875rem] text-hushed">{title}</span></div>
      {rows.map(([l, r, t], i) => (
        <div key={l} style={{ animationDelay: `${i * 140}ms` }} className="flex animate-[rise-in_.7s_both] items-center gap-3 border-b border-border px-4 py-3.5 text-sm last:border-0">
          <span className="min-w-0 flex-1 truncate">{l}</span>
          <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs", PILL[t ?? "grey"])}>{r}</span>
        </div>
      ))}
    </div>
  )
}

export function Content() {
  const { slug = "" } = useParams()
  const p = PAGES[slug]
  if (!p) return <div className={`${wrap} py-32`}><h1 className="text-d1s">Page not found.</h1><Link to="/" className="mt-4 inline-block underline">Back home</Link></div>
  const others = PLATFORM.filter((i) => !i.to.endsWith(slug))
  return (
    <main id="main" tabIndex={-1} className="outline-none">
      <section className={`${wrap} pb-6 pt-12 md:pt-16`}>
        <p className="font-mono text-[0.75rem] uppercase tracking-[0.02em] text-hushed">{p.kicker}</p>
        <h1 className="mt-4 max-w-[980px] tracking-[-0.02em] text-d1s"><TwoTone lead={p.lead} rest={p.rest} /></h1>
        <p className="mt-4 max-w-[680px] text-lg text-hushed sm:text-xl sm:leading-8">{p.sub}</p>
        <div className="mt-8 flex flex-wrap gap-2"><Button variant="lime" size="lg" render={<Link to="/demo" />}>Open the demo</Button><Button variant="outline" size="lg" render={<Link to="/pricing" />}>See pricing</Button></div>
        <div className="dotgrid relative mt-10 flex min-h-[380px] items-end justify-center overflow-hidden rounded-2xl border border-border bg-muted px-5 pt-14 sm:px-12 md:min-h-[460px]">
          <div className="absolute inset-0 bg-gradient-to-b from-muted/0 via-muted/40 to-muted" aria-hidden="true" />
          <Window title={p.vtitle} rows={p.rows} className="relative w-full max-w-[640px] rounded-b-none border-b-0" />
        </div>
      </section>

      <section className={`${wrap} py-[var(--sec)]`}>
        <Reveal><h2 className="max-w-[760px] tracking-[-0.01em] text-d2"><TwoTone lead="The old way is a spreadsheet and a hunch." rest="The venn way shows its working." /></h2></Reveal>
        <div className="mt-[var(--gap)] grid gap-3 md:grid-cols-2">
          <Reveal><div className="h-full rounded-xl bg-muted p-7"><h3 className="text-d4">The old way.</h3><ul className="mt-5 space-y-3">{p.old.map((t) => <li key={t} className="flex gap-3 text-hushed"><X className="mt-1 size-4 shrink-0" />{t}</li>)}</ul></div></Reveal>
          <Reveal delay={100}><div className="h-full rounded-xl bg-[#14110f] p-7 text-white"><h3 className="text-d4">The venn way.</h3><ul className="mt-5 space-y-3">{p.neu.map((t) => <li key={t} className="flex gap-3 text-white/85"><Check className="mt-1 size-4 shrink-0 text-lime" />{t}</li>)}</ul></div></Reveal>
        </div>
      </section>

      <section className={`${wrap} space-y-20 pb-20 md:space-y-28 md:pb-28`}>
        {p.feats.map(([t, d], i) => (
          <Reveal key={t}>
            <div className={cn("grid grid-cols-[minmax(0,1fr)] items-center gap-8 lg:grid-cols-2 lg:gap-16", i % 2 && "lg:[&>*:first-child]:order-2")}>
              <div className="dotgrid flex min-h-[320px] items-center justify-center rounded-xl border border-border bg-muted p-6 sm:p-10"><Window title={p.vtitle} rows={[...p.rows.slice(i % p.rows.length), ...p.rows.slice(0, i % p.rows.length)].slice(0, 3)} className="w-full max-w-[460px]" /></div>
              <div><h3 className="tracking-[-0.01em] text-d4">{t}</h3><p className="mt-3 max-w-[520px] text-base text-hushed">{d}</p></div>
            </div>
          </Reveal>
        ))}
      </section>

      <section className={`${wrap} pb-[var(--sec)]`}>
        <Reveal><h2 className="tracking-[-0.01em] text-d2"><TwoTone lead="One platform for every payment discrepancy." rest="Explore the rest." /></h2></Reveal>
        <div className="mt-[var(--gap)] grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {others.map(({ icon: Icon, t, d, to }) => (
            <Reveal key={t}><Link to={to} className="group relative block h-full rounded-xl border-[0.8px] border-border bg-muted p-5 transition-colors duration-300 hover:bg-[#efece8]"><span className="card-arrow absolute right-4 top-4 flex size-8 items-center justify-center overflow-hidden rounded-md bg-white"><ArrowUpRight className="size-4" /></span><Icon className="size-5" /><div className="mt-8 text-xl">{t}</div><div className="text-hushed">{d}</div></Link></Reveal>
          ))}
        </div>
      </section>

      <section className={`${wrap} pb-[var(--sec)]`}>
        <Reveal><div className="rounded-3xl bg-muted px-6 py-16 text-center md:px-16 md:py-24"><h2 className="mx-auto max-w-[820px] tracking-[-0.02em] text-d2">See it on your own exports.</h2><div className="mx-auto mt-8 flex justify-center"><EmailForm id="content-cta" cta="Book a walkthrough" /></div><Link to="/pricing" className="mt-6 inline-flex items-center gap-1.5 hover:underline">See pricing <ArrowRight className="size-4" /></Link></div></Reveal>
      </section>
    </main>
  )
}


import { useState, type ReactNode } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, ArrowRight, Check, FileSpreadsheet, Landmark, Loader2, Mail, Plus, Receipt, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/venn/kit"
import { config } from "@/config"
import { errorMessage, toastApiError } from "@/lib/errors"
import { activeOrg, createOrganization, setActiveOrg } from "@/features/identity/api"
import { A, useApp, type Role } from "./store"
import { NativeSelect } from "./ui"
import { cn } from "@/lib/utils"

const email = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

/** Each step: its key, its short name, whether it can be skipped, and the heading and one line shown with it. */
const STEPS = [
  ["organization", "Organization", false, "Tell us who you are", "This is the name your team sees, and the one on every statement venn prepares."],
  ["sources", "Money sources", true, "Where does the money show up?", "Pick what you use today. You can connect or upload more later from Integrations."],
  ["email", "Email", true, "Bring in the replies", "venn reads messages that match your filters and sends only what you approve. It never deletes or edits mail."],
  ["import", "First data", true, "Put something on the table", "A CSV is enough to start. Matches and short payments show up within minutes."],
  ["team", "Team", true, "Who works the queue?", "Invite the people who chase invoices. They get an email and join with one click."],
  ["preferences", "Preferences", true, "Last bit: house rules", "These set the defaults. Everything can be changed in settings."],
] as const

/** The progress indicator is the product's own picture: two circles (invoices, payments) that slide together as setup completes. */
function Overlap({ p }: { p: number }) {
  const gap = 214 * (1 - p), r = 92
  return (
    <svg viewBox="0 0 420 236" role="img" aria-label={`Setup is ${Math.round(p * 100)} percent complete`} className="w-full max-w-[420px] overflow-visible">
      <defs>
        <clipPath id="ob-a"><circle cx={210 - gap / 2} cy="110" r={r} style={{ transition: "cx 700ms cubic-bezier(.22,1,.36,1)" }} /></clipPath>
      </defs>
      <circle cx={210 - gap / 2} cy="110" r={r} fill="#fff" fillOpacity=".55" stroke="#0c0a08" strokeOpacity=".9" strokeWidth="1.5" style={{ transition: "cx 700ms cubic-bezier(.22,1,.36,1)" }} />
      <circle cx={210 + gap / 2} cy="110" r={r} fill="#fff" fillOpacity=".55" stroke="#0c0a08" strokeOpacity=".9" strokeWidth="1.5" style={{ transition: "cx 700ms cubic-bezier(.22,1,.36,1)" }} />
      <circle cx={210 + gap / 2} cy="110" r={r} fill="#0c0a08" clipPath="url(#ob-a)" style={{ transition: "cx 700ms cubic-bezier(.22,1,.36,1)" }} />
      <text x={210 - gap / 2} y="224" textAnchor="middle" className="fill-[#0c0a08] text-[12px]" style={{ opacity: p > 0.8 ? 0 : 1, transition: "opacity 300ms" }}>invoices</text>
      <text x={210 + gap / 2} y="224" textAnchor="middle" className="fill-[#0c0a08] text-[12px]" style={{ opacity: p > 0.8 ? 0 : 1, transition: "opacity 300ms" }}>payments</text>
      <text x="210" y="116" textAnchor="middle" className="fill-white text-[13px]" style={{ opacity: p > 0.55 ? 1 : 0, transition: "opacity 400ms" }}>{p >= 1 ? "matched" : "matching"}</text>
    </svg>
  )
}

const Label = ({ children, hint }: { children: ReactNode; hint?: string }) => <span className="mb-2 block text-[15px]">{children}{hint && <span className="ml-2 text-sm text-hushed">{hint}</span>}</span>
const field = "h-12 rounded-xl border-gray-medium/70 bg-white px-4 text-base md:text-base focus-visible:border-foreground focus-visible:ring-0 focus-visible:shadow-[0_0_0_4px_rgba(249,168,212,.45)]"
const select = "h-12 rounded-xl border-gray-medium/70 px-3.5 text-base focus:shadow-[0_0_0_4px_rgba(249,168,212,.45)]"

function Choice({ icon, name, desc, tag, on, set, disabled }: { icon: ReactNode; name: string; desc: string; tag?: string; on: boolean; set: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} disabled={disabled} onClick={set}
      className={cn("group flex w-full items-center gap-4 rounded-2xl border bg-white p-4 text-left transition-[border-color,box-shadow,transform] duration-200 active:scale-[.995] disabled:opacity-60",
        on ? "border-foreground shadow-[4px_4px_0_0_#f9a8d4]" : "border-gray-medium/60 hover:border-foreground/60")}>
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors", on ? "bg-foreground text-white" : "bg-muted text-foreground")}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-base">{name}{tag && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-hushed">{tag}</span>}</span>
        <span className="block text-sm text-hushed">{desc}</span>
      </span>
      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors", on ? "border-foreground bg-foreground text-white" : "border-gray-medium")}>{on && <Check className="size-3.5" />}</span>
    </button>
  )
}

export function Onboarding() {
  const { step = "organization" } = useParams(), nav = useNavigate(), s = useApp()
  const idx = Math.max(0, STEPS.findIndex(([k]) => k === step))
  const real = config.authSource === "supabase"
  const [org, setOrg] = useState({ name: real || s.settings.company.name === "Your workspace" ? "" : s.settings.company.name, industry: "Software agency", size: "11 to 50", country: "United States", currency: "USD", website: "" })
  const [rows, setRows] = useState<{ email: string; role: Role }[]>([{ email: "", role: "ar" }])
  const [prefs, setPrefs] = useState({ tz: "America/Chicago", terms: 30, auto: true })
  const [src, setSrc] = useState<string[]>(["csv"]), [mail, setMail] = useState<string | null>(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false)
  const last = idx === STEPS.length - 1
  const next = () => { setErr(""); if (last) { A.saveSettings("financial", { ...s.settings.financial, timezone: prefs.tz, terms: prefs.terms, autoApply: prefs.auto }); A.finishOnboarding(); nav("/app"); return } nav("/onboarding/" + STEPS[idx + 1][0]) }
  const cont = async () => {
    if (idx === 0) {
      if (!org.name.trim()) return setErr("Enter your organization's name to continue.")
      if (real && !activeOrg()) {
        setBusy(true)
        try { setActiveOrg((await createOrganization({ name: org.name.trim(), industry: org.industry, company_size: org.size, website: org.website || undefined })).id) }
        catch (x) { setBusy(false); toastApiError(x); return setErr(errorMessage(x)) }
        setBusy(false)
      }
      A.saveSettings("company", { ...s.settings.company, name: org.name, industry: org.industry, size: org.size, website: org.website })
    }
    if (idx === 4) { const bad = rows.find((r) => r.email && !email(r.email)); if (bad) return setErr(`${bad.email} is not a valid email address.`); rows.filter((r) => r.email).forEach((r) => A.invite(r.email, r.role)); A.setSetup("team", true) }
    if (idx === 1) A.setSetup("sources", true)
    if (idx === 2 && mail) A.setSetup("email", true)
    if (idx === 3) A.setSetup("import", true)
    if (idx === 5) A.setSetup("prefs", true)
    next()
  }
  const [, label, skip, heading, lead] = STEPS[idx]
  const p = idx / (STEPS.length - 1)

  return (
    <div className="min-h-screen bg-[#fffdfb] lg:grid lg:grid-cols-[minmax(380px,44%)_1fr]">
      <aside className="relative overflow-hidden px-5 pb-5 pt-5 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:px-12 lg:py-10" style={{ background: "linear-gradient(180deg,#f9a8d4 0%,#fbbddb 38%,#fcd9e9 70%,#fff1f7 100%)" }}>
        <div aria-hidden="true" className="dotgrid pointer-events-none absolute inset-0 opacity-[.12] [mask-image:linear-gradient(180deg,black,transparent_70%)]" />
        <div className="relative flex items-center justify-between">
          <Link to="/" className="inline-flex"><Logo size={28} /></Link>
          <span className="font-mono text-xs text-[#0c0a08]/70 lg:hidden">{idx + 1} / {STEPS.length}</span>
        </div>
        {/* phone and tablet: a slim progress bar replaces the diagram */}
        <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-white/60 lg:hidden" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={idx + 1} aria-label="Setup progress">
          <div className="h-full rounded-full bg-foreground transition-[width] duration-500" style={{ width: `${((idx + 1) / STEPS.length) * 100}%` }} />
        </div>
        <div className="relative my-auto hidden lg:block">
          <Overlap p={p} />
          <h2 className="mt-10 max-w-[420px] text-[34px] leading-[1.08] tracking-[-0.02em]">{last ? "Nearly matched." : "Two lists in. One truth out."}</h2>
          <p className="mt-3 max-w-[380px] text-[15px] leading-6 text-[#0c0a08]/70">Invoices on one side, payments on the other. Setup brings them together so nothing slips between.</p>
        </div>
        <ol className="relative mt-auto hidden lg:block">
          {STEPS.map(([k, t], i) => (
            <li key={k} className="relative">
              <button type="button" disabled={i > idx} onClick={() => i < idx && nav("/onboarding/" + k)} aria-current={i === idx ? "step" : undefined}
                className={cn("flex w-full items-center gap-3 py-1.5 text-left text-[15px] transition-colors disabled:cursor-default", i === idx ? "text-foreground" : i < idx ? "text-foreground/80 hover:text-foreground" : "text-foreground/45")}>
                <span className={cn("flex size-5 items-center justify-center rounded-full text-[11px] transition-colors", i < idx ? "bg-foreground text-white" : i === idx ? "border-2 border-foreground bg-white" : "border border-foreground/30")}>{i < idx ? <Check className="size-3" /> : i === idx ? <span className="size-1.5 rounded-full bg-foreground" /> : null}</span>
                <span className={i === idx ? "font-medium" : ""}>{t}</span>
              </button>
            </li>
          ))}
        </ol>
      </aside>

      <main className="flex min-h-[calc(100vh-110px)] flex-col px-5 py-8 sm:px-10 lg:min-h-screen lg:px-16 lg:py-14">
        <div key={idx} className="mx-auto w-full max-w-[600px] flex-1 animate-rise-in">
          <p className="text-sm text-hushed">Step {idx + 1} of {STEPS.length}{skip ? " · you can skip this" : ""}</p>
          <h1 className="mt-3 text-[34px] leading-[1.05] tracking-[-0.025em] sm:text-[44px]">{heading}</h1>
          <p className="mt-3 max-w-[520px] text-base leading-7 text-hushed">{lead}</p>

          <div className="mt-9 space-y-5">
            {idx === 0 && <>
              <label className="block"><Label>Organization name</Label><Input autoFocus className={field} placeholder="e.g. Northbeam Studio" value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && void cont()} /></label>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block"><Label>Industry</Label><NativeSelect className={select} value={org.industry} onChange={(e) => setOrg({ ...org, industry: e.target.value })}>{["Software agency", "IT consultancy", "Managed service provider", "Staffing and recruitment", "Professional services"].map((o) => <option key={o}>{o}</option>)}</NativeSelect></label>
                <label className="block"><Label>Company size</Label><NativeSelect className={select} value={org.size} onChange={(e) => setOrg({ ...org, size: e.target.value })}>{["1 to 10", "11 to 50", "51 to 200", "200+"].map((o) => <option key={o}>{o}</option>)}</NativeSelect></label>
                <label className="block"><Label>Country</Label><NativeSelect className={select} value={org.country} onChange={(e) => setOrg({ ...org, country: e.target.value, currency: e.target.value === "United Kingdom" ? "GBP" : e.target.value === "Germany" ? "EUR" : "USD" })}>{["United States", "United Kingdom", "Germany", "Canada"].map((o) => <option key={o}>{o}</option>)}</NativeSelect></label>
                <label className="block"><Label>Default currency</Label><NativeSelect className={select} value={org.currency} onChange={(e) => setOrg({ ...org, currency: e.target.value })}>{["USD", "EUR", "GBP", "CAD"].map((o) => <option key={o}>{o}</option>)}</NativeSelect></label>
              </div>
              <label className="block"><Label hint="optional">Website</Label><Input className={field} inputMode="url" placeholder="yourcompany.com" value={org.website} onChange={(e) => setOrg({ ...org, website: e.target.value })} /></label>
            </>}

            {idx === 1 && <div className="space-y-3">{([
              ["csv", <FileSpreadsheet key="i" className="size-5" />, "Upload a CSV", "Invoice and payment exports from any system. Works today.", ""],
              ["quickbooks", <Receipt key="i" className="size-5" />, "QuickBooks Online", "Reads unpaid invoices. Connect it from Integrations after setup.", ""],
              ["stripe", <Landmark key="i" className="size-5" />, "Stripe", "Reads charges so card payments match on their own. Read-only key.", ""],
            ] as const).map(([id, icon, n, d, tag]) => <Choice key={id} icon={icon} name={n} desc={d} tag={tag} on={src.includes(id)} set={() => setSrc(src.includes(id) ? src.filter((x) => x !== id) : [...src, id])} />)}</div>}

            {idx === 2 && <div className="space-y-3">
              <Choice icon={<Mail className="size-5" />} name="Gmail" desc="Read replies and remittance advice. Connect it from Integrations after setup." on={mail === "gmail"} set={() => setMail(mail === "gmail" ? null : "gmail")} />
              <Choice icon={<Mail className="size-5" />} name="Outlook" desc="Not available yet." tag="coming later" on={false} set={() => undefined} disabled />
            </div>}

            {idx === 3 && <div className="space-y-3">{[["Import invoices (CSV)", "Your open and past invoices", "/app/invoices/import"], ["Import payments (CSV)", "Bank or processor payment exports", "/app/payments/import"], ["Upload a remittance PDF", "A customer's payment advice", "/app/invoices/pdf-review"]].map(([t, d, to]) => (
              <button key={t} type="button" onClick={() => { A.setSetup("import", true); nav(to) }} className="group flex w-full items-center justify-between rounded-2xl border border-gray-medium/60 bg-white p-4 text-left transition-colors hover:border-foreground">
                <span><span className="block text-base">{t}</span><span className="block text-sm text-hushed">{d}</span></span>
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </button>
            ))}</div>}

            {idx === 4 && <div className="space-y-3">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[1fr_160px_auto]">
                  <Input aria-label="Email" className={cn(field, "col-span-2 sm:col-span-1")} placeholder="name@company.com" value={r.email} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
                  <NativeSelect aria-label="Role" className={select} value={r.role} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, role: e.target.value as Role } : x)))}><option value="ar">AR specialist</option><option value="owner">Owner</option></NativeSelect>
                  <Button variant="ghost" size="icon" className="size-11" aria-label="Remove this person" onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [{ email: "", role: "ar" }])}><X className="size-4" /></Button>
                </div>
              ))}
              <Button variant="outline" className="h-11 rounded-xl" onClick={() => setRows([...rows, { email: "", role: "ar" }])}><Plus className="size-4" />Add another person</Button>
            </div>}

            {idx === 5 && <>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block"><Label>Timezone</Label><NativeSelect className={select} value={prefs.tz} onChange={(e) => setPrefs({ ...prefs, tz: e.target.value })}>{["America/Chicago", "America/New_York", "Europe/London"].map((o) => <option key={o}>{o}</option>)}</NativeSelect></label>
                <label className="block"><Label>Payment terms</Label><div className="relative"><Input type="number" min={0} className={cn(field, "pr-14")} value={prefs.terms} onChange={(e) => setPrefs({ ...prefs, terms: +e.target.value })} /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-hushed">days</span></div></label>
              </div>
              <Choice icon={<Check className="size-5" />} name="Apply exact matches automatically" desc="A payment that matches an invoice to the cent is applied for you. Everything else waits for a person." on={prefs.auto} set={() => setPrefs({ ...prefs, auto: !prefs.auto })} />
            </>}

            {err && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{err}</p>}
          </div>
        </div>

        <div className="sticky bottom-0 mx-auto mt-10 flex w-full max-w-[600px] items-center gap-3 border-t border-border bg-[#fffdfb]/90 py-4 backdrop-blur">
          <Button variant="ghost" className="h-12 rounded-xl px-4" disabled={idx === 0} onClick={() => { setErr(""); nav("/onboarding/" + STEPS[idx - 1][0]) }}><ArrowLeft className="size-4" />Back</Button>
          {skip && !last && <Button variant="ghost" className="h-12 rounded-xl px-4 text-hushed" onClick={next}>Skip {label.toLowerCase()}</Button>}
          <Button className="ml-auto h-12 rounded-xl px-7 text-base" disabled={busy} onClick={cont}>{busy ? <Loader2 className="size-4 animate-spin" /> : null}{last ? "Finish setup" : idx === 0 ? "Create organization" : "Continue"}{!busy && <ArrowRight className="size-4" />}</Button>
        </div>
      </main>
    </div>
  )
}

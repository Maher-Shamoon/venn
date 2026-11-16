import { useState, type ReactNode } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, ArrowRight, Check, FileSpreadsheet, Landmark, Loader2, Mail, Plus, Receipt, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/venn/kit"
import { Showcase } from "./AuthShowcase"
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

const Label = ({ children, hint }: { children: ReactNode; hint?: string }) => <span className="mb-1.5 block text-sm">{children}{hint && <span className="ml-2 text-sm text-hushed">{hint}</span>}</span>
const field = "h-11 text-base"
const select = "h-11 rounded-lg text-base"

function Choice({ icon, name, desc, tag, on, set, disabled }: { icon: ReactNode; name: string; desc: string; tag?: string; on: boolean; set: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} disabled={disabled} onClick={set}
      className={cn("group flex w-full items-center gap-3.5 rounded-xl border bg-white p-3.5 text-left transition-[border-color,background-color,transform] duration-200 active:scale-[.99] disabled:opacity-60",
        on ? "border-foreground bg-[#fff4f9]" : "border-input hover:border-foreground/50")}>
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors", on ? "bg-foreground text-white" : "bg-muted text-foreground")}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[15px]">{name}{tag && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-hushed">{tag}</span>}</span>
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
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[1.08fr_1fr]">
      <Showcase mode="setup" progress={p} copy={{ tag: `Setting up · step ${idx + 1} of ${STEPS.length}`, h: last ? "Nearly matched." : "Two lists in. One truth out.", p: "Invoices on one side, payments on the other. Setup brings them together so nothing slips between." }} />
      <div className="flex min-h-screen flex-col">
        <div className="flex h-24 items-end px-6 pb-4 lg:hidden" style={{ background: "linear-gradient(180deg,#f9a8d4,#fde3ef 70%,#fff)" }}><Link to="/"><Logo size={28} /></Link></div>
        <main className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-[440px]">
            <div className="flex gap-1.5" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={idx + 1}>
              {STEPS.map(([k], i) => <span key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-muted"><span className={cn("block h-full rounded-full bg-foreground transition-[width] duration-500 ease-[var(--ease-out-soft)]", i <= idx ? "w-full" : "w-0")} /></span>)}
            </div>
            <div key={idx} className="animate-rise-in">
              <p className="mt-5 text-sm text-hushed">Step {idx + 1} of {STEPS.length}{skip ? " · you can skip this" : ""}</p>
              <h1 className="mt-1.5 text-[34px] leading-10 tracking-[-0.02em]">{heading}</h1>
              <p className="mt-1.5 text-lg leading-7 text-hushed">{lead}</p>
          <div className="mt-8 space-y-4">
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

            {err && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">{err}</p>}
          </div>

          <div className="mt-6 space-y-3">
            <Button size="lg" className="h-11 w-full text-base" disabled={busy} onClick={cont}>{busy ? <><Loader2 className="size-4 animate-spin" />Please wait</> : <>{last ? "Finish setup" : idx === 0 ? "Create organization" : "Continue"}<ArrowRight className="size-4" /></>}</Button>
            <div className="flex items-center justify-between text-sm">
              <button type="button" disabled={idx === 0} onClick={() => { setErr(""); nav("/onboarding/" + STEPS[idx - 1][0]) }} className="inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-hushed transition-colors hover:text-foreground disabled:invisible"><ArrowLeft className="size-4" />Back</button>
              {skip && !last && <button type="button" onClick={next} className="rounded-md px-1 py-1 text-hushed transition-colors hover:text-foreground">Skip {label.toLowerCase()}</button>}
            </div>
          </div>
            </div>
          </div>
        </main>
        <p className="px-6 pb-6 text-center text-xs text-hushed">Your data is isolated per organization.</p>
      </div>
    </div>
  )
}

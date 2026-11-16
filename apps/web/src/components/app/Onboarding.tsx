import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Check, Loader2, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/venn/kit"
import { request } from "@/api/http"
import { config } from "@/config"
import { errorMessage, toastApiError } from "@/lib/errors"
import { activeOrg, createOrganization, fetchMe, setActiveOrg } from "@/features/identity/api"
import { A, useApp, type Role } from "./store"
import { Field, NativeSelect } from "./ui"
import { Showcase } from "./AuthShowcase"
import { cn } from "@/lib/utils"

const email = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const STEPS = [["organization", "Organization", false], ["sources", "Financial sources", true], ["email", "Email", true], ["import", "Import", true], ["team", "Team", true], ["preferences", "Preferences", true]] as const
const Opt = ({ name, desc, on, set, tag }: { id?: string; name: string; desc: string; on: boolean; set: () => void; tag?: string }) => <button type="button" aria-pressed={on} onClick={set} className={cn("flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors", on ? "border-foreground bg-lime/30" : "border-border hover:bg-muted/60")}><span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border", on ? "border-foreground bg-foreground text-white" : "border-gray-medium")}>{on && <Check className="size-3" />}</span><span className="flex-1"><span className="block">{name} {tag && <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-hushed">{tag}</span>}</span><span className="block text-sm text-hushed">{desc}</span></span></button>

/** Setup. Same split screen as sign-in and sign-up: the animated venn on the left closes as each step is completed. */
export function Onboarding() {
  const { step = "organization" } = useParams(), nav = useNavigate(), s = useApp()
  const idx = Math.max(0, STEPS.findIndex(([k]) => k === step))
  const real = config.authSource === "supabase"
  const [org, setOrg] = useState({ name: real || s.settings.company.name === "Your workspace" ? "" : s.settings.company.name, industry: "Software agency", size: "11 to 50", country: "United States", currency: "USD", website: "" })
  const [rows, setRows] = useState<{ email: string; role: Role }[]>([{ email: "", role: "ar" }])
  const [prefs, setPrefs] = useState({ tz: "America/Chicago", terms: 30, auto: true })
  const [src, setSrc] = useState<string[]>(["csv"]), [mail, setMail] = useState<string | null>(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false)
  // Someone who already belongs to an organization (an old confirmation link, a second device) is taken to it instead of creating another.
  useEffect(() => {
    if (!real || activeOrg()) return
    void fetchMe().then((m) => { const mem = m.memberships.find((x) => x.status === "active"); if (mem) { setActiveOrg(mem.organization_id); A.finishOnboarding(); window.location.replace("/app") } }).catch(() => undefined)
  }, [real])
  const next = () => { setErr(""); if (idx === STEPS.length - 1) { A.saveSettings("financial", { ...s.settings.financial, timezone: prefs.tz, terms: prefs.terms, autoApply: prefs.auto }); A.finishOnboarding(); nav("/app"); return } nav("/onboarding/" + STEPS[idx + 1][0]) }
  const cont = async () => {
    if (idx === 0) {
      if (!org.name.trim()) return setErr("Organization name is required.")
      if (real && !activeOrg()) {
        setBusy(true)
        try { setActiveOrg((await createOrganization({ name: org.name.trim(), industry: org.industry, company_size: org.size, website: org.website || undefined })).id) }
        catch (x) { setBusy(false); toastApiError(x); return setErr(errorMessage(x)) }
        setBusy(false)
      }
      A.saveSettings("company", { ...s.settings.company, name: org.name, industry: org.industry, size: org.size, website: org.website })
    }
    if (idx === 4) { const bad = rows.find((r) => r.email && !email(r.email)); if (bad) return setErr(`${bad.email} is not a valid email address.`); const who = rows.filter((r) => r.email)
      if (real) {
        setBusy(true)
        try { for (const r of who) await request("/members/invitations", { method: "POST", body: { email: r.email, role_key: r.role === "owner" ? "owner" : "ar_specialist" }, idempotent: true }) }
        catch (x) { setBusy(false); toastApiError(x); return setErr(errorMessage(x)) }
        setBusy(false)
      } else who.forEach((r) => A.invite(r.email, r.role))
      A.setSetup("team", true) }
    if (idx === 1) A.setSetup("sources", true)
    if (idx === 2 && mail) A.setSetup("email", true)
    if (idx === 3) A.setSetup("import", true)
    if (idx === 5) A.setSetup("prefs", true)
    next()
  }
  const [, label, skip] = STEPS[idx]
  const last = idx === STEPS.length - 1

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[1.08fr_1fr]">
      <Showcase mode="setup" progress={idx / (STEPS.length - 1)} copy={{ tag: `Setup · step ${idx + 1} of ${STEPS.length}`, h: last ? "Nearly matched." : "Two lists in. One truth out.", p: "Invoices on one side, payments on the other. Setup brings them together so nothing slips between." }} />
      <div className="flex min-h-screen flex-col">
        <div className="flex h-24 items-end px-6 pb-4 lg:hidden" style={{ background: "linear-gradient(180deg,#f9a8d4,#fde3ef 70%,#fff)" }}><Link to="/"><Logo size={28} /></Link></div>
        <main className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-[520px]">
            <ol className="mb-8 flex items-center gap-1.5" aria-label="Setup steps">{STEPS.map(([k, t], i) => (
              <li key={k} className="flex-1">
                <button type="button" aria-label={t} aria-current={i === idx ? "step" : undefined} disabled={i > idx} onClick={() => i < idx && nav("/onboarding/" + k)} className="group block w-full py-1.5 disabled:cursor-default">
                  <span className="block h-1 overflow-hidden rounded-full bg-muted"><span className={cn("block h-full rounded-full bg-foreground transition-[width] duration-500 ease-[var(--ease-out-soft)]", i <= idx ? "w-full" : "w-0")} /></span>
                </button>
              </li>
            ))}</ol>
            <div key={idx} className="animate-rise-in">
              <div className="font-mono text-xs text-hushed">STEP {idx + 1} OF {STEPS.length}{skip ? " · SKIPPABLE" : ""}</div>
              <h1 className="mt-2 text-[34px] leading-10 tracking-[-0.02em]">{label}</h1>
              <div className="mt-6 space-y-3">
                {idx === 0 && <><Field label="Organization name *"><Input autoFocus className="h-11 text-base" value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && void cont()} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Industry *"><NativeSelect className="h-11 text-base" value={org.industry} onChange={(e) => setOrg({ ...org, industry: e.target.value })}>{["Software agency", "IT consultancy", "Managed service provider", "Staffing and recruitment", "Professional services"].map((o) => <option key={o}>{o}</option>)}</NativeSelect></Field><Field label="Company size *"><NativeSelect className="h-11 text-base" value={org.size} onChange={(e) => setOrg({ ...org, size: e.target.value })}>{["1 to 10", "11 to 50", "51 to 200", "200+"].map((o) => <option key={o}>{o}</option>)}</NativeSelect></Field><Field label="Country *"><NativeSelect className="h-11 text-base" value={org.country} onChange={(e) => setOrg({ ...org, country: e.target.value, currency: e.target.value === "United Kingdom" ? "GBP" : e.target.value === "Germany" ? "EUR" : "USD" })}>{["United States", "United Kingdom", "Germany", "Canada"].map((o) => <option key={o}>{o}</option>)}</NativeSelect></Field><Field label="Default currency *"><NativeSelect className="h-11 text-base" value={org.currency} onChange={(e) => setOrg({ ...org, currency: e.target.value })}>{["USD", "EUR", "GBP", "CAD"].map((o) => <option key={o}>{o}</option>)}</NativeSelect></Field></div><Field label="Website"><Input className="h-11 text-base" value={org.website} onChange={(e) => setOrg({ ...org, website: e.target.value })} /></Field></>}
                {idx === 1 && [["csv", "Upload CSV", "Available now. Invoice and payment exports.", ""], ["quickbooks", "QuickBooks Online", "Read unpaid invoices. Connect it from Integrations after setup.", ""], ["stripe", "Stripe", "Read charges so card payments match on their own. Read-only key.", ""], ["xero", "Xero", "Read invoices and payments.", "planned"]].map(([id, n, d, tag]) => <Opt key={id} id={id} name={n} desc={d} tag={tag} on={src.includes(id)} set={() => setSrc(src.includes(id) ? src.filter((x) => x !== id) : [...src, id])} />)}
                {idx === 2 && <><p className="text-sm text-hushed">venn reads messages that match your filters and sends only what you approve. It never deletes or edits mail.</p>{[["gmail", "Gmail", "Read replies and remittances. Connect it from Integrations after setup."], ["outlook", "Outlook", "Planned for the first release."]].map(([id, n, d]) => <Opt key={id} id={id} name={n} desc={d} tag={id === "outlook" ? "planned" : ""} on={mail === id} set={() => setMail(mail === id ? null : id)} />)}</>}
                {idx === 3 && <div className="grid gap-2">{[["Import invoices (CSV)", "/app/invoices/import"], ["Import payments (CSV)", "/app/payments/import"], ["Upload a remittance PDF", "/app/invoices/pdf-review"]].map(([t, to]) => <Button key={t} variant="outline" className="h-11 justify-start" onClick={() => { A.setSetup("import", true); nav(to) }}>{t}</Button>)}<Button className="h-11" onClick={() => { A.setSetup("import", true); next() }}>{real ? "I'll import later" : "Explore with the sample workspace"}</Button></div>}
                {idx === 4 && <>{rows.map((r, i) => <div key={i} className="grid grid-cols-[1fr_140px_40px] items-center gap-2"><Input aria-label="Email" className="h-11 text-base" placeholder="name@company.com" value={r.email} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} /><NativeSelect aria-label="Role" className="h-11 text-base" value={r.role} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, role: e.target.value as Role } : x)))}><option value="ar">AR specialist</option><option value="owner">Owner</option></NativeSelect><Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [{ email: "", role: "ar" }])}><X className="size-4" /></Button></div>)}<Button variant="outline" size="sm" onClick={() => setRows([...rows, { email: "", role: "ar" }])}><Plus className="size-4" />Add another</Button></>}
                {idx === 5 && <><div className="grid gap-3 sm:grid-cols-2"><Field label="Timezone"><NativeSelect className="h-11 text-base" value={prefs.tz} onChange={(e) => setPrefs({ ...prefs, tz: e.target.value })}>{["America/Chicago", "America/New_York", "Europe/London"].map((o) => <option key={o}>{o}</option>)}</NativeSelect></Field><Field label="Default payment terms (days)"><Input type="number" className="h-11 text-base" value={prefs.terms} onChange={(e) => setPrefs({ ...prefs, terms: +e.target.value })} /></Field></div><Opt id="auto" name="Apply exact matches automatically" desc="Everything else waits for a person. You can change this in settings." on={prefs.auto} set={() => setPrefs({ ...prefs, auto: !prefs.auto })} /></>}
                {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-border pt-5">
                <Button variant="outline" size="lg" className="h-11" disabled={idx === 0} onClick={() => { setErr(""); nav("/onboarding/" + STEPS[idx - 1][0]) }}>Back</Button>
                {skip && <Button variant="ghost" size="lg" className="h-11" onClick={next}>Skip for now</Button>}
                <Button size="lg" className="ml-auto h-11 px-6 text-base" disabled={busy} onClick={cont}>{busy ? <><Loader2 className="size-4 animate-spin" />Please wait</> : last ? "Finish" : "Continue"}</Button>
              </div>
            </div>
          </div>
        </main>
        <p className="px-6 pb-6 text-center text-xs text-hushed">Your data is isolated per organization.</p>
      </div>
    </div>
  )
}

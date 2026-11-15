import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Box, Field, NativeSelect } from "@/components/app/ui"
import { errorMessage } from "@/lib/errors"
import { useOrgSettings, useSaveCompany, useSaveFinancial, type Company, type Financial } from "./api"

const Loading = () => <div role="status" aria-busy="true" className="h-40 animate-pulse rounded-xl bg-muted" />
const TIMEZONES = ["America/Chicago", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Australia/Sydney", "UTC"]

export function RemoteCompany() {
  const q = useOrgSettings()
  if (q.isPending) return <Loading />
  if (q.isError) return <Box pad><p role="alert" className="text-sm text-destructive">{errorMessage(q.error)}</p></Box>
  // Remount when the server version changes so the form always starts from what was saved.
  return <CompanyForm key={q.data.version} initial={q.data.company} version={q.data.version} />
}

function CompanyForm({ initial, version }: { initial: Company; version: number }) {
  const [co, setCo] = useState(initial), save = useSaveCompany()
  const fields = [["name", "Name"], ["legal_name", "Legal name"], ["industry", "Industry"], ["company_size", "Company size"], ["website", "Website"]] as const
  const onSave = () => {
    if (!co.name.trim()) return toast.error("A company name is required.")
    save.mutate(
      { body: { name: co.name, legal_name: co.legal_name || undefined, industry: co.industry, company_size: co.company_size, website: co.website || undefined }, version },
      { onSuccess: () => toast.success("Settings saved") },
    )
  }
  return (
    <Box pad>
      <div className="grid max-w-[640px] gap-3 sm:grid-cols-2">
        {fields.map(([k, l]) => <Field key={k} label={l}><Input value={co[k] ?? ""} onChange={(e) => setCo({ ...co, [k]: e.target.value })} /></Field>)}
      </div>
      <Button className="mt-4" disabled={save.isPending} onClick={onSave}>Save changes</Button>
    </Box>
  )
}

export function RemoteFinancial() {
  const q = useOrgSettings()
  if (q.isPending) return <Loading />
  if (q.isError) return <Box pad><p role="alert" className="text-sm text-destructive">{errorMessage(q.error)}</p></Box>
  return <FinancialForm key={q.data.version} initial={q.data.financial} version={q.data.version} />
}

type Num = "default_terms_days" | "short_grace_days" | "claim_grace_days"

function FinancialForm({ initial, version }: { initial: Financial; version: number }) {
  const [f, setF] = useState(initial), save = useSaveFinancial()
  const num = (k: Num) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(e.target.value) })
  const onSave = () => {
    if (!(f.default_terms_days > 0)) return toast.error("Payment terms must be above zero.")
    save.mutate({ body: f, version }, { onSuccess: () => toast.success("Settings saved") })
  }
  return (
    <Box pad>
      <div className="grid max-w-[640px] gap-3 sm:grid-cols-2">
        <Field label="Default currency"><NativeSelect value={f.default_currency} onChange={(e) => setF({ ...f, default_currency: e.target.value })}>{["USD", "EUR", "GBP", "CAD"].map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field>
        <Field label="Timezone"><NativeSelect value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })}>{[...new Set([f.timezone, ...TIMEZONES])].map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field>
        <Field label="Default payment terms (days)"><Input type="number" value={f.default_terms_days} onChange={num("default_terms_days")} /></Field>
        <Field label="Short-payment grace (days)"><Input type="number" value={f.short_grace_days} onChange={num("short_grace_days")} /></Field>
        <Field label="Claim grace (days)"><Input type="number" value={f.claim_grace_days} onChange={num("claim_grace_days")} /></Field>
      </div>
      <label className="mt-4 flex max-w-[640px] items-center gap-3 text-sm">
        <Switch checked={f.auto_apply_exact} onCheckedChange={(v) => setF({ ...f, auto_apply_exact: v })} aria-label="Auto-apply exact matches" />
        Apply exact matches automatically. Everything else waits for a person.
      </label>
      <label className="mt-3 flex max-w-[640px] items-start gap-3 text-sm">
        <Switch checked={f.ai_enabled} onCheckedChange={(v) => setF({ ...f, ai_enabled: v })} aria-label="Explain investigations with AI" className="mt-0.5" />
        <span>Explain investigations with AI. Sends the case findings (amounts, dates and record numbers, never customer names) to Groq to write a short cited explanation. The recommendation always comes from fixed rules. Off by default.</span>
      </label>
      <Button className="mt-4" disabled={save.isPending} onClick={onSave}>Save changes</Button>
    </Box>
  )
}

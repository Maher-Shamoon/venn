import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Check, Play } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Box, DataTable, Empty, Field, Kpi, Modal, Mono, Pill, Seg, TextArea, Title, type Tone } from "@/components/app/ui"
import { errorMessage } from "@/lib/errors"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import { useAccept, useAutoApplied, useDiscrepancies, useReject, useResolve, useRunReconciliation, useRuns, useSuggestions, useUndoAuto, type Suggestion } from "./api"

const day = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
const CONF: Record<string, Tone> = { exact: "green", high: "blue", medium: "amber" }
const TYPE: Record<string, string> = { short_payment: "Short payment", overpayment: "Overpayment", duplicate_payment: "Possible duplicate", currency_mismatch: "Currency mismatch" }
const ASK_TITLE = { reject: "Reject this suggestion", undo: "Undo this match", resolve: "Resolve this discrepancy" }
type Tab = "review" | "unmatched" | "auto" | "discrepancies"
type Ask = null | { kind: "reject" | "undo" | "resolve"; id: string }

/** Reconciliation for real organizations: the rules suggest, a person decides. Nothing is applied without the exact-match rule or a click. */
export function RemoteReconciliation() {
  const sug = useSuggestions(), auto = useAutoApplied(), disc = useDiscrepancies(), runs = useRuns()
  const [tab, setTab] = useState<Tab>("review"), [sel, setSel] = useState(""), [ask, setAsk] = useState<Ask>(null), [reason, setReason] = useState("")
  const run = useRunReconciliation(), accept = useAccept(), reject = useReject(), undo = useUndoAuto(), resolve = useResolve()
  const pending = sug.data?.data ?? [], g = pending.find((x) => x.id === sel) ?? pending[0]
  const last = runs.data?.data[0]
  const step = (d: 1 | -1) => { const i = pending.findIndex((x) => x.id === g?.id); const n = pending[(i + d + pending.length) % pending.length]; if (n) setSel(n.id) }
  const fail = (e: unknown) => toast.error(errorMessage(e))
  const confirm = (x: Suggestion) => accept.mutate(x.id, { onSuccess: () => toast.success(`${x.payment.number} applied`), onError: fail })
  const doRun = () => run.mutate(undefined, { onSuccess: (r) => toast.success(`Run finished: ${r.auto_applied} applied, ${r.suggested} to review, ${r.discrepancies} new discrepancies`), onError: fail })
  const close = () => { setAsk(null); setReason("") }
  const submit = () => {
    if (!ask || !reason.trim()) return
    const done = { onSuccess: close, onError: fail }
    if (ask.kind === "reject") reject.mutate({ id: ask.id, reason }, done)
    else if (ask.kind === "undo") undo.mutate({ id: ask.id, reason }, done)
    else resolve.mutate({ id: ask.id, reason }, done)
  }
  useEffect(() => {
    if (tab !== "review" || ask) return
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("input,textarea,select") || e.metaKey || e.ctrlKey) return
      const k = e.key.toLowerCase()
      if (k === "c" && g) confirm(g); else if (k === "r" && g) setAsk({ kind: "reject", id: g.id }); else if (k === "j") step(1); else if (k === "k") step(-1)
    }
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on)
  })
  const exposure = (disc.data?.data ?? []).reduce((s, d) => s + Number(d.exposure), 0)
  const busy = reject.isPending || undo.isPending || resolve.isPending
  return (
    <>
      <Title sub={last ? `Last run ${day(last.started_at)}${last.by ? ` by ${last.by}` : ""}` : "No run yet. Run reconciliation to match payments to invoices."} right={<Button onClick={doRun} disabled={run.isPending}><Play className="size-4" />{run.isPending ? "Running…" : "Run reconciliation"}</Button>}>Reconciliation</Title>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <Kpi dark label="Auto-applied" value={String(auto.data?.total ?? 0)} note="Exact matches only" />
        <Kpi label="Needs review" value={String(sug.data?.total ?? 0)} note="A person decides" />
        <Kpi label="Unmatched" value={String(last?.counts.unmatched ?? 0)} note="Found by the last run" />
        <Kpi label="Discrepancies" value={String(disc.data?.total ?? 0)} note={formatMoney(exposure.toFixed(2)) + " exposure"} />
      </div>
      <div className="mt-6"><Seg items={[{ v: "review", label: "Needs review", n: sug.data?.total ?? 0 }, { v: "unmatched", label: "Unmatched" }, { v: "auto", label: "Auto-applied", n: auto.data?.total ?? 0 }, { v: "discrepancies", label: "Discrepancies", n: disc.data?.total ?? 0 }] as const} value={tab} onChange={setTab} /></div>
      <div className="mt-4">
        {tab === "review" && (sug.isPending ? <div role="status" aria-busy="true" className="h-48 animate-pulse rounded-xl bg-muted" /> : pending.length && g ? (
          <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
            <Box><ul>{pending.map((x) => (
              <li key={x.id}><button type="button" onClick={() => setSel(x.id)} aria-current={x.id === g.id} className={cn("w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted", x.id === g.id && "bg-muted")}>
                <div className="flex items-center justify-between"><Mono>{x.payment.number}</Mono><Pill tone={CONF[x.confidence]}>{x.confidence}</Pill></div>
                <div className="mt-1 text-sm tabular-nums">{formatMoney(x.payment.amount, x.payment.currency)} <span className="text-hushed">· {x.payment.payer ?? "No payer name"}</span></div></button></li>))}</ul>
              <div className="border-t border-border px-4 py-2 text-xs text-hushed">Keys: <kbd className="rounded bg-muted px-1">C</kbd> confirm · <kbd className="rounded bg-muted px-1">R</kbd> reject · <kbd className="rounded bg-muted px-1">J</kbd>/<kbd className="rounded bg-muted px-1">K</kbd> next/previous</div></Box>
            <Box title={`${g.payment.number}: match suggestion`} right={<Mono>{g.rule}</Mono>} pad>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-muted p-4"><div className="font-mono text-[11px] text-hushed">PAYMENT</div><div className="mt-1 text-2xl tabular-nums">{formatMoney(g.payment.unallocated, g.payment.currency)}</div><div className="text-sm text-hushed">{g.payment.payer ?? "No payer name"} · {g.payment.reference ?? "no reference"}</div></div>
                <div className="rounded-lg border border-border p-4"><div className="font-mono text-[11px] text-hushed">SETTLES</div>{g.allocations.map((a) => (
                  <div key={a.invoice_id} className="mt-1 flex justify-between text-sm"><Link to={`/app/invoices/${a.invoice_id}`} className="underline underline-offset-2">{a.invoice_number}</Link><span className="tabular-nums">{formatMoney(a.amount, g.payment.currency)}{a.balance && a.balance !== a.amount ? <span className="text-hushed"> of {formatMoney(a.balance, g.payment.currency)}</span> : null}</span></div>))}</div>
              </div>
              <div className="mt-4 rounded-lg bg-[#f4f2f0] p-4 text-sm"><div className="font-mono text-[11px] text-hushed">WHY</div>{g.reason}</div>
              <div className="mt-5 flex flex-wrap gap-2"><Button onClick={() => confirm(g)} disabled={accept.isPending}><Check className="size-4" />Confirm match</Button><Button variant="outline" onClick={() => setAsk({ kind: "reject", id: g.id })}>Reject</Button></div>
            </Box>
          </div>) : <Box><Empty title="Nothing to review" sub="Run reconciliation to look for matches. Anything the rules cannot decide on their own will appear here." /></Box>)}
        {tab === "unmatched" && <Box><Empty title="Unmatched payments live in the payments list" sub="Payments with money still unallocated are under Payments, Unallocated." action={<Button variant="outline" render={<Link to="/app/payments?tab=unallocated" />}>View unallocated payments</Button>} /></Box>}
        {tab === "auto" && <Box><DataTable rows={auto.data?.data ?? []} id={(a) => a.id} loading={auto.isPending} empty={<Empty title="Nothing auto-applied yet" sub="Exact matches are applied when the setting is on." />}
          cols={[{ key: "p", label: "Payment", render: (a) => <Mono>{a.payment_number}</Mono> }, { key: "i", label: "Invoice", render: (a) => <Mono>{a.invoice_number}</Mono> }, { key: "a", label: "Amount", right: true, render: (a) => formatMoney(a.amount, a.currency) }, { key: "w", label: "When", hide: "md", render: (a) => day(a.created_at) },
            { key: "u", label: "", render: (a) => <Button size="sm" variant="outline" onClick={() => setAsk({ kind: "undo", id: a.id })}>Undo</Button> }]} /></Box>}
        {tab === "discrepancies" && <Box><DataTable rows={disc.data?.data ?? []} id={(d) => d.id} loading={disc.isPending} empty={<Empty title="No open discrepancies" />}
          cols={[{ key: "t", label: "Type", render: (d) => <Pill tone={d.type === "duplicate_payment" ? "red" : "amber"}>{TYPE[d.type] ?? d.type}</Pill> }, { key: "d", label: "What was found", render: (d) => d.detail }, { key: "x", label: "Exposure", right: true, render: (d) => formatMoney(d.exposure) },
            { key: "u", label: "", render: (d) => <Button size="sm" variant="outline" onClick={() => setAsk({ kind: "resolve", id: d.id })}>Resolve</Button> }]} /></Box>}
      </div>
      <Modal open={!!ask} onOpenChange={(o) => { if (!o) close() }} title={ask ? ASK_TITLE[ask.kind] : ""} desc="The reason is kept in the audit log."
        footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={!reason.trim() || busy} onClick={submit}>Save</Button></>}>
        <Field label="Reason"><TextArea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
    </>
  )
}

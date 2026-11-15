import { useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Box, DataTable, Field, Modal, NativeSelect, Pill, Row, Seg, Title, type Tone } from "@/components/app/ui"
import { NotFound } from "@/components/app/System"
import { errorMessage } from "@/lib/errors"
import { cmp, formatMoney, isDecimal } from "@/lib/money"
import { useUrlTable } from "@/lib/tableState"
import { useAllocate, useCreatePayment, useCustomers, useInvoices, usePayment, usePayments, useReversePayment, useReviewPayment, useVoidAllocation } from "./api"

const LIMIT = 25
const day = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
const Loading = () => <div role="status" aria-busy="true" className="h-48 animate-pulse rounded-xl bg-muted" />
const TONE: Record<string, Tone> = { unmatched: "amber", partially_allocated: "blue", fully_allocated: "green", reversed: "grey" }
const PayPill = ({ s, review }: { s: string; review?: boolean }) => <span className="inline-flex gap-1"><Pill tone={TONE[s] ?? "grey"}>{s.replace("_", " ")}</Pill>{review && <Pill tone="red">under review</Pill>}</span>
const TABS = [{ v: "all", label: "All" }, { v: "unallocated", label: "Unallocated" }, { v: "allocated", label: "Allocated" }, { v: "review", label: "Under review" }, { v: "reversed", label: "Reversed" }] as const

export function RemotePayments() {
  const nav = useNavigate(), t = useUrlTable("", { sort: ["date", -1] }), [params, setParams] = useSearchParams()
  const tab = (params.get("tab") ?? "all") as (typeof TABS)[number]["v"]
  const q = usePayments({ tab, q: t.q || undefined, sort: t.sort?.[0] ?? "date", desc: t.sort?.[1] === -1, page: t.page + 1, limit: LIMIT })
  const [open, setOpen] = useState(false)
  return (
    <>
      <Title sub={`${q.data?.total ?? 0} payments`} right={<><Button variant="outline" render={<Link to="/app/payments/import" />}>Import CSV</Button><Button onClick={() => setOpen(true)}><Plus className="size-4" />Record payment</Button></>}>Payments</Title>
      <Seg items={TABS} value={tab} onChange={(v) => setParams((p) => { const n = new URLSearchParams(p); if (v === "all") n.delete("tab"); else n.set("tab", v); n.delete("page"); return n }, { replace: true })} />
      <Box>
        {q.isError ? <p role="alert" className="p-5 text-sm text-destructive">{errorMessage(q.error)}</p> : (
          <DataTable rows={q.data?.data ?? []} id={(p) => p.id} loading={q.isPending} onRow={(p) => nav("/app/payments/" + p.id)} search={() => ""} pageSize={LIMIT} ctl={{ ...t, total: q.data?.total ?? 0 }}
            cols={[
              { key: "number", label: "Payment", sort: () => 0, render: (p) => <span className="font-mono text-xs">{p.number}</span> },
              { key: "date", label: "Date", sort: () => 0, render: (p) => day(p.payment_date) },
              { key: "payer", label: "Payer as received", sort: () => 0, hide: "md", render: (p) => p.payer_name_raw ?? p.customer_name ?? "—" },
              { key: "amount", label: "Amount", right: true, sort: () => 0, render: (p) => formatMoney(p.amount, p.currency) },
              { key: "un", label: "Unallocated", right: true, hide: "lg", render: (p) => formatMoney(p.unallocated_amount, p.currency) },
              { key: "s", label: "Status", render: (p) => <PayPill s={p.status} review={p.under_review} /> },
            ]} />)}
      </Box>
      <PaymentModal open={open} onOpenChange={setOpen} />
    </>
  )
}

function PaymentModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const customers = useCustomers({ limit: 100, sort: "name" }), create = useCreatePayment(), nav = useNavigate()
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), amount: "", method: "wire", reference: "", payer: "", customer: "" }), [err, setErr] = useState("")
  const submit = () => {
    if (!isDecimal(f.amount) || !(cmp(f.amount, "0") > 0)) return setErr("Enter an amount above zero.")
    create.mutate({ payment_date: f.date, amount: f.amount, method: f.method, reference: f.reference || null, payer_name_raw: f.payer || null, customer_id: f.customer || null }, {
      onSuccess: (p) => { toast.success(`Payment ${p.number} recorded`); onOpenChange(false); nav("/app/payments/" + p.id) }, onError: (e) => setErr(errorMessage(e)) })
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Record payment" desc="Entered by hand, so it stays unverified until it matches a bank record." footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={create.isPending} onClick={submit}>Record payment</Button></>}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field><Field label="Amount"><Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field></div>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Method"><NativeSelect value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{["wire", "ach", "card", "cheque", "other"].map((m) => <option key={m}>{m}</option>)}</NativeSelect></Field><Field label="Reference"><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field></div>
        <Field label="Payer as received"><Input value={f.payer} onChange={(e) => setF({ ...f, payer: e.target.value })} /></Field>
        <Field label="Customer (if known)"><NativeSelect value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })}><option value="">Not identified</option>{(customers.data?.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      </div>
    </Modal>
  )
}

export function RemotePaymentDetail() {
  const { id = "" } = useParams(), q = usePayment(id)
  // When the payer is known, offer that customer's open invoices; otherwise the oldest 100 open invoices.
  const open = useInvoices({ tab: "open", limit: 100, sort: "due", desc: false, customer_id: q.data?.customer_id ?? undefined })
  const alloc = useAllocate(), voidA = useVoidAllocation(), reverse = useReversePayment(), review = useReviewPayment()
  const [inv, setInv] = useState(""), [amt, setAmt] = useState(""), [err, setErr] = useState(""), [modal, setModal] = useState<null | "reverse">(null), [reason, setReason] = useState("")
  if (q.isPending) return <Loading />
  if (q.isError) return <NotFound what="payment" back="/app/payments" />
  const p = q.data, can = p.status !== "reversed", candidates = (open.data?.data ?? []).filter((i) => i.currency === p.currency && !p.allocations.some((a) => a.invoice_id === i.id && !a.voided_at))
  const submit = () => {
    if (!inv) return setErr("Choose an invoice.")
    if (!isDecimal(amt) || !(cmp(amt, "0") > 0)) return setErr("Enter an amount above zero.")
    if (cmp(amt, p.unallocated_amount) > 0) return setErr(`Only ${formatMoney(p.unallocated_amount, p.currency)} is left on this payment.`)
    alloc.mutate({ paymentId: p.id, invoiceId: inv, amount: amt }, { onSuccess: () => { toast.success("Payment applied"); setInv(""); setAmt(""); setErr("") }, onError: (e) => setErr(errorMessage(e)) })
  }
  const doReverse = () => {
    if (!reason.trim()) return setErr("A reason is required.")
    reverse.mutate({ id: p.id, reason }, { onSuccess: () => { toast.success("Payment reversed"); setModal(null); setReason(""); setErr("") }, onError: (e) => setErr(errorMessage(e)) })
  }
  return (
    <>
      <Title back={["/app/payments", "Payments"]} sub={`${p.payer_name_raw ?? p.customer_name ?? "Unknown payer"} · ${day(p.payment_date)}`}
        right={can && <><Button variant="outline" onClick={() => review.mutate({ id: p.id, under_review: !p.under_review })}>{p.under_review ? "Clear review" : "Mark under review"}</Button><Button variant="outline" onClick={() => setModal("reverse")}>Mark reversed</Button></>}>
        {p.number} <PayPill s={p.status} review={p.under_review} />
      </Title>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <Box title="Allocations">
            <DataTable rows={p.allocations} id={(a) => a.id} pageSize={50} empty={<p className="px-5 py-8 text-center text-sm text-hushed">Not allocated yet. Apply it to an invoice below.</p>}
              cols={[{ key: "i", label: "Invoice", render: (a) => <Link to={"/app/invoices/" + a.invoice_id} className="font-mono text-xs underline-offset-2 hover:underline">{a.invoice_number}</Link> }, { key: "a", label: "Amount", right: true, render: (a) => formatMoney(a.amount, a.currency) }, { key: "s", label: "Status", render: (a) => (a.voided_at ? <Pill tone="grey">voided</Pill> : <Pill tone="green">applied</Pill>) },
                { key: "v", label: "", right: true, render: (a) => (!a.voided_at && can ? <Button variant="ghost" size="sm" disabled={voidA.isPending} onClick={() => voidA.mutate({ id: a.id, reason: "Voided by user" }, { onSuccess: () => toast.success("Allocation voided"), onError: (e) => toast.error(errorMessage(e)) })}>Void</Button> : null) }]} />
          </Box>
          {can && cmp(p.unallocated_amount, "0") > 0 && (
            <Box title="Allocate manually" pad>
              <div className="grid items-end gap-3 sm:grid-cols-[1fr_140px_auto]">
                <Field label="Invoice"><NativeSelect value={inv} onChange={(e) => { setInv(e.target.value); const c = candidates.find((x) => x.id === e.target.value); if (c && !amt) setAmt(cmp(c.balance_due, p.unallocated_amount) < 0 ? c.balance_due : p.unallocated_amount) }}><option value="">Select an open invoice…</option>{candidates.map((i) => <option key={i.id} value={i.id}>{i.invoice_number} · {i.customer_name} · {formatMoney(i.balance_due, i.currency)}</option>)}</NativeSelect></Field>
                <Field label="Amount"><Input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} /></Field>
                <Button disabled={alloc.isPending} onClick={submit}>Allocate</Button>
              </div>
              {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
            </Box>)}
        </div>
        <aside>
          <Box title="Facts" pad>
            <Row k="Amount">{formatMoney(p.amount, p.currency)}</Row><Row k="Allocated">{formatMoney(p.allocated_amount, p.currency)}</Row><Row k="Unallocated">{formatMoney(p.unallocated_amount, p.currency)}</Row>
            <Row k="Reference"><span className="font-mono text-xs">{p.reference ?? "—"}</span></Row><Row k="Method">{p.method ?? "—"}</Row><Row k="Customer">{p.customer_name ?? "Not identified"}</Row>
            <Row k="Verification">{p.verification_level === "manual" ? "Entered by hand, unverified" : "Verified by bank record"}</Row>
          </Box>
          {p.reversal_reason && <Box className="mt-3" title="Reversed" pad><p className="text-sm">{p.reversal_reason}</p></Box>}
        </aside>
      </div>
      <Modal open={modal === "reverse"} onOpenChange={(o) => !o && setModal(null)} title={`Reverse ${p.number}?`} desc="Every allocation is voided and the invoices are reopened. This is recorded in the audit log." footer={<><Button variant="outline" onClick={() => setModal(null)}>Keep payment</Button><Button variant="destructive" disabled={reverse.isPending} onClick={doReverse}>Reverse payment</Button></>}>
        <div className="space-y-3"><Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>{err && <p role="alert" className="text-sm text-destructive">{err}</p>}</div>
      </Modal>
    </>
  )
}

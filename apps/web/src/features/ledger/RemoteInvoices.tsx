import { useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Box, DataTable, Field, Modal, NativeSelect, Pill, Row, Seg, Title, type Tone } from "@/components/app/ui"
import { NotFound } from "@/components/app/System"
import { errorMessage } from "@/lib/errors"
import { cmp, formatMoney, isDecimal } from "@/lib/money"
import { useUrlTable } from "@/lib/tableState"
import { useCancelInvoice, useCreateInvoice, useCustomers, useInvoice, useInvoices, useRecordPayment, type Invoice } from "./api"

const LIMIT = 25
const day = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
const Loading = () => <div role="status" aria-busy="true" className="h-48 animate-pulse rounded-xl bg-muted" />
export const STATUS_TONE: Record<string, Tone> = { paid: "green", overdue: "red", partially_paid: "amber", disputed: "amber", cancelled: "grey", draft: "grey", issued: "grey" }
export const StatusPill = ({ s }: { s: string }) => <Pill tone={STATUS_TONE[s] ?? "grey"}>{s.replace("_", " ")}</Pill>
/** The display status is the first match in the documented order; the other facts stay visible as secondary badges (A.3). */
export const InvoiceBadges = ({ i }: { i: Pick<Invoice, "status" | "amount_paid"> }) => (
  <span className="inline-flex flex-wrap items-center gap-1.5">
    <StatusPill s={i.status} />
    {i.status === "overdue" && cmp(i.amount_paid, "0") > 0 && <StatusPill s="partially_paid" />}
  </span>
)
const TABS = [{ v: "all", label: "All" }, { v: "open", label: "Open" }, { v: "overdue", label: "Overdue" }, { v: "paid", label: "Paid" }, { v: "cancelled", label: "Cancelled" }] as const

export function RemoteInvoices() {
  const nav = useNavigate(), t = useUrlTable("", { sort: ["due", -1] }), [params, setParams] = useSearchParams()
  const tab = (params.get("tab") ?? "all") as (typeof TABS)[number]["v"]
  const q = useInvoices({ tab, q: t.q || undefined, sort: t.sort?.[0] ?? "due", desc: t.sort?.[1] === -1, page: t.page + 1, limit: LIMIT })
  const [open, setOpen] = useState(false)
  return (
    <>
      <Title sub={`${q.data?.total ?? 0} invoices`} right={<><Button variant="outline" render={<Link to="/app/invoices/import" />}>Import CSV</Button><Button onClick={() => setOpen(true)}><Plus className="size-4" />New invoice</Button></>}>Invoices</Title>
      <Seg items={TABS} value={tab} onChange={(v) => setParams((p) => { const n = new URLSearchParams(p); if (v === "all") n.delete("tab"); else n.set("tab", v); n.delete("page"); return n }, { replace: true })} />
      <Box>
        {q.isError ? <p role="alert" className="p-5 text-sm text-destructive">{errorMessage(q.error)}</p> : (
          <DataTable rows={q.data?.data ?? []} id={(i) => i.id} loading={q.isPending} onRow={(i) => nav("/app/invoices/" + i.id)} search={() => ""} pageSize={LIMIT} ctl={{ ...t, total: q.data?.total ?? 0 }}
            cols={[
              { key: "invoice", label: "Invoice", sort: () => 0, render: (i: Invoice) => <span className="font-mono text-xs">{i.invoice_number}</span> },
              { key: "customer", label: "Customer", sort: () => 0, render: (i) => i.customer_name },
              { key: "due", label: "Due", sort: () => 0, hide: "md", render: (i) => day(i.due_date) },
              { key: "total", label: "Total", right: true, sort: () => 0, hide: "md", render: (i) => formatMoney(i.total_amount, i.currency) },
              { key: "balance", label: "Balance", right: true, sort: () => 0, render: (i) => formatMoney(i.balance_due, i.currency) },
              { key: "status", label: "Status", render: (i) => <span className="inline-flex items-center gap-2"><InvoiceBadges i={i} />{i.days_late > 0 && <span className="text-xs text-hushed">{i.days_late}d</span>}</span> },
            ]} />)}
      </Box>
      <InvoiceModal open={open} onOpenChange={setOpen} />
    </>
  )
}

type Line = { description: string; quantity: string; unit_price: string }

function InvoiceModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const customers = useCustomers({ limit: 100, sort: "name" }), create = useCreateInvoice(), nav = useNavigate()
  const today = new Date().toISOString().slice(0, 10)
  const [customer, setCustomer] = useState(""), [issue, setIssue] = useState(today), [due, setDue] = useState(""), [po, setPo] = useState(""), [err, setErr] = useState("")
  const [lines, setLines] = useState<Line[]>([{ description: "", quantity: "1", unit_price: "" }])
  const setLine = (i: number, k: keyof Line, v: string) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)))
  const submit = () => {
    if (!customer) return setErr("Choose a customer.")
    if (!due) return setErr("Choose a due date.")
    if (due < issue) return setErr("The due date cannot be before the issue date.")
    if (lines.some((l) => !l.description.trim() || !isDecimal(l.quantity) || !(cmp(l.quantity, "0") > 0) || !isDecimal(l.unit_price) || cmp(l.unit_price, "0") < 0)) return setErr("Each line needs a description, a quantity above zero and a price.")
    create.mutate({ customer_id: customer, issue_date: issue, due_date: due, po_number: po || null, lines: lines.map((l) => ({ description: l.description.trim(), quantity: l.quantity, unit_price: l.unit_price })) }, {
      onSuccess: (inv) => { toast.success(`Invoice ${inv.invoice_number} created`); onOpenChange(false); nav("/app/invoices/" + inv.id) },
      onError: (e) => setErr(errorMessage(e)),
    })
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New invoice" footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={create.isPending} onClick={submit}>Create invoice</Button></>}>
      <div className="space-y-3">
        <Field label="Customer *"><NativeSelect value={customer} onChange={(e) => setCustomer(e.target.value)}><option value="">Select…</option>{(customers.data?.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
        <div className="grid gap-3 sm:grid-cols-3"><Field label="Issue date"><Input type="date" value={issue} onChange={(e) => setIssue(e.target.value)} /></Field><Field label="Due date"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field><Field label="PO number"><Input value={po} onChange={(e) => setPo(e.target.value)} /></Field></div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_70px_100px_32px] items-end gap-2">
            <Field label={i === 0 ? "Description" : ""}><Input aria-label={`Description ${i + 1}`} value={l.description} onChange={(e) => setLine(i, "description", e.target.value)} /></Field>
            <Field label={i === 0 ? "Qty" : ""}><Input aria-label={`Quantity ${i + 1}`} value={l.quantity} onChange={(e) => setLine(i, "quantity", e.target.value)} /></Field>
            <Field label={i === 0 ? "Price" : ""}><Input aria-label={`Price ${i + 1}`} value={l.unit_price} onChange={(e) => setLine(i, "unit_price", e.target.value)} /></Field>
            <Button variant="ghost" size="icon" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
          </div>))}
        <Button variant="outline" size="sm" onClick={() => setLines([...lines, { description: "", quantity: "1", unit_price: "" }])}>Add line</Button>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      </div>
    </Modal>
  )
}

export function RemoteInvoiceDetail() {
  const { id = "" } = useParams(), q = useInvoice(id), pay = useRecordPayment(), cancel = useCancelInvoice(), nav = useNavigate()
  const [modal, setModal] = useState<null | "pay" | "cancel">(null), [amount, setAmount] = useState(""), [method, setMethod] = useState("wire"), [ref, setRef] = useState(""), [reason, setReason] = useState(""), [err, setErr] = useState("")
  if (q.isPending) return <Loading />
  if (q.isError) return <NotFound what="invoice" back="/app/invoices" />
  const i = q.data, open = i.lifecycle_status === "issued", owed = cmp(i.balance_due, "0") > 0
  const close = () => { setModal(null); setErr(""); setAmount(""); setReason("") }
  const submitPay = () => {
    if (!isDecimal(amount) || !(cmp(amount, "0") > 0)) return setErr("Enter an amount above zero.")
    if (cmp(amount, i.balance_due) > 0) return setErr(`The amount cannot exceed the balance of ${formatMoney(i.balance_due, i.currency)}.`)
    pay.mutate({ invoiceId: i.id, amount, method, reference: ref || undefined }, { onSuccess: () => { toast.success("Payment recorded"); close() }, onError: (e) => setErr(errorMessage(e)) })
  }
  const submitCancel = () => {
    if (!reason.trim()) return setErr("A reason is required.")
    cancel.mutate({ id: i.id, reason }, { onSuccess: () => { toast.success("Invoice cancelled"); close() }, onError: (e) => setErr(errorMessage(e)) })
  }
  return (
    <>
      <Title back={["/app/invoices", "Invoices"]} sub={<>{i.customer_name} · due {day(i.due_date)}</>}
        right={open && <>{owed && <Button onClick={() => setModal("pay")}>Record payment</Button>}<Button variant="outline" onClick={() => setModal("cancel")}>Cancel invoice</Button></>}>
        {i.invoice_number} <InvoiceBadges i={i} />
      </Title>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <Box title="Line items"><DataTable rows={i.lines} id={(l) => String(l.position)} pageSize={50} cols={[{ key: "d", label: "Description", render: (l) => l.description }, { key: "q", label: "Qty", right: true, render: (l) => l.quantity }, { key: "p", label: "Price", right: true, render: (l) => formatMoney(l.unit_price, i.currency) }, { key: "a", label: "Amount", right: true, render: (l) => formatMoney(l.amount, i.currency) }]} /></Box>
          <Box title="Payments and allocations">
            <DataTable rows={i.allocations} id={(a) => a.id} pageSize={50} onRow={(a) => nav("/app/payments/" + a.payment_id)} empty={<p className="px-5 py-8 text-center text-sm text-hushed">No payments applied yet.</p>}
              cols={[{ key: "p", label: "Payment", render: (a) => <Link to={"/app/payments/" + a.payment_id} className="font-mono text-xs underline-offset-2 hover:underline">{a.payment_number}</Link> }, { key: "a", label: "Amount", right: true, render: (a) => formatMoney(a.amount, a.currency) }, { key: "m", label: "Method", hide: "md", render: (a) => a.method.replace("_", " ") }, { key: "s", label: "Status", render: (a) => (a.voided_at ? <Pill tone="grey">voided</Pill> : <Pill tone="green">applied</Pill>) }]} />
          </Box>
        </div>
        <aside>
          <Box title="Balance, calculated" pad>
            <Row k="Total">{formatMoney(i.total_amount, i.currency)}</Row><Row k="Paid">{formatMoney(i.amount_paid, i.currency)}</Row><Row k="Adjustments">{formatMoney(i.amount_adjusted, i.currency)}</Row>
            <Row k="Balance due"><b className="font-normal">{formatMoney(i.balance_due, i.currency)}</b></Row>
            <p className="mt-2 text-xs text-hushed">Total − payments − approved adjustments. Calculated by venn from stored records.</p>
          </Box>
          {i.cancel_reason && <Box className="mt-3" title="Cancelled" pad><p className="text-sm">{i.cancel_reason}</p></Box>}
        </aside>
      </div>
      <Modal open={modal === "pay"} onOpenChange={(o) => !o && close()} title="Record payment" desc={`Balance ${formatMoney(i.balance_due, i.currency)}`} footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={pay.isPending} onClick={submitPay}>Record payment</Button></>}>
        <div className="space-y-3"><Field label="Amount"><Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" /></Field><Field label="Method"><NativeSelect value={method} onChange={(e) => setMethod(e.target.value)}>{["wire", "ach", "card", "cheque", "other"].map((m) => <option key={m}>{m}</option>)}</NativeSelect></Field><Field label="Reference"><Input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>{err && <p role="alert" className="text-sm text-destructive">{err}</p>}</div>
      </Modal>
      <Modal open={modal === "cancel"} onOpenChange={(o) => !o && close()} title={`Cancel ${i.invoice_number}?`} desc="The invoice becomes read-only and leaves the receivables. This is recorded in the audit log." footer={<><Button variant="outline" onClick={close}>Keep invoice</Button><Button variant="destructive" disabled={cancel.isPending} onClick={submitCancel}>Cancel invoice</Button></>}>
        <div className="space-y-3"><Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>{err && <p role="alert" className="text-sm text-destructive">{err}</p>}</div>
      </Modal>
    </>
  )
}

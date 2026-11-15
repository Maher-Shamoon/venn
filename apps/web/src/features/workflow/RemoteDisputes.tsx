import { useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Box, DataTable, Empty, Field, Modal, Mono, NativeSelect, Pill, Row, Seg, TextArea, Title, type Tone } from "@/components/app/ui"
import { NotFound } from "@/components/app/System"
import { ApiError } from "@/api/errors"
import { errorMessage } from "@/lib/errors"
import { cmp, formatMoney, isDecimal } from "@/lib/money"
import { useInvoices } from "@/features/ledger/api"
import { CATEGORIES, useDispute, useDisputeNote, useDisputeStatus, useDisputes, useOpenDispute, useResolveDispute, type Dispute } from "./api"

const day = (iso: string) => new Date(iso + (iso.length === 10 ? "T00:00:00Z" : "")).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
const label = (s: string) => s.replace(/_/g, " ")
const TONE: Record<string, Tone> = { open: "amber", awaiting_customer: "blue", awaiting_approval: "blue", resolved: "green" }
const cat = (k: string) => CATEGORIES.find(([v]) => v === k)?.[1] ?? k
const Loading = () => <div role="status" aria-busy="true" className="h-48 animate-pulse rounded-xl bg-muted" />
const FILTERS = [{ v: "all", label: "All" }, { v: "open", label: "Open" }, { v: "awaiting_customer", label: "Awaiting customer" }, { v: "resolved", label: "Resolved" }] as const

export function RemoteDisputes() {
  const [f, setF] = useState<(typeof FILTERS)[number]["v"]>("all"), q = useDisputes(f, ""), nav = useNavigate(), [params] = useSearchParams(), [open, setOpen] = useState(!!params.get("invoice"))
  return (
    <>
      <Title sub="The customer's explanation is kept as they wrote it and is not verified." right={<Button onClick={() => setOpen(true)}>New dispute</Button>}>Disputes</Title>
      <Seg items={FILTERS} value={f} onChange={setF} />
      {q.isPending ? <Loading /> : (
        <Box><DataTable rows={q.data ?? []} id={(d: Dispute) => d.id} onRow={(d) => nav("/app/disputes/" + d.id)} search={(d) => d.number + d.customer + d.invoice_number} empty={<Empty title="No disputes" sub="Open one from an invoice when a customer disagrees with it." />}
          cols={[{ key: "n", label: "Dispute", render: (d) => <div><Mono>{d.number}</Mono><div className="text-xs text-hushed">{cat(d.category)}</div></div> }, { key: "c", label: "Customer", render: (d) => <div>{d.customer}<div className="font-mono text-[11px] text-hushed">{d.invoice_number}</div></div> },
            { key: "a", label: "Disputed", right: true, render: (d) => formatMoney(d.amount, d.currency) }, { key: "w", label: "Due", hide: "md", render: (d) => (d.due_date ? <span className={d.overdue ? "text-destructive" : ""}>{day(d.due_date)}{d.overdue ? " · overdue" : ""}</span> : "") },
            { key: "s", label: "Status", render: (d) => <Pill tone={TONE[d.status]}>{label(d.status)}</Pill> }]} /></Box>)}
      <NewDispute open={open} onClose={() => setOpen(false)} invoiceId={params.get("invoice") ?? ""} />
    </>
  )
}

function NewDispute({ open, onClose, invoiceId }: { open: boolean; onClose: () => void; invoiceId: string }) {
  const [inv, setInv] = useState(invoiceId), [category, setCategory] = useState("pricing"), [amount, setAmount] = useState(""), [why, setWhy] = useState(""), [due, setDue] = useState(""), [err, setErr] = useState("")
  const invoices = useInvoices({ tab: "open", limit: 100, sort: "due" }), create = useOpenDispute(), nav = useNavigate()
  const chosen = invoices.data?.data.find((i) => i.id === inv)
  const submit = () => {
    if (!inv) return setErr("Choose an invoice.")
    if (!isDecimal(amount) || cmp(amount, "0") <= 0) return setErr("Enter the disputed amount.")
    if (chosen && cmp(amount, chosen.total_amount) > 0) return setErr(`The amount cannot exceed the invoice total of ${formatMoney(chosen.total_amount, chosen.currency)}.`)
    if (!why.trim()) return setErr("Write down what the customer says.")
    create.mutate({ invoice_id: inv, category, amount, explanation: why, due_date: due || undefined }, { onSuccess: (d) => { toast.success("Dispute opened"); onClose(); nav("/app/disputes/" + d.id) }, onError: (e) => setErr(errorMessage(e)) })
  }
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="New dispute" desc="Opening a dispute pauses collections for this customer." footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={create.isPending} onClick={submit}>Open dispute</Button></>}>
      <div className="space-y-3">
        <Field label="Invoice"><NativeSelect value={inv} onChange={(e) => setInv(e.target.value)}><option value="">Choose an invoice</option>{(invoices.data?.data ?? []).map((i) => <option key={i.id} value={i.id}>{i.invoice_number} · {i.customer_name} · {formatMoney(i.total_amount, i.currency)}</option>)}</NativeSelect></Field>
        <Field label="Category"><NativeSelect value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect></Field>
        <Field label="Disputed amount"><Input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="What the customer says" hint="Kept as their words. It is not verified."><TextArea value={why} onChange={(e) => setWhy(e.target.value)} /></Field>
        <Field label="Respond by (optional)"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      </div>
    </Modal>
  )
}

export function RemoteDisputeDetail() {
  const { id = "" } = useParams(), q = useDispute(id), note = useDisputeNote(), status = useDisputeStatus(), resolve = useResolveDispute()
  const [modal, setModal] = useState<null | "note" | "resolve">(null), [txt, setTxt] = useState(""), [outcome, setOutcome] = useState("rejected"), [credit, setCredit] = useState(""), [err, setErr] = useState("")
  if (q.isPending) return <Loading />
  if (q.isError || !q.data) return <NotFound what="dispute" back="/app/disputes" />
  const d = q.data, ro = d.status === "resolved", close = () => { setModal(null); setTxt(""); setErr(""); setCredit("") }
  const fail = (e: unknown) => toast.error(e instanceof ApiError && e.status === 409 ? e.message : errorMessage(e))
  const submit = () => {
    if (!txt.trim()) return setErr("Say why.")
    if (outcome !== "rejected" && (!isDecimal(credit) || cmp(credit, "0") <= 0 || cmp(credit, d.amount) > 0)) return setErr(`Enter the credit to issue, up to ${formatMoney(d.amount, d.currency)}.`)
    resolve.mutate({ id, outcome, note: txt, credit_amount: outcome === "rejected" ? undefined : credit }, { onSuccess: (r) => { toast.success(r.status === "resolved" ? "Dispute resolved" : "Credit sent for approval"); close() }, onError: (e) => setErr(errorMessage(e)) })
  }
  return (
    <>
      <Title back={["/app/disputes", "Disputes"]} sub={<><Mono>{d.number}</Mono> · {cat(d.category)} · {d.customer}</>} right={!ro && <>
        {d.status !== "awaiting_approval" && <Button variant="outline" disabled={status.isPending} onClick={() => status.mutate({ id, status: d.status === "open" ? "awaiting_customer" : "open" }, { onError: fail })}>{d.status === "open" ? "Waiting for customer" : "Back to open"}</Button>}
        <Button variant="outline" onClick={() => setModal("note")}>Add note</Button>{d.status !== "awaiting_approval" && <Button onClick={() => setModal("resolve")}>Resolve</Button>}</>}>{formatMoney(d.amount, d.currency)} disputed</Title>
      <div className="mb-4 flex flex-wrap gap-2"><Pill tone={TONE[d.status]}>{label(d.status)}</Pill>{d.overdue && <Pill tone="red">response overdue</Pill>}{d.outcome && <Pill tone="green">{label(d.outcome)}</Pill>}</div>
      {ro && <div className="mb-4 rounded-xl bg-muted p-4 text-sm">This dispute is resolved and read-only. {d.outcome_note}</div>}
      {d.status === "awaiting_approval" && d.approval_id && <div role="status" className="mb-4 rounded-xl border border-[#e0b13a] bg-[#fff8e1] p-4 text-sm">A credit is waiting for approval. The dispute closes when it is decided. <Link className="underline underline-offset-2" to={"/app/approvals/" + d.approval_id}>Open the request</Link></div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Box title="What the customer says" pad><blockquote className="border-l-[3px] border-border pl-4 text-sm">{d.explanation}</blockquote><p className="mt-2 font-mono text-[11px] text-hushed">UNVERIFIED · NOT CONFIRMED BY A RECORD</p></Box>
          <Box title="Timeline" pad><ol>{d.events.map((e, i) => <li key={i} className="relative border-l border-border pb-5 pl-5 last:pb-0"><span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-lime-light" /><div className="text-sm">{e.text}</div><div className="text-xs text-hushed">{e.by ?? "venn"} · {when(e.at)}</div></li>)}</ol></Box>
        </div>
        <aside className="space-y-4">
          <Box title="Linked" pad><Row k="Invoice"><Link className="font-mono text-xs underline underline-offset-2" to={"/app/invoices/" + d.invoice_id}>{d.invoice_number}</Link></Row><Row k="Customer"><Link className="underline underline-offset-2" to={"/app/customers/" + d.customer_id}>{d.customer}</Link></Row>{d.due_date && <Row k="Respond by">{day(d.due_date)}</Row>}</Box>
          <Box title="Evidence" pad>{d.documents.length ? d.documents.map((x) => <div key={x.id} className="py-1 text-sm">{x.filename}</div>) : <p className="text-sm text-hushed">No documents are linked to this invoice yet.</p>}</Box>
        </aside>
      </div>
      <Modal open={modal === "note"} onOpenChange={(o) => !o && close()} title="Add note" footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={!txt.trim() || note.isPending} onClick={() => note.mutate({ id, text: txt }, { onSuccess: () => { toast.success("Note added"); close() }, onError: fail })}>Add note</Button></>}><TextArea aria-label="Note" value={txt} onChange={(e) => setTxt(e.target.value)} /></Modal>
      <Modal open={modal === "resolve"} onOpenChange={(o) => !o && close()} title="Resolve this dispute" desc="A credit goes to an owner for approval first. The dispute closes when it is decided." footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={resolve.isPending} onClick={submit}>Resolve</Button></>}>
        <div className="space-y-3"><Field label="Outcome"><NativeSelect value={outcome} onChange={(e) => setOutcome(e.target.value)}><option value="rejected">Rejected: the invoice stands</option><option value="partially_upheld">Partly upheld: issue a credit</option><option value="upheld">Upheld: issue a credit</option></NativeSelect></Field>
          {outcome !== "rejected" && <Field label="Credit to issue" hint={`Up to ${formatMoney(d.amount, d.currency)}`}><Input value={credit} inputMode="decimal" onChange={(e) => setCredit(e.target.value)} /></Field>}
          <Field label="Why"><TextArea aria-label="Why" value={txt} onChange={(e) => setTxt(e.target.value)} /></Field>{err && <p role="alert" className="text-sm text-destructive">{err}</p>}</div></Modal>
    </>
  )
}

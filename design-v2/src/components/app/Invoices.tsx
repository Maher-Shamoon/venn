import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Download, FileUp, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { A, balOf, download, invTotal, lateOf, paidOf, statusOf, toCsv, useApp, usd, fmtD, type Line } from "./store"
import { Box, DataTable, Field, Modal, Mono, NativeSelect, Pill, Row, Seg, TextArea, Title } from "./ui"
import { NotFound } from "./System"
import { useRole } from "./Shell"

function NewInvoice({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const s = useApp(), nav = useNavigate()
  const [cust, setCust] = useState(""), [issued, setIssued] = useState("2026-11-13"), [due, setDue] = useState("2026-12-13"), [po, setPo] = useState("")
  const [lines, setLines] = useState<Line[]>([{ d: "", qty: 1, price: 0 }])
  const [err, setErr] = useState("")
  const total = lines.reduce((t, l) => t + l.qty * l.price, 0)
  const submit = () => {
    if (!cust) return setErr("Choose a customer.")
    if (due < issued) return setErr("The due date cannot be before the issue date.")
    if (!lines.length || lines.some((l) => !l.d.trim() || l.qty <= 0 || l.price <= 0)) return setErr("Each line needs a description, a quantity and a price above zero.")
    const id = A.addInvoice({ cust, issued, due, po: po || "—", lines }); onOpenChange(false); nav("/app/invoices/" + id)
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New invoice" desc="Creates an invoice record in venn. It does not post to your accounting system."
      footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit}>Create invoice</Button></>}>
      <div className="space-y-3">
        <Field label="Customer *"><NativeSelect value={cust} onChange={(e) => setCust(e.target.value)}><option value="">Select…</option>{s.customers.map((c) => <option key={c.id}>{c.name}</option>)}</NativeSelect></Field>
        <div className="grid gap-3 sm:grid-cols-3"><Field label="Issue date"><Input type="date" value={issued} onChange={(e) => setIssued(e.target.value)} /></Field><Field label="Due date"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field><Field label="PO number"><Input value={po} onChange={(e) => setPo(e.target.value)} /></Field></div>
        <div className="space-y-2">{lines.map((l, k) => (
          <div key={k} className="grid grid-cols-[1fr_64px_96px_32px] items-end gap-2">
            <Field label={k ? "" : "Description"}><Input value={l.d} onChange={(e) => setLines(lines.map((x, j) => (j === k ? { ...x, d: e.target.value } : x)))} /></Field>
            <Field label={k ? "" : "Qty"}><Input type="number" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === k ? { ...x, qty: +e.target.value } : x)))} /></Field>
            <Field label={k ? "" : "Price"}><Input type="number" value={l.price || ""} onChange={(e) => setLines(lines.map((x, j) => (j === k ? { ...x, price: +e.target.value } : x)))} /></Field>
            <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== k))}><Trash2 className="size-4" /></Button>
          </div>))}</div>
        <div className="flex items-center justify-between"><Button variant="outline" size="sm" onClick={() => setLines([...lines, { d: "", qty: 1, price: 0 }])}><Plus className="size-4" />Add line</Button><span className="text-sm">Total <b className="font-normal tabular-nums">{usd(total)}</b></span></div>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      </div>
    </Modal>
  )
}

export function Invoices() {
  const s = useApp(), nav = useNavigate()
  const [f, setF] = useState<"all" | "open" | "overdue" | "paid" | "disputed">("all")
  const [cust, setCust] = useState("")
  const [sel, setSel] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const disputed = new Set(s.dsps.filter((d) => d.status !== "resolved").map((d) => d.inv))
  const rows = s.invoices.filter((i) => (cust ? i.cust === cust : true)).filter((i) => (f === "open" ? balOf(s, i) > 0 : f === "overdue" ? balOf(s, i) > 0 && lateOf(i) > 0 : f === "paid" ? balOf(s, i) === 0 && !i.cancelled : f === "disputed" ? disputed.has(i.id) : true))
  const exportCsv = () => { const r = (sel.length ? rows.filter((i) => sel.includes(i.id)) : rows); download("invoices.csv", toCsv([["Number", "Customer", "Issued", "Due", "Total", "Paid", "Balance", "Status"], ...r.map((i) => [i.id, i.cust, i.issued, i.due, invTotal(i), paidOf(s, i.id), balOf(s, i), statusOf(s, i)[0]])])); toast.success(`Exported ${r.length} invoices`) }
  return (
    <>
      <Title sub={`${s.invoices.length} invoices`} right={<><Button variant="outline" render={<Link to="/app/invoices/pdf-review" />}><FileUp className="size-4" />Upload PDF</Button><Button variant="outline" render={<Link to="/app/invoices/import" />}>Import CSV</Button><Button onClick={() => setOpen(true)}><Plus className="size-4" />New invoice</Button></>}>Invoices</Title>
      <div className="flex flex-wrap items-center gap-x-3"><Seg items={[{ v: "all", label: "All", n: s.invoices.length }, { v: "open", label: "Open" }, { v: "overdue", label: "Overdue" }, { v: "paid", label: "Paid" }, { v: "disputed", label: "Disputed" }] as const} value={f} onChange={setF} />
        <div className="mb-4 w-52"><NativeSelect aria-label="Customer filter" value={cust} onChange={(e) => setCust(e.target.value)}><option value="">All customers</option>{s.customers.map((c) => <option key={c.id}>{c.name}</option>)}</NativeSelect></div></div>
      <Box>
        <DataTable rows={rows} id={(i) => i.id} onRow={(i) => nav("/app/invoices/" + i.id)} search={(i) => i.id + i.cust + i.po} defaultSort={["due", 1]}
          toolbar={<><span className="text-sm text-hushed">{sel.length ? `${sel.length} selected` : ""}</span><Button variant="outline" size="sm" onClick={exportCsv}><Download className="size-4" />Export{sel.length ? " selected" : ""}</Button></>}
          cols={[
            { key: "sel", label: "", render: (i) => <input type="checkbox" aria-label={`Select ${i.id}`} checked={sel.includes(i.id)} onClick={(e) => e.stopPropagation()} onChange={() => setSel(sel.includes(i.id) ? sel.filter((x) => x !== i.id) : [...sel, i.id])} className="size-4 accent-[#f472b6]" /> },
            { key: "id", label: "Invoice", sort: (i) => i.id, render: (i) => <Mono>{i.id}</Mono> },
            { key: "c", label: "Customer", sort: (i) => i.cust, render: (i) => i.cust },
            { key: "due", label: "Due", hide: "md", sort: (i) => i.due, render: (i) => fmtD(i.due) },
            { key: "t", label: "Total", right: true, hide: "lg", sort: (i) => invTotal(i), render: (i) => usd(invTotal(i)) },
            { key: "p", label: "Paid", right: true, hide: "lg", render: (i) => usd(paidOf(s, i.id)) },
            { key: "b", label: "Balance", right: true, sort: (i) => balOf(s, i), render: (i) => usd(balOf(s, i)) },
            { key: "late", label: "Days late", right: true, hide: "md", sort: (i) => (balOf(s, i) ? lateOf(i) : 0), render: (i) => (balOf(s, i) && lateOf(i) ? lateOf(i) : "—") },
            { key: "s", label: "Status", render: (i) => { const [l, t] = statusOf(s, i); return <span className="flex gap-1"><Pill tone={t}>{l}</Pill>{disputed.has(i.id) && <Pill tone="blue">disputed</Pill>}</span> } },
          ]} />
      </Box>
      <NewInvoice open={open} onOpenChange={setOpen} />
    </>
  )
}

export function InvoiceDetail() {
  const { id } = useParams(), s = useApp(), nav = useNavigate(), role = useRole()
  const i = s.invoices.find((x) => x.id === id)
  const [modal, setModal] = useState<null | "pay" | "adjust" | "dispute" | "cancel">(null)
  const [pay, setPay] = useState({ amount: "", method: "Wire", ref: "" }), [adj, setAdj] = useState({ type: "write-off", amount: "", reason: "" }), [dsp, setDsp] = useState({ cat: "Scope", reason: "" })
  const [err, setErr] = useState("")
  if (!i) return <NotFound what="invoice" back="/app/invoices" />
  const total = invTotal(i), bal = balOf(s, i), [label, tone] = statusOf(s, i)
  const allocs = s.allocs.filter((a) => a.inv === i.id), pays = allocs.filter((a) => a.kind === "payment" && !a.void).reduce((t, a) => t + a.amount, 0), adjs = allocs.filter((a) => a.kind !== "payment" && !a.void).reduce((t, a) => t + a.amount, 0)
  const invg = s.invgs.find((g) => g.inv === i.id), dspn = s.dsps.find((d) => d.inv === i.id), col = s.cols.find((c) => c.invs.includes(i.id))
  const readOnly = !!i.cancelled || bal === 0
  const submitPay = () => { const n = +pay.amount; if (!(n > 0)) return setErr("Enter an amount above zero."); if (n > bal + 0.001) return setErr(`The amount cannot exceed the balance of ${usd(bal)}.`); A.recordPayment(i.id, n, pay.method, pay.ref); setModal(null); setPay({ amount: "", method: "Wire", ref: "" }); setErr("") }
  const submitAdj = () => { const n = +adj.amount; if (!(n > 0) || n > bal) return setErr(`Enter an amount between 0.01 and ${usd(bal)}.`); if (!adj.reason.trim()) return setErr("A reason is required."); A.requestApproval(adj.type as "write-off" | "credit", i.id, i.cust, n, adj.reason, i.id); setModal(null); setErr("") }
  return (
    <>
      <Title back={["/app/invoices", "Invoices"]} sub={<>{i.cust} · PO {i.po}</>} right={!readOnly && <>
        <Button variant="outline" onClick={() => setModal("pay")}>Record payment</Button>
        <Button variant="outline" onClick={() => { const g = A.openInvg(i.id); nav("/app/investigations/" + g) }}>{invg ? "Open investigation" : "Start investigation"}</Button>
        <Button variant="outline" onClick={() => setModal("dispute")}>Open dispute</Button>
        <Button variant="outline" onClick={() => setModal("adjust")}>{role === "owner" ? "Request adjustment" : "Submit for approval"}</Button>
      </>}><span className="font-mono">{i.id}</span> <Pill tone={tone}>{label}</Pill></Title>
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          <Box title="Balance, calculated">
            <div className="grid gap-px overflow-hidden rounded-b-xl bg-border sm:grid-cols-4">
              {[["Total", usd(total)], ["− Payments", usd(pays)], ["− Adjustments", usd(adjs)], ["= Balance", usd(bal)]].map(([k, v], n) => <div key={k} className={n === 3 ? "bg-lime p-4" : "bg-white p-4"}><div className="text-xs text-hushed">{k}</div><div className="mt-1 text-xl tabular-nums">{v}</div></div>)}
            </div>
          </Box>
          <Box title="Line items"><DataTable rows={i.lines} id={(l) => l.d} cols={[{ key: "d", label: "Description", render: (l) => l.d }, { key: "q", label: "Qty", right: true, render: (l) => l.qty }, { key: "p", label: "Price", right: true, render: (l) => usd(l.price) }, { key: "t", label: "Amount", right: true, render: (l) => usd(l.qty * l.price) }]} /></Box>
          <Box title="Payments and allocations"><DataTable rows={allocs} id={(a) => a.id} empty={<div className="px-5 py-8 text-center text-sm text-hushed">No payments allocated yet.</div>} cols={[{ key: "p", label: "Source", render: (a) => a.kind === "payment" ? <Link to={"/app/payments/" + a.pay} className="font-mono text-xs underline-offset-2 hover:underline">{a.pay}</Link> : <Pill tone="blue">{a.kind}</Pill> }, { key: "d", label: "Date", hide: "md", render: (a) => fmtD(a.at) }, { key: "by", label: "By", hide: "md", render: (a) => a.by }, { key: "a", label: "Amount", right: true, render: (a) => (a.void ? <span className="text-hushed line-through">{usd(a.amount)}</span> : usd(a.amount)) }, { key: "u", label: "", right: true, render: (a) => (a.void ? <Pill tone="grey">voided</Pill> : a.kind === "payment" ? <Button variant="ghost" size="sm" onClick={() => A.undoAlloc(a.id)}>Void</Button> : null) }]} /></Box>
        </div>
        <aside className="space-y-3">
          <Box title="Details" pad><Row k="Customer"><Link className="underline-offset-2 hover:underline" to={"/app/customers/" + (s.customers.find((c) => c.name === i.cust)?.id ?? "")}>{i.cust}</Link></Row><Row k="Issued">{fmtD(i.issued)}</Row><Row k="Due">{fmtD(i.due)}</Row><Row k="Days late">{bal && lateOf(i) ? lateOf(i) : "—"}</Row></Box>
          <Box title="Related" pad>
            <Row k="Investigation">{invg ? <Link className="underline-offset-2 hover:underline" to={"/app/investigations/" + invg.id}>{invg.id}</Link> : "None"}</Row>
            <Row k="Dispute">{dspn ? <Link className="underline-offset-2 hover:underline" to={"/app/disputes/" + dspn.id}>{dspn.id}</Link> : "None"}</Row>
            <Row k="Collections">{col ? <Link className="underline-offset-2 hover:underline" to={"/app/collections/" + col.id}>{col.id}</Link> : "None"}</Row>
          </Box>
          {!readOnly && <Button variant="outline" className="w-full text-destructive" onClick={() => setModal("cancel")}>Cancel invoice</Button>}
        </aside>
      </div>

      <Modal open={modal === "pay"} onOpenChange={(o) => { setModal(o ? "pay" : null); setErr("") }} title="Record payment" desc={`Balance ${usd(bal)}`} footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button onClick={submitPay}>Record payment</Button></>}>
        <div className="space-y-3"><Field label="Amount"><Input type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} placeholder={String(bal)} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Method"><NativeSelect value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}><option>Wire</option><option>ACH</option><option>Card</option><option>Check</option></NativeSelect></Field><Field label="Reference"><Input value={pay.ref} onChange={(e) => setPay({ ...pay, ref: e.target.value })} /></Field></div>{err && <p role="alert" className="text-sm text-destructive">{err}</p>}</div>
      </Modal>
      <Modal open={modal === "adjust"} onOpenChange={(o) => { setModal(o ? "adjust" : null); setErr("") }} title="Request adjustment" desc="Write-offs and credits always wait for an owner." footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button onClick={submitAdj}>Submit for approval</Button></>}>
        <div className="space-y-3"><Field label="Type"><NativeSelect value={adj.type} onChange={(e) => setAdj({ ...adj, type: e.target.value })}><option value="write-off">Write-off</option><option value="credit">Credit</option></NativeSelect></Field><Field label="Amount"><Input type="number" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} placeholder={String(bal)} /></Field><Field label="Reason"><TextArea value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} /></Field>{err && <p role="alert" className="text-sm text-destructive">{err}</p>}</div>
      </Modal>
      <Modal open={modal === "dispute"} onOpenChange={(o) => setModal(o ? "dispute" : null)} title="Open dispute" footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button onClick={() => { if (!dsp.reason.trim()) return setErr("Describe what the customer disputes."); A.addDispute({ cust: i.cust, inv: i.id, amt: bal, cat: dsp.cat, reason: dsp.reason, due: "2026-11-27" }); setModal(null); setErr("") }}>Open dispute</Button></>}>
        <div className="space-y-3"><Field label="Category"><NativeSelect value={dsp.cat} onChange={(e) => setDsp({ ...dsp, cat: e.target.value })}>{["Scope", "Amount", "Payment claimed", "Duplicate payment", "Quality"].map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field><Field label="What does the customer say?"><TextArea value={dsp.reason} onChange={(e) => setDsp({ ...dsp, reason: e.target.value })} /></Field>{err && <p role="alert" className="text-sm text-destructive">{err}</p>}</div>
      </Modal>
      <Modal open={modal === "cancel"} onOpenChange={(o) => setModal(o ? "cancel" : null)} title={`Cancel ${i.id}?`} desc="The invoice becomes read-only and its balance drops to zero. This is recorded in the audit log." footer={<><Button variant="outline" onClick={() => setModal(null)}>Keep invoice</Button><Button variant="destructive" onClick={() => { A.cancelInvoice(i.id); setModal(null) }}>Cancel invoice</Button></>} />
    </>
  )
}

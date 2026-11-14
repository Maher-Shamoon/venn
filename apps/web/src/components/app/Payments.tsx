import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Check, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { A, balOf, payAllocated, useApp, usd, fmtD, type Pay, type State, type Tone } from "./store"
import { Box, DataTable, Empty, Field, Mono, NativeSelect, Pill, Row, Seg, Title } from "./ui"
import { NotFound } from "./System"

export const payState = (s: State, p: Pay): [string, Tone] => {
  if (p.status === "duplicate") return ["duplicate", "red"]
  if (p.status === "reversed") return ["reversed", "grey"]
  if (p.status === "under review") return ["under review", "blue"]
  const a = payAllocated(s, p.id)
  return a >= p.amount ? ["allocated", "green"] : a > 0 ? ["partly allocated", "amber"] : s.suggs.some((g) => g.pay === p.id && g.status === "pending") ? ["suggested", "blue"] : ["unallocated", "amber"]
}

export function Payments() {
  const s = useApp(), nav = useNavigate()
  const [f, setF] = useState<"all" | "unallocated" | "allocated" | "review" | "duplicate">("all")
  const rows = s.payments.filter((p) => { const [l] = payState(s, p); return f === "all" ? true : f === "unallocated" ? ["unallocated", "suggested", "partly allocated"].includes(l) : f === "allocated" ? l === "allocated" : f === "review" ? l === "under review" : l === "duplicate" })
  return (
    <>
      <Title sub={`${s.payments.length} payments`} right={<Button render={<Link to="/app/payments/import" />}><Upload className="size-4" />Import payments</Button>}>Payments</Title>
      <Seg items={[{ v: "all", label: "All" }, { v: "unallocated", label: "Unallocated" }, { v: "allocated", label: "Allocated" }, { v: "review", label: "Under review" }, { v: "duplicate", label: "Duplicates" }] as const} value={f} onChange={setF} />
      <Box>
        <DataTable rows={rows} id={(p) => p.id} onRow={(p) => nav("/app/payments/" + p.id)} search={(p) => p.id + p.payer + p.ref} defaultSort={["date", -1]}
          cols={[
            { key: "id", label: "Payment", sort: (p) => p.id, render: (p) => <Mono>{p.id}</Mono> },
            { key: "date", label: "Date", sort: (p) => p.date, render: (p) => fmtD(p.date) },
            { key: "payer", label: "Payer as received", sort: (p) => p.payer, render: (p) => p.payer },
            { key: "ref", label: "Reference", hide: "lg", render: (p) => <Mono>{p.ref}</Mono> },
            { key: "amt", label: "Amount", right: true, sort: (p) => p.amount, render: (p) => usd(p.amount) },
            { key: "un", label: "Unallocated", right: true, hide: "md", render: (p) => usd(p.amount - payAllocated(s, p.id)) },
            { key: "st", label: "Status", render: (p) => { const [l, t] = payState(s, p); return <Pill tone={t}>{l}</Pill> } },
          ]} />
      </Box>
    </>
  )
}

export function PaymentDetail() {
  const { id } = useParams(), s = useApp()
  const p = s.payments.find((x) => x.id === id)
  const [inv, setInv] = useState(""), [amt, setAmt] = useState(""), [err, setErr] = useState("")
  if (!p) return <NotFound what="payment" back="/app/payments" />
  const alloc = payAllocated(s, p.id), left = Math.round((p.amount - alloc) * 100) / 100, [label, tone] = payState(s, p)
  const sg = s.suggs.filter((g) => g.pay === p.id && g.status === "pending")
  const allocs = s.allocs.filter((a) => a.pay === p.id)
  const candidates = s.invoices.filter((i) => balOf(s, i) > 0)
  const invg = s.invgs.find((g) => g.pay === p.id)
  const add = () => { const n = +amt, i = s.invoices.find((x) => x.id === inv); if (!i) return setErr("Choose an invoice."); if (!(n > 0)) return setErr("Enter an amount above zero."); if (n > left + 0.001) return setErr(`Only ${usd(left)} of this payment is unallocated.`); if (n > balOf(s, i) + 0.001) return setErr(`${i.id} has a balance of ${usd(balOf(s, i))}.`); A.allocate(p.id, i.id, n); setAmt(""); setInv(""); setErr("") }
  return (
    <>
      <Title back={["/app/payments", "Payments"]} sub={`${p.payer} · ${p.method} · ${fmtD(p.date)}`} right={<>
        {p.status !== "under review" && <Button variant="outline" onClick={() => A.setPayStatus(p.id, "under review")}>Mark under review</Button>}
        {p.status === "under review" && <Button variant="outline" onClick={() => A.setPayStatus(p.id, "open")}>Clear review</Button>}
        <Button variant="outline" onClick={() => A.setPayStatus(p.id, "reversed")} disabled={p.status === "reversed"}>Mark reversed</Button>
        {invg && <Button variant="outline" render={<Link to={"/app/investigations/" + invg.id} />}>Open investigation</Button>}</>}>
        <span className="font-mono">{p.id}</span> <Pill tone={tone}>{label}</Pill></Title>
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          <Box title="Facts" pad><Row k="Amount">{usd(p.amount)}</Row><Row k="Allocated">{usd(alloc)}</Row><Row k="Unallocated">{usd(left)}</Row><Row k="Reference"><Mono>{p.ref}</Mono></Row><Row k="Source">{p.source}</Row><Row k="Customer">{p.cust ?? "Not identified"}</Row></Box>
          {sg.map((g) => (
            <Box key={g.id} title="Suggested match" right={<Pill tone={g.conf === "high" ? "green" : g.conf === "medium" ? "amber" : "blue"}>{g.conf}</Pill>} pad>
              <p className="text-sm">{g.reason}</p><p className="mt-1 font-mono text-xs text-hushed">{g.rule}</p>
              <div className="mt-3 flex flex-wrap gap-2">{g.invs.map(([i, a]) => <span key={i} className="rounded-full bg-muted px-3 py-1 text-sm">{i} · {usd(a)}</span>)}</div>
              <div className="mt-4 flex gap-2"><Button onClick={() => A.confirmSugg(g.id)}><Check className="size-4" />Confirm</Button><Button variant="outline" onClick={() => A.rejectSugg(g.id)}>Reject</Button></div>
            </Box>))}
          <Box title="Allocations"><DataTable rows={allocs} id={(a) => a.id} empty={<Empty title="Not allocated yet" sub="Confirm a suggestion or allocate manually below." />} cols={[{ key: "i", label: "Invoice", render: (a) => <Link to={"/app/invoices/" + a.inv} className="font-mono text-xs hover:underline">{a.inv}</Link> }, { key: "a", label: "Amount", right: true, render: (a) => (a.void ? <span className="line-through text-hushed">{usd(a.amount)}</span> : usd(a.amount)) }, { key: "by", label: "By", hide: "md", render: (a) => a.by }, { key: "w", label: "When", hide: "md", render: (a) => fmtD(a.at) }, { key: "v", label: "", right: true, render: (a) => (a.void ? <Pill tone="grey">voided</Pill> : <Button variant="ghost" size="sm" onClick={() => A.undoAlloc(a.id)}>Void</Button>) }]} /></Box>
          {left > 0 && p.status === "open" && (
            <Box title="Allocate manually" pad>
              <div className="grid items-end gap-3 sm:grid-cols-[1fr_140px_auto]">
                <Field label="Invoice"><NativeSelect value={inv} onChange={(e) => { setInv(e.target.value); const i = s.invoices.find((x) => x.id === e.target.value); if (i) setAmt(String(Math.min(left, balOf(s, i)))) }}><option value="">Select an open invoice…</option>{candidates.map((i) => <option key={i.id} value={i.id}>{i.id} · {i.cust} · {usd(balOf(s, i))}</option>)}</NativeSelect></Field>
                <Field label="Amount"><Input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} /></Field>
                <Button onClick={add}>Allocate</Button>
              </div>
              {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
            </Box>)}
        </div>
        <aside className="space-y-3"><Box title="History" pad>{s.audit.filter((a) => a.rec === p.id).length ? s.audit.filter((a) => a.rec === p.id).map((a) => <div key={a.id} className="border-b border-border py-2 text-sm last:border-0"><div>{a.action}</div><div className="text-xs text-hushed">{a.actor} · {a.at}</div></div>) : <p className="text-sm text-hushed">Imported on {fmtD(p.date)} from {p.source}.</p>}</Box></aside>
      </div>
    </>
  )
}

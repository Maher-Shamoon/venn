import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { A, balOf, invTotal, lateOf, statusOf, useApp, usd, fmtD, type Customer, type State } from "./store"
import { Box, DataTable, Drawer, Empty, Field, Kpi, Mono, Pill, Row, Seg, TextArea, Title } from "./ui"
import { NotFound } from "./System"

const AVG_DAYS: Record<string, number> = { "Northwind Labs": 38, "Meridian Retail Group": 31, "Cobalt Energy Partners": 44, "Alder Health Systems": 36, "Harbor & Pine Legal": 33, "Fernhill Logistics": 41, "Quillon Media": 52, "Tessera Robotics": 27 }
export const custStats = (s: State, c: Customer) => {
  const inv = s.invoices.filter((i) => i.cust === c.name)
  const issues = s.dsps.filter((d) => d.cust === c.name && d.status !== "resolved").length + s.invgs.filter((g) => g.cust === c.name && !["resolved", "dismissed"].includes(g.status)).length
  const pays = s.payments.filter((p) => p.cust === c.name).sort((a, b) => (a.date < b.date ? 1 : -1))
  return { inv, open: inv.reduce((t, i) => t + balOf(s, i), 0), overdue: inv.filter((i) => lateOf(i) > 0).reduce((t, i) => t + balOf(s, i), 0), openN: inv.filter((i) => balOf(s, i) > 0).length, issues, last: pays[0], avg: AVG_DAYS[c.name] ?? 30 }
}

function CustomerForm({ c, onDone }: { c?: Customer; onDone: () => void }) {
  const [f, setF] = useState({ name: c?.name ?? "", contact: c?.contact ?? "", email: c?.email ?? "", terms: c?.terms ?? 30, city: c?.city ?? "", aliases: (c?.aliases ?? []).join(", "), notes: c?.notes ?? "" })
  const [err, setErr] = useState("")
  const set = (k: string, v: string | number) => setF((x) => ({ ...x, [k]: v }))
  const save = () => {
    if (!f.name.trim()) return setErr("Customer name is required.")
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return setErr("Enter a valid email address.")
    const body = { name: f.name.trim(), contact: f.contact, email: f.email, terms: Number(f.terms) || 30, city: f.city, aliases: f.aliases.split(",").map((x) => x.trim()).filter(Boolean), notes: f.notes }
    if (c) A.updateCustomer(c.id, body); else A.addCustomer(body)
    onDone()
  }
  return (
    <div className="mt-4 space-y-3">
      <Field label="Customer name *"><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Contact"><Input value={f.contact} onChange={(e) => set("contact", e.target.value)} /></Field><Field label="Email"><Input value={f.email} onChange={(e) => set("email", e.target.value)} /></Field></div>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Payment terms (days)"><Input type="number" value={f.terms} onChange={(e) => set("terms", e.target.value)} /></Field><Field label="City"><Input value={f.city} onChange={(e) => set("city", e.target.value)} /></Field></div>
      <Field label="Payer aliases" hint="Names this customer's payments may arrive under, separated by commas."><Input value={f.aliases} onChange={(e) => set("aliases", e.target.value)} /></Field>
      <Field label="Notes"><TextArea value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Button onClick={save} className="w-full">{c ? "Save changes" : "Add customer"}</Button>
    </div>
  )
}

export function Customers() {
  const s = useApp(), nav = useNavigate()
  const [f, setF] = useState<"all" | "overdue" | "issues">("all")
  const [open, setOpen] = useState(false)
  const rows = s.customers.map((c) => ({ c, ...custStats(s, c) })).filter((r) => (f === "overdue" ? r.overdue > 0 : f === "issues" ? r.issues > 0 : true))
  return (
    <>
      <Title sub={`${s.customers.length} customers`} right={<Button onClick={() => setOpen(true)}><Plus className="size-4" />New customer</Button>}>Customers</Title>
      <Seg items={[{ v: "all", label: "All" }, { v: "overdue", label: "Has overdue" }, { v: "issues", label: "Has open issues" }] as const} value={f} onChange={setF} />
      <Box>
        <DataTable rows={rows} id={(r) => r.c.id} onRow={(r) => nav("/app/customers/" + r.c.id)} search={(r) => r.c.name + r.c.contact} defaultSort={["open", -1]}
          cols={[
            { key: "name", label: "Customer", sort: (r) => r.c.name, render: (r) => <div><div>{r.c.name}</div><div className="text-xs text-hushed">{r.c.city}</div></div> },
            { key: "open", label: "Open balance", right: true, sort: (r) => r.open, render: (r) => usd(r.open, 0) },
            { key: "over", label: "Overdue", right: true, sort: (r) => r.overdue, render: (r) => (r.overdue ? <span className="text-[#a24a10]">{usd(r.overdue, 0)}</span> : "—") },
            { key: "n", label: "Open invoices", right: true, hide: "md", sort: (r) => r.openN, render: (r) => r.openN },
            { key: "avg", label: "Avg days to pay", right: true, hide: "lg", sort: (r) => r.avg, render: (r) => r.avg },
            { key: "last", label: "Last payment", hide: "lg", render: (r) => (r.last ? fmtD(r.last.date) : "—") },
            { key: "iss", label: "Issues", right: true, sort: (r) => r.issues, render: (r) => (r.issues ? <Pill tone="amber">{r.issues}</Pill> : "—") },
          ]} />
      </Box>
      <Drawer open={open} onOpenChange={setOpen} title="New customer"><CustomerForm onDone={() => setOpen(false)} /></Drawer>
    </>
  )
}

export function CustomerDetail() {
  const { id } = useParams(), s = useApp(), nav = useNavigate()
  const c = s.customers.find((x) => x.id === id)
  const [tab, setTab] = useState<"overview" | "invoices" | "payments" | "disputes" | "investigations" | "communication" | "documents" | "activity">("overview")
  const [edit, setEdit] = useState(false)
  if (!c) return <NotFound what="customer" back="/app/customers" />
  const st = custStats(s, c)
  const pays = s.payments.filter((p) => p.cust === c.name || c.aliases.includes(p.payer))
  const dsps = s.dsps.filter((d) => d.cust === c.name), invgs = s.invgs.filter((g) => g.cust === c.name)
  const col = s.cols.filter((x) => x.cust === c.name)
  const docs = s.docs.filter((d) => st.inv.some((i) => i.id === d.link) || d.link === c.name || invgs.some((g) => g.id === d.link))
  const act = s.audit.filter((a) => st.inv.some((i) => i.id === a.rec) || a.rec === c.name || pays.some((p) => p.id === a.rec))
  return (
    <>
      <Title back={["/app/customers", "Customers"]} sub={`${c.contact} · ${c.email} · terms ${c.terms} days`} right={<Button variant="outline" onClick={() => setEdit(true)}>Edit</Button>}>{c.name}</Title>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi dark label="Open balance" value={usd(st.open, 0)} note={`${st.openN} open invoices`} />
        <Kpi label="Overdue" value={usd(st.overdue, 0)} note="Past due date" />
        <Kpi label="Avg days to pay" value={String(st.avg)} note={`Terms are ${c.terms} days`} />
        <Kpi label="Open issues" value={String(st.issues)} note="Disputes and investigations" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <Seg items={["overview", "invoices", "payments", "disputes", "investigations", "communication", "documents", "activity"] as const} value={tab} onChange={setTab} />
          {tab === "overview" && <Box title="Open invoices"><DataTable rows={st.inv.filter((i) => balOf(s, i) > 0)} id={(i) => i.id} onRow={(i) => nav("/app/invoices/" + i.id)} cols={[{ key: "id", label: "Invoice", render: (i) => <Mono>{i.id}</Mono> }, { key: "due", label: "Due", render: (i) => fmtD(i.due) }, { key: "b", label: "Balance", right: true, render: (i) => usd(balOf(s, i)) }, { key: "s", label: "Status", render: (i) => { const [l, t] = statusOf(s, i); return <Pill tone={t}>{l}</Pill> } }]} /></Box>}
          {tab === "invoices" && <Box><DataTable rows={st.inv} id={(i) => i.id} onRow={(i) => nav("/app/invoices/" + i.id)} cols={[{ key: "id", label: "Invoice", render: (i) => <Mono>{i.id}</Mono> }, { key: "iss", label: "Issued", hide: "md", render: (i) => fmtD(i.issued) }, { key: "due", label: "Due", render: (i) => fmtD(i.due) }, { key: "t", label: "Total", right: true, render: (i) => usd(invTotal(i)) }, { key: "b", label: "Balance", right: true, render: (i) => usd(balOf(s, i)) }, { key: "s", label: "Status", render: (i) => { const [l, t] = statusOf(s, i); return <Pill tone={t}>{l}</Pill> } }]} /></Box>}
          {tab === "payments" && <Box><DataTable rows={pays} id={(p) => p.id} onRow={(p) => nav("/app/payments/" + p.id)} empty={<Empty title="No payments yet" />} cols={[{ key: "id", label: "Payment", render: (p) => <Mono>{p.id}</Mono> }, { key: "d", label: "Date", render: (p) => fmtD(p.date) }, { key: "p", label: "Payer", hide: "md", render: (p) => p.payer }, { key: "a", label: "Amount", right: true, render: (p) => usd(p.amount) }]} /></Box>}
          {tab === "disputes" && <Box>{dsps.length ? dsps.map((d) => <Link key={d.id} to={"/app/disputes/" + d.id} className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-0 hover:bg-muted/60"><div className="min-w-0 flex-1"><div className="text-sm">{d.reason}</div><Mono>{d.id} · {d.inv}</Mono></div><Pill tone={d.status === "resolved" ? "green" : "amber"}>{d.status}</Pill></Link>) : <Empty title="No disputes" />}</Box>}
          {tab === "investigations" && <Box>{invgs.length ? invgs.map((g) => <Link key={g.id} to={"/app/investigations/" + g.id} className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-0 hover:bg-muted/60"><div className="min-w-0 flex-1"><div className="text-sm">{g.title}</div><Mono>{g.id}</Mono></div><span className="text-sm tabular-nums">{usd(g.exposure, 0)}</span></Link>) : <Empty title="No investigations" />}</Box>}
          {tab === "communication" && <Box>{col.length ? col.flatMap((x) => x.timeline.map((t, k) => <div key={x.id + k} className="border-b border-border px-5 py-3 text-sm last:border-0"><div>{t.text}</div><div className="text-xs text-hushed">{t.by} · {t.at}</div></div>)) : <Empty title="No communication logged" />}</Box>}
          {tab === "documents" && <Box>{docs.length ? docs.map((d) => <div key={d.id} className="flex items-center gap-3 border-b border-border px-5 py-3 text-sm last:border-0"><span className="flex-1">{d.name}</span><span className="text-xs text-hushed">{d.type}</span></div>) : <Empty title="No documents" />}</Box>}
          {tab === "activity" && <Box>{act.length ? act.map((a) => <div key={a.id} className="border-b border-border px-5 py-3 text-sm last:border-0"><div>{a.action}</div><div className="text-xs text-hushed">{a.actor} · {a.at}</div></div>) : <Empty title="No activity yet" />}</Box>}
        </div>
        <aside className="space-y-3">
          <Box title="Contact" pad><Row k="Name">{c.contact || "—"}</Row><Row k="Email">{c.email || "—"}</Row><Row k="City">{c.city || "—"}</Row><Row k="Terms">{c.terms} days</Row></Box>
          <Box title="Payer aliases" pad>{c.aliases.length ? <div className="flex flex-wrap gap-1.5">{c.aliases.map((a) => <span key={a} className="rounded-full bg-muted px-2.5 py-1 text-xs">{a}</span>)}</div> : <p className="text-sm text-hushed">None saved.</p>}</Box>
          <Box title="Notes" pad><p className="text-sm text-hushed">{c.notes || "No notes."}</p></Box>
        </aside>
      </div>
      <Drawer open={edit} onOpenChange={setEdit} title="Edit customer"><CustomerForm c={c} onDone={() => setEdit(false)} /></Drawer>
    </>
  )
}

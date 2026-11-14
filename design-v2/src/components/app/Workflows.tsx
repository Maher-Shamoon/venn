import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Check, Clock, Plus, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { A, balOf, lateOf, useApp, usd, fmtD, custOf, type Apr, type Col, type Tone } from "./store"
import { Box, DataTable, Drawer, Empty, Field, Mono, NativeSelect, Pill, Row, Seg, TextArea, Title } from "./ui"
import { NotFound } from "./System"
import { useRole } from "./Shell"
import { cn } from "@/lib/utils"

/* ---------------------------------------------------------------- collections */
const TEMPLATES = ["Friendly reminder", "Firm reminder", "Final notice", "Wire confirmation request", "Promise follow-up"] as const
const STAGE_TONE: Record<Col["stage"], Tone> = { "reminder 1": "grey", "reminder 2": "amber", "final notice": "red", "promise to pay": "blue", paused: "grey" }

export function Collections() {
  const s = useApp(), nav = useNavigate()
  const [f, setF] = useState<"all" | "due today" | Col["stage"]>("all")
  const rows = s.cols.map((c) => { const invs = c.invs.map((i) => s.invoices.find((x) => x.id === i)!).filter(Boolean); const total = invs.reduce((t, i) => t + balOf(s, i), 0); const oldest = Math.max(0, ...invs.map(lateOf)); return { c, total, oldest, n: invs.length, score: total * (1 + oldest / 30) } }).filter((r) => (f === "all" ? true : f === "due today" ? r.c.next <= "2026-11-13" : r.c.stage === f))
  return (
    <>
      <Title sub="Reminders drafted from your records. Every amount is checked before sending.">Collections</Title>
      <Seg items={[{ v: "all", label: "All" }, { v: "due today", label: "Due today" }, "reminder 1", "reminder 2", "final notice", "promise to pay"] as const} value={f} onChange={setF} />
      <Box><DataTable rows={rows} id={(r) => r.c.id} onRow={(r) => nav("/app/collections/" + r.c.id)} search={(r) => r.c.cust} defaultSort={["score", -1]}
        cols={[
          { key: "c", label: "Customer", sort: (r) => r.c.cust, render: (r) => <div><div>{r.c.cust}</div><Mono>{r.c.id}</Mono></div> },
          { key: "n", label: "Invoices", right: true, hide: "md", render: (r) => r.n },
          { key: "score", label: "Overdue", right: true, sort: (r) => r.score, render: (r) => <span title="Priority = balance weighted by days overdue">{usd(r.total, 0)}</span> },
          { key: "old", label: "Oldest", right: true, hide: "md", sort: (r) => r.oldest, render: (r) => `${r.oldest} days` },
          { key: "st", label: "Stage", render: (r) => <Pill tone={STAGE_TONE[r.c.stage]}>{r.c.stage}</Pill> },
          { key: "nx", label: "Next action", hide: "lg", render: (r) => fmtD(r.c.next) },
          { key: "last", label: "Last contact", hide: "lg", render: (r) => (r.c.last === "—" ? "—" : fmtD(r.c.last)) },
        ]} /></Box>
    </>
  )
}

function draftFor(tpl: string, tone: string, name: string, invs: { id: string; bal: number; due: string; late: number }[], cust: string) {
  const list = invs.map((i) => `${i.id} for ${usd(i.bal)} (due ${fmtD(i.due)}, ${i.late} days overdue)`).join(", ")
  const total = invs.reduce((t, i) => t + i.bal, 0)
  const hi = tone === "friendly" ? `Hi ${name},` : `Dear ${name},`
  const body: Record<string, string> = {
    "Friendly reminder": `A quick note that ${list} is still open, a total of ${usd(total)}. If it has been paid, a remittance reference would help us match it. Thank you.`,
    "Firm reminder": `Our records show ${list} remains unpaid. Please arrange payment of ${usd(total)} this week or reply with the expected date.`,
    "Final notice": `This is a final notice for ${list}. Please pay ${usd(total)} by 20 Nov. Otherwise the balance will be reviewed for closure.`,
    "Wire confirmation request": `You mentioned a payment for ${list}. We cannot find it on our statement. Could you share the wire confirmation or reference?`,
    "Promise follow-up": `Following your promise to pay, ${list} is still open. Could you confirm the payment date for ${usd(total)}?`,
  }
  return `${hi}\n\n${body[tpl]}\n\nKind regards,\nBrightpath Digital\n(${cust})`.replace(`\n(${cust})`, "")
}
const MONEY = /\$[\d,]+(?:\.\d{2})?/g

export function CollectionDetail() {
  const { id } = useParams(), s = useApp(), role = useRole()
  const c = s.cols.find((x) => x.id === id)
  const [tpl, setTpl] = useState<(typeof TEMPLATES)[number]>("Friendly reminder"), [tone, setTone] = useState("friendly")
  const [body, setBody] = useState("")
  if (!c) return <NotFound what="case" back="/app/collections" />
  const invs = c.invs.map((i) => s.invoices.find((x) => x.id === i)!).filter(Boolean)
  const info = invs.map((i) => ({ id: i.id, bal: balOf(s, i), due: i.due, late: lateOf(i) }))
  const cu = custOf(s, c.cust), name = cu?.contact.split(" ")[0] || "there"
  const gmail = s.integs.find((i) => i.id === "gmail")?.status === "connected"
  const allowed = new Set<string>([usd(info.reduce((t, i) => t + i.bal, 0)), ...info.map((i) => usd(i.bal))])
  const found = body.match(MONEY) ?? []
  const bad = found.filter((m) => ![...allowed].some((a) => a === (m.includes(".") ? m : m + ".00") || a.replace(".00", "") === m))
  const finalNotice = tpl === "Final notice"
  const subject = `${tpl}: ${invs.map((i) => i.id).join(", ")}`
  const send = () => { if (!body.trim()) return toast.error("Write or generate a message first."); if (bad.length) return toast.error(`Fix mismatched amounts: ${bad.join(", ")}`); A.sendCollection(c.id, subject); setBody("") }
  return (
    <>
      <Title back={["/app/collections", "Collections"]} sub={`${c.cust} · owner ${c.owner}`} right={<Seg className="!mb-0" items={["reminder 1", "reminder 2", "final notice", "promise to pay", "paused"] as const} value={c.stage} onChange={(v) => A.setStage(c.id, v)} />}>{c.id}</Title>
      {!gmail && <div className="mb-4 rounded-xl border border-[#e0b13a] bg-[#fff8e1] p-4 text-sm">Your mailbox is not connected. <Link to="/app/integrations" className="underline">Connect Gmail</Link> to send from here.</div>}
      <div className="grid gap-4 lg:grid-cols-[260px_1fr_360px]">
        <Box title="Invoices in case" pad>
          {info.map((i) => <Link key={i.id} to={"/app/invoices/" + i.id} className="block border-b border-border py-2.5 text-sm last:border-0 hover:bg-muted/40"><Mono>{i.id}</Mono><div className="tabular-nums">{usd(i.bal)}</div><div className="text-xs text-hushed">{i.late} days overdue</div></Link>)}
          {c.promise && <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#e4ebf6] p-3 text-sm text-[#3a5fa8]"><Clock className="size-4" />Promised by {fmtD(c.promise)}</div>}
        </Box>
        <Box title="Timeline"><ol className="p-5">{[...c.timeline].reverse().map((t, i) => <li key={i} className="relative border-l border-border pb-4 pl-5 last:pb-0"><span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-lime-light" /><div className="text-sm">{t.text}</div><div className="text-xs text-hushed">{t.by} · {t.at}</div></li>)}</ol></Box>
        <Box title="Compose" pad>
          <div className="space-y-3">
            <Field label="Template"><NativeSelect value={tpl} onChange={(e) => setTpl(e.target.value as typeof tpl)}>{TEMPLATES.map((t) => <option key={t}>{t}</option>)}</NativeSelect></Field>
            <Field label="Tone"><NativeSelect value={tone} onChange={(e) => setTone(e.target.value)}><option value="friendly">Friendly</option><option value="firm">Firm</option></NativeSelect></Field>
            <Button variant="outline" className="w-full" onClick={() => setBody(draftFor(tpl, tone, name, info, c.cust))}>Draft from records</Button>
            <TextArea aria-label="Message" className="min-h-[170px]" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Generate a draft or write your own." />
            {body && <div className={cn("rounded-lg p-3 text-sm", bad.length ? "bg-[#fbe9dd] text-[#a24a10]" : "bg-[#e3f6e6] text-[#17692b]")}>{bad.length ? `These amounts do not match your records: ${bad.join(", ")}` : <span className="flex items-center gap-1.5"><Check className="size-4" />Amounts and dates in this draft match records</span>}</div>}
            <div className="flex flex-wrap gap-2">
              {finalNotice && role === "ar" ? <Button disabled={!body || !!bad.length} onClick={() => { A.requestApproval("final notice", info[0]?.id ?? c.id, c.cust, info.reduce((t, i) => t + i.bal, 0), "Final notice to " + c.cust, info[0]?.id); setBody("") }}><ShieldCheck className="size-4" />Submit for approval</Button> : <Button disabled={!gmail} onClick={send}>Send</Button>}
              <Button variant="outline" disabled={!body} onClick={() => { toast.success("Scheduled for tomorrow 09:00"); setBody("") }}>Schedule</Button>
            </div>
          </div>
        </Box>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------- disputes */
const DTONE: Record<string, Tone> = { open: "amber", "awaiting customer": "blue", resolved: "green" }
export function Disputes() {
  const s = useApp(), nav = useNavigate()
  const [f, setF] = useState<"all" | "open" | "awaiting customer" | "resolved">("all")
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ inv: "", cat: "Scope", reason: "" }), [err, setErr] = useState("")
  const rows = s.dsps.filter((d) => f === "all" || d.status === f)
  const create = () => { const i = s.invoices.find((x) => x.id === form.inv); if (!i) return setErr("Choose an invoice."); if (!form.reason.trim()) return setErr("Describe what the customer disputes."); A.addDispute({ cust: i.cust, inv: i.id, amt: balOf(s, i), cat: form.cat, reason: form.reason, due: "2026-11-27" }); setOpen(false); setForm({ inv: "", cat: "Scope", reason: "" }); setErr("") }
  return (
    <>
      <Title sub={`${s.dsps.filter((d) => d.status !== "resolved").length} open`} right={<Button onClick={() => setOpen(true)}><Plus className="size-4" />New dispute</Button>}>Disputes</Title>
      <Seg items={["all", "open", "awaiting customer", "resolved"] as const} value={f} onChange={setF} />
      <Box><DataTable rows={rows} id={(d) => d.id} onRow={(d) => nav("/app/disputes/" + d.id)} search={(d) => d.id + d.cust + d.reason}
        cols={[{ key: "id", label: "ID", render: (d) => <Mono>{d.id}</Mono> }, { key: "c", label: "Customer", sort: (d) => d.cust, render: (d) => <div><div>{d.cust}</div><div className="text-xs text-hushed">{d.cat} · {d.inv}</div></div> }, { key: "a", label: "Disputed", right: true, sort: (d) => d.amt, render: (d) => usd(d.amt, 0) }, { key: "st", label: "Status", render: (d) => <Pill tone={DTONE[d.status]}>{d.status}</Pill> }, { key: "due", label: "Due", hide: "md", render: (d) => fmtD(d.due) }]} /></Box>
      <Drawer open={open} onOpenChange={setOpen} title="New dispute" desc="Opens a case linked to the invoice.">
        <div className="mt-4 space-y-3"><Field label="Invoice"><NativeSelect value={form.inv} onChange={(e) => setForm({ ...form, inv: e.target.value })}><option value="">Select…</option>{s.invoices.filter((i) => balOf(s, i) > 0).map((i) => <option key={i.id} value={i.id}>{i.id} · {i.cust}</option>)}</NativeSelect></Field><Field label="Category"><NativeSelect value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>{["Scope", "Amount", "Payment claimed", "Duplicate payment", "Quality"].map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field><Field label="What does the customer say?"><TextArea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>{err && <p role="alert" className="text-sm text-destructive">{err}</p>}<Button className="w-full" onClick={create}>Open dispute</Button></div>
      </Drawer>
    </>
  )
}

export function DisputeDetail() {
  const { id } = useParams(), s = useApp()
  const d = s.dsps.find((x) => x.id === id)
  const [note, setNote] = useState(""), [outcome, setOutcome] = useState("Customer withdrew the dispute")
  if (!d) return <NotFound what="dispute" back="/app/disputes" />
  const docs = s.docs.filter((x) => x.link === d.inv || x.link === d.cust)
  const resolved = d.status === "resolved"
  const resolve = () => { if (outcome.startsWith("Credit")) { A.requestApproval("credit", d.inv, d.cust, Math.min(d.amt, 410), "Credit to settle dispute " + d.id, d.inv); A.resolveDispute(d.id, outcome + " (awaiting approval)") } else A.resolveDispute(d.id, outcome) }
  return (
    <>
      <Title back={["/app/disputes", "Disputes"]} sub={`${d.cust} · ${d.cat} · ${usd(d.amt)} disputed · due ${fmtD(d.due)}`}>{d.id} <Pill tone={DTONE[d.status]}>{d.status}</Pill></Title>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Box title="Customer's explanation" pad><blockquote className="border-l-[3px] border-lime-light pl-4 text-lg">{d.reason}</blockquote><p className="mt-2 text-xs text-hushed">Quoted from the dispute record. Not confirmed by any payment record.</p></Box>
          <Box title="Timeline and notes"><ol className="p-5">{d.notes.map((t, i) => <li key={i} className="relative border-l border-border pb-4 pl-5 last:pb-0"><span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-lime-light" /><div className="text-sm">{t.text}</div><div className="text-xs text-hushed">{t.by} · {t.at}</div></li>)}</ol>
            {!resolved && <div className="flex gap-2 border-t border-border p-4"><input aria-label="Internal note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note" className="h-9 flex-1 rounded-lg border border-input px-3 text-sm outline-none focus:border-foreground" /><Button disabled={!note.trim()} onClick={() => { A.noteDispute(d.id, note); setNote("") }}>Add</Button></div>}</Box>
          {!resolved ? (
            <Box title="Resolution" pad><div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]"><Field label="Outcome"><NativeSelect value={outcome} onChange={(e) => setOutcome(e.target.value)}>{["Customer withdrew the dispute", "Invoice stands, customer agreed to pay", "Credit issued (needs approval)", "Refund recorded"].map((o) => <option key={o}>{o}</option>)}</NativeSelect></Field><Button onClick={resolve}>Resolve</Button></div>{outcome.startsWith("Credit") && <p className="mt-2 text-xs text-hushed">A credit always goes to an owner for approval.</p>}</Box>
          ) : <Box pad><p className="text-sm">Resolved: {d.outcome}. This dispute is read-only.</p></Box>}
        </div>
        <aside className="space-y-3"><Box title="Linked" pad><Row k="Invoice"><Link to={"/app/invoices/" + d.inv} className="underline-offset-2 hover:underline">{d.inv}</Link></Row><Row k="Customer">{d.cust}</Row><Row k="Owner">{d.owner}</Row></Box>
          <Box title="Evidence" pad>{docs.length ? docs.map((x) => <div key={x.id} className="border-b border-border py-2 text-sm last:border-0">{x.name}<div className="text-xs text-hushed">{x.type}</div></div>) : <p className="text-sm text-hushed">No documents linked.</p>}</Box></aside>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ approvals */
const ATONE: Record<Apr["status"], Tone> = { pending: "amber", "info requested": "blue", approved: "green", rejected: "red", withdrawn: "grey" }
export function Approvals() {
  const s = useApp(), role = useRole(), nav = useNavigate()
  const [tab, setTab] = useState<"pending" | "info requested" | "decided">("pending")
  const mine = role === "ar" ? s.aprs.filter((a) => a.by === "Priya R.") : s.aprs
  const rows = mine.filter((a) => (tab === "decided" ? ["approved", "rejected", "withdrawn"].includes(a.status) : a.status === tab))
  return (
    <>
      <Title sub={role === "owner" ? "Owners decide. Every decision is logged and cannot be edited." : "Requests you submitted. Owners decide."}>{role === "owner" ? "Approvals" : "My requests"}</Title>
      <Seg items={[{ v: "pending", label: "Pending", n: mine.filter((a) => a.status === "pending").length }, { v: "info requested", label: "Info requested", n: mine.filter((a) => a.status === "info requested").length }, { v: "decided", label: "Decided" }] as const} value={tab} onChange={setTab} />
      <Box><DataTable rows={rows} id={(a) => a.id} onRow={(a) => nav("/app/approvals/" + a.id)} empty={<Empty title="Nothing here" sub="Requests will appear as they are submitted." />}
        cols={[{ key: "id", label: "Request", render: (a) => <div><Mono>{a.id}</Mono><div className="text-xs capitalize text-hushed">{a.type}</div></div> }, { key: "c", label: "Customer", render: (a) => a.cust }, { key: "a", label: "Amount", right: true, sort: (a) => a.amount, render: (a) => usd(a.amount, 0) }, { key: "by", label: "Requested by", hide: "md", render: (a) => a.by }, { key: "age", label: "Age", hide: "lg", render: (a) => fmtD(a.created) }, { key: "s", label: "Status", render: (a) => <Pill tone={ATONE[a.status]}>{a.status}</Pill> }]} /></Box>
    </>
  )
}

export function ApprovalDetail() {
  const { id } = useParams(), s = useApp(), role = useRole()
  const a = s.aprs.find((x) => x.id === id)
  const [comment, setComment] = useState("")
  if (!a) return <NotFound what="request" back="/app/approvals" />
  const inv = s.invoices.find((i) => i.id === a.link), bal = inv ? balOf(s, inv) : null
  const stale = !!inv && ["write-off", "credit"].includes(a.type) && bal !== null && bal < a.amount && a.status === "pending"
  const open = a.status === "pending" || a.status === "info requested"
  const after = bal !== null && ["write-off", "credit"].includes(a.type) ? Math.max(0, bal - a.amount) : null
  const own = a.by === "Dana W."
  return (
    <>
      <Title back={["/app/approvals", role === "owner" ? "Approvals" : "My requests"]} sub={`Requested by ${a.by} on ${fmtD(a.created)}`}><span className="capitalize">{a.type}</span> · {usd(a.amount)} <Pill tone={ATONE[a.status]}>{a.status}</Pill></Title>
      {stale && <div className="mb-4 rounded-xl border border-[#e0b13a] bg-[#fff8e1] p-4 text-sm">The record changed since this request: the invoice balance is now {usd(bal ?? 0)}, less than the requested {usd(a.amount)}. Approving will only apply {usd(bal ?? 0)}.</div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Box title="Request" pad><Row k="ID"><Mono>{a.id}</Mono></Row><Row k="Customer">{a.cust}</Row><Row k="Record">{a.link ? <Link className="underline-offset-2 hover:underline" to={a.link.startsWith("INVG") ? "/app/investigations/" + a.link : "/app/invoices/" + a.link}>{a.link}</Link> : a.rec}</Row><Row k="Reason">{a.reason}</Row></Box>
          {after !== null && <Box title="Impact" pad><div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]"><div className="rounded-lg bg-muted p-4"><div className="text-xs text-hushed">Balance now</div><div className="text-2xl tabular-nums">{usd(bal ?? 0)}</div></div><span className="text-center text-hushed">→</span><div className="rounded-lg bg-lime/40 p-4"><div className="text-xs text-hushed">After approval</div><div className="text-2xl tabular-nums">{usd(after)}</div></div></div></Box>}
          {a.decided && <Box title="Decision" pad><Row k="By">{a.decidedBy}</Row><Row k="On">{fmtD(a.decided)}</Row><Row k="Comment">{a.comment || "No comment"}</Row><p className="mt-2 text-xs text-hushed">Decisions are immutable.</p></Box>}
          {role === "owner" && open && (
            <Box title="Decision" pad>
              <Field label="Comment"><TextArea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional for approval. Recommended when rejecting." /></Field>
              {own && <p className="mt-2 text-xs text-[#8a5a00]">You submitted this request yourself. Separation of duties may require a second owner.</p>}
              <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => A.decide(a.id, "approved", comment)}><Check className="size-4" />Approve</Button><Button variant="outline" onClick={() => A.decide(a.id, "rejected", comment)}>Reject</Button><Button variant="ghost" onClick={() => { if (!comment.trim()) return toast.error("Say what information you need."); A.decide(a.id, "info requested", comment) }}>Request more information</Button></div>
            </Box>)}
          {role === "ar" && open && a.by === "Priya R." && <Button variant="outline" onClick={() => A.withdraw(a.id)}>Withdraw request</Button>}
        </div>
        <aside><Box title="History" pad>{s.audit.filter((x) => x.rec === a.id).map((x) => <div key={x.id} className="border-b border-border py-2 text-sm last:border-0"><div>{x.action}</div><div className="text-xs text-hushed">{x.actor} · {x.at}</div></div>)}<div className="py-2 text-sm"><div>Submitted</div><div className="text-xs text-hushed">{a.by} · {fmtD(a.created)}</div></div></Box></aside>
      </div>
    </>
  )
}

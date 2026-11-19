import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { AlertTriangle, ArrowRight, Check, FileText, Mail, Play, ScrollText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { A, balOf, invTotal, lateOf, payAllocated, totals, useApp, usd, fmtD, type Finding, type Invg } from "./store"
import { Box, DataTable, Drawer, Empty, Field, Kpi, Modal, Mono, NativeSelect, Pill, Row, Seg, TextArea, Title, type Tone } from "./ui"
import { NotFound } from "./System"
import { useRole } from "./Shell"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------ reconciliation */
export function Reconciliation() {
  const s = useApp(), t = totals(s), nav = useNavigate()
  const [tab, setTab] = useState<"needs review" | "unmatched" | "auto-applied" | "discrepancies">("needs review")
  const [run, setRun] = useState(false)
  const pending = s.suggs.filter((g) => g.status === "pending")
  const [sel, setSel] = useState(pending[0]?.id ?? "")
  const [amts, setAmts] = useState<Record<string, number[]>>({})
  const g = pending.find((x) => x.id === sel) ?? pending[0]
  const pay = g && s.payments.find((p) => p.id === g.pay)
  const auto = s.allocs.filter((a) => a.by === "venn" && a.kind === "payment")
  const disc = s.invgs.filter((x) => !["resolved", "dismissed"].includes(x.status))
  const step = (d: 1 | -1) => { const i = pending.findIndex((x) => x.id === g?.id); const n = pending[(i + d + pending.length) % pending.length]; if (n) setSel(n.id) }
  const confirm = () => { if (!g) return; const i = pending.findIndex((x) => x.id === g.id); A.confirmSugg(g.id, amts[g.id]); const n = pending.filter((x) => x.id !== g.id)[Math.min(i, pending.length - 2)]; setSel(n?.id ?? "") }
  const reject = () => { if (!g) return; const i = pending.findIndex((x) => x.id === g.id); A.rejectSugg(g.id); const n = pending.filter((x) => x.id !== g.id)[Math.min(i, pending.length - 2)]; setSel(n?.id ?? "") }
  useEffect(() => {
    if (tab !== "needs review") return
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("input,textarea,select") || e.metaKey || e.ctrlKey) return
      const k = e.key.toLowerCase()
      if (k === "c") confirm(); else if (k === "r") reject(); else if (k === "j") step(1); else if (k === "k") step(-1)
    }
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on)
  })
  const doRun = () => { setRun(true); setTimeout(() => { setRun(false); A.runRecon() }, 1400) }
  return (
    <>
      <Title sub={<>Last run today, 09:30 · <Link to="/app/reconciliation/runs/RUN-0042" className="underline underline-offset-2">run details</Link></>} right={<Button onClick={doRun} disabled={run}><Play className="size-4" />{run ? "Running…" : "Run reconciliation"}</Button>}>Reconciliation</Title>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <Kpi dark label="Auto-applied" value={String(auto.filter((a) => !a.void).length)} note="Exact matches only" />
        <Kpi label="Needs review" value={String(pending.length)} note="A person decides" />
        <Kpi label="Unmatched" value={String(t.unmatched.length)} note="No candidate invoice" />
        <Kpi label="Discrepancies" value={String(disc.length)} note={usd(t.exposure, 0) + " exposure"} />
      </div>
      <div className="mt-6"><Seg items={[{ v: "needs review", label: "Needs review", n: pending.length }, { v: "unmatched", label: "Unmatched", n: t.unmatched.length }, { v: "auto-applied", label: "Auto-applied", n: auto.filter((a) => !a.void).length }, { v: "discrepancies", label: "Discrepancies", n: disc.length }] as const} value={tab} onChange={setTab} /></div>

      {tab === "needs review" && (pending.length ? (
        <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
          <Box><ul>{pending.map((x) => { const p = s.payments.find((y) => y.id === x.pay)!; return <li key={x.id}><button onClick={() => setSel(x.id)} className={cn("w-full border-b border-border px-4 py-3 text-left transition-colors last:border-0", g?.id === x.id ? "bg-lime/40" : "hover:bg-muted/60")}><div className="flex items-center justify-between"><Mono>{x.pay}</Mono><Pill tone={x.conf === "high" ? "green" : x.conf === "medium" ? "amber" : "blue"}>{x.conf}</Pill></div><div className="mt-1 text-sm">{p.payer}</div><div className="text-sm tabular-nums text-hushed">{usd(p.amount)}</div></button></li> })}</ul>
            <div className="border-t border-border px-4 py-2 text-xs text-hushed">Keys: <kbd className="rounded bg-muted px-1">C</kbd> confirm · <kbd className="rounded bg-muted px-1">R</kbd> reject · <kbd className="rounded bg-muted px-1">J</kbd>/<kbd className="rounded bg-muted px-1">K</kbd> next/previous</div></Box>
          {g && pay && (
            <Box title={`${g.pay}: ${g.invs.length ? "match" : "duplicate"} suggestion`} right={<Mono>{g.rule}</Mono>} pad>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-muted p-4"><div className="font-mono text-[0.75rem] text-hushed">PAYMENT</div><div className="mt-1 [container-type:inline-size]"><div className="whitespace-nowrap text-[min(1.5rem,13cqw)] tabular-nums">{usd(pay.amount)}</div></div><div className="text-sm text-hushed">{pay.payer} · {fmtD(pay.date)} · {pay.ref}</div></div>
                <div className="rounded-lg border border-border p-4"><div className="font-mono text-[0.75rem] text-hushed">{g.invs.length ? "SETTLES" : "SAME AS"}</div>{g.invs.length ? g.invs.map(([i], k) => { const inv = s.invoices.find((x) => x.id === i)!; return <div key={i} className="mt-2 flex items-center gap-2 text-sm"><Link to={"/app/invoices/" + i} className="font-mono text-xs hover:underline">{i}</Link><span className="flex-1 text-hushed">bal {usd(balOf(s, inv), 0)}</span><Input aria-label={`Amount for ${i}`} type="number" className="h-8 w-28 text-right" value={(amts[g.id] ?? g.invs.map((x) => x[1]))[k]} onChange={(e) => { const a = [...(amts[g.id] ?? g.invs.map((x) => x[1]))]; a[k] = +e.target.value; setAmts({ ...amts, [g.id]: a }) }} /></div> }) : <div className="mt-2 text-sm">PAY-0006 · {usd(9600)} · already settles INV-1043</div>}</div>
              </div>
              <div className="mt-4 rounded-lg bg-[#f4f2f0] p-4 text-sm"><div className="font-mono text-[0.75rem] text-hushed">WHY</div>{g.reason}</div>
              <div className="mt-5 flex flex-wrap gap-2"><Button onClick={confirm}><Check className="size-4" />{g.invs.length ? "Confirm match" : "Confirm duplicate"}</Button><Button variant="outline" onClick={reject}>Reject</Button><Button variant="ghost" onClick={() => step(1)}>Skip<ArrowRight className="size-4" /></Button></div>
            </Box>)}
        </div>
      ) : <Box><Empty title="Nothing to review" sub="Every suggestion has been decided. New payments will appear here after the next run." /></Box>)}

      {tab === "unmatched" && <Box><DataTable rows={t.unmatched} id={(p) => p.id} onRow={(p) => nav("/app/payments/" + p.id)} empty={<Empty title="No unmatched payments" />} cols={[{ key: "id", label: "Payment", render: (p) => <Mono>{p.id}</Mono> }, { key: "payer", label: "Payer", render: (p) => p.payer }, { key: "d", label: "Date", hide: "md", render: (p) => fmtD(p.date) }, { key: "a", label: "Unallocated", right: true, render: (p) => usd(p.amount - payAllocated(s, p.id)) }, { key: "go", label: "", right: true, render: () => <span className="text-sm text-hushed">Search and allocate →</span> }]} /></Box>}
      {tab === "auto-applied" && <Box><DataTable rows={auto} id={(a) => a.id} empty={<Empty title="Nothing auto-applied yet" />} cols={[{ key: "p", label: "Payment", render: (a) => <Mono>{a.pay}</Mono> }, { key: "i", label: "Invoice", render: (a) => <Mono>{a.inv}</Mono> }, { key: "a", label: "Amount", right: true, render: (a) => (a.void ? <span className="line-through text-hushed">{usd(a.amount)}</span> : usd(a.amount)) }, { key: "w", label: "When", hide: "md", render: (a) => fmtD(a.at) }, { key: "u", label: "", right: true, render: (a) => (a.void ? <Pill tone="grey">undone</Pill> : <Button variant="ghost" size="sm" onClick={() => A.undoAlloc(a.id)}>Undo</Button>) }]} /></Box>}
      {tab === "discrepancies" && <Box><DataTable rows={disc} id={(x) => x.id} onRow={(x) => nav("/app/investigations/" + x.id)} cols={[{ key: "t", label: "Type", render: (x) => x.type }, { key: "c", label: "Customer", render: (x) => x.cust }, { key: "i", label: "Invoice", hide: "md", render: (x) => (x.inv ? <Mono>{x.inv}</Mono> : "—") }, { key: "e", label: "Exposure", right: true, render: (x) => usd(x.exposure, 0) }, { key: "s", label: "Investigation", render: (x) => <Mono>{x.id}</Mono> }]} /></Box>}
    </>
  )
}

/* ------------------------------------------------------------- investigations */
const STATUS_TONE: Record<Invg["status"], Tone> = { new: "grey", "in progress": "blue", "ready for review": "amber", "awaiting approval": "blue", monitoring: "grey", resolved: "green", dismissed: "grey" }
const PRI_TONE: Record<string, Tone> = { high: "red", medium: "amber", low: "grey" }
const COLS: { k: Invg["status"]; label: string }[] = [{ k: "new", label: "New" }, { k: "in progress", label: "In progress" }, { k: "ready for review", label: "Ready for review" }, { k: "awaiting approval", label: "Awaiting approval" }, { k: "monitoring", label: "Monitoring" }, { k: "resolved", label: "Resolved" }]
function Board({ rows }: { rows: Invg[] }) {
  const nav = useNavigate(), [over, setOver] = useState<string | null>(null)
  const move = (id: string, to: Invg["status"]) => { const g = rows.find((x) => x.id === id); if (g && g.status !== to) A.setInvgStatus(id, to, "Moved to " + to) }
  return (
    <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-3" role="list" aria-label="Investigations board">
      {COLS.map(({ k, label }) => {
        const col = rows.filter((g) => (k === "resolved" ? g.status === "resolved" || g.status === "dismissed" : g.status === k)), sum = col.reduce((n, g) => n + g.exposure, 0)
        return (
          <section key={k} role="listitem" aria-label={label} onDragOver={(e) => { e.preventDefault(); setOver(k) }} onDragLeave={() => setOver(null)} onDrop={(e) => { e.preventDefault(); setOver(null); move(e.dataTransfer.getData("text/plain"), k) }}
            className={cn("w-[290px] shrink-0 snap-start rounded-xl border-[0.8px] bg-muted/60 p-2 transition-colors", over === k ? "border-[#f472b6] bg-[#fdf2f8]" : "border-border")}>
            <header className="flex items-baseline gap-2 px-2 pb-2 pt-1"><h2 className="text-sm">{label}</h2><span className="text-xs text-hushed">{col.length}</span><span className="ml-auto text-xs tabular-nums text-hushed">{usd(sum, 0)}</span></header>
            <div className="space-y-2">
              {col.map((g) => (
                <div key={g.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", g.id)} className="group relative cursor-grab rounded-lg border-[0.8px] border-border bg-white p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-22px_rgba(12,10,8,.5)] active:cursor-grabbing">
                  <button onClick={() => nav("/app/investigations/" + g.id)} className="block w-full text-left"><div className="flex items-center gap-2 font-mono text-[0.75rem] text-hushed">{g.id}<span className="ml-auto"><Pill tone={PRI_TONE[g.priority]}>{g.priority}</Pill></span></div>
                    <div className="mt-1.5 text-sm leading-5">{g.type}</div>{g.analysis && <div className="mt-1"><Pill tone={g.analysis === "failed" ? "red" : "amber"}>{g.analysis === "failed" ? "analysis failed" : "needs evidence"}</Pill></div>}<div className="truncate text-xs text-hushed">{g.cust}</div>
                    <div className="mt-2 flex items-center justify-between text-sm"><span className="shrink-0 tabular-nums">{usd(g.exposure, 0)}</span><span className="min-w-0 truncate pl-2 text-xs text-hushed">{g.assignee}</span></div></button>
                  <select aria-label={"Move " + g.id} value={g.status} onChange={(e) => move(g.id, e.target.value as Invg["status"])} className="sr-only focus:not-sr-only focus:mt-2 focus:h-8 focus:w-full focus:rounded-md focus:border focus:border-input focus:bg-white focus:px-2 focus:text-sm">{[...COLS, { k: "dismissed" as const, label: "Dismissed" }].map((c) => <option key={c.k} value={c.k}>{c.label}</option>)}</select>
                </div>))}
              {!col.length && <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-hushed">Nothing here. Drag a card in.</div>}
            </div>
          </section>)
      })}
    </div>
  )
}

export function Investigations() {
  const s = useApp(), nav = useNavigate(), role = useRole()
  const me = role === "owner" ? "Dana W." : "Priya R."
  const [view, setView] = useState<"board" | "table">("board")
  const [v, setV] = useState<"all" | "mine" | "ready" | "approval" | "monitoring">("all")
  const open = s.invgs
  const rows = open.filter((g) => (v === "mine" ? g.assignee === me : v === "ready" ? g.status === "ready for review" : v === "approval" ? g.status === "awaiting approval" : v === "monitoring" ? g.status === "monitoring" : true))
  return (
    <>
      <Title sub={`${open.filter((g) => !["resolved", "dismissed"].includes(g.status)).length} open · ${usd(totals(s).exposure, 0)} exposure`} right={<Seg className="!mb-0" items={["board", "table"] as const} value={view} onChange={setView} />}>Investigations</Title>
      <Seg items={[{ v: "all", label: "All" }, { v: "mine", label: "Assigned to me" }, { v: "ready", label: "Ready for review" }, { v: "approval", label: "Awaiting approval" }, { v: "monitoring", label: "Monitoring" }] as const} value={v} onChange={setV} />
      {view === "board" ? <Board rows={rows} /> : <Box><DataTable rows={rows} id={(g) => g.id} onRow={(g) => nav("/app/investigations/" + g.id)} search={(g) => g.id + g.cust + g.type} defaultSort={["exp", -1]}
        cols={[{ key: "id", label: "ID", render: (g) => <Mono>{g.id}</Mono> }, { key: "t", label: "Type", sort: (g) => g.type, render: (g) => g.type }, { key: "c", label: "Customer", sort: (g) => g.cust, render: (g) => g.cust }, { key: "exp", label: "Exposure", right: true, sort: (g) => g.exposure, render: (g) => usd(g.exposure, 0) }, { key: "p", label: "Priority", hide: "md", render: (g) => <Pill tone={PRI_TONE[g.priority]}>{g.priority}</Pill> }, { key: "s", label: "Status", render: (g) => <Pill tone={STATUS_TONE[g.status]}>{g.status}</Pill> }, { key: "a", label: "Assignee", hide: "lg", render: (g) => g.assignee }]} /></Box>}
    </>
  )
}

const KIND: Record<Finding["kind"], { label: string; box: string; tag: string }> = {
  confirmed: { label: "CONFIRMED FACT", box: "border-l-[3px] border-l-[#2f9e44] border-border bg-white", tag: "text-[#17692b]" },
  calc: { label: "CALCULATED BY venn, NOT BY AI", box: "border-transparent bg-muted font-mono text-[0.8125rem]", tag: "text-hushed" },
  possible: { label: "POSSIBLE EXPLANATION", box: "border-dashed border-[#d2cecb] bg-white", tag: "text-hushed" },
  claim: { label: "UNVERIFIED CLAIM · NOT CONFIRMED BY A PAYMENT RECORD", box: "border-dashed border-[#e0b13a] bg-[#fff8e1]", tag: "text-[#8a5a00]" },
  missing: { label: "MISSING EVIDENCE", box: "border-dashed border-[#a24a10]/40 bg-[#fdf3ec]", tag: "text-[#a24a10]" },
}
const evType = (e: string) => (e.startsWith("INV-") ? "Invoices" : e.startsWith("PAY-") ? "Payments" : e.endsWith(".eml") ? "Emails" : e.endsWith(".pdf") || e.endsWith(".csv") ? "Documents" : "Notes")
const STEPS = ["Loading records", "Retrieving documents", "Checking calculations", "Drafting findings"]

export function InvestigationDetail() {
  const { id } = useParams(), s = useApp(), role = useRole(), nav = useNavigate()
  const g = s.invgs.find((x) => x.id === id)
  const [run, setRun] = useState(-1)
  const [ev, setEv] = useState<string | null>(null), [filter, setFilter] = useState("All")
  const [tab, setTab] = useState<"findings" | "activity">("findings")
  const [modal, setModal] = useState<null | "note" | "assign" | "dismiss" | "evidence">(null)
  const [txt, setTxt] = useState("")
  useEffect(() => { if (run < 0) return; if (run >= STEPS.length) { A.rerun(id!); setRun(-1); return } const t = setTimeout(() => setRun(run + 1), 650); return () => clearTimeout(t) }, [run, id])
  if (!g) return <NotFound what="investigation" back="/app/investigations" />
  const inv = s.invoices.find((i) => i.id === g.inv), bal = inv ? balOf(s, inv) : null
  const stale = !!inv && ["Short payment", "Manual investigation"].includes(g.type) && bal !== g.exposure && !["resolved", "dismissed"].includes(g.status)
  const ro = ["resolved", "dismissed"].includes(g.status)
  const apr = s.aprs.find((a) => a.rec === g.id || a.link === g.id)
  const types = ["All", ...new Set(g.evidence.map(evType))]
  const groups: Finding["kind"][] = ["confirmed", "calc", "possible", "claim", "missing"]
  const Ev = ({ e }: { e: string }) => { const T = evType(e); const I = T === "Emails" ? Mail : T === "Documents" ? ScrollText : FileText; return <button onClick={() => setEv(e)} className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/60"><I className="size-4 shrink-0 text-hushed" /><span className="min-w-0 flex-1"><span className="block truncate text-sm">{e}</span><span className="text-xs text-hushed">{T}</span></span></button> }
  return (
    <>
      <Title back={["/app/investigations", "Investigations"]} sub={<><Mono>{g.id}</Mono> · {g.type} · {g.cust} · assigned to {g.assignee}</>} right={!ro && <>
        <Button variant="outline" onClick={() => setRun(0)} disabled={run >= 0}>Re-run analysis</Button><Button variant="outline" onClick={() => setModal("assign")}>Assign</Button><Button variant="outline" onClick={() => setModal("note")}>Add note</Button><Button variant="outline" onClick={() => setModal("dismiss")}>Dismiss</Button></>}>{g.title}</Title>
      <div className="mb-4 flex flex-wrap gap-2"><Pill tone={STATUS_TONE[g.status]}>{g.status}</Pill><Pill tone={PRI_TONE[g.priority]}>{g.priority} priority</Pill><Pill tone="grey">exposure {usd(g.exposure)}</Pill>{g.analysis === "failed" ? <Pill tone="red">analysis failed</Pill> : g.analysis === "insufficient" ? <Pill tone="amber">needs evidence</Pill> : <Pill tone="grey">analysis v{g.version}</Pill>}</div>
      {ro && <div className="mb-4 rounded-xl bg-muted p-4 text-sm">This investigation is {g.status}. It is read-only.</div>}
      {stale && <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#e0b13a] bg-[#fff8e1] p-4 text-sm"><span className="flex-1">Records changed since this analysis: the invoice balance is now {usd(bal ?? 0)}.</span><Button size="sm" onClick={() => setRun(0)}>Re-run analysis</Button></div>}
      {g.analysis === "failed" && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#a24a10]/40 bg-[#fdf3ec] p-4 text-sm"><AlertTriangle className="size-5 shrink-0 text-[#a24a10]" /><span className="min-w-[220px] flex-1"><b className="font-normal text-[#a24a10]">Analysis failed.</b> The document reader timed out on {g.evidence.find((e) => e.endsWith(".pdf")) ?? "an attachment"}. No records were changed and no figures were guessed.</span><Button size="sm" onClick={() => setRun(0)} disabled={run >= 0}>Try again</Button></div>}
      {g.analysis === "insufficient" && <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#e0b13a] bg-[#fff8e1] p-4 text-sm"><AlertTriangle className="size-5 shrink-0 text-[#8a5a00]" /><span className="min-w-[220px] flex-1"><b className="font-normal text-[#8a5a00]">Not enough evidence.</b> {g.evidence.length} record is linked. venn needs a document or an email that names the payer before it proposes anything. It will not guess.</span><Button size="sm" variant="outline" onClick={() => setModal("evidence")}>Add evidence</Button><Button size="sm" onClick={() => setRun(0)} disabled={run >= 0}>Re-run analysis</Button></div>}
      {run >= 0 && <Box className="mb-4" pad><div className="text-sm">Analysing…</div><ol className="mt-2 grid gap-1.5 sm:grid-cols-4">{STEPS.map((t, i) => <li key={t} className={cn("rounded-lg px-3 py-2 text-sm transition-colors", i < run ? "bg-[#e3f6e6] text-[#17692b]" : i === run ? "bg-lime" : "bg-muted text-hushed")}>{i < run ? "✓ " : ""}{t}</li>)}</ol></Box>}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <Seg items={["findings", "activity"] as const} value={tab} onChange={setTab} />
          {tab === "findings" ? (
            <div className="space-y-4">
              <Box title="What happened" pad><p>{g.analysis === "failed" ? "The analysis did not finish, so there is no summary yet." : g.summary}</p></Box>
              <Box title="Findings" pad>{g.analysis === "failed" && <p className="text-sm text-hushed">No findings were produced. Try the analysis again, or add notes by hand.</p>}<div className="space-y-2">{groups.flatMap((k) => g.findings.filter((f) => f.kind === k).map((f, i) => <div key={k + i} className={cn("rounded-lg border p-4", KIND[k].box)}><div className={cn("font-mono text-[0.6875rem]", KIND[k].tag)}>{KIND[k].label}</div><p className="mt-1">{f.text}</p></div>))}</div></Box>
              {g.analysis ? <Box title="Recommendation" pad><p className="text-sm text-hushed">{g.analysis === "failed" ? "No recommendation until the analysis completes." : "No recommendation yet. Link more evidence and re-run the analysis."}</p></Box> : <Box title="Recommendation" pad right={<Pill tone="grey">{g.rec.gate}</Pill>}>
                <p className="text-lg">{g.rec.action}</p><p className="mt-1 text-sm text-hushed">venn proposes. A person decides. It cannot approve, allocate or send on its own.</p>
                {!ro && <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => { A.actOnInvg(g.id); if (g.rec.kind === "request-proof") nav("/app/collections") }}>{g.rec.gate.includes("approval") && role === "ar" ? "Submit for approval" : g.rec.action}</Button></div>}
              </Box>}
              {apr && <Box title="Approval" right={<Pill tone={apr.status === "approved" ? "green" : apr.status === "pending" ? "amber" : "grey"}>{apr.status}</Pill>} pad><p className="text-sm">{apr.id} · {apr.type} · {usd(apr.amount)}</p><Link to={"/app/approvals/" + apr.id} className="mt-2 inline-flex items-center gap-1 text-sm underline-offset-2 hover:underline">Open request<ArrowRight className="size-4" /></Link></Box>}
              {!ro && <Box title="Resolution" pad><p className="text-sm text-hushed">Close this investigation when the exposure is settled or explained.</p><Button className="mt-3" variant="outline" onClick={() => A.setInvgStatus(g.id, "resolved", "Marked resolved")}>Mark resolved</Button></Box>}
            </div>
          ) : (
            <Box><ol className="p-5">{g.timeline.map((t, i) => <li key={i} className="relative border-l border-border pb-5 pl-5 last:pb-0"><span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-lime-light" /><div className="text-sm">{t.text}</div><div className="text-xs text-hushed">{t.by} · {t.at}</div></li>)}</ol></Box>
          )}
        </div>
        <aside><Box title="Evidence" right={!ro && <Button variant="ghost" size="sm" onClick={() => setModal("evidence")}>Add</Button>} pad>
          <Seg className="!mb-3" items={types} value={filter} onChange={setFilter} />
          <div className="space-y-2">{g.evidence.filter((e) => filter === "All" || evType(e) === filter).map((e) => <Ev key={e} e={e} />)}</div>
        </Box></aside>
      </div>

      <Drawer open={!!ev} onOpenChange={(o) => !o && setEv(null)} title={ev ?? ""} desc={ev ? evType(ev) : ""}>
        {ev && ev.startsWith("INV-") && (() => { const i = s.invoices.find((x) => x.id === ev); return i ? <div className="mt-2"><Row k="Customer">{i.cust}</Row><Row k="Total">{usd(invTotal(i))}</Row><Row k="Balance">{usd(balOf(s, i))}</Row><Row k="Due">{fmtD(i.due)} ({lateOf(i)} days late)</Row><Link to={"/app/invoices/" + i.id} className="mt-4 inline-flex items-center gap-1 text-sm underline-offset-2 hover:underline">Open invoice<ArrowRight className="size-4" /></Link></div> : null })()}
        {ev && ev.startsWith("PAY-") && (() => { const p = s.payments.find((x) => x.id === ev); return p ? <div className="mt-2"><Row k="Payer">{p.payer}</Row><Row k="Amount">{usd(p.amount)}</Row><Row k="Date">{fmtD(p.date)}</Row><Row k="Reference">{p.ref}</Row><Link to={"/app/payments/" + p.id} className="mt-4 inline-flex items-center gap-1 text-sm underline-offset-2 hover:underline">Open payment<ArrowRight className="size-4" /></Link></div> : null })()}
        {ev?.endsWith(".eml") && <div className="mt-2 rounded-lg bg-muted p-4 text-sm"><div className="text-xs text-hushed">From Hannah Cole · 28 Oct</div><p className="mt-2">Hi, we sent the remaining $1,000 last Friday. Please check your account and let us know if anything is missing.</p><p className="mt-2 text-xs text-hushed">venn marked this as an unverified claim. No bank record matches.</p></div>}
        {ev?.endsWith(".pdf") && <div className="mt-2 rounded-lg bg-muted p-6 text-sm"><div className="text-lg">{ev}</div><p className="mt-2 text-hushed">Page 1 of 1 · text extracted and linked to this case.</p><div className="mt-4 h-40 rounded bg-white shadow-sm" /></div>}
        {ev && !ev.startsWith("INV-") && !ev.startsWith("PAY-") && !ev.endsWith(".eml") && !ev.endsWith(".pdf") && <p className="mt-2 text-sm">{ev}</p>}
      </Drawer>
      <Modal open={modal === "note"} onOpenChange={(o) => setModal(o ? "note" : null)} title="Add note" footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button disabled={!txt.trim()} onClick={() => { A.addInvgNote(g.id, txt); setTxt(""); setModal(null) }}>Add note</Button></>}><TextArea aria-label="Note" value={txt} onChange={(e) => setTxt(e.target.value)} /></Modal>
      <Modal open={modal === "evidence"} onOpenChange={(o) => setModal(o ? "evidence" : null)} title="Add evidence" desc="Link an invoice, a payment or a document." footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button disabled={!txt} onClick={() => { A.addEvidence(g.id, txt); setTxt(""); setModal(null) }}>Link</Button></>}><NativeSelect aria-label="Record" value={txt} onChange={(e) => setTxt(e.target.value)}><option value="">Select a record…</option>{[...s.invoices.map((i) => i.id), ...s.payments.map((p) => p.id), ...s.docs.map((d) => d.name)].filter((x) => !g.evidence.includes(x)).map((x) => <option key={x}>{x}</option>)}</NativeSelect></Modal>
      <Modal open={modal === "assign"} onOpenChange={(o) => setModal(o ? "assign" : null)} title="Assign investigation" footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button onClick={() => { A.assignInvg(g.id, txt || g.assignee); setTxt(""); setModal(null) }}>Assign</Button></>}><Field label="Assignee"><NativeSelect value={txt || g.assignee} onChange={(e) => setTxt(e.target.value)}>{s.team.filter((m) => m.status === "active").map((m) => <option key={m.id}>{m.name.split(" ")[0]} {m.name.split(" ")[1]?.[0]}.</option>)}</NativeSelect></Field></Modal>
      <Modal open={modal === "dismiss"} onOpenChange={(o) => setModal(o ? "dismiss" : null)} title="Dismiss this investigation?" desc="It becomes read-only. The reason is recorded in the audit log." footer={<><Button variant="outline" onClick={() => setModal(null)}>Keep open</Button><Button variant="destructive" disabled={!txt.trim()} onClick={() => { A.setInvgStatus(g.id, "dismissed", "Dismissed: " + txt); setTxt(""); setModal(null) }}>Dismiss</Button></>}><TextArea aria-label="Reason" placeholder="Reason" value={txt} onChange={(e) => setTxt(e.target.value)} /></Modal>
    </>
  )
}

export function ReconRun() {
  const s = useApp(), { id } = useParams()
  const auto = s.allocs.filter((a) => a.by === "venn" && !a.void).length, pend = s.suggs.filter((g) => g.status === "pending").length
  const rules = Object.entries(s.suggs.reduce<Record<string, number>>((m, g) => ({ ...m, [g.rule]: (m[g.rule] ?? 0) + 1 }), {}))
  return (
    <>
      <Title back={["/app/reconciliation", "Reconciliation"]} sub="Started 13 Nov 09:30 · finished in 4 seconds">{id}</Title>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4"><Kpi dark label="Payments read" value={String(s.payments.length)} /><Kpi label="Auto-applied" value={String(auto)} note="Exact matches" /><Kpi label="Needs review" value={String(pend)} /><Kpi label="Unmatched" value={String(totals(s).unmatched.length)} /></div>
      <Box className="mt-4" title="Rule breakdown"><DataTable rows={rules} id={(r) => r[0]} empty={<Empty title="No rules fired" />} cols={[{ key: "r", label: "Rule", render: (r) => <Mono>{r[0]}</Mono> }, { key: "n", label: "Suggestions", right: true, render: (r) => r[1] }]} /></Box>
    </>
  )
}

import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowRight, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { A, balOf, lateOf, totals, useApp, usd, fmtD, type Tone } from "./store"
import { ActivityChart, AgingChart, AGING_COLORS, CustomerBars, Donut, ReconChart, RecoveredChart, TrendChart } from "./charts"
import { Box, Kpi, Pill, RangeSeg, Seg, Spark, Title, COLORS } from "./ui"
import { RANGE_NAME, scoped, useRange } from "./ranges"
import { useRole } from "./Shell"

const SPARK_AR = [58, 62, 60, 67, 72, 70, 78, 84, 91, 98, 104, 113.7], SPARK_OV = [9, 11, 10, 14, 15, 13, 18, 21, 24, 27, 31, 66]
const STATUS_COLOR: Record<string, string> = { new: COLORS.grey, "in progress": COLORS.blue, "ready for review": COLORS.deep, "awaiting approval": COLORS.amber, monitoring: COLORS.ink }
const invgTone = (s: string): Tone => (s === "ready for review" ? "amber" : s === "awaiting approval" ? "blue" : s === "resolved" ? "green" : "grey")

function Checklist() {
  const s = useApp()
  const [hide, setHide] = useState(false)
  const items: [string, string, string][] = [["sources", "Connect a financial source", "/app/integrations"], ["email", "Connect your mailbox", "/app/integrations"], ["import", "Import invoices and payments", "/app/invoices"], ["team", "Invite your AR team", "/app/team"], ["prefs", "Review financial preferences", "/app/settings"]]
  const left = items.filter(([k]) => !s.setup[k])
  if (hide || !left.length) return null
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border-[0.8px] border-border bg-muted p-4">
      <div className="flex-1"><div className="text-base">Finish setting up</div><div className="mt-1 flex flex-wrap gap-2">{left.map(([k, t, to]) => <Link key={k} to={to} onClick={() => A.setSetup(k, true)} className="rounded-full bg-white px-3 py-1 text-sm transition-colors hover:bg-lime">{t}</Link>)}</div></div>
      <button aria-label="Dismiss checklist" onClick={() => setHide(true)} className="flex size-8 items-center justify-center rounded-md hover:bg-black/[.05]"><X className="size-4" /></button>
    </div>
  )
}

function OwnerDashboard() {
  const s = useApp(), t = totals(s), nav = useNavigate()
  const [range] = useRange()
  const [view, setView] = useState<"chart" | "table">("chart")
  const pend = s.aprs.filter((a) => a.status === "pending")
  const sc = scoped(s, range), byCust = sc.byCust.slice(0, 8), aging = sc.aging, agingSum = aging.reduce((n, [, v]) => n + v, 0)
  const note = <p className="px-5 pb-4 text-xs text-hushed">Invoices issued in the {RANGE_NAME[range]}.</p>
  const open = s.invgs.filter((g) => !["resolved", "dismissed"].includes(g.status))
  const byStatus = Object.entries(open.reduce<Record<string, number>>((m, g) => ({ ...m, [g.status]: (m[g.status] ?? 0) + 1 }), {})).map(([name, value]) => ({ name, value, color: STATUS_COLOR[name] ?? COLORS.grey }))
  const recovered = 7600
  return (
    <>
      <Title sub="Friday 13 November · Brightpath Digital" right={<RangeSeg />}>Good morning, Dana</Title>
      <Checklist />
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-5 [&>:last-child:nth-child(odd)]:col-span-2 xl:[&>:last-child:nth-child(odd)]:col-span-1">
        <Kpi dark label="Total receivable" value={usd(t.receivable, 0)} note={`${t.open} open invoices`} spark={SPARK_AR} delta={{ v: "9%", good: false, up: true }} to="/app/invoices" />
        <Kpi label="Overdue" value={usd(t.overdue, 0)} note={`${t.overdueCount} invoices`} spark={SPARK_OV} to="/app/invoices" />
        <Kpi label="Unmatched payments" value={String(t.unmatched.length + t.needsReview)} note="Need review in reconciliation" to="/app/reconciliation" />
        <Kpi label="Open exposure" value={usd(t.exposure, 0)} note={`${open.length} open investigations`} to="/app/investigations" />
        <Kpi label="Verified recovered" value={usd(recovered, 0)} note="This month, bank-confirmed" spark={[4, 7, 5, 9, 12, 8]} delta={{ v: "12%", good: true, up: false }} to="/app/reports" />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Box title="Receivables aging" right={<Seg className="!mb-0" items={["chart", "table"] as const} value={view} onChange={setView} />}>
          <div className="p-4">{view === "chart" ? <AgingChart data={aging} /> : (
            <table className="w-full text-sm"><tbody>{aging.map(([k, v], i) => <tr key={k} className="border-b border-border last:border-0"><td className="py-3"><span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: AGING_COLORS[i] }} />{k}</td><td className="py-3 text-right tabular-nums">{usd(v)}</td><td className="w-16 py-3 text-right text-hushed">{Math.round((v / Math.max(1, agingSum)) * 100)}%</td></tr>)}</tbody></table>
          )}</div>{note}
        </Box>
        <Box title="Outstanding balance trend" right={<span className="flex items-center gap-3 text-xs text-hushed"><span><i className="mr-1 inline-block size-2 rounded-full bg-deep" style={{ background: COLORS.deep }} />Outstanding</span><span><i className="mr-1 inline-block size-2 rounded-full" style={{ background: COLORS.ink }} />Overdue</span></span>}>
          <div className="p-4"><TrendChart total={t.receivable} overdue={t.overdue} range={range} /></div>
        </Box>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Box title="Pending approvals" right={<Link to="/app/approvals" className="text-sm text-hushed hover:text-foreground">View all</Link>}>
          {pend.length ? pend.map((a) => (
            <div key={a.id} className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-0">
              <button className="min-w-0 flex-1 text-left" onClick={() => nav("/app/approvals/" + a.id)}><div className="font-mono text-[0.75rem] text-hushed">{a.id} · {a.type}</div><div className="flex gap-1 text-sm"><span className="truncate">{a.cust}</span><span className="shrink-0 tabular-nums">· {usd(a.amount, 0)}</span></div></button>
              <Button size="icon" variant="outline" aria-label={`Approve ${a.id}`} onClick={() => A.decide(a.id, "approved", "")}><Check className="size-4" /></Button>
            </div>)) : <div className="px-5 py-8 text-center text-sm text-hushed">Nothing waiting for you.</div>}
        </Box>
        <Box title="Investigations by status" right={<Link to="/app/investigations" className="text-sm text-hushed hover:text-foreground">Open</Link>}>
          <div className="p-4"><Donut data={byStatus} center={String(open.length)} h={170} /><ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">{byStatus.map((d) => <li key={d.name} className="flex items-center gap-1.5 capitalize"><span className="size-2 rounded-full" style={{ background: d.color }} />{d.name}<span className="ml-auto text-hushed">{d.value}</span></li>)}</ul></div>
        </Box>
        <Box title="Top exposure" right={<Link to="/app/investigations" className="text-sm text-hushed hover:text-foreground">All</Link>}>
          {[...open].sort((a, b) => b.exposure - a.exposure).slice(0, 5).map((g) => <Link key={g.id} to={"/app/investigations/" + g.id} className="flex items-center gap-3 border-b border-border px-5 py-3 transition-colors last:border-0 hover:bg-muted/60"><div className="min-w-0 flex-1"><div className="truncate text-sm">{g.cust}</div><div className="font-mono text-[0.75rem] text-hushed">{g.id} · {g.type}</div></div><div className="shrink-0 whitespace-nowrap text-sm tabular-nums">{usd(g.exposure, 0)}</div></Link>)}
        </Box>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <Box title="Overdue by customer"><div className="p-4">{byCust.length ? <CustomerBars data={byCust} /> : <div className="py-16 text-center text-sm text-hushed">No invoices fell overdue in the {RANGE_NAME[range]}.</div>}</div><p className="px-5 pb-4 text-xs text-hushed">Invoices that fell due in the {RANGE_NAME[range]} and are still unpaid.</p></Box>
        <div className="grid gap-3">
          <Box title="Open disputes" right={<Link to="/app/disputes" className="text-sm text-hushed hover:text-foreground">View</Link>}>
            {s.dsps.filter((d) => d.status !== "resolved").map((d) => <Link key={d.id} to={"/app/disputes/" + d.id} className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-0 hover:bg-muted/60"><div className="min-w-0 flex-1"><div className="truncate text-sm">{d.cust}</div><div className="font-mono text-[0.75rem] text-hushed">{d.id} · due {fmtD(d.due)}</div></div><span className="text-sm tabular-nums">{usd(d.amt, 0)}</span></Link>)}
          </Box>
          <Box title="Integration health">
            {s.integs.filter((i) => i.status === "connected").map((i) => <div key={i.id} className="flex items-center gap-3 border-b border-border px-5 py-3 text-sm last:border-0"><span className="size-2 rounded-full bg-[#2f9e44]" /><span className="flex-1">{i.name}</span><span className="text-xs text-hushed">synced {i.last}</span></div>)}
          </Box>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Box title="Verified recovered"><div className="p-4"><RecoveredChart range={range} /></div></Box>
        <Box title="Recent activity" right={<Link to="/app/audit" className="text-sm text-hushed hover:text-foreground">Audit log</Link>}>
          {s.audit.slice(0, 6).map((a) => <div key={a.id} className="flex items-start gap-3 border-b border-border px-5 py-3 text-sm last:border-0"><span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: a.actor === "venn" ? COLORS.pink : COLORS.ink }} /><div className="min-w-0 flex-1"><div className="truncate">{a.action}</div><div className="text-xs text-hushed">{a.actor} · {a.at}</div></div></div>)}
        </Box>
      </div>
    </>
  )
}

function ArDashboard() {
  const s = useApp(), t = totals(s), nav = useNavigate(), [range] = useRange()
  const mine = s.tasks.filter((x) => x.owner === "ar")
  const due = s.cols.filter((c) => c.next <= "2026-11-14")
  const attention = s.invoices.filter((i) => balOf(s, i) > 0 && lateOf(i) > 0).sort((a, b) => lateOf(b) - lateOf(a)).slice(0, 5)
  const myInvg = s.invgs.filter((g) => g.assignee === "Priya R." && !["resolved", "dismissed"].includes(g.status))
  const myApr = s.aprs.filter((a) => a.by === "Priya R.")
  return (
    <>
      <Title sub="Friday 13 November · your queue" right={<RangeSeg />}>My work today</Title>
      <Checklist />
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <Kpi dark label="Tasks due" value={String(mine.filter((x) => !x.done).length)} note="Today and tomorrow" to="/app/tasks" />
        <Kpi label="Needs review" value={String(t.needsReview)} note="Suggested matches" to="/app/reconciliation" />
        <Kpi label="My investigations" value={String(myInvg.length)} note={`${myInvg.filter((g) => g.status === "ready for review").length} ready for review`} to="/app/investigations" />
        <Kpi label="Unmatched payments" value={String(t.unmatched.length)} note="No candidate invoice" to="/app/reconciliation" />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <Box title="Tasks" right={<Link to="/app/tasks" className="text-sm text-hushed hover:text-foreground">All tasks</Link>}>
          {mine.map((x) => (
            <label key={x.id} className="flex cursor-pointer items-center gap-3 border-b border-border px-5 py-3 text-sm last:border-0 hover:bg-muted/50">
              <input type="checkbox" checked={x.done} onChange={() => A.toggleTask(x.id)} className="size-4 accent-[#f472b6]" /><span className={x.done ? "flex-1 text-hushed line-through" : "flex-1"}>{x.text}</span><span className="text-xs text-hushed">{fmtD(x.due)}</span>
            </label>))}
        </Box>
        <Box title="Reconciliation throughput"><div className="p-4"><ReconChart h={220} range={range} /></div></Box>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Box title="Follow-ups due" right={<Link to="/app/collections" className="text-sm text-hushed hover:text-foreground">Queue</Link>}>
          {due.map((c) => <button key={c.id} onClick={() => nav("/app/collections/" + c.id)} className="flex w-full items-center gap-3 border-b border-border px-5 py-3 text-left last:border-0 hover:bg-muted/60"><div className="min-w-0 flex-1"><div className="truncate text-sm">{c.cust}</div><div className="text-xs capitalize text-hushed">{c.stage} · due {fmtD(c.next)}</div></div><ArrowRight className="size-4 text-hushed" /></button>)}
        </Box>
        <Box title="Invoices needing attention" right={<Link to="/app/invoices" className="text-sm text-hushed hover:text-foreground">All</Link>}>
          {attention.map((i) => <Link key={i.id} to={"/app/invoices/" + i.id} className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-0 hover:bg-muted/60"><div className="min-w-0 flex-1"><div className="truncate text-sm">{i.cust}</div><div className="font-mono text-[0.75rem] text-hushed">{i.id} · {lateOf(i)} days late</div></div><span className="text-sm tabular-nums">{usd(balOf(s, i), 0)}</span></Link>)}
        </Box>
        <Box title="My requests" right={<Link to="/app/approvals" className="text-sm text-hushed hover:text-foreground">All</Link>}>
          {myApr.map((a) => <Link key={a.id} to={"/app/approvals/" + a.id} className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-0 hover:bg-muted/60"><div className="min-w-0 flex-1"><div className="truncate text-sm">{a.type} · {usd(a.amount, 0)}</div><div className="font-mono text-[0.75rem] text-hushed">{a.id}</div></div><Pill tone={a.status === "approved" ? "green" : a.status === "pending" ? "amber" : "grey"}>{a.status}</Pill></Link>)}
        </Box>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Box title="My collections activity"><div className="p-4"><ActivityChart range={range} /></div></Box>
        <Box title="Open investigations">
          {myInvg.map((g) => <Link key={g.id} to={"/app/investigations/" + g.id} className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-0 hover:bg-muted/60"><div className="min-w-0 flex-1"><div className="truncate text-sm">{g.title}</div><div className="font-mono text-[0.75rem] text-hushed">{g.id} · {g.cust}</div></div><Pill tone={invgTone(g.status)}>{g.status}</Pill></Link>)}
          <div className="px-5 py-3"><Spark data={[3, 4, 3, 5, 4, 6, myInvg.length]} /><div className="text-xs text-hushed">Queue size, last 7 days</div></div>
        </Box>
      </div>
    </>
  )
}

/** A workspace with no records yet: a guided start instead of empty charts. */
function FirstRun() {
  const s = useApp(), nav = useNavigate(), me = s.session?.name.split(" ")[0] ?? "there"
  const steps: [string, string, string, string, string][] = [
    ["sources", "Connect a financial source", "Link your accounting system or bank so venn can read invoices and payments. Read-only.", "Connect", "/app/integrations"],
    ["import", "Or start with a CSV", "Upload an invoice export and a payment export. You review every row before anything is saved.", "Import a CSV", "/app/invoices/import"],
    ["email", "Connect your mailbox", "Customer emails become evidence when they mention a payment or a dispute. Nothing is sent without approval.", "Connect mail", "/app/integrations"],
    ["team", "Invite your AR team", "Specialists work the queue. Owners approve write-offs, credits and refunds.", "Invite people", "/app/team"],
    ["prefs", "Set your financial preferences", "Currency, payment terms, and how strict automatic matching should be.", "Review", "/app/settings"],
  ]
  const done = steps.filter(([k]) => s.setup[k]).length
  return (
    <>
      <Title sub="Your workspace is ready. It has no records yet.">Welcome, {me}</Title>
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border-[0.8px] border-border bg-white">
          <div className="flex items-center gap-4 border-b border-border px-5 py-4"><div className="flex-1"><h2 className="text-lg">Get venn reading your data</h2><p className="text-sm text-hushed">{done} of {steps.length} done</p></div>
            <div className="h-2 w-32 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}><div className="h-full rounded-full bg-[#f472b6] transition-all duration-500" style={{ width: (done / steps.length) * 100 + "%" }} /></div></div>
          <ol>{steps.map(([k, t, d, cta, to], i) => (
            <li key={k} className="flex items-start gap-4 border-b border-border px-5 py-4 last:border-0">
              <span className={"mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-sm " + (s.setup[k] ? "bg-foreground text-white" : "bg-muted")}>{s.setup[k] ? <Check className="size-4" /> : i + 1}</span>
              <div className="min-w-0 flex-1"><div className="text-base">{t}</div><p className="text-sm text-hushed">{d}</p></div>
              <Button size="sm" variant={s.setup[k] ? "ghost" : "outline"} onClick={() => { A.setSetup(k, true); nav(to) }}>{s.setup[k] ? "Done" : cta}</Button>
            </li>))}</ol>
        </section>
        <section className="relative overflow-hidden rounded-xl border-[0.8px] border-border bg-muted p-5">
          <h2 className="text-lg">What you will see here</h2>
          <p className="mt-1 text-sm text-hushed">Once records arrive, this page shows receivables, overdue balances, payments waiting for review and every open investigation.</p>
          <div className="mt-5 flex h-[150px] items-end gap-2" aria-hidden="true">{[38, 56, 44, 70, 62, 88, 74, 96].map((h, i) => <div key={i} className="flex-1 rounded-t-md bg-[#f9a8d4]/50" style={{ height: h + "%" }} />)}</div>
          <div className="mt-2 h-px bg-border" />
          <Button variant="outline" className="mt-5 w-full bg-white" onClick={() => A.signIn("Dana Whitfield", "dana@brightpath.example")}>Explore with sample records</Button>
          <p className="mt-2 text-xs text-hushed">Replaces this empty workspace with a complete set of records so you can look around. You can empty it again in Settings.</p>
        </section>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">{["Total receivable", "Overdue", "Unmatched payments", "Open exposure"].map((l) => <Kpi key={l} label={l} value="—" note="Appears after your first import" />)}</div>
    </>
  )
}

export function Dashboard() {
  const role = useRole(), s = useApp()
  if (!s.invoices.length && !s.payments.length) return <FirstRun />
  return role === "owner" ? <OwnerDashboard /> : <ArDashboard />
}


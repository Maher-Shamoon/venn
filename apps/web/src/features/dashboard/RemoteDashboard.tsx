import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Area, AreaChart, Bar, BarChart, Legend, Tooltip, XAxis, YAxis } from "recharts"
import { Check } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { AgingChart, AGING_COLORS, CustomerBars, Donut, H, Tip, axis, grid, short } from "@/components/app/charts"
import { Box, Empty, Kpi, Pill, RangeSeg, Seg, Title, COLORS } from "@/components/app/ui"
import { RANGE_NAME, useRange } from "@/components/app/ranges"
import { useRole } from "@/components/app/Shell"
import { useDecide } from "@/features/approvals/api"
import { errorMessage } from "@/lib/errors"
import { formatMoney } from "@/lib/money"
import { useArDashboard, useOwnerDashboard, type OwnerDashboard, type TrendPoint } from "./api"

const label = (s: string) => s.replace(/_/g, " ")
const num = (s: string) => Number(s)
const PRI: Record<string, "red" | "amber" | "grey"> = { critical: "red", high: "red", medium: "amber", low: "grey" }
const Loading = () => <div role="status" aria-busy="true" className="grid gap-3"><div className="h-28 animate-pulse rounded-xl bg-muted" /><div className="h-72 animate-pulse rounded-xl bg-muted" /></div>
const STATUS_COLOR: Record<string, string> = { new: COLORS.grey, in_progress: COLORS.blue, ready_for_review: COLORS.deep, awaiting_approval: COLORS.amber, monitoring: COLORS.ink }
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening" }

export function TrendArea({ data, h }: { data: TrendPoint[]; h?: number }) {
  const rows = data.map((p) => ({ m: p.label, total: num(p.total), overdue: num(p.overdue) }))
  return (
    <div>
      <H h={h} label="Area chart of the outstanding and overdue balance over time"><AreaChart data={rows} margin={{ left: -8, right: 8, top: 8 }}>
        <defs><linearGradient id="gt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.pink} stopOpacity={0.7} /><stop offset="100%" stopColor={COLORS.pink} stopOpacity={0.05} /></linearGradient></defs>
        {grid}<XAxis dataKey="m" {...axis} minTickGap={16} /><YAxis {...axis} tickFormatter={short} /><Tooltip content={<Tip />} />
        <Area type="monotone" dataKey="total" name="Outstanding" stroke={COLORS.deep} strokeWidth={2} fill="url(#gt)" /><Area type="monotone" dataKey="overdue" name="Overdue" stroke={COLORS.ink} strokeWidth={2} fill="none" />
      </AreaChart></H>
      <p className="sr-only">Outstanding balance by period: {data.map((p) => `${p.label} ${p.total}`).join(", ")}.</p>
    </div>
  )
}

/** First run for a real organization: guided steps that link to the real screens, no sample figures. */
function FirstRun({ d }: { d: OwnerDashboard }) {
  const steps: [boolean, string, string, string, string][] = [
    [d.setup.invoices, "Import your invoices", "Upload an invoice export. You review every row before anything is saved.", "Import invoices", "/app/invoices/import"],
    [d.setup.payments, "Import your payments", "Upload a payment export so venn can match payments to invoices.", "Import payments", "/app/payments/import"],
    [d.setup.reconciliation, "Run reconciliation", "venn suggests matches and applies exact ones if you allow it. A person decides the rest.", "Open reconciliation", "/app/reconciliation"],
    [d.setup.team, "Invite your AR team", "Specialists work the queue. Owners approve write-offs, credits and refunds.", "Invite people", "/app/team"],
  ]
  const done = steps.filter(([ok]) => ok).length
  return (
    <>
      <Title sub="Your workspace has no invoices or payments yet.">Welcome</Title>
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border-[0.8px] border-border bg-white">
          <div className="flex items-center gap-4 border-b border-border px-5 py-4"><div className="flex-1"><h2 className="text-lg">Get venn reading your data</h2><p className="text-sm text-hushed">{done} of {steps.length} done</p></div></div>
          <ol>{steps.map(([ok, t, desc, cta, to], i) => (
            <li key={t} className="flex items-start gap-4 border-b border-border px-5 py-4 last:border-0">
              <span className={"mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-sm " + (ok ? "bg-foreground text-white" : "bg-muted")}>{ok ? <Check className="size-4" /> : i + 1}</span>
              <div className="min-w-0 flex-1"><div className="text-base">{t}</div><p className="text-sm text-hushed">{desc}</p></div>
              <Button size="sm" variant={ok ? "ghost" : "outline"} render={<Link to={to} />}>{ok ? "Done" : cta}</Button>
            </li>))}</ol>
        </section>
        <section className="rounded-xl border-[0.8px] border-border bg-muted p-5"><h2 className="text-lg">What you will see here</h2><p className="mt-1 text-sm text-hushed">Once records arrive, this page shows receivables, overdue balances, payments waiting for review and every open investigation, all calculated from your records.</p></section>
      </div>
    </>
  )
}

function Owner() {
  const [range] = useRange(), q = useOwnerDashboard(range), nav = useNavigate(), decide = useDecide(), [view, setView] = useState<"chart" | "table">("chart")
  if (q.isPending) return <Loading />
  if (q.isError || !q.data) return <Box><Empty title="The dashboard could not load" sub="Reload the page. Nothing was changed." /></Box>
  const d = q.data, k = d.kpis, cur = d.currency
  if (!d.has_data) return <FirstRun d={d} />
  const change = num(k.total_ar_change), open = Object.values(d.investigations_by_status).reduce((a, b) => a + b, 0)
  const byStatus = Object.entries(d.investigations_by_status).map(([name, value]) => ({ name: label(name), value, color: STATUS_COLOR[name] ?? COLORS.grey }))
  const aging = d.aging.map((a): [string, number] => [a.bucket, num(a.amount)])
  const approve = (id: string, number: string) => decide.mutate({ id, decision: "approve" }, { onSuccess: () => toast.success(`${number} approved`), onError: (e) => toast.error(errorMessage(e)) })
  return (
    <>
      <Title sub={new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} right={<RangeSeg />}>{greeting()}</Title>
      {k.other_currencies > 0 && <p className="mb-3 text-sm text-hushed">Figures are in {cur}. {k.other_currencies} other {k.other_currencies === 1 ? "currency is" : "currencies are"} not included and not converted.</p>}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-5 [&>:last-child:nth-child(odd)]:col-span-2 xl:[&>:last-child:nth-child(odd)]:col-span-1">
        <Kpi dark label="Total receivable" value={formatMoney(k.total_ar, cur)} note={`${k.open_invoices} open invoices`} to="/app/invoices" delta={change === 0 ? undefined : { v: formatMoney(Math.abs(change).toFixed(2), cur), good: change < 0, up: change > 0 }} spark={d.trend.map((p) => num(p.total))} />
        <Kpi label="Overdue" value={formatMoney(k.overdue, cur)} note={`${k.overdue_invoices} invoices`} to="/app/invoices?tab=overdue" spark={d.trend.map((p) => num(p.overdue))} />
        <Kpi label="Unmatched payments" value={formatMoney(k.unmatched, cur)} note={`${k.unmatched_payments} payments to match`} to="/app/payments?tab=unallocated" />
        <Kpi label="Open exposure" value={formatMoney(k.open_exposure, cur)} note={`${k.open_investigations} open investigations`} to="/app/investigations" />
        <Kpi label="Verified recovered" value={formatMoney(k.recovered, cur)} note={`${RANGE_NAME[range]}, source-confirmed`} to="/app/reports/recovered" />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Box title="Receivables aging" right={<Seg className="!mb-0" items={["chart", "table"] as const} value={view} onChange={setView} />}>
          <div className="p-4">{view === "chart" ? <AgingChart data={aging} /> : (
            <table className="w-full text-sm"><caption className="sr-only">Receivables aging</caption><tbody>{d.aging.map((a, i) => <tr key={a.bucket} className="border-b border-border last:border-0"><td className="py-3"><span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: AGING_COLORS[i] }} />{a.bucket}</td><td className="py-3 text-right text-hushed">{a.count} invoices</td><td className="py-3 text-right tabular-nums">{formatMoney(a.amount, cur)}</td></tr>)}</tbody></table>)}</div>
          <p className="px-5 pb-4 text-xs text-hushed">All open invoices, by days past their due date today. The buckets add up to the total receivable.</p>
        </Box>
        <Box title="Outstanding balance trend"><div className="p-4"><TrendArea data={d.trend} /></div><p className="px-5 pb-4 text-xs text-hushed">Rebuilt from invoices, payments applied and approved adjustments as they stood at the end of each period. The last point is today.</p></Box>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Box title="Pending approvals" right={<Link to="/app/approvals" className="text-sm text-hushed hover:text-foreground">View all</Link>}>
          {d.approvals.length ? d.approvals.map((a) => (
            <div key={a.id} className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-0">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => nav("/app/approvals/" + a.id)}><div className="font-mono text-[0.75rem] text-hushed">{a.number} · {label(a.type)}</div><div className="flex gap-1 text-sm"><span className="truncate">{a.customer}</span><span className="shrink-0 tabular-nums">· {formatMoney(a.amount, a.currency)}</span></div></button>
              <Button size="icon" variant="outline" aria-label={`Approve ${a.number}`} disabled={decide.isPending} onClick={() => approve(a.id, a.number)}><Check className="size-4" /></Button>
            </div>)) : <div className="px-5 py-8 text-center text-sm text-hushed">Nothing waiting for you.</div>}
        </Box>
        <Box title="Investigations by status" right={<Link to="/app/investigations" className="text-sm text-hushed hover:text-foreground">Open</Link>}>
          {open ? <div className="p-4"><Donut data={byStatus} center={String(open)} h={170} /><ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">{byStatus.map((s) => <li key={s.name} className="flex items-center gap-1.5 capitalize"><span className="size-2 rounded-full" style={{ background: s.color }} />{s.name} · {s.value}</li>)}</ul></div> : <div className="px-5 py-8 text-center text-sm text-hushed">No open investigations.</div>}
        </Box>
        <Box title="Top exposure" right={<Link to="/app/investigations" className="text-sm text-hushed hover:text-foreground">All</Link>}>
          {d.top_exposure.length ? d.top_exposure.map((g) => <Link key={g.id} to={"/app/investigations/" + g.id} className="flex items-center gap-3 border-b border-border px-5 py-3 transition-colors last:border-0 hover:bg-muted/60"><div className="min-w-0 flex-1"><div className="truncate text-sm">{g.title}</div><div className="truncate font-mono text-[0.75rem] text-hushed">{g.number}</div></div><Pill tone={PRI[g.priority]}>{g.priority}</Pill><span className="tabular-nums text-sm">{formatMoney(g.exposure, g.currency)}</span></Link>) : <div className="px-5 py-8 text-center text-sm text-hushed">Nothing open.</div>}
        </Box>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <Box title="Overdue by customer"><div className="p-4">{d.overdue_by_customer.length ? <CustomerBars data={d.overdue_by_customer.slice(0, 8).map((c) => ({ name: c.customer, value: num(c.amount) }))} /> : <div className="py-16 text-center text-sm text-hushed">No invoices fell overdue in the {RANGE_NAME[range]}.</div>}</div><p className="px-5 pb-4 text-xs text-hushed">Invoices that fell due in the {RANGE_NAME[range]} and are still unpaid.</p></Box>
        <Box title="Recent activity" right={<Link to="/app/audit" className="text-sm text-hushed hover:text-foreground">Audit log</Link>}>
          {d.activity.map((a, i) => <div key={i} className="flex items-start gap-3 border-b border-border px-5 py-3 text-sm last:border-0"><span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: a.by ? COLORS.ink : COLORS.pink }} /><div className="min-w-0 flex-1"><div className="truncate">{label(a.action.replace(".", " "))}</div><div className="text-xs text-hushed">{a.by ?? "venn"} · {new Date(a.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div></div></div>)}
        </Box>
      </div>
    </>
  )
}

function Ar() {
  const q = useArDashboard(), nav = useNavigate()
  if (q.isPending) return <Loading />
  if (q.isError || !q.data) return <Box><Empty title="The dashboard could not load" sub="Reload the page. Nothing was changed." /></Box>
  const d = q.data, row = "flex w-full items-center gap-3 border-b border-border px-5 py-3 text-left last:border-0 hover:bg-muted/60"
  const none = (t: string) => <div className="px-5 py-8 text-center text-sm text-hushed">{t}</div>
  return (
    <>
      <Title sub={new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) + " · your queue"}>My work today</Title>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <Kpi dark label="Needs review" value={String(d.needs_review.count)} note="Suggested matches" to="/app/reconciliation" />
        <Kpi label="My investigations" value={String(d.my_investigations.length)} note={`${d.my_investigations.filter((g) => g.status === "ready_for_review").length} ready for review`} to="/app/investigations?filter=mine" />
        <Kpi label="Unmatched payments" value={String(d.kpis.unmatched_payments)} note="Money not yet applied" to="/app/payments?tab=unallocated" />
        <Kpi label="Overdue invoices" value={String(d.kpis.overdue_invoices)} note={formatMoney(d.kpis.overdue, d.currency)} to="/app/invoices?tab=overdue" />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Box title="Needs review" right={<Link to="/app/reconciliation" className="text-sm text-hushed hover:text-foreground">Open</Link>}>{d.needs_review.items.length ? d.needs_review.items.map((s) => <button key={s.id} type="button" onClick={() => nav("/app/reconciliation")} className={row}><div className="min-w-0 flex-1"><div className="truncate text-sm">{s.payer ?? "No payer name"}</div><div className="font-mono text-[0.75rem] text-hushed">{s.payment} · {s.rule}</div></div><span className="tabular-nums text-sm">{formatMoney(s.amount, s.currency)}</span></button>) : none("No suggestions waiting. Run reconciliation to look for matches.")}</Box>
        <Box title="Unmatched payments" right={<Link to="/app/payments?tab=unallocated" className="text-sm text-hushed hover:text-foreground">All</Link>}>{d.unmatched.length ? d.unmatched.map((p) => <Link key={p.id} to={"/app/payments/" + p.id} className={row}><div className="min-w-0 flex-1"><div className="truncate text-sm">{p.payer ?? "No payer name"}</div><div className="font-mono text-[0.75rem] text-hushed">{p.number}</div></div><span className="tabular-nums text-sm">{formatMoney(p.amount, p.currency)}</span></Link>) : none("Every payment is applied.")}</Box>
        <Box title="Invoices needing attention" right={<Link to="/app/invoices?tab=overdue" className="text-sm text-hushed hover:text-foreground">All</Link>}>{d.attention.length ? d.attention.map((i) => <Link key={i.id} to={"/app/invoices/" + i.id} className={row}><div className="min-w-0 flex-1"><div className="truncate text-sm">{i.customer}</div><div className="font-mono text-[0.75rem] text-hushed">{i.number} · {i.days_late} days late</div></div><span className="tabular-nums text-sm">{formatMoney(i.balance, i.currency)}</span></Link>) : none("Nothing is overdue.")}</Box>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Box title="My investigations" right={<Link to="/app/investigations" className="text-sm text-hushed hover:text-foreground">All</Link>}>{d.my_investigations.length ? d.my_investigations.map((g) => <Link key={g.id} to={"/app/investigations/" + g.id} className={row}><div className="min-w-0 flex-1"><div className="truncate text-sm">{g.title}</div><div className="font-mono text-[0.75rem] text-hushed">{g.number} · {label(g.status)}</div></div><span className="tabular-nums text-sm">{formatMoney(g.exposure, g.currency)}</span></Link>) : none("Nothing is assigned to you.")}</Box>
        <Box title="My requests" right={<Link to="/app/approvals" className="text-sm text-hushed hover:text-foreground">All</Link>}>{d.my_requests.length ? d.my_requests.map((a) => <Link key={a.id} to={"/app/approvals/" + a.id} className={row}><div className="min-w-0 flex-1"><div className="flex gap-1 text-sm"><span className="truncate">{label(a.type)}</span><span className="shrink-0 tabular-nums">· {formatMoney(a.amount, a.currency)}</span></div><div className="font-mono text-[0.75rem] text-hushed">{a.number}</div></div><Pill tone="amber">{label(a.status)}</Pill></Link>) : none("No open requests.")}</Box>
        <Box title="Last reconciliation run">{d.last_run ? <div className="p-5 text-sm"><div className="text-hushed">{new Date(d.last_run.at).toLocaleString("en-GB")}</div><div className="mt-3 grid grid-cols-2 gap-3"><div><div className="text-2xl tabular-nums">{d.last_run.counts.auto_applied ?? 0}</div><div className="text-xs text-hushed">applied automatically</div></div><div><div className="text-2xl tabular-nums">{d.last_run.counts.suggested ?? 0}</div><div className="text-xs text-hushed">suggestions</div></div></div></div> : none("No run yet.")}</Box>
      </div>
    </>
  )
}

export function RemoteDashboard() { return useRole() === "owner" ? <Owner /> : <Ar /> }

export function RecBars({ rows }: { rows: { label: string; auto: number; manual: number; review: number }[] }) {
  return <H h={260} label="Stacked bar chart of reconciliation matches over time"><BarChart data={rows} margin={{ left: -16, right: 8, top: 8 }}>{grid}<XAxis dataKey="label" {...axis} minTickGap={8} /><YAxis {...axis} allowDecimals={false} /><Tooltip cursor={{ fill: "rgba(0,0,0,.04)" }} content={<Tip money={false} />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
    <Bar dataKey="auto" name="Applied automatically" stackId="a" fill={COLORS.ink} /><Bar dataKey="manual" name="Confirmed by a person" stackId="a" fill={COLORS.pink} /><Bar dataKey="review" name="Left for review" stackId="a" fill={COLORS.grey} /></BarChart></H>
}

import { useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Download, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { A, balOf, download, lateOf, toCsv, totals, useApp, usd } from "./store"
import { ActivityChart, AgingChart, CustomerBars, ReconChart, RecoveredChart, ResolutionChart, TrendChart } from "./charts"
import { activityData, RANGE_NAME, reconData, recoveredData, resolutionData, scoped, trendData, useRange, type Range } from "./ranges"
import { Box, DataTable, Drawer, Field, Locked, Mono, NativeSelect, Pill, RangeSeg, Row, Seg, Title, Empty } from "./ui"
import { NotFound } from "./System"
import { useRole } from "./Shell"

type Rep = { slug: string; title: string; blurb: string; def: string; ownerOnly?: boolean }
const REPORTS: Rep[] = [
  { slug: "aging", title: "Receivables aging", blurb: "What is owed, by how late it is.", def: "Open invoice balances for invoices issued in the selected period, grouped by days past the due date as of 13 Nov. Balance = invoice total − active allocations − adjustments. Cancelled invoices are excluded.", ownerOnly: true },
  { slug: "ar-trend", title: "Outstanding balance trend", blurb: "Total and overdue receivables over time.", def: "Month-end open balance and the part past due. The latest point is live. Earlier points are month-end snapshots.", ownerOnly: true },
  { slug: "overdue-by-customer", title: "Overdue by customer", blurb: "Who owes the most past due.", def: "Unpaid balance on invoices that fell due in the selected period. An invoice is overdue when its due date is before 13 Nov and its balance is above zero.", ownerOnly: true },
  { slug: "recovered", title: "Verified recovered", blurb: "Revenue recovered and confirmed by a bank record.", def: "Amounts counted only when a bank payment is allocated to an invoice that had an open investigation or collection case. Claims in emails do not count.", ownerOnly: true },
  { slug: "reconciliation-performance", title: "Reconciliation performance", blurb: "How many payments match on their own.", def: "Weekly payments split into auto-applied exact matches, matches confirmed by a person and items left for review." },
  { slug: "investigation-resolution", title: "Investigation resolution time", blurb: "Median days from opening to resolved.", def: "Median calendar days between an investigation being opened and marked resolved, by type, over the selected period." },
  { slug: "collections-activity", title: "Collections activity", blurb: "Reminders sent and replies received.", def: "Count of reminders sent from venn and customer replies linked to the same case, by weekday this week." },
]

function Chart({ slug, h = 300, range }: { slug: string; h?: number; range: Range }) {
  const s = useApp(), t = totals(s), sc = scoped(s, range)
  return slug === "aging" ? <AgingChart data={sc.aging} h={h} /> : slug === "ar-trend" ? <TrendChart total={t.receivable} overdue={t.overdue} h={h} range={range} /> : slug === "overdue-by-customer" ? <CustomerBars data={h < 200 ? sc.byCust.slice(0, 5) : sc.byCust} h={h} /> : slug === "recovered" ? <RecoveredChart h={h} range={range} /> : slug === "reconciliation-performance" ? <ReconChart h={h} range={range} /> : slug === "investigation-resolution" ? <ResolutionChart h={h} range={range} /> : <ActivityChart h={h} range={range} />
}

export function Analytics() {
  const role = useRole(), [range] = useRange()
  return (
    <>
      <Title sub={role === "owner" ? "Six charts, each with its definition and export." : "Operational reports for your work."} right={<RangeSeg />}>Analytics</Title>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.filter((r) => role === "owner" || !r.ownerOnly).map((r) => (
          <Link key={r.slug} to={"/app/reports/" + r.slug} className="group block rounded-xl border-[0.8px] border-border bg-white p-4 transition-all duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-1 hover:shadow-[0_18px_40px_-26px_rgba(12,10,8,.4)]">
            <div className="text-lg">{r.title}</div><div className="text-sm text-hushed">{r.blurb}</div>
            <div className="pointer-events-none mt-3 h-[150px] opacity-90 transition-opacity group-hover:opacity-100"><Chart slug={r.slug} h={150} range={range} /></div>
          </Link>))}
      </div>
    </>
  )
}
export function Report() {
  const { slug } = useParams(), role = useRole(), s = useApp(), t = totals(s)
  const [cust, setCust] = useState(""), [range] = useRange()
  const r = REPORTS.find((x) => x.slug === slug)
  if (!r) return <NotFound what="report" back="/app/reports" />
  if (r.ownerOnly && role !== "owner") return <Locked what="This report" />
  const sc = scoped(s, range), open = sc.inv.filter((i) => !cust || i.cust === cust)
  let head: string[] = [], body: (string | number)[][] = []
  if (r.slug === "aging") { head = ["Invoice", "Customer", "Days late", "Balance"]; body = open.sort((a, b) => lateOf(b) - lateOf(a)).map((i) => [i.id, i.cust, lateOf(i), balOf(s, i)]) }
  else if (r.slug === "ar-trend") { head = ["Period", "Outstanding", "Overdue"]; body = trendData(range, t.receivable, t.overdue).map((x) => [x.m, x.total, x.overdue]) }
  else if (r.slug === "overdue-by-customer") { head = ["Customer", "Overdue invoices", "Overdue balance"]; body = s.customers.map((c) => { const x = sc.due.filter((i) => i.cust === c.name); return [c.name, x.length, x.reduce((n, i) => n + balOf(s, i), 0)] as (string | number)[] }).filter((x) => +x[1] > 0).sort((a, b) => +b[2] - +a[2]) }
  else if (r.slug === "recovered") { head = ["Period", "Verified recovered"]; body = recoveredData(range).map((x) => [x.m, x.v]) }
  else if (r.slug === "reconciliation-performance") { head = ["Period", "Auto-applied", "Confirmed by a person", "Left for review"]; body = reconData(range).map((x) => [x.w, x.auto, x.manual, x.review]) }
  else if (r.slug === "investigation-resolution") { head = ["Type", "Median days to resolve"]; body = resolutionData(range).map((x) => [x.name, x.days]) }
  else { head = ["Period", "Reminders sent", "Replies"]; body = activityData(range).map((x) => [x.d, x.sent, x.replied]) }
  const money = (c: string) => /balance|overdue$|outstanding|recovered/i.test(c) && !/invoices/i.test(c)
  return (
    <>
      <Title back={["/app/reports", "Analytics"]} sub={r.blurb} right={<><RangeSeg /><Button variant="outline" onClick={() => { download(r.slug + "-" + range.toLowerCase() + ".csv", toCsv([head, ...body])); toast.success("CSV exported") }}><Download className="size-4" />Export CSV</Button></>}>{r.title}</Title>
      {(r.slug === "aging" || r.slug === "overdue-by-customer") && <div className="mb-4 w-60"><Field label="Customer"><NativeSelect value={cust} onChange={(e) => setCust(e.target.value)}><option value="">All customers</option>{s.customers.map((c) => <option key={c.id}>{c.name}</option>)}</NativeSelect></Field></div>}
      <Box title={"Chart · " + RANGE_NAME[range]} pad><Chart slug={r.slug} range={range} /></Box>
      <Box className="mt-3" title="How this is calculated" pad><p className="text-sm text-hushed">{r.def}</p></Box>
      <Box className="mt-3" title="Data"><DataTable rows={body} id={(x) => String(x[0]) + String(x[1])} empty={<Empty title="No data for this filter" />} cols={head.map((h, i) => ({ key: h, label: h, right: i > 0, render: (x: (string | number)[]) => (typeof x[i] === "number" && money(h) ? usd(x[i] as number, 0) : x[i]) }))} /></Box>
    </>
  )
}

export function Documents() {
  const s = useApp(), file = useRef<HTMLInputElement>(null)
  const [pv, setPv] = useState<string | null>(null), [link, setLink] = useState("")
  const [type, setType] = useState("all")
  const d = s.docs.find((x) => x.id === pv)
  const types = ["all", ...new Set(s.docs.map((x) => x.type))]
  const up = (f?: File) => { if (!f) return; if (f.size > 5e6) return toast.error("Choose a file under 5 MB."); A.addDoc(f.name, `${Math.max(1, Math.round(f.size / 1024))} KB`, link || "Unlinked") }
  return (
    <>
      <Title sub={`${s.docs.length} documents`} right={<><input ref={file} type="file" className="sr-only" aria-label="Upload document" onChange={(e) => { up(e.target.files?.[0]); e.target.value = "" }} /><Button onClick={() => file.current?.click()}><Upload className="size-4" />Upload</Button></>}>Documents</Title>
      <div className="mb-4 flex flex-wrap items-end gap-3"><Seg className="!mb-0" items={types} value={type} onChange={setType} /><div className="w-60"><NativeSelect aria-label="Link uploads to" value={link} onChange={(e) => setLink(e.target.value)}><option value="">Link next upload to…</option>{s.invoices.map((i) => <option key={i.id}>{i.id}</option>)}{s.invgs.map((g) => <option key={g.id}>{g.id}</option>)}</NativeSelect></div></div>
      <Box><DataTable rows={s.docs.filter((x) => type === "all" || x.type === type)} id={(x) => x.id} onRow={(x) => setPv(x.id)} search={(x) => x.name + x.type + x.link}
        cols={[{ key: "n", label: "Name", sort: (x) => x.name, render: (x) => x.name }, { key: "t", label: "Type", hide: "md", render: (x) => x.type }, { key: "l", label: "Linked to", render: (x) => <Mono>{x.link}</Mono> }, { key: "by", label: "Uploaded by", hide: "lg", render: (x) => x.by }, { key: "st", label: "Status", render: (x) => <Pill tone={x.status === "needs review" ? "amber" : x.status === "extracted" || x.status === "linked" ? "green" : "grey"}>{x.status}</Pill> }]} /></Box>
      <Drawer open={!!d} onOpenChange={(o) => !o && setPv(null)} title={d?.name ?? ""} desc={d?.type}>
        {d && <><div className="mt-3 h-52 rounded-lg bg-muted p-4 text-sm text-hushed">Preview of {d.name}. {d.size}</div><div className="mt-4"><Row k="Linked to">{d.link}</Row><Row k="Uploaded by">{d.by}</Row><Row k="Status">{d.status}</Row></div></>}
      </Drawer>
    </>
  )
}

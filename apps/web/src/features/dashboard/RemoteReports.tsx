import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { AgingChart, CustomerBars } from "@/components/app/charts"
import { Box, DataTable, Empty, Field, NativeSelect, RangeSeg, Title } from "@/components/app/ui"
import { NotFound } from "@/components/app/System"
import { RANGE_NAME, useRange } from "@/components/app/ranges"
import { useCustomers } from "@/features/ledger/api"
import { errorMessage } from "@/lib/errors"
import { formatMoney } from "@/lib/money"
import { RecBars, TrendArea } from "./RemoteDashboard"
import { exportReport, useReport, useReports, type ReportData } from "./api"

const Loading = () => <div role="status" aria-busy="true" className="h-48 animate-pulse rounded-xl bg-muted" />
const NO_CHART = new Set(["recovered", "investigation-resolution"])

function Chart({ rep, h }: { rep: ReportData; h?: number }) {
  const rows = rep.rows
  if (!rows.length) return <div className="flex h-full items-center justify-center text-sm text-hushed">No data for this range.</div>
  if (rep.slug === "aging") return <AgingChart h={h} data={rows.map((r): [string, number] => [String(r.bucket), Number(r.amount)])} />
  if (rep.slug === "ar-trend") return <TrendArea h={h} data={rows.map((r) => ({ date: "", label: String(r.label), total: String(r.total), overdue: String(r.overdue) }))} />
  if (rep.slug === "overdue-by-customer") return <CustomerBars h={h} data={rows.slice(0, 8).map((r) => ({ name: String(r.customer), value: Number(r.amount) }))} />
  if (rep.slug === "reconciliation-performance") return <RecBars rows={rows as unknown as { label: string; auto: number; manual: number; review: number }[]} />
  return <div className="flex h-full items-center justify-center px-6 text-center text-sm text-hushed">This report is a table. Open it to read the rows.</div>
}

function Card({ slug, title, definition }: { slug: string; title: string; definition: string }) {
  const [range] = useRange(), q = useReport(slug, range, "")
  return (
    <Link to={"/app/reports/" + slug} className="group block rounded-xl border-[0.8px] border-border bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-24px_rgba(12,10,8,.5)]">
      <div className="text-lg">{title}</div><div className="line-clamp-2 text-sm text-hushed">{definition}</div>
      <div className="pointer-events-none mt-3 h-[150px]">{q.data && !NO_CHART.has(slug) ? <Chart rep={q.data} h={150} /> : <div className="h-full animate-pulse rounded-lg bg-muted/60" />}</div>
    </Link>
  )
}

export function RemoteAnalytics() {
  const q = useReports()
  return (
    <>
      <Title sub="Every figure is calculated from your records. The definition is on each report." right={<RangeSeg />}>Analytics</Title>
      {q.isPending ? <Loading /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(q.data ?? []).map((r) => <Card key={r.slug} {...r} />)}</div>}
    </>
  )
}

export function RemoteReport() {
  const { slug = "" } = useParams(), [range] = useRange(), [cust, setCust] = useState(""), reports = useReports(), q = useReport(slug, range, cust), customers = useCustomers({ limit: 100, sort: "name" })
  if (reports.isPending) return <Loading />
  const info = reports.data?.find((r) => r.slug === slug)
  if (!info) return <NotFound what="report" back="/app/reports" />
  const rep = q.data
  return (
    <>
      <Title back={["/app/reports", "Analytics"]} sub={info.definition} right={<><RangeSeg /><Button variant="outline" onClick={() => void exportReport(slug, range, cust).then(() => toast.success("CSV exported")).catch((e) => toast.error(errorMessage(e)))}>Export CSV</Button></>}>{info.title}</Title>
      {(slug === "aging" || slug === "overdue-by-customer") && <div className="mb-4 w-60"><Field label="Customer"><NativeSelect value={cust} onChange={(e) => setCust(e.target.value)}><option value="">All customers</option>{(customers.data?.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field></div>}
      {!rep ? <Loading /> : <>
        {!NO_CHART.has(slug) && <Box title={"Chart · " + RANGE_NAME[range]} pad><div className="h-[280px]"><Chart rep={rep} h={280} /></div></Box>}
        {rep.total !== undefined && <Box className="mt-3" title="Total" pad><div className="text-3xl tabular-nums">{formatMoney(rep.total, rep.currency)}</div></Box>}
        <Box className="mt-3" title="How this is calculated" pad><p className="text-sm text-hushed">{rep.definition}</p></Box>
        <Box className="mt-3" title="Data"><DataTable rows={rep.rows} id={(r) => JSON.stringify(r)} empty={<Empty title="No data for this filter" />} pageSize={25}
          cols={rep.columns.map((c, i) => ({ key: c.key, label: c.label, right: c.right || c.money || i > 0 && typeof rep.rows[0]?.[c.key] === "number", render: (r: Record<string, string | number>) => c.money ? formatMoney(String(r[c.key]), rep.currency) : String(r[c.key] ?? "") }))} /></Box>
      </>}
    </>
  )
}

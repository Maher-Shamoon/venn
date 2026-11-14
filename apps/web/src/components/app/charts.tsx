import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { COLORS } from "./ui"
import { usd } from "./store"
import { activityData, reconData, recoveredData, resolutionData, trendData, type Range } from "./ranges"

const axis = { stroke: "#8a8582", fontSize: 12, tickLine: false, axisLine: false } as const
const grid = <CartesianGrid stroke="rgba(33,33,33,.08)" strokeDasharray="3 4" vertical={false} />
const short = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k` : `$${n}`)

function Tip({ active, payload, label, money = true }: { active?: boolean; payload?: { name: string; value: number; color?: string; fill?: string }[]; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 text-xs shadow-lg">
      {label && <div className="mb-1 text-hushed">{label}</div>}
      {payload.map((p) => <div key={p.name} className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: p.color ?? p.fill }} /><span className="text-hushed">{p.name}</span><span className="ml-auto pl-4 tabular-nums">{money ? usd(p.value, 0) : p.value}</span></div>)}
    </div>
  )
}
const H = ({ h = 260, children }: { h?: number; children: React.ReactElement }) => <div style={{ height: h }} className="w-full" role="img"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>

export const AGING_COLORS = ["#d2cecb", "#f9a8d4", "#f472b6", "#1a1919"]
export function AgingChart({ data, h }: { data: [string, number][]; h?: number }) {
  const rows = data.map(([name, value]) => ({ name, value }))
  return <H h={h}><BarChart data={rows} margin={{ left: -8, right: 8, top: 8 }}>{grid}<XAxis dataKey="name" {...axis} /><YAxis {...axis} tickFormatter={short} /><Tooltip cursor={{ fill: "rgba(0,0,0,.04)" }} content={<Tip />} /><Bar dataKey="value" name="Balance" radius={[6, 6, 0, 0]} maxBarSize={64}>{rows.map((_, i) => <Cell key={i} fill={AGING_COLORS[i]} />)}</Bar></BarChart></H>
}

export function TrendChart({ total, overdue, h, range }: { total: number; overdue: number; h?: number; range: Range }) {
  return (
    <H h={h}><AreaChart data={trendData(range, total, overdue)} margin={{ left: -8, right: 8, top: 8 }}>
      <defs><linearGradient id="gt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.pink} stopOpacity={0.7} /><stop offset="100%" stopColor={COLORS.pink} stopOpacity={0.05} /></linearGradient></defs>
      {grid}<XAxis dataKey="m" {...axis} minTickGap={16} /><YAxis {...axis} tickFormatter={short} /><Tooltip content={<Tip />} />
      <Area type="monotone" dataKey="total" name="Outstanding" stroke={COLORS.deep} strokeWidth={2} fill="url(#gt)" />
      <Area type="monotone" dataKey="overdue" name="Overdue" stroke={COLORS.ink} strokeWidth={2} fill="none" />
    </AreaChart></H>
  )
}

export function CustomerBars({ data, h = 280 }: { data: { name: string; value: number }[]; h?: number }) {
  return <H h={h}><BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>{grid}<XAxis type="number" {...axis} tickFormatter={short} /><YAxis type="category" dataKey="name" {...axis} width={132} /><Tooltip cursor={{ fill: "rgba(0,0,0,.04)" }} content={<Tip />} /><Bar dataKey="value" name="Overdue" fill={COLORS.deep} radius={[0, 6, 6, 0]} maxBarSize={22} /></BarChart></H>
}

export function Donut({ data, h = 220, center }: { data: { name: string; value: number; color: string }[]; h?: number; center?: string }) {
  return (
    <div className="relative"><H h={h}><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="none">{data.map((d) => <Cell key={d.name} fill={d.color} />)}</Pie><Tooltip content={<Tip money={false} />} /></PieChart></H>
      {center && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center"><div><div className="text-[30px] leading-8 tracking-[-0.02em]">{center}</div><div className="text-xs text-hushed">open</div></div></div>}
    </div>
  )
}

export function ReconChart({ h, range }: { h?: number; range: Range }) {
  return <H h={h}><BarChart data={reconData(range)} margin={{ left: -16, right: 8, top: 8 }}>{grid}<XAxis dataKey="w" {...axis} minTickGap={8} /><YAxis {...axis} /><Tooltip cursor={{ fill: "rgba(0,0,0,.04)" }} content={<Tip money={false} />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
    <Bar dataKey="auto" name="Auto-applied" stackId="a" fill={COLORS.ink} maxBarSize={36} /><Bar dataKey="manual" name="Confirmed by a person" stackId="a" fill={COLORS.pink} /><Bar dataKey="review" name="Left for review" stackId="a" fill={COLORS.grey} radius={[6, 6, 0, 0]} /></BarChart></H>
}

export function RecoveredChart({ h, range }: { h?: number; range: Range }) {
  return <H h={h}><ComposedChart data={recoveredData(range)} margin={{ left: -8, right: 8, top: 8 }}>{grid}<XAxis dataKey="m" {...axis} minTickGap={8} /><YAxis {...axis} tickFormatter={short} /><Tooltip cursor={{ fill: "rgba(0,0,0,.04)" }} content={<Tip />} /><Bar dataKey="v" name="Verified recovered" fill={COLORS.pink} radius={[6, 6, 0, 0]} maxBarSize={40} /><Line type="monotone" dataKey="t" name="Target" stroke={COLORS.ink} strokeDasharray="4 4" dot={false} strokeWidth={2} /></ComposedChart></H>
}

export function ResolutionChart({ h, range }: { h?: number; range: Range }) {
  return <H h={h}><BarChart data={resolutionData(range)} margin={{ left: -16, right: 8, top: 8 }}>{grid}<XAxis dataKey="name" {...axis} interval={0} fontSize={11} /><YAxis {...axis} /><Tooltip cursor={{ fill: "rgba(0,0,0,.04)" }} content={<Tip money={false} />} /><Bar dataKey="days" name="Median days to resolve" fill={COLORS.deep} radius={[6, 6, 0, 0]} maxBarSize={44} /></BarChart></H>
}

export function ActivityChart({ h, range }: { h?: number; range: Range }) {
  return <H h={h}><BarChart data={activityData(range)} margin={{ left: -16, right: 8, top: 8 }}>{grid}<XAxis dataKey="d" {...axis} minTickGap={8} /><YAxis {...axis} /><Tooltip cursor={{ fill: "rgba(0,0,0,.04)" }} content={<Tip money={false} />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="sent" name="Reminders sent" fill={COLORS.ink} radius={[6, 6, 0, 0]} maxBarSize={28} /><Bar dataKey="replied" name="Replies" fill={COLORS.pink} radius={[6, 6, 0, 0]} maxBarSize={28} /></BarChart></H>
}

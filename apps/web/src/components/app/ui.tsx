import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowDown, ArrowLeft, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { Tone } from "./store"
import { RANGES, useRange } from "./ranges"

export type { Tone }
export const COLORS = { pink: "#f9a8d4", deep: "#f472b6", ink: "#1a1919", grey: "#d2cecb", blue: "#5683d2", orange: "#e96516", green: "#2f9e44", amber: "#e0b13a" }

export const Title = ({ children, sub, right, back }: { children: ReactNode; sub?: ReactNode; right?: ReactNode; back?: [string, string] }) => (
  <div className="mb-8">
    {back && <Link to={back[0]} className="mb-3 inline-flex items-center gap-1.5 text-sm text-hushed hover:text-foreground"><ArrowLeft className="size-4" />{back[1]}</Link>}
    <div className="flex flex-wrap items-end gap-4">
      <div className="min-w-0"><h1 className="text-[30px] leading-9 tracking-[-0.015em] md:text-[40px] md:leading-[44px]">{children}</h1>{sub && <p className="mt-1 text-hushed">{sub}</p>}</div>
      <div className="ml-auto flex flex-wrap gap-2">{right}</div>
    </div>
  </div>
)

export function Spark({ data, color = COLORS.deep, className }: { data: number[]; color?: string; className?: string }) {
  const max = Math.max(...data), min = Math.min(...data), w = 100, h = 28
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 3 - ((v - min) / Math.max(1, max - min)) * (h - 6)}`).join(" ")
  return <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-7 w-full", className)} aria-hidden="true"><polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" /></svg>
}

export const Kpi = ({ label, value, note, to, dark, spark, delta }: { label: string; value: string; note?: string; to?: string; dark?: boolean; spark?: number[]; delta?: { v: string; good: boolean; up: boolean } }) => {
  const cls = cn("group block rounded-xl border-[0.8px] p-5 transition-all duration-300 ease-[var(--ease-out-soft)]", dark ? "border-transparent bg-[#1a1919] text-white" : "border-border bg-muted hover:-translate-y-0.5 hover:bg-[#efece8]", to && "cursor-pointer")
  const inner = (
    <>
      <div className={cn("flex items-center justify-between text-sm", dark ? "text-white/60" : "text-hushed")}>{label}{delta && <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 text-xs", delta.good ? "bg-[#e3f6e6] text-[#17692b]" : "bg-[#fbe9dd] text-[#a24a10]")}>{delta.up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}{delta.v}</span>}</div>
      <div className={cn("tick mt-2 text-[30px] leading-9 tracking-[-0.02em] md:text-[34px] md:leading-10", dark && "text-lime")}>{value}</div>
      {spark && <Spark data={spark} color={dark ? COLORS.pink : COLORS.deep} className="mt-2" />}
      {note && <div className={cn("mt-1 text-sm", dark ? "text-white/60" : "text-hushed")}>{note}</div>}
    </>
  )
  return to ? <Link to={to} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>
}

const TONE: Record<Tone, string> = { green: "bg-[#e3f6e6] text-[#17692b]", amber: "bg-[#fff1c7] text-[#8a5a00]", blue: "bg-[#e4ebf6] text-[#3a5fa8]", grey: "bg-muted text-hushed", red: "bg-[#fbe9dd] text-[#a24a10]" }
export const Pill = ({ tone, children }: { tone: Tone; children: ReactNode }) => <Badge variant="secondary" className={`rounded-full px-2.5 font-normal whitespace-nowrap ${TONE[tone]}`}>{children}</Badge>
export const Box = ({ title, children, right, className, pad }: { title?: ReactNode; children: ReactNode; right?: ReactNode; className?: string; pad?: boolean }) => (
  <section className={cn("min-w-0 rounded-xl border-[0.8px] border-border bg-white", className)}>
    {title && <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-4"><h2 className="flex-1 text-lg">{title}</h2>{right}</div>}
    <div className={pad ? "p-5" : undefined}>{children}</div>
  </section>
)

/** Pill segmented control, same look as the landing page tabs. */
export function Seg<T extends string>({ items, value, onChange, className }: { items: readonly (T | { v: T; label: string; n?: number })[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cn("mb-4 inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1 [scrollbar-width:none]", className)}>
      {items.map((it) => { const v = typeof it === "string" ? it : it.v, label = typeof it === "string" ? it : it.label, n = typeof it === "string" ? undefined : it.n
        return <button key={v} role="tab" type="button" aria-selected={value === v} onClick={() => onChange(v)} className={cn("whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm capitalize transition-colors duration-300", value === v ? "bg-foreground text-white" : "text-hushed hover:text-foreground")}>{label}{n !== undefined && <span className={cn("ml-1.5 text-xs", value === v ? "text-white/60" : "text-hushed")}>{n}</span>}</button> })}
    </div>
  )
}
export const Chips = Seg
/** Time range switch for charts. The choice is shared across the dashboard, analytics and reports. */
export function RangeSeg() { const [r, set] = useRange(); return <Seg className="!mb-0" items={RANGES} value={r} onChange={set} /> }

export const Locked = ({ what }: { what: string }) => (
  <div className="rounded-xl bg-muted p-10 text-center"><div className="text-2xl tracking-[-0.01em]">{what} is for owners.</div><p className="mt-2 text-hushed">Your role is AR specialist. Switch the view in the top bar to see this screen. The server enforces this, not just the interface.</p></div>
)
export const Empty = ({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) => (
  <div className="px-6 py-14 text-center"><div className="text-xl">{title}</div>{sub && <p className="mx-auto mt-1 max-w-[420px] text-hushed">{sub}</p>}{action && <div className="mt-4">{action}</div>}</div>
)
export const Field = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) => (
  <label className="block text-sm"><span className="mb-1.5 block">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-hushed">{hint}</span>}</label>
)
export const NativeSelect = ({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cn("h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition-colors focus:border-foreground", className)} />
export const TextArea = ({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cn("min-h-[90px] w-full rounded-lg border border-input bg-white px-2.5 py-2 text-sm outline-none transition-colors focus:border-foreground", className)} />

export function Modal({ open, onOpenChange, title, desc, children, footer }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; desc?: string; children?: ReactNode; footer?: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader><DialogTitle className="text-xl font-normal">{title}</DialogTitle>{desc && <DialogDescription>{desc}</DialogDescription>}</DialogHeader>
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}
export function Drawer({ open, onOpenChange, title, desc, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; desc?: string; children?: ReactNode }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[480px]">
        <SheetHeader><SheetTitle className="text-xl font-normal">{title}</SheetTitle>{desc && <SheetDescription>{desc}</SheetDescription>}</SheetHeader>
        <div className="px-4 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
  )
}

export type Column<T> = { key: string; label: string; render: (r: T) => ReactNode; sort?: (r: T) => string | number; right?: boolean; hide?: "md" | "lg"; cls?: string }
export function DataTable<T>({ rows, cols, id, onRow, search, pageSize = 10, empty, toolbar, defaultSort }: { rows: T[]; cols: Column<T>[]; id: (r: T) => string; onRow?: (r: T) => void; search?: (r: T) => string; pageSize?: number; empty?: ReactNode; toolbar?: ReactNode; defaultSort?: [string, 1 | -1] }) {
  const [q, setQ] = useState("")
  const [sort, setSort] = useState<[string, 1 | -1] | null>(defaultSort ?? null)
  const [page, setPage] = useState(0)
  const view = useMemo(() => {
    let r = rows
    if (q && search) r = r.filter((x) => search(x).toLowerCase().includes(q.toLowerCase()))
    const c = sort && cols.find((x) => x.key === sort[0])
    if (c?.sort) { const f = c.sort, d = sort![1]; r = [...r].sort((a, b) => (f(a) > f(b) ? d : f(a) < f(b) ? -d : 0)) }
    return r
  }, [rows, q, sort, cols, search])
  const pages = Math.max(1, Math.ceil(view.length / pageSize)), pg = Math.min(page, pages - 1), slice = view.slice(pg * pageSize, pg * pageSize + pageSize)
  const hide = (c: Column<T>) => (c.hide === "md" ? "hidden md:table-cell" : c.hide === "lg" ? "hidden lg:table-cell" : "")
  return (
    <div>
      {(search || toolbar) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          {search && <div className="relative min-w-[200px] flex-1 sm:max-w-[320px]"><Search className="absolute left-2.5 top-2.5 size-4 text-hushed" /><Input aria-label="Search table" value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder="Search" className="h-9 pl-8" /></div>}
          <div className="ml-auto flex flex-wrap items-center gap-2">{toolbar}</div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm md:min-w-0">
          <thead className="border-b border-border bg-muted/60 text-xs text-hushed"><tr>{cols.map((c) => (
            <th key={c.key} className={cn("whitespace-nowrap px-4 py-2.5 font-normal", c.right && "text-right", hide(c))} aria-sort={sort?.[0] === c.key ? (sort[1] === 1 ? "ascending" : "descending") : undefined}>
              {c.sort ? <button type="button" onClick={() => setSort(sort?.[0] === c.key ? [c.key, (sort[1] * -1) as 1 | -1] : [c.key, 1])} className="inline-flex items-center gap-1 hover:text-foreground">{c.label}{sort?.[0] === c.key && (sort[1] === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}</button> : c.label}
            </th>))}</tr></thead>
          <tbody>{slice.map((r) => (
            <tr key={id(r)} onClick={onRow ? () => onRow(r) : undefined} className={cn("border-b border-border last:border-0 transition-colors duration-200", onRow && "cursor-pointer hover:bg-muted/60")}>
              {cols.map((c) => <td key={c.key} className={cn("px-4 py-3 align-middle", c.right && "text-right tabular-nums", hide(c), c.cls)}>{c.render(r)}</td>)}
            </tr>))}</tbody>
        </table>
      </div>
      {!view.length && (empty ?? <Empty title="Nothing here" sub={q ? "No rows match your search." : undefined} />)}
      {view.length > pageSize && (
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-sm text-hushed">
          <span>{pg * pageSize + 1}–{Math.min(view.length, pg * pageSize + pageSize)} of {view.length}</span>
          <span className="flex gap-1"><Button variant="outline" size="icon" aria-label="Previous page" disabled={pg === 0} onClick={() => setPage(pg - 1)}><ChevronLeft className="size-4" /></Button><Button variant="outline" size="icon" aria-label="Next page" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}><ChevronRight className="size-4" /></Button></span>
        </div>
      )}
    </div>
  )
}

export const Row = ({ k, children }: { k: string; children: ReactNode }) => <div className="flex items-start justify-between gap-4 border-b border-border py-2.5 text-sm last:border-0"><span className="text-hushed">{k}</span><span className="text-right">{children}</span></div>
export const Mono = ({ children }: { children: ReactNode }) => <span className="font-mono text-xs">{children}</span>

/* ------------------------------------------------------------------ loading */
const seen = new Set<string>()
const Bone = Skeleton
export function PageSkeleton({ path }: { path: string }) {
  const parts = path.split("/").filter(Boolean), home = parts.length === 1, detail = parts.length >= 3
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="animate-in fade-in duration-300">
      <span className="sr-only">Loading</span>
      <div className="mb-6 flex items-end justify-between gap-4"><div className="space-y-2"><Bone className="h-8 w-56" /><Bone className="h-4 w-72 max-w-full" /></div><Bone className="hidden h-9 w-44 rounded-full sm:block" /></div>
      {home ? <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Bone key={i} className="h-[132px] rounded-xl" />)}</div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2"><Bone className="h-[340px] rounded-xl" /><Bone className="h-[340px] rounded-xl" /></div>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">{[0, 1, 2].map((i) => <Bone key={i} className="h-[260px] rounded-xl" />)}</div>
      </> : detail ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]"><div className="space-y-4"><Bone className="h-24 rounded-xl" /><Bone className="h-64 rounded-xl" /><Bone className="h-40 rounded-xl" /></div><Bone className="h-80 rounded-xl" /></div>
      ) : <>
        <div className="mb-4 flex gap-2"><Bone className="h-9 w-28 rounded-full" /><Bone className="h-9 w-28 rounded-full" /><Bone className="h-9 w-28 rounded-full" /></div>
        <div className="rounded-xl border-[0.8px] border-border bg-white p-4"><Bone className="mb-4 h-9 w-64" />{Array.from({ length: 8 }, (_, i) => <div key={i} className="flex items-center gap-4 border-t border-border py-3.5"><Bone className="h-4 w-24" /><Bone className="h-4 flex-1" /><Bone className="hidden h-4 w-24 md:block" /><Bone className="h-6 w-20 rounded-full" /></div>)}</div>
      </>}
    </div>
  )
}
/** Shows a page-shaped skeleton the first time a screen is opened, then renders it straight away on every later visit. */
export function Loading({ path, children }: { path: string; children: ReactNode }) {
  const first = !seen.has(path), [wait, setWait] = useState(first)
  useEffect(() => { if (!first) return; const t = setTimeout(() => { seen.add(path); setWait(false) }, 520); return () => clearTimeout(t) }, [first, path])
  return wait ? <PageSkeleton path={path} /> : <>{children}</>
}

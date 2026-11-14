import { useSyncExternalStore } from "react"
import { balOf, lateOf, TODAY, type Inv, type State } from "./store"

/** One time range shared by every chart in the app, so the dashboard, analytics and reports always agree. */
export type Range = "7D" | "30D" | "90D" | "12M"
export const RANGES = [{ v: "7D", label: "7 days" }, { v: "30D", label: "30 days" }, { v: "90D", label: "90 days" }, { v: "12M", label: "12 months" }] as const
export const RANGE_NAME: Record<Range, string> = { "7D": "last 7 days", "30D": "last 30 days", "90D": "last 90 days", "12M": "last 12 months" }
const DAYS: Record<Range, number> = { "7D": 7, "30D": 30, "90D": 90, "12M": 365 }

let cur: Range = "30D"
const subs = new Set<() => void>()
const set = (r: Range) => { cur = r; subs.forEach((f) => f()) }
export const useRange = (): [Range, (r: Range) => void] => [useSyncExternalStore((f) => (subs.add(f), () => void subs.delete(f)), () => cur), set]

const MON = ["Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"]
const WK = ["17 Aug", "24 Aug", "31 Aug", "7 Sep", "14 Sep", "21 Sep", "28 Sep", "5 Oct", "12 Oct", "19 Oct", "26 Oct", "2 Nov", "9 Nov"]
const DAY = ["Sat 7", "Sun 8", "Mon 9", "Tue 10", "Wed 11", "Thu 12", "Fri 13"]
/** Daily for 7 days, weekly for 30 and 90 (the 30 day view is the last five weeks of the 90 day one), monthly for 12 months. */
const labels = (r: Range) => (r === "7D" ? DAY : r === "30D" ? WK.slice(-5) : r === "90D" ? WK : MON)
const cut = <T,>(r: Range, day: T[], wk: T[], mon: T[]) => (r === "7D" ? day : r === "30D" ? wk.slice(-5) : r === "90D" ? wk : mon)

export const reconData = (r: Range) => {
  const a = cut(r, [0, 0, 5, 4, 6, 5, 4], [10, 12, 11, 13, 15, 14, 18, 16, 22, 25, 21, 27, 24], [30, 33, 32, 37, 41, 44, 46, 49, 52, 60, 84, 51])
  const m = cut(r, [0, 0, 1, 2, 1, 1, 1], [3, 3, 4, 4, 3, 3, 4, 6, 5, 4, 7, 5, 6], [8, 9, 8, 10, 11, 11, 12, 12, 13, 14, 22, 11])
  const v = cut(r, [0, 0, 1, 0, 1, 0, 1], [2, 2, 2, 1, 2, 1, 2, 2, 3, 1, 2, 3, 3], [5, 5, 4, 5, 6, 6, 6, 6, 7, 6, 8, 6])
  return labels(r).map((w, i) => ({ w, auto: a[i], manual: m[i], review: v[i] }))
}
export const recoveredData = (r: Range) => {
  const v = cut(r, [0, 0, 700, 900, 800, 1000, 300], [1200, 1300, 1500, 1900, 2200, 2400, 2600, 2700, 3000, 3300, 3500, 3700, 3700], [1800, 2400, 2100, 3100, 3600, 3900, 4200, 6800, 5100, 9400, 12300, 7600])
  return labels(r).map((m, i) => ({ m, v: v[i], t: Math.round(v[i] * 1.25) }))
}
export const activityData = (r: Range) => {
  const s = cut(r, [0, 0, 6, 9, 7, 11, 8], [18, 20, 22, 21, 25, 24, 27, 26, 29, 34, 31, 37, 41], [48, 52, 50, 60, 66, 72, 80, 88, 92, 97, 120, 78])
  const p = cut(r, [0, 0, 2, 4, 3, 5, 2], [5, 6, 7, 7, 8, 8, 9, 9, 10, 13, 11, 14, 16], [14, 16, 15, 19, 21, 23, 26, 28, 29, 32, 43, 30])
  return labels(r).map((d, i) => ({ d, sent: s[i], replied: p[i] }))
}
const RES = { "7D": [3.8, 1.9, 5.9, 8.2, 1.5], "30D": [4, 2, 6.1, 9, 1.7], "90D": [4.2, 2.1, 6.5, 9.3, 1.8], "12M": [4.9, 2.4, 7.2, 10.1, 2.1] }
export const resolutionData = (r: Range) => ["Short payment", "Duplicate", "Claimed payment", "Dispute", "Unapplied"].map((name, i) => ({ name, days: RES[r][i] }))

const TOTAL = [58, 62, 60, 67, 72, 70, 78, 84, 91, 98, 104], OVER = [9, 11, 10, 14, 15, 13, 18, 21, 24, 27, 31]
const dayLabel = (d: number) => { const t = new Date(Date.UTC(2026, 10, 13 - d)); return `${t.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][t.getUTCMonth()]}` }
/** Month-end snapshots are interpolated for the shorter ranges. The last point is always the live figure. */
const at = (arr: number[], live: number, d: number) => {
  if (d <= 0) return live
  const x = Math.max(0, 11 - d / 30), k = Math.floor(x), lo = k > 10 ? live : arr[k] * 1000, hi = k + 1 > 10 ? live : arr[k + 1] * 1000
  return Math.round((lo + (hi - lo) * (x - k)) * (1 + 0.012 * Math.sin(d * 1.9)))
}
export const trendData = (r: Range, total: number, overdue: number) => {
  if (r === "12M") return MON.map((m, i) => ({ m, total: i < 11 ? TOTAL[i] * 1000 : Math.round(total), overdue: i < 11 ? OVER[i] * 1000 : Math.round(overdue) }))
  const n = r === "7D" ? 7 : r === "30D" ? 10 : 13, step = r === "7D" ? 1 : r === "30D" ? 3 : 7
  return Array.from({ length: n }, (_, i) => { const d = (n - 1 - i) * step; return { m: dayLabel(d), total: at(TOTAL, total, d), overdue: at(OVER, overdue, d) } })
}

/** Aging is today's balances for invoices issued inside the range. Overdue-by-customer is the balance on invoices that fell due inside the range. */
const within = (d: string, r: Range) => (+TODAY - +new Date(d + "T00:00:00Z")) / 864e5 <= DAYS[r]
export const issuedIn = (i: Inv, r: Range) => within(i.issued, r)
export const scoped = (s: State, r: Range) => {
  const inv = s.invoices.filter((i) => issuedIn(i, r) && balOf(s, i) > 0)
  const sum = (a: number, b: number) => inv.filter((i) => lateOf(i) >= a && lateOf(i) <= b).reduce((n, i) => n + balOf(s, i), 0)
  const aging: [string, number][] = [["Current", sum(0, 0)], ["1–30 days", sum(1, 30)], ["31–60 days", sum(31, 60)], ["60+ days", sum(61, 9999)]]
  const due = s.invoices.filter((i) => within(i.due, r) && balOf(s, i) > 0 && lateOf(i) > 0)
  const byCust = s.customers.map((c) => ({ name: c.name, value: due.filter((i) => i.cust === c.name).reduce((n, i) => n + balOf(s, i), 0) })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value)
  return { aging, byCust, inv, due }
}

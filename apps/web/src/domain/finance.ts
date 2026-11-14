import type { Inv, State, Tone } from "./types"
import { TODAY } from "./format"

/** Balances are always derived from allocations, never stored. */
export const invTotal = (i: Inv) => Math.round(i.lines.reduce((s, l) => s + l.qty * l.price, 0) * 100) / 100
export const paidOf = (s: State, id: string) => Math.round(s.allocs.filter((a) => a.inv === id && !a.void).reduce((t, a) => t + a.amount, 0) * 100) / 100
export const balOf = (s: State, i: Inv) => (i.cancelled ? 0 : Math.round((invTotal(i) - paidOf(s, i.id)) * 100) / 100)
export const lateOf = (i: Inv) => Math.max(0, Math.floor((+TODAY - +new Date(i.due + "T00:00:00Z")) / 864e5))
export const statusOf = (s: State, i: Inv): [string, Tone] => {
  if (i.cancelled) return ["cancelled", "grey"]
  const b = balOf(s, i), p = paidOf(s, i.id), late = lateOf(i)
  if (b <= 0) return ["paid", "green"]
  if (late > 0) return p ? ["partial, overdue", "amber"] : ["overdue", "red"]
  return p ? ["partial", "amber"] : ["current", "grey"]
}
export const payAllocated = (s: State, id: string) => Math.round(s.allocs.filter((a) => a.pay === id && !a.void).reduce((t, a) => t + a.amount, 0) * 100) / 100
export const custOf = (s: State, name: string) => s.customers.find((c) => c.name === name)
export const totals = (s: State) => {
  const open = s.invoices.filter((i) => balOf(s, i) > 0)
  const sum = (xs: Inv[]) => xs.reduce((t, i) => t + balOf(s, i), 0)
  const bucket = (a: number, b: number) => sum(open.filter((i) => lateOf(i) >= a && lateOf(i) <= b))
  const unmatched = s.payments.filter((p) => p.status === "open" && payAllocated(s, p.id) < p.amount && !s.suggs.some((g) => g.pay === p.id && g.status === "pending"))
  const exposure = s.invgs.filter((g) => !["resolved", "dismissed"].includes(g.status)).reduce((t, g) => t + g.exposure, 0)
  return { open: open.length, receivable: sum(open), overdue: sum(open.filter((i) => lateOf(i) > 0)), overdueCount: open.filter((i) => lateOf(i) > 0).length, aging: [["Current", bucket(0, 0)], ["1–30 days", bucket(1, 30)], ["31–60 days", bucket(31, 60)], ["60+ days", bucket(61, 9999)]] as [string, number][], unmatched, exposure, pendingApr: s.aprs.filter((a) => a.status === "pending").length, needsReview: s.suggs.filter((g) => g.status === "pending").length }
}

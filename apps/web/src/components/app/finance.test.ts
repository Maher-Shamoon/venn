import { describe, expect, it } from "vitest"
import { balOf, getState, invTotal, totals } from "./store"
import { activityData, reconData, recoveredData, scoped, trendData } from "./ranges"

const s = getState()

describe("receivable balances", () => {
  it("never goes negative and equals total minus active allocations", () => {
    for (const i of s.invoices) {
      const paid = s.allocs.filter((a) => a.inv === i.id && !a.void).reduce((n, a) => n + a.amount, 0)
      expect(balOf(s, i)).toBeGreaterThanOrEqual(0)
      if (!i.cancelled) expect(balOf(s, i)).toBeCloseTo(Math.max(0, invTotal(i) - paid), 2)
    }
  })
  it("splits receivables exactly across the aging buckets", () => {
    const t = totals(s)
    expect(t.aging.reduce((n, [, v]) => n + v, 0)).toBeCloseTo(t.receivable, 2)
  })
})

describe("time ranges", () => {
  it("ends the trend on the live figures", () => {
    for (const r of ["7D", "30D", "90D", "12M"] as const) {
      const d = trendData(r, 1234, 567)
      expect(d.at(-1)).toMatchObject({ total: 1234, overdue: 567 })
    }
  })
  it("returns the expected number of points", () => {
    expect(trendData("7D", 1, 1)).toHaveLength(7)
    expect(trendData("30D", 1, 1)).toHaveLength(10)
    expect(trendData("90D", 1, 1)).toHaveLength(13)
    expect(trendData("12M", 1, 1)).toHaveLength(12)
  })
  it("keeps weekly and monthly reconciliation counts consistent", () => {
    const sum = (rows: { auto: number; manual: number; review: number }[]) => rows.reduce((n, r) => n + r.auto + r.manual + r.review, 0)
    expect(sum(reconData("90D").slice(7, 11))).toBe(sum(reconData("12M").slice(10, 11)))
    expect(reconData("30D")).toEqual(reconData("90D").slice(-5))
  })
  it("keeps recovered and activity series aligned with their labels", () => {
    for (const r of ["7D", "30D", "90D", "12M"] as const) {
      expect(recoveredData(r).length).toBe(activityData(r).length)
    }
  })
  it("never shows more invoices in a shorter range", () => {
    expect(scoped(s, "7D").inv.length).toBeLessThanOrEqual(scoped(s, "30D").inv.length)
    expect(scoped(s, "30D").inv.length).toBeLessThanOrEqual(scoped(s, "90D").inv.length)
  })
})

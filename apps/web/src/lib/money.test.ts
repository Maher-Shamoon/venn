import { describe, expect, it } from "vitest"
import { add, cmp, formatMoney, isDecimal, round, sub } from "./money"

describe("money", () => {
  it("formats by currency digits", () => {
    expect(formatMoney("1234.5")).toBe("$1,234.50")
    expect(formatMoney("1234", "JPY")).toBe("¥1,234")
    expect(formatMoney("-9600")).toBe("−$9,600.00")
    expect(formatMoney("5", "USD", { signed: true })).toBe("+$5.00")
  })
  it("adds without float error", () => {
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(add("0.1", "0.2")).toBe("0.3")
    expect(sub("1000.00", "999.99")).toBe("0.01")
  })
  it("compares exactly", () => {
    expect(cmp("0.30", "0.3")).toBe(0)
    expect(cmp("1000.01", "1000")).toBe(1)
  })
  it("rounds half-even", () => {
    expect(round("2.345")).toBe("2.34")
    expect(round("2.355")).toBe("2.36")
    expect(round("2.5", "JPY")).toBe("2")
  })
  it("validates decimal text", () => {
    for (const ok of ["12", "12.50", "-3.1"]) expect(isDecimal(ok)).toBe(true)
    for (const bad of ["", "1,000", "1e3", "abc", "1."]) expect(isDecimal(bad)).toBe(false)
  })
})

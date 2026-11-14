import Decimal from "decimal.js"

/**
 * Money crosses the API as decimal strings ("1000.00"). Never parseFloat or Number() an amount:
 * use these helpers, which keep exact decimal arithmetic. The server's totals are authoritative;
 * arithmetic here is only for previews while typing.
 */
const DIGITS: Record<string, number> = { JPY: 0, KRW: 0, VND: 0, BHD: 3, KWD: 3, JOD: 3 }
export const currencyDigits = (currency: string) => DIGITS[currency] ?? 2

/** "1234.5" + "USD" -> "$1,234.50". Throws on text that is not a decimal number. */
export function formatMoney(amount: string, currency = "USD", opts: { signed?: boolean } = {}): string {
  const d = new Decimal(amount), digits = currencyDigits(currency)
  const text = new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(d.abs().toNumber())
  return d.isNegative() ? "−" + text : opts.signed && d.gt(0) ? "+" + text : text
}

/** True for "12", "12.50", "-3.1"; false for "", "1,000", "1e3", "abc". */
export const isDecimal = (s: string) => /^-?\d+(\.\d+)?$/.test(s.trim())

export const add = (a: string, b: string) => new Decimal(a).plus(b).toFixed()
export const sub = (a: string, b: string) => new Decimal(a).minus(b).toFixed()
/** Compare two decimal strings: -1, 0 or 1. */
export const cmp = (a: string, b: string) => new Decimal(a).cmp(b)

/** Rounds half-even to the currency's digits (the rounding rule in FEATURE_SPECIFICATION A.1). */
export const round = (amount: string, currency = "USD") =>
  new Decimal(amount).toDecimalPlaces(currencyDigits(currency), Decimal.ROUND_HALF_EVEN).toFixed(currencyDigits(currency))

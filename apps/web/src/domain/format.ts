export const TODAY = new Date("2026-11-13T00:00:00Z")
export const NOW = "13 Nov 09:41"
export const fmtD = (s: string) => new Date(s + (s.length === 10 ? "T00:00:00Z" : "")).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
export const usd = (n: number, d = 2) => (n < 0 ? "−" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })

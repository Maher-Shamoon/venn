import { useCallback } from "react"
import { useSearchParams } from "react-router-dom"

export type TableState = { q: string; sort: [string, 1 | -1] | null; page: number }
/** Controlled table state. With `total` set, rows are already one server page: no client filtering or slicing. */
export type TableControl = TableState & { total?: number; onChange: (next: Partial<TableState>) => void }

/**
 * Keeps search, sort and page in the URL (?q=, ?sort=-due, ?page=2) so a reload, a shared link and the back
 * button all restore the same view. `prefix` separates two tables on one page. Page is 1-based in the URL.
 */
export function useUrlTable(prefix = "", defaults: Partial<TableState> = {}): Omit<TableControl, "total"> {
  const [params, setParams] = useSearchParams()
  const sortRaw = params.get(prefix + "sort")
  const sort: TableState["sort"] = sortRaw ? [sortRaw.replace(/^-/, ""), sortRaw.startsWith("-") ? -1 : 1] : defaults.sort ?? null
  const page = Math.max(0, (Number(params.get(prefix + "page")) || 1) - 1)
  const q = params.get(prefix + "q") ?? defaults.q ?? ""
  const onChange = useCallback((next: Partial<TableState>) => {
    setParams((prev) => {
      const p = new URLSearchParams(prev)
      const set = (k: string, v: string | null) => (v ? p.set(prefix + k, v) : p.delete(prefix + k))
      if ("q" in next) set("q", next.q || null)
      if ("sort" in next) set("sort", next.sort ? (next.sort[1] === -1 ? "-" : "") + next.sort[0] : null)
      if ("page" in next) set("page", next.page ? String(next.page + 1) : null)
      else p.delete(prefix + "page") // a new search or sort starts on page 1
      return p
    }, { replace: true })
  }, [prefix, setParams])
  return { q, sort, page, onChange }
}

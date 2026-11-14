// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, useLocation } from "react-router-dom"
import { afterEach, describe, expect, it } from "vitest"
import { useUrlTable } from "@/lib/tableState"
import { DataTable } from "./ui"

type Row = { id: string; name: string }
const rows: Row[] = Array.from({ length: 25 }, (_, i) => ({ id: String(i), name: `Customer ${i + 1}` }))
const cols = [{ key: "n", label: "Name", sort: (r: Row) => r.name, render: (r: Row) => r.name }]

const Loc = () => <output data-testid="loc">{useLocation().search}</output>
function UrlTable({ server }: { server?: boolean }) {
  const ctl = useUrlTable()
  return <DataTable rows={server ? rows.slice(10, 20) : rows} cols={cols} id={(r) => r.id} search={(r) => r.name} ctl={server ? { ...ctl, total: 25 } : ctl} />
}
const mount = (url: string, server?: boolean) => render(<MemoryRouter initialEntries={[url]}><UrlTable server={server} /><Loc /></MemoryRouter>)

afterEach(cleanup)

describe("DataTable with URL state", () => {
  it("restores page and search from the URL", () => {
    mount("/?page=2&q=customer")
    expect(screen.getByText("11–20 of 25")).toBeTruthy()
  })
  it("writes the page to the URL and resets it when searching", () => {
    mount("/")
    fireEvent.click(screen.getByLabelText("Next page"))
    expect(screen.getByTestId("loc").textContent).toBe("?page=2")
    fireEvent.change(screen.getByLabelText("Search table"), { target: { value: "Customer 2" } })
    expect(screen.getByTestId("loc").textContent).toBe("?q=Customer+2")
  })
  it("writes sort descending with a minus sign", () => {
    mount("/")
    const btn = screen.getByRole("button", { name: "Name" })
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(screen.getByTestId("loc").textContent).toBe("?sort=-n")
  })
  it("server mode shows the rows it is given and the server total", () => {
    mount("/?page=2", true)
    expect(screen.getByText("Customer 11")).toBeTruthy()
    expect(screen.queryByText("Customer 1")).toBeNull()
    expect(screen.getByText("11–20 of 25")).toBeTruthy()
  })
})

// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CommandDialog, CommandInput, CommandItem, CommandList } from "./command"

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
Element.prototype.scrollIntoView ??= () => {}

describe("CommandDialog", () => {
  it("renders its input and items inside a cmdk root (regression: palette crashed)", () => {
    render(<CommandDialog open onOpenChange={() => {}}><CommandInput placeholder="Search" /><CommandList><CommandItem>Invoices</CommandItem></CommandList></CommandDialog>)
    expect(screen.getByPlaceholderText("Search")).toBeTruthy()
    expect(screen.getByText("Invoices")).toBeTruthy()
  })
})

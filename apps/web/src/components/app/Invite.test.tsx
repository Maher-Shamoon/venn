// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { http, HttpResponse, server } from "@/test/server"

const state = vi.hoisted(() => ({ signedIn: true as boolean | undefined }))
vi.mock("@/components/Balatro", () => ({ default: () => null })) // WebGL shader is not needed here
vi.mock("@/config", () => ({ config: { authSource: "supabase", apiBase: "/api/v1", dataSource: "remote", supabaseUrl: "x", supabaseAnonKey: "y" } }))
vi.mock("@/auth", async (orig) => ({ ...(await orig<typeof import("@/auth")>()), useSignedIn: () => state.signedIn }))

window.matchMedia ??= ((q: string) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => { server.resetHandlers(); cleanup() })
afterAll(() => server.close())
beforeEach(() => { localStorage.clear(); state.signedIn = true })

const info = { organization_name: "Globex", role_key: "ar_specialist", role_name: "AR specialist", email: "ana@globex.test" }
async function mount() {
  const { Invite } = await import("./Auth")
  render(<MemoryRouter initialEntries={["/invite/tok123"]}><Routes><Route path="/invite/:token" element={<Invite />} /><Route path="/app" element={<p>app home</p>} /></Routes></MemoryRouter>)
}

describe("invitation page (real accounts)", () => {
  it("shows an invalid link plainly", async () => {
    server.use(http.get("*/api/v1/invitations/tok123", () => HttpResponse.json({ code: "not_found", detail: "nope" }, { status: 404 })))
    await mount()
    expect(await screen.findByText("This invitation is not valid")).toBeTruthy()
  })
  it("asks a signed-out visitor to sign in or sign up and remembers the link", async () => {
    state.signedIn = false
    server.use(http.get("*/api/v1/invitations/tok123", () => HttpResponse.json(info)))
    await mount()
    expect(await screen.findByText("Join Globex")).toBeTruthy()
    expect(screen.getByText("ana@globex.test")).toBeTruthy()
    expect(screen.getByText("Create an account")).toBeTruthy()
    expect(localStorage.getItem("venn.invite")).toBe("tok123")
  })
  it("accepts when signed in, selects the organization and goes to the app", async () => {
    server.use(
      http.get("*/api/v1/invitations/tok123", () => HttpResponse.json(info)),
      http.post("*/api/v1/invitations/tok123/accept", () => HttpResponse.json({ organization_id: "11111111-1111-1111-1111-111111111111" })),
      http.get("*/api/v1/me", () => HttpResponse.json({ id: "u", email: "ana@globex.test", email_verified: true, full_name: "Ana", memberships: [{ organization_id: "11111111-1111-1111-1111-111111111111", organization_name: "Globex", role_key: "ar_specialist", role_name: "AR specialist", status: "active" }] })),
    )
    await mount()
    fireEvent.click(await screen.findByRole("button", { name: "Accept invitation" }))
    expect(await screen.findByText("app home")).toBeTruthy()
    expect(localStorage.getItem("venn.org")).toBe("11111111-1111-1111-1111-111111111111")
    expect(localStorage.getItem("venn.invite")).toBeNull()
  })
  it("shows the server's message when the wrong person accepts", async () => {
    server.use(
      http.get("*/api/v1/invitations/tok123", () => HttpResponse.json(info)),
      http.post("*/api/v1/invitations/tok123/accept", () => HttpResponse.json({ code: "permission_denied", detail: "This invitation was sent to ana@globex.test. Sign in with that address." }, { status: 403 })),
    )
    await mount()
    fireEvent.click(await screen.findByRole("button", { name: "Accept invitation" }))
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/permission/))
  })
})

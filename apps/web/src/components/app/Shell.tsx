import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link, NavLink, Outlet, useLocation, useNavigate, useOutletContext } from "react-router-dom"
import { BarChart3, Bell, CheckSquare, CreditCard, FileSearch, FileText, FolderOpen, GitMerge, LayoutGrid, LogOut, Mail, Menu, Plug, ScrollText, Scale, Search, Settings, ShieldCheck, User, Users, UsersRound, WifiOff, type LucideIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Toaster } from "@/components/ui/sonner"
import { Logo } from "@/components/venn/kit"
import { cn } from "@/lib/utils"
import { A, balOf, useApp, usd, type Role } from "./store"
import { Loading, PageSkeleton } from "./ui"
import { fetchContext, remote } from "@/features/identity/api"
import { useFrame, useSearch } from "@/features/shell/api"
import { BellList } from "@/features/workflow/RemoteInbox"
import { useNotifications } from "@/features/workflow/api"
import { toastApiError } from "@/lib/errors"
import { signOut } from "@/auth"
import { SkipLink } from "@/components/venn/SkipLink"

export type { Role }
export const useRole = () => useOutletContext<{ role: Role }>().role

type Item = { to: string; icon: LucideIcon; label: string; ar?: string; count?: (r: Role) => number; ownerOnly?: boolean; end?: boolean }
const GROUPS: [string, Item[]][] = [
  ["", [{ to: "/app", icon: LayoutGrid, label: "Dashboard", end: true }]],
  ["Receivables", [{ to: "/app/customers", icon: Users, label: "Customers" }, { to: "/app/invoices", icon: FileText, label: "Invoices" }, { to: "/app/payments", icon: CreditCard, label: "Payments" }]],
  ["Resolve", [
    { to: "/app/reconciliation", icon: GitMerge, label: "Reconciliation", count: () => 0 },
    { to: "/app/investigations", icon: FileSearch, label: "Investigations" },
    { to: "/app/collections", icon: Mail, label: "Collections" },
    { to: "/app/disputes", icon: Scale, label: "Disputes" },
    { to: "/app/approvals", icon: ShieldCheck, label: "Approvals", ar: "My requests" },
  ]],
  ["Insight", [{ to: "/app/reports", icon: BarChart3, label: "Analytics" }, { to: "/app/documents", icon: FolderOpen, label: "Documents" }, { to: "/app/tasks", icon: CheckSquare, label: "Tasks" }]],
  ["Admin", [
    { to: "/app/integrations", icon: Plug, label: "Integrations", ownerOnly: true },
    { to: "/app/team", icon: UsersRound, label: "Team", ownerOnly: true },
    { to: "/app/audit-log", icon: ScrollText, label: "Audit log", ownerOnly: true },
    { to: "/app/settings", icon: Settings, label: "Settings", ownerOnly: true },
  ]],
]

function Pop({ trigger, children, label }: { trigger: ReactNode; children: (close: () => void) => ReactNode; label: string }) {
  const [o, setO] = useState(false), ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!o) return
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setO(false) }, key = (e: KeyboardEvent) => e.key === "Escape" && setO(false)
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key)
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key) }
  }, [o])
  return <div ref={ref} className="relative"><button type="button" aria-label={label} aria-expanded={o} onClick={() => setO(!o)} className="relative flex size-10 items-center justify-center rounded-md hover:bg-muted">{trigger}</button>{o && <div className="absolute right-0 top-12 z-50 w-[min(340px,92vw)] animate-rise-in rounded-xl border border-border bg-white p-1 shadow-xl">{children(() => setO(false))}</div>}</div>
}

export function AppShell() {
  const s = useApp(), nav = useNavigate(), loc = useLocation()
  const real = remote()
  // Real organizations take the role from the server; the "view as" switcher exists only in sample workspaces.
  const [ctxReady, setCtxReady] = useState(!real)
  useEffect(() => {
    if (!real) return
    fetchContext().then((c) => A.setRole(c.role_key === "owner" ? "owner" : "ar")).catch((e) => toastApiError(e)).finally(() => setCtxReady(true))
  }, [real])
  const role = s.role
  const [menu, setMenu] = useState(false), [cmd, setCmd] = useState(false), [online, setOnline] = useState(true)
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((v) => !v) } }
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener("keydown", key); window.addEventListener("online", on); window.addEventListener("offline", off)
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("online", on); window.removeEventListener("offline", off) }
  }, [])
  useEffect(() => { setMenu(false); window.scrollTo(0, 0); const t = setTimeout(() => { document.title = `${document.querySelector("main h1")?.textContent?.slice(0, 48) || "venn"} · venn` }, 60); return () => clearTimeout(t) }, [loc.pathname])
  const frame = useFrame(real), [qtext, setQtext] = useState(""), found = useSearch(qtext, real && cmd)
  const me = real ? (frame.data?.user.name ?? "") : role === "owner" ? "Dana W." : "Priya R."
  const localCounts: Record<string, number> = { "/app/reconciliation": s.suggs.filter((g) => g.status === "pending").length, "/app/investigations": s.invgs.filter((g) => !["resolved", "dismissed"].includes(g.status) && (role === "owner" || g.assignee === me)).length, "/app/collections": s.cols.filter((c) => c.next <= "2026-11-13").length, "/app/disputes": s.dsps.filter((d) => d.status !== "resolved").length, "/app/approvals": s.aprs.filter((a) => a.status === "pending" && (role === "owner" || a.by === me)).length }
  const counts: Record<string, number> = real ? { "/app/reconciliation": frame.data?.counts.reconciliation ?? 0, "/app/investigations": frame.data?.counts.investigations ?? 0, "/app/approvals": frame.data?.counts.approvals ?? 0 } : localCounts
  const groups = GROUPS.map(([g, items]) => [g, items.filter((i) => role === "owner" || !i.ownerOnly)] as [string, Item[]]).filter(([, i]) => i.length)
  const unreadReal = useNotifications(false, real), unread = real ? (unreadReal.data?.unread ?? 0) : s.notifs.filter((n) => !n.read).length
  const link = ({ isActive }: { isActive: boolean }) => cn("flex items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm transition-colors duration-[240ms]", isActive ? "border-border bg-white text-foreground shadow-sm" : "text-hushed hover:bg-black/[.04] hover:text-foreground")
  const navEl = (
    <nav aria-label="App" className="space-y-5">{groups.map(([g, items]) => (
      <div key={g || "top"}>{g && <div className="mb-1 px-3 font-mono text-[10.5px] uppercase tracking-[0.02em] text-hushed">{g}</div>}
        <div className="space-y-0.5">{items.map(({ to, end, icon: Icon, label, ar }) => { const c = counts[to]; return <NavLink key={to} to={to} end={end} className={link}><Icon className="size-4" />{role === "ar" && ar ? ar : label}{c ? <span className="ml-auto rounded-full bg-lime px-1.5 text-[11px] leading-5 text-foreground">{c}</span> : null}</NavLink> })}</div>
      </div>))}</nav>
  )
  const initials = (s.session?.name ?? me).split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase()
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[248px_1fr]">
      <SkipLink />
      <div className="flex h-10 items-center bg-[#1a1919] px-4 text-xs text-white lg:col-span-2">
        <Link to="/" className="font-medium hover:underline">← venn.com</Link>
        {!real && <span className="ml-3 hidden text-white/65 md:inline">Sample data. Nothing here is real.</span>}
        {!real && <span className="ml-auto flex items-center gap-2">view as
          <span className="inline-flex rounded-md border border-white/25 p-0.5" role="group" aria-label="Role switcher">
            {(["owner", "ar"] as Role[]).map((r) => <button key={r} onClick={() => A.setRole(r)} aria-pressed={role === r} className={cn("rounded px-2.5 py-0.5 transition-colors duration-300", role === r ? "bg-lime text-foreground" : "text-white/80 hover:text-white")}>{r === "owner" ? "Owner" : "AR specialist"}</button>)}
          </span>
          <Link to="/signup" className="ml-1 rounded bg-white px-2.5 py-0.5 text-foreground transition-opacity hover:opacity-90">Create account</Link>
        </span>}
      </div>
      <aside className="hidden max-h-[calc(100vh-40px)] overflow-y-auto border-r border-border bg-muted p-4 [scrollbar-width:none] lg:sticky lg:top-0 lg:block lg:self-start">
        <Link to="/app" className="mb-6 block px-2 pt-1"><Logo size={26} /></Link>
        {navEl}
        <div className="mt-8 rounded-lg border border-border bg-white p-3 text-xs text-hushed"><div className="text-sm text-foreground">{real ? (frame.data?.organization.name ?? "") : s.settings.company.name}</div>{role === "owner" ? "Owner" : "AR specialist"} · {me}</div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b-[0.8px] border-[rgba(33,33,33,.08)] bg-white/60 px-4 backdrop-blur-[25px] backdrop-saturate-150 md:gap-3 md:px-8">
          <button type="button" aria-label="Open menu" onClick={() => setMenu(true)} className="flex size-10 items-center justify-center rounded-md hover:bg-muted lg:hidden"><Menu className="size-5" /></button>
          <Link to="/app" className="lg:hidden"><Logo size={22} /></Link>
          <button type="button" onClick={() => setCmd(true)} className="relative hidden h-10 max-w-[420px] flex-1 items-center rounded-md border border-border bg-muted pl-9 pr-3 text-left text-sm text-hushed transition-colors duration-300 hover:bg-white sm:flex"><Search className="absolute left-3 top-3 size-4" />Search invoices, customers, payments<kbd className="ml-auto rounded bg-white px-1.5 py-0.5 font-mono text-[11px]">Ctrl K</kbd></button>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" aria-label="Search" onClick={() => setCmd(true)} className="flex size-10 items-center justify-center rounded-md hover:bg-muted sm:hidden"><Search className="size-4" /></button>
            <Pop label="Notifications" trigger={<><Bell className="size-4" />{unread > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-blaze" />}</>}>
              {(close) => real ? <BellList close={close} /> : <div><div className="flex items-center justify-between px-3 py-2"><span className="text-sm">Notifications</span><button className="text-xs text-hushed hover:text-foreground" onClick={() => A.markRead()}>Mark all read</button></div>
                {s.notifs.slice(0, 5).map((n) => <button key={n.id} onClick={() => { A.markRead(n.id); close(); nav(n.to) }} className="flex w-full gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-muted"><span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: n.read ? "transparent" : "#f472b6" }} /><span><span className="block text-sm">{n.text}</span><span className="text-xs text-hushed">{n.at}</span></span></button>)}
                <Link to="/app/notifications" onClick={close} className="block border-t border-border px-3 py-2.5 text-center text-sm hover:bg-muted">See all</Link></div>}
            </Pop>
            <Pop label="Account menu" trigger={<Avatar className="size-8"><AvatarFallback>{initials}</AvatarFallback></Avatar>}>
              {(close) => <div className="p-1"><div className="px-3 py-2"><div className="text-sm">{real ? (frame.data?.user.name ?? "") : (s.session?.name ?? me)}</div><div className="text-xs text-hushed">{real ? (frame.data?.user.email ?? "") : (s.session?.email ?? "sample workspace")}</div></div>
                <Link to="/app/profile" onClick={close} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"><User className="size-4" />Profile</Link>
                <button onClick={() => { close(); void signOut().finally(() => { A.signOut(); nav("/login") }) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"><LogOut className="size-4" />Sign out</button></div>}
            </Pop>
          </div>
        </header>
        {!online && <div role="status" className="flex items-center gap-2 bg-[#fff1c7] px-5 py-2 text-sm text-[#8a5a00]"><WifiOff className="size-4" />You are offline. Changes are paused until the connection returns.</div>}
        <main className="mx-auto max-w-[1180px] px-4 py-5 pb-24 md:px-8 md:py-10 lg:pb-10">{ctxReady ? <Loading key={loc.pathname} path={loc.pathname}><Outlet context={{ role }} /></Loading> : <PageSkeleton path="/app" />}</main>
      </div>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {([["/app", LayoutGrid, "Home", true], ["/app/invoices", FileText, "Invoices", false], ["/app/payments", CreditCard, "Payments", false], ["/app/reconciliation", GitMerge, "Match", false]] as const).map(([to, Icon, label, end]) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", isActive ? "text-foreground" : "text-hushed")}><Icon className="size-5" />{label}</NavLink>))}
        <button type="button" onClick={() => setMenu(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-hushed"><Menu className="size-5" />More</button>
      </nav>
      <Sheet open={menu} onOpenChange={setMenu}><SheetContent side="left" className="w-[280px] overflow-y-auto bg-muted p-4"><SheetTitle className="sr-only">Menu</SheetTitle><Link to="/app" className="mb-6 block px-2 pt-1"><Logo size={26} /></Link>{navEl}</SheetContent></Sheet>
      <CommandDialog open={cmd} onOpenChange={(o) => { setCmd(o); if (!o) setQtext("") }} shouldFilter={!real} title="Search" description="Search records and pages">
        <CommandInput placeholder="Search invoices, customers, payments, investigations…" value={real ? qtext : undefined} onValueChange={real ? setQtext : undefined} />
        <CommandList>
          <CommandEmpty>{real && qtext.trim().length < 2 ? "Type at least two characters to search your records." : "No results."}</CommandEmpty>
          <CommandGroup heading="Go to">{groups.flatMap(([, i]) => i).filter((i) => !real || !qtext.trim() || i.label.toLowerCase().includes(qtext.trim().toLowerCase())).map((i) => <CommandItem key={i.to} value={"go " + i.label} onSelect={() => { setCmd(false); nav(i.to) }}><i.icon className="size-4" />{i.label}</CommandItem>)}</CommandGroup>
          {real ? (<>
            {found.data?.invoices.length ? <CommandGroup heading="Invoices">{found.data.invoices.map((i) => <CommandItem key={i.id} value={"inv " + i.id} onSelect={() => { setCmd(false); nav("/app/invoices/" + i.id) }}><span className="font-mono text-xs">{i.number}</span><span className="flex-1 truncate">{i.customer}</span><span className="text-xs text-hushed">{i.currency} {i.balance}</span></CommandItem>)}</CommandGroup> : null}
            {found.data?.customers.length ? <CommandGroup heading="Customers">{found.data.customers.map((c) => <CommandItem key={c.id} value={"cus " + c.id} onSelect={() => { setCmd(false); nav("/app/customers/" + c.id) }}>{c.name}</CommandItem>)}</CommandGroup> : null}
            {found.data?.payments.length ? <CommandGroup heading="Payments">{found.data.payments.map((p) => <CommandItem key={p.id} value={"pay " + p.id} onSelect={() => { setCmd(false); nav("/app/payments/" + p.id) }}><span className="font-mono text-xs">{p.number}</span><span className="flex-1 truncate">{p.payer}</span><span className="text-xs text-hushed">{p.currency} {p.amount}</span></CommandItem>)}</CommandGroup> : null}
            {found.data?.investigations.length ? <CommandGroup heading="Investigations">{found.data.investigations.map((g) => <CommandItem key={g.id} value={"case " + g.id} onSelect={() => { setCmd(false); nav("/app/investigations/" + g.id) }}><span className="font-mono text-xs">{g.number}</span><span className="flex-1 truncate">{g.title}</span></CommandItem>)}</CommandGroup> : null}
          </>) : (<>
          <CommandGroup heading="Invoices">{s.invoices.map((i) => <CommandItem key={i.id} value={`${i.id} ${i.cust}`} onSelect={() => { setCmd(false); nav("/app/invoices/" + i.id) }}><span className="font-mono text-xs">{i.id}</span><span className="flex-1 truncate">{i.cust}</span><span className="text-xs text-hushed">{usd(balOf(s, i), 0)}</span></CommandItem>)}</CommandGroup>
          <CommandGroup heading="Customers">{s.customers.map((c) => <CommandItem key={c.id} value={c.name + " " + c.aliases.join(" ")} onSelect={() => { setCmd(false); nav("/app/customers/" + c.id) }}>{c.name}</CommandItem>)}</CommandGroup>
          <CommandGroup heading="Payments">{s.payments.map((p) => <CommandItem key={p.id} value={`${p.id} ${p.payer} ${p.ref}`} onSelect={() => { setCmd(false); nav("/app/payments/" + p.id) }}><span className="font-mono text-xs">{p.id}</span><span className="flex-1 truncate">{p.payer}</span><span className="text-xs text-hushed">{usd(p.amount, 0)}</span></CommandItem>)}</CommandGroup>
          <CommandGroup heading="Investigations">{s.invgs.map((g) => <CommandItem key={g.id} value={`${g.id} ${g.cust} ${g.type}`} onSelect={() => { setCmd(false); nav("/app/investigations/" + g.id) }}><span className="font-mono text-xs">{g.id}</span><span className="flex-1 truncate">{g.title}</span></CommandItem>)}</CommandGroup>
        </>)}
        </CommandList>
      </CommandDialog>
      <Toaster position="bottom-right" theme="light" />
    </div>
  )
}

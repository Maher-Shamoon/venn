import { remote } from "@/features/identity/api"
import { RemoteCompany, RemoteFinancial } from "@/features/settings/RemoteSettings"
import { RemoteAuditLog } from "@/features/audit/RemoteAuditLog"
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Download, Lock, Mail, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { A, download, toCsv, useApp, usd, fmtD, type Integ, type Member, type Role, type Settings as SettingsT, type Tone } from "./store"
import { Box, DataTable, Drawer, Empty, Field, Locked, Modal, Mono, NativeSelect, Pill, Row, Seg, Title } from "./ui"
import { NotFound } from "./System"
import { useRole } from "./Shell"
import { cn } from "@/lib/utils"

/* --------------------------------------------------------------- integrations */
const ITONE: Record<Integ["status"], Tone> = { connected: "green", available: "blue", planned: "grey", "needs attention": "amber" }
export function Integrations() {
  const s = useApp(), role = useRole()
  const cats = [...new Set(s.integs.map((i) => i.cat))]
  return (
    <>
      <Title sub={role === "owner" ? "Connect only what you need. venn reads. It never writes to your accounting system." : "Read-only view of connection status."}>Integrations</Title>
      {cats.map((c) => (
        <section key={c} className="mb-8"><h2 className="mb-3 text-lg">{c}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{s.integs.filter((i) => i.cat === c).map((i) => (
            <div key={i.id} className="flex flex-col rounded-xl border-[0.8px] border-border bg-muted p-5 transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#efece8]">
              <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-white text-sm">{i.name.slice(0, 2)}</span><div className="flex-1 text-lg">{i.name}</div><Pill tone={ITONE[i.status]}>{i.status}</Pill></div>
              <p className="mt-3 flex-1 text-sm text-hushed">{i.desc}</p>
              <div className="mt-4 flex gap-2">
                {role === "owner" && i.status === "connected" && <Button variant="outline" render={<Link to={"/app/integrations/" + i.id} />}>Manage</Button>}
                {role === "owner" && i.status === "available" && <Button onClick={() => A.setInteg(i.id, "connected")}>Connect</Button>}
                {role === "owner" && i.status === "planned" && <Button variant="outline" onClick={() => A.setInteg(i.id, "planned")}>Join waitlist</Button>}
                {role === "ar" && <Button variant="ghost" disabled>Owner manages</Button>}
              </div>
            </div>))}</div>
        </section>))}
    </>
  )
}
export function IntegrationDetail() {
  const { id } = useParams(), s = useApp(), role = useRole(), nav = useNavigate()
  const i = s.integs.find((x) => x.id === id)
  const [dc, setDc] = useState(false)
  if (!i) return <NotFound what="integration" back="/app/integrations" />
  if (role !== "owner") return <Locked what="Integration settings" />
  return (
    <>
      <Title back={["/app/integrations", "Integrations"]} sub={i.account} right={i.status === "available" ? <Button onClick={() => A.setInteg(i.id, "connected")}>Connect</Button> : i.status === "planned" ? <Button variant="outline" onClick={() => A.setInteg(i.id, "planned")}>Join waitlist</Button> : <><Button variant="outline" onClick={() => A.syncInteg(i.id)}>Sync now</Button><Button variant="outline" className="text-destructive" onClick={() => setDc(true)}>Disconnect</Button></>}>{i.name} <Pill tone={ITONE[i.status]}>{i.status}</Pill></Title>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3"><Box title="Permissions granted" pad><ul className="space-y-2 text-sm">{i.scopes.map((x) => <li key={x} className="flex gap-2"><Lock className="mt-0.5 size-3.5 shrink-0 text-hushed" />{x}</li>)}</ul></Box><Box title="Status" pad><Row k="Account">{i.account}</Row><Row k="Last sync">{i.last}</Row></Box></div>
        <Box title="Sync history"><DataTable rows={i.syncs} id={(x) => x.at + x.msg} empty={<Empty title="No syncs yet" />} cols={[{ key: "a", label: "Time", render: (x) => x.at }, { key: "n", label: "Records", right: true, render: (x) => x.n }, { key: "m", label: "Result", render: (x) => x.msg }, { key: "ok", label: "", right: true, render: (x) => <Pill tone={x.ok ? "green" : "red"}>{x.ok ? "ok" : "failed"}</Pill> }]} /></Box>
      </div>
      <Modal open={dc} onOpenChange={setDc} title={`Disconnect ${i.name}?`} desc="Synced records stay in venn. New data stops arriving. You can reconnect at any time." footer={<><Button variant="outline" onClick={() => setDc(false)}>Keep connected</Button><Button variant="destructive" onClick={() => { A.setInteg(i.id, "available"); setDc(false); nav("/app/integrations") }}>Disconnect</Button></>} />
    </>
  )
}

/* ----------------------------------------------------------------------- team */
export function Team() {
  const s = useApp(), role = useRole(), nav = useNavigate()
  const [open, setOpen] = useState(false), [email, setEmail] = useState(""), [r, setR] = useState<Role>("ar"), [err, setErr] = useState("")
  if (role !== "owner") return <Locked what="Team" />
  const invite = () => { if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Enter a valid email address."); if (s.team.some((m) => m.email === email)) return setErr("This person is already on the team."); A.invite(email, r); setOpen(false); setEmail(""); setErr("") }
  const members = s.team.filter((m) => m.status !== "invited"), pending = s.team.filter((m) => m.status === "invited")
  return (
    <>
      <Title sub={`${members.length} members · ${pending.length} pending`} right={<Button onClick={() => setOpen(true)}><Plus className="size-4" />Invite</Button>}>Team</Title>
      <Box title="Members"><DataTable rows={members} id={(m) => m.id} onRow={(m) => nav("/app/team/" + m.id)} cols={[{ key: "n", label: "Name", render: (m) => <div><div>{m.name}</div><div className="text-xs text-hushed">{m.email}</div></div> }, { key: "r", label: "Role", render: (m) => <Pill tone={m.role === "owner" ? "blue" : "grey"}>{m.role === "owner" ? "owner" : "AR specialist"}</Pill> }, { key: "l", label: "Last active", hide: "md", render: (m) => m.last }, { key: "s", label: "Status", render: (m) => <Pill tone={m.status === "active" ? "green" : "red"}>{m.status}</Pill> }]} /></Box>
      <Box className="mt-3" title="Pending invitations"><DataTable rows={pending} id={(m) => m.id} empty={<Empty title="No pending invitations" />} cols={[{ key: "e", label: "Email", render: (m) => m.email }, { key: "r", label: "Role", render: (m) => (m.role === "owner" ? "owner" : "AR specialist") }, { key: "a", label: "", right: true, render: (m) => <Button variant="ghost" size="sm" onClick={() => toast.success("Invitation resent to " + m.email)}>Resend</Button> }]} /></Box>
      <Modal open={open} onOpenChange={setOpen} title="Invite a teammate" desc="They receive an email with a link that expires in 7 days." footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={invite}><Mail className="size-4" />Send invitation</Button></>}>
        <div className="space-y-3"><Field label="Work email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field><Field label="Role"><NativeSelect value={r} onChange={(e) => setR(e.target.value as Role)}><option value="ar">AR specialist</option><option value="owner">Owner</option></NativeSelect></Field>{err && <p role="alert" className="text-sm text-destructive">{err}</p>}</div>
      </Modal>
    </>
  )
}
const PERMS: [string, string, boolean][] = [["approve", "Approve write-offs, credits and refunds", true], ["send", "Send collection emails", false], ["integrations", "Manage integrations", true], ["audit", "View the audit log", true]]
export function MemberDetail() {
  const { id } = useParams(), s = useApp(), role = useRole()
  const m = s.team.find((x) => x.id === id)
  if (role !== "owner") return <Locked what="Team" />
  if (!m) return <NotFound what="member" back="/app/team" />
  const owners = s.team.filter((x) => x.role === "owner" && x.status === "active").length
  const last = m.role === "owner" && owners <= 1
  return (
    <>
      <Title back={["/app/team", "Team"]} sub={m.email} right={m.status === "suspended" ? <Button onClick={() => A.setMember(m.id, { status: "active" })}>Reactivate</Button> : <Button variant="outline" disabled={last} onClick={() => A.setMember(m.id, { status: "suspended" })}>Suspend</Button>}>{m.name}</Title>
      <div className="grid gap-4 lg:grid-cols-2">
        <Box title="Role" pad><NativeSelect aria-label="Role" value={m.role} disabled={last} onChange={(e) => A.setMember(m.id, { role: e.target.value as Role })}><option value="owner">Owner</option><option value="ar">AR specialist</option></NativeSelect>{last && <p className="mt-2 flex gap-1.5 text-xs text-hushed"><Lock className="size-3.5" />The last owner cannot be changed or suspended.</p>}</Box>
        <Box title="Permissions" pad>{PERMS.map(([k, label, ownerOnly]) => (
          <div key={k} className="flex items-center gap-3 border-b border-border py-2.5 text-sm last:border-0"><span className="flex-1">{label}{ownerOnly && m.role === "ar" && <span className="ml-2 text-xs text-hushed">locked for AR</span>}</span>
            <Switch aria-label={label} checked={m.role === "owner" ? true : ownerOnly ? false : m.perms[k]} disabled={m.role === "owner" || ownerOnly} onCheckedChange={(v) => A.setPerm(m.id, k, v)} /></div>))}</Box>
      </div>
      <Box className="mt-4" title="Recent activity">{s.audit.filter((a) => a.actor.startsWith(m.name.split(" ")[0])).slice(0, 5).map((a) => <div key={a.id} className="border-b border-border px-5 py-3 text-sm last:border-0">{a.action}<div className="text-xs text-hushed">{a.at}</div></div>)}{!s.audit.some((a) => a.actor.startsWith(m.name.split(" ")[0])) && <Empty title="No activity yet" />}</Box>
    </>
  )
}

/* ---------------------------------------------------------------------- audit */
export function AuditLog() {
  return remote() ? <RemoteAuditLog /> : <LocalAuditLog />
}
function LocalAuditLog() {
  const s = useApp(), role = useRole()
  const [g, setG] = useState("all"), [sel, setSel] = useState<string | null>(null)
  if (role !== "owner") return <Locked what="The audit log" />
  const groups = ["all", ...new Set(s.audit.map((a) => a.group))]
  const rows = s.audit.filter((a) => g === "all" || a.group === g), a = s.audit.find((x) => x.id === sel)
  return (
    <>
      <Title sub="Every decision, send and change. Entries cannot be edited." right={<Button variant="outline" onClick={() => { download("audit-log.csv", toCsv([["Time", "Actor", "Action", "Record"], ...rows.map((x) => [x.at, x.actor, x.action, x.rec])])); toast.success("Exported") }}><Download className="size-4" />Export CSV</Button>}>Audit log</Title>
      <Seg items={groups} value={g} onChange={setG} />
      <Box><DataTable rows={rows} id={(x) => x.id} onRow={(x) => setSel(x.id)} search={(x) => x.action + x.actor + x.rec} pageSize={12} cols={[{ key: "t", label: "Time", render: (x) => <span className="whitespace-nowrap">{x.at}</span> }, { key: "a", label: "Actor", hide: "md", render: (x) => x.actor }, { key: "ac", label: "Action", render: (x) => x.action }, { key: "r", label: "Record", right: true, render: (x) => <Mono>{x.rec}</Mono> }]} /></Box>
      <Drawer open={!!a} onOpenChange={(o) => !o && setSel(null)} title={a?.action ?? ""} desc={a?.at}>
        {a && <div className="mt-3"><Row k="Actor">{a.actor}</Row><Row k="Record"><Mono>{a.rec}</Mono></Row><Row k="Group">{a.group}</Row><Row k="Request ID"><Mono>req_{a.id.toLowerCase()}9f2</Mono></Row>
          {(a.before || a.after) && <div className="mt-4 grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-[#fbe9dd] p-3"><div className="text-xs text-hushed">Before</div>{a.before ?? "—"}</div><div className="rounded-lg bg-[#e3f6e6] p-3"><div className="text-xs text-hushed">After</div>{a.after ?? "—"}</div></div>}</div>}
      </Drawer>
    </>
  )
}

/* ------------------------------------------------------------------- settings */
const TABS = ["company", "financial", "approvals", "notifications", "roles", "remittance", "security", "data"] as const
export function Settings() {
  const { tab = "company" } = useParams(), nav = useNavigate(), s = useApp(), role = useRole()
  const st = s.settings
  const [co, setCo] = useState(st.company), [fin, setFin] = useState(st.financial), [ap, setAp] = useState(st.approvals), [rem, setRem] = useState({ bank: st.remittance.bank, account: "" }), [pw, setPw] = useState(""), [reauth, setReauth] = useState(false), [err, setErr] = useState("")
  const [del, setDel] = useState(false), [delTxt, setDelTxt] = useState("")
  if (role !== "owner") return <Locked what="Settings" />
  const t = (TABS as readonly string[]).includes(tab) ? tab : "company"
  return (
    <>
      <Title sub="Organization-wide rules. Changes are recorded in the audit log.">Settings</Title>
      <Seg items={TABS} value={t as (typeof TABS)[number]} onChange={(v) => nav("/app/settings/" + v)} />
      {t === "company" && remote() && <RemoteCompany />}
      {t === "financial" && remote() && <RemoteFinancial />}
      {t === "company" && !remote() && <Box pad><div className="grid max-w-[640px] gap-3 sm:grid-cols-2">{([["name", "Name"], ["legal", "Legal name"], ["industry", "Industry"], ["size", "Company size"], ["website", "Website"], ["address", "Address"]] as const).map(([k, l]) => <Field key={k} label={l}><Input value={co[k]} onChange={(e) => setCo({ ...co, [k]: e.target.value })} /></Field>)}</div><Button className="mt-4" onClick={() => co.name.trim() ? A.saveSettings("company", co) : toast.error("A company name is required.")}>Save changes</Button></Box>}
      {t === "financial" && !remote() && <Box pad><div className="grid max-w-[640px] gap-3 sm:grid-cols-2"><Field label="Default currency"><NativeSelect value={fin.currency} onChange={(e) => setFin({ ...fin, currency: e.target.value })}>{["USD", "EUR", "GBP", "CAD"].map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field><Field label="Timezone"><NativeSelect value={fin.timezone} onChange={(e) => setFin({ ...fin, timezone: e.target.value })}>{["America/Chicago", "America/New_York", "Europe/London", "Asia/Dubai"].map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field><Field label="Default payment terms (days)"><Input type="number" value={fin.terms} onChange={(e) => setFin({ ...fin, terms: +e.target.value })} /></Field><Field label="Short-payment grace (days)"><Input type="number" value={fin.shortGrace} onChange={(e) => setFin({ ...fin, shortGrace: +e.target.value })} /></Field><Field label="Claim grace (days)"><Input type="number" value={fin.claimGrace} onChange={(e) => setFin({ ...fin, claimGrace: +e.target.value })} /></Field></div>
        <label className="mt-4 flex max-w-[640px] items-center gap-3 text-sm"><Switch checked={fin.autoApply} onCheckedChange={(v) => setFin({ ...fin, autoApply: v })} aria-label="Auto-apply exact matches" />Apply exact matches automatically. Everything else waits for a person.</label>
        <Button className="mt-4" onClick={() => (fin.terms > 0 ? A.saveSettings("financial", fin) : toast.error("Payment terms must be above zero."))}>Save changes</Button></Box>}
      {t === "approvals" && <Box pad><p className="mb-4 max-w-[560px] text-sm text-hushed">Requests at or above the threshold need an owner. A threshold of 0 means every request needs approval. Separation of duties applies: nobody approves their own request when another owner exists.</p><div className="grid max-w-[560px] gap-2">{Object.entries(ap).map(([k, v]) => <div key={k} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm"><span className="flex-1 capitalize">{k}</span><span className="text-hushed">from $</span><Input aria-label={`${k} threshold`} type="number" className="h-8 w-24" value={v} onChange={(e) => setAp({ ...ap, [k]: +e.target.value })} /></div>)}</div><Button className="mt-4" onClick={() => A.saveSettings("approvals", ap)}>Save policy</Button></Box>}
      {t === "notifications" && <Box pad>{([["approvals", "Approval requests and decisions"], ["reconciliation", "Payments needing review"], ["dueToday", "Invoices due today"], ["integrations", "Integration problems"], ["digest", "Daily email digest"]] as [keyof SettingsT["notifications"], string][]).map(([k, l]) => <label key={k} className="flex items-center gap-3 border-b border-border py-3 text-sm last:border-0"><span className="flex-1">{l}</span><Switch aria-label={l} checked={st.notifications[k]} onCheckedChange={(v) => A.saveSettings("notifications", { ...st.notifications, [k]: v })} /></label>)}</Box>}
      {t === "roles" && <Box pad><p className="mb-3 max-w-[560px] text-sm text-hushed">What an AR specialist can do. Locked rows are always owner-only.</p>{PERMS.map(([k, l, locked]) => <div key={k} className="flex max-w-[560px] items-center gap-3 border-b border-border py-3 text-sm last:border-0"><span className="flex-1">{l}</span>{locked ? <span className="flex items-center gap-1 text-xs text-hushed"><Lock className="size-3.5" />owner only</span> : <Switch aria-label={l} defaultChecked />}</div>)}</Box>}
      {t === "remittance" && <Box pad><div className="max-w-[560px]"><Row k="Bank">{st.remittance.bank}</Row><Row k="Account">{st.remittance.account}</Row><Row k="Last changed">{fmtD(st.remittance.changedAt)}</Row><p className="mt-3 text-sm text-hushed">These details appear in reminder emails. Changing them asks you to confirm your password, and fraud-prone changes are logged.</p><Button className="mt-3" variant="outline" onClick={() => setReauth(true)}>Change details</Button></div></Box>}
      {t === "security" && <Box pad><label className="flex max-w-[560px] items-center gap-3 text-sm"><span className="flex-1">Require two-step verification for every member</span><Switch aria-label="Require MFA" checked={st.security.mfa} onCheckedChange={(v) => A.saveSettings("security", { mfa: v })} /></label><div className="mt-5 max-w-[560px]"><div className="mb-2 text-sm">Active sessions</div>{[["This browser · Austin", "Now"], ["Phone · Austin", "2 hours ago"]].map(([d, w]) => <div key={d} className="flex items-center gap-3 border-b border-border py-2.5 text-sm last:border-0"><span className="flex-1">{d}</span><span className="text-xs text-hushed">{w}</span><Button variant="ghost" size="sm" onClick={() => toast.success("Session ended")}>End</Button></div>)}</div></Box>}
      {t === "data" && <Box pad><div className="max-w-[560px] space-y-3"><div className="rounded-lg border border-border p-4"><div>Export your data</div><p className="text-sm text-hushed">Download invoices and payments as CSV.</p><Button className="mt-2" variant="outline" onClick={() => { download("invoices-all.csv", toCsv([["Invoice", "Customer", "Due"], ...s.invoices.map((i) => [i.id, i.cust, i.due])])); toast.success("Exported") }}>Export</Button></div>
        <div className="rounded-lg border border-border p-4"><div>Reset the workspace</div><p className="text-sm text-hushed">Restores the starting records. Your changes here are removed.</p><div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" onClick={() => A.reset()}>Reset</Button><Button variant="outline" onClick={() => { A.startFresh(s.session?.name ?? "Dana Whitfield", s.session?.email ?? "dana@northbeam.example"); toast.success("Workspace emptied") }}>Start with an empty workspace</Button></div></div>
        <div className="rounded-lg border border-destructive/40 p-4"><div className="text-destructive">Request organization deletion</div><p className="text-sm text-hushed">Starts a 14-day deletion window. Type the organization name to confirm.</p><Button className="mt-2" variant="outline" onClick={() => setDel(true)}>Request deletion</Button></div></div></Box>}
      <Modal open={reauth} onOpenChange={(o) => { setReauth(o); setErr("") }} title="Confirm it's you" desc="Enter your password to change remittance details." footer={<><Button variant="outline" onClick={() => setReauth(false)}>Cancel</Button><Button onClick={() => { if (pw.length < 6) return setErr("Enter your password."); if (!rem.account.trim()) return setErr("Enter the new account number."); A.saveSettings("remittance", { bank: rem.bank, account: "•••• " + rem.account.slice(-4), changedAt: "2026-11-13" }); setReauth(false); setPw(""); setRem({ ...rem, account: "" }) }}>Save</Button></>}>
        <div className="space-y-3"><Field label="Bank name"><Input value={rem.bank} onChange={(e) => setRem({ ...rem, bank: e.target.value })} /></Field><Field label="New account number"><Input value={rem.account} onChange={(e) => setRem({ ...rem, account: e.target.value })} /></Field><Field label="Password"><Input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>{err && <p role="alert" className="text-sm text-destructive">{err}</p>}</div>
      </Modal>
      <Modal open={del} onOpenChange={setDel} title="Request deletion" desc={`Type ${st.company.name} to confirm.`} footer={<><Button variant="outline" onClick={() => setDel(false)}>Cancel</Button><Button variant="destructive" disabled={delTxt !== st.company.name} onClick={() => { setDel(false); toast.success("Deletion requested. You have 14 days to cancel.") }}>Request deletion</Button></>}><Input aria-label="Organization name" value={delTxt} onChange={(e) => setDelTxt(e.target.value)} /></Modal>
    </>
  )
}

/* ------------------------------------------------- notifications, tasks, profile */
export function Notifications() {
  const s = useApp(), nav = useNavigate()
  const [f, setF] = useState<"all" | "unread">("all")
  const rows = s.notifs.filter((n) => f === "all" || !n.read)
  return (
    <>
      <Title sub={`${s.notifs.filter((n) => !n.read).length} unread`} right={<Button variant="outline" onClick={() => A.markRead()}>Mark all read</Button>}>Notifications</Title>
      <Seg items={["all", "unread"] as const} value={f} onChange={setF} />
      <Box>{rows.length ? rows.map((n) => <button key={n.id} onClick={() => { A.markRead(n.id); nav(n.to) }} className="flex w-full items-start gap-3 border-b border-border px-5 py-4 text-left transition-colors last:border-0 hover:bg-muted/60"><span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-deep")} style={n.read ? undefined : { background: "#f472b6" }} /><div className="flex-1"><div className="text-sm">{n.text}</div><div className="text-xs text-hushed">{n.at}</div></div></button>) : <Empty title="All caught up" />}</Box>
    </>
  )
}
export function Tasks() {
  const s = useApp(), role = useRole()
  const [txt, setTxt] = useState(""), [due, setDue] = useState("2026-11-16")
  const mine = s.tasks.filter((t) => t.owner === role)
  return (
    <>
      <Title sub={`${mine.filter((t) => !t.done).length} open`}>Tasks</Title>
      <Box>
        <div className="flex flex-wrap gap-2 border-b border-border p-3"><Input aria-label="New task" className="h-9 min-w-[200px] flex-1" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Add a task" /><Input aria-label="Due date" type="date" className="h-9 w-40" value={due} onChange={(e) => setDue(e.target.value)} /><Button disabled={!txt.trim()} onClick={() => { A.addTask(txt, due); setTxt("") }}>Add</Button></div>
        {mine.map((t) => <div key={t.id} className="flex items-center gap-3 border-b border-border px-5 py-3 text-sm last:border-0"><Checkbox checked={t.done} onCheckedChange={() => A.toggleTask(t.id)} aria-label={t.text} /><Link to={t.link} className={cn("flex-1 hover:underline", t.done && "text-hushed line-through")}>{t.text}</Link><span className="text-xs text-hushed">{fmtD(t.due)}</span></div>)}
        {!mine.length && <Empty title="No tasks" />}
      </Box>
    </>
  )
}
export function Profile() {
  const s = useApp(), role = useRole()
  const [pw, setPw] = useState({ a: "", b: "" }), [err, setErr] = useState("")
  return (
    <>
      <Title sub={s.session?.email}>Profile</Title>
      <div className="grid gap-4 lg:grid-cols-2">
        <Box title="Account" pad><Row k="Name">{s.session?.name ?? (role === "owner" ? "Dana Whitfield" : "Priya Raman")}</Row><Row k="Role">{role === "owner" ? "Owner" : "AR specialist"}</Row><Row k="Organization">{s.settings.company.name}</Row></Box>
        <Box title="Change password" pad><div className="space-y-3"><Field label="New password" hint="At least 10 characters."><Input type="password" autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} /></Field><Field label="Confirm"><Input type="password" autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} /></Field>{err && <p role="alert" className="text-sm text-destructive">{err}</p>}<Button onClick={() => { if (pw.a.length < 10) return setErr("Use at least 10 characters."); if (pw.a !== pw.b) return setErr("The passwords do not match."); setErr(""); setPw({ a: "", b: "" }); toast.success("Password changed") }}>Update password</Button></div></Box>
        <Box title="Two-step verification" pad><label className="flex items-center gap-3 text-sm"><span className="flex-1">Use an authenticator app</span><Switch aria-label="Two-step verification" onCheckedChange={(v) => toast.success(v ? "Two-step verification on" : "Two-step verification off")} /></label></Box>
        <Box title="My notifications" pad>{["Approvals", "Payments needing review", "Daily digest"].map((l) => <label key={l} className="flex items-center gap-3 border-b border-border py-2.5 text-sm last:border-0"><span className="flex-1">{l}</span><Switch aria-label={l} defaultChecked={l !== "Daily digest"} /></label>)}</Box>
      </div>
    </>
  )
}
void usd; void ({} as Member)

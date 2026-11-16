import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Lock, Mail, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Box, DataTable, Empty, Field, Locked, Modal, NativeSelect, Pill, Title } from "@/components/app/ui"
import { NotFound } from "@/components/app/System"
import { errorMessage } from "@/lib/errors"
import { useArPermissions, useChangeMember, useInvitations, useInvite, useMembers, useResend, useRevoke, useSetArPermissions, type Member } from "./api"

const roleName = (k: string) => (k === "owner" ? "Owner" : "AR specialist")
const ago = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
const Loading = () => <div role="status" aria-busy="true" className="h-40 animate-pulse rounded-xl bg-muted" />

/** Team on the real API. Owners manage; everyone else gets the locked state (the server enforces it too). */
type Sent = { link: string; emailed: boolean }
/** The email can land in spam, so the person inviting always gets the link too. */
const announce = (r: Sent, ok: string) => toast[r.emailed ? "success" : "warning"](r.emailed ? ok : "Invitation saved, but the email could not be sent", { description: "If it does not arrive, check spam or share the link yourself.", duration: 12000, action: { label: "Copy link", onClick: () => void navigator.clipboard.writeText(r.link).then(() => toast.success("Link copied")) } })

export function RemoteTeam() {
  const nav = useNavigate(), members = useMembers(), invites = useInvitations()
  const invite = useInvite(), resend = useResend(), revoke = useRevoke()
  const [open, setOpen] = useState(false), [email, setEmail] = useState(""), [role, setRole] = useState("ar_specialist"), [err, setErr] = useState("")
  if (invites.isError && (invites.error as { status?: number }).status === 403) return <Locked what="Team" />
  const send = () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Enter a valid email address.")
    invite.mutate({ email, role_key: role }, { onSuccess: (r) => { setOpen(false); setEmail(""); setErr(""); announce(r as Sent, "Invitation sent") }, onError: (e) => setErr(errorMessage(e)) })
  }
  const list = members.data ?? [], pending = invites.data ?? []
  return (
    <>
      <Title sub={`${list.length} members · ${pending.length} pending`} right={<Button onClick={() => setOpen(true)}><Plus className="size-4" />Invite</Button>}>Team</Title>
      <Box title="Members">
        {members.isPending ? <Loading /> : (
          <DataTable rows={list} id={(m) => m.id} onRow={(m) => nav("/app/team/" + m.id)} search={(m) => m.full_name + m.email}
            cols={[{ key: "n", label: "Name", sort: (m) => m.full_name, render: (m) => <div><div>{m.full_name}</div><div className="text-xs text-hushed">{m.email}</div></div> },
              { key: "r", label: "Role", render: (m) => <Pill tone={m.role_key === "owner" ? "blue" : "grey"}>{roleName(m.role_key)}</Pill> },
              { key: "j", label: "Joined", hide: "md", render: (m) => ago(m.joined_at) },
              { key: "s", label: "Status", render: (m) => <Pill tone={m.status === "active" ? "green" : "amber"}>{m.status}</Pill> }]} />)}
      </Box>
      <Box className="mt-3" title="Pending invitations">
        <DataTable rows={pending} id={(i) => i.id} empty={<Empty title="No pending invitations" />}
          cols={[{ key: "e", label: "Email", render: (i) => i.email }, { key: "r", label: "Role", render: (i) => roleName(i.role_key) },
            { key: "x", label: "Expires", hide: "md", render: (i) => ago(i.expires_at) },
            { key: "a", label: "", right: true, render: (i) => (
              <span className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" disabled={resend.isPending} onClick={() => resend.mutate(i.id, { onSuccess: (r) => announce(r as Sent, "Invitation sent again") })}>Resend</Button>
                <Button variant="ghost" size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate(i.id, { onSuccess: () => toast.success("Invitation withdrawn") })}>Revoke</Button>
              </span>) }]} />
      </Box>
      <Modal open={open} onOpenChange={setOpen} title="Invite a teammate" desc="They receive an email with a link that expires in 7 days."
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={invite.isPending} onClick={send}><Mail className="size-4" />Send invitation</Button></>}>
        <div className="space-y-3">
          <Field label="Work email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Role"><NativeSelect value={role} onChange={(e) => setRole(e.target.value)}><option value="ar_specialist">AR specialist</option><option value="owner">Owner</option></NativeSelect></Field>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        </div>
      </Modal>
    </>
  )
}

const LABEL: Record<string, string> = { "approvals.decide": "Approve write-offs, credits and refunds", "collections.send": "Send collection emails without approval", "integrations.manage": "Manage integrations", "audit.view": "View the audit log", "invoices.manage": "Create and edit invoices", "payments.manage": "Create and edit payments", "reports.financial": "Organization-wide financial reports", "settings.view": "View organization settings", "reports.export": "Export CSV files" }

export function RemoteMemberDetail() {
  const { id } = useParams(), members = useMembers(), perms = useArPermissions(), change = useChangeMember(), save = useSetArPermissions()
  if (members.isPending) return <Loading />
  if (members.isError) return <Locked what="Team" />
  const m: Member | undefined = members.data.find((x) => x.id === id)
  if (!m) return <NotFound what="member" back="/app/team" />
  const owners = members.data.filter((x) => x.role_key === "owner" && x.status === "active").length
  const last = m.role_key === "owner" && owners <= 1
  const apply = (v: { role_key?: string; status?: string }, ok: string) => change.mutate({ id: m.id, ...v }, { onSuccess: () => toast.success(ok), onError: (e) => toast.error(errorMessage(e)) })
  const toggle = (key: string, on: boolean) => {
    const granted = (perms.data ?? []).filter((p) => p.granted && p.key !== key).map((p) => p.key)
    save.mutate(on ? [...granted, key] : granted, { onSuccess: () => toast.success("Permissions updated for all AR specialists"), onError: (e) => toast.error(errorMessage(e)) })
  }
  return (
    <>
      <Title back={["/app/team", "Team"]} sub={m.email} right={m.status === "suspended"
        ? <Button onClick={() => apply({ status: "active" }, "Access restored")}>Reactivate</Button>
        : <Button variant="outline" disabled={last} onClick={() => apply({ status: "suspended" }, "Access suspended")}>Suspend</Button>}>{m.full_name}</Title>
      <div className="grid gap-4 lg:grid-cols-2">
        <Box title="Role" pad>
          <NativeSelect aria-label="Role" value={m.role_key} disabled={last} onChange={(e) => apply({ role_key: e.target.value }, "Role updated")}><option value="owner">Owner</option><option value="ar_specialist">AR specialist</option></NativeSelect>
          {last && <p className="mt-2 flex gap-1.5 text-xs text-hushed"><Lock className="size-3.5" />The last owner cannot be changed or suspended.</p>}
        </Box>
        <Box title="AR specialist permissions" pad>
          <p className="mb-2 text-xs text-hushed">These apply to every AR specialist in the organization.</p>
          {(perms.data ?? []).filter((p) => LABEL[p.key]).map((p) => (
            <div key={p.key} className="flex items-center gap-3 border-b border-border py-2.5 text-sm last:border-0">
              <span className="flex-1">{LABEL[p.key]}{p.locked && <span className="ml-2 text-xs text-hushed">{p.reason}</span>}</span>
              <Switch aria-label={LABEL[p.key]} checked={p.granted} disabled={p.locked || save.isPending} onCheckedChange={(v) => toggle(p.key, v)} />
            </div>))}
        </Box>
      </div>
    </>
  )
}

import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Check } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Box, DataTable, Empty, Field, Modal, NativeSelect, Pill, Row, Seg, TextArea, Title, type Tone } from "@/components/app/ui"
import { NotFound } from "@/components/app/System"
import { useRole } from "@/components/app/Shell"
import { ApiError } from "@/api/errors"
import { errorMessage } from "@/lib/errors"
import { cmp, formatMoney, isDecimal } from "@/lib/money"
import { TYPE_LABEL, useApproval, useApprovals, useDecide, usePolicies, useReply, useRequestAdjustment, useSetPolicy, useWithdraw, type AdjType, type ApprovalStatus, type Policy } from "./api"

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
const TONE: Record<ApprovalStatus, Tone> = { pending: "amber", info_requested: "blue", approved: "green", rejected: "red", withdrawn: "grey", expired: "grey" }
const label = (s: string) => s.replace("_", " ")
const Loading = () => <div role="status" aria-busy="true" className="h-48 animate-pulse rounded-xl bg-muted" />

export function RemoteApprovals() {
  const role = useRole(), nav = useNavigate(), owner = role === "owner"
  const [tab, setTab] = useState<"pending" | "info" | "decided">("pending")
  const q = useApprovals(tab), pend = useApprovals("pending"), info = useApprovals("info")
  return (
    <>
      <Title sub={owner ? "Owners decide. Every decision is logged and cannot be edited." : "Requests you submitted. Owners decide."}>{owner ? "Approvals" : "My requests"}</Title>
      <Seg items={[{ v: "pending", label: "Pending", n: pend.data?.total }, { v: "info", label: "Info requested", n: info.data?.total }, { v: "decided", label: "Decided" }] as const} value={tab} onChange={setTab} />
      <Box><DataTable rows={q.data?.data ?? []} id={(a) => a.id} loading={q.isPending} onRow={(a) => nav("/app/approvals/" + a.id)} empty={<Empty title="Nothing here" sub="Requests will appear as they are submitted." />}
        cols={[{ key: "n", label: "Request", render: (a) => <div><span className="font-mono text-xs">{a.number}</span><div className="text-xs text-hushed">{TYPE_LABEL[a.type]}</div></div> },
          { key: "c", label: "Customer", render: (a) => <div>{a.customer}<div className="font-mono text-xs text-hushed">{a.invoice_number}</div></div> }, { key: "a", label: "Amount", right: true, render: (a) => formatMoney(a.amount, a.currency) },
          { key: "by", label: "Requested by", hide: "md", render: (a) => a.requested_by }, { key: "w", label: "When", hide: "lg", render: (a) => day(a.requested_at) }, { key: "s", label: "Status", render: (a) => <Pill tone={TONE[a.status]}>{label(a.status)}</Pill> }]} /></Box>
    </>
  )
}

export function RemoteApprovalDetail() {
  const { id = "" } = useParams(), role = useRole(), q = useApproval(id), decide = useDecide(), reply = useReply(), withdraw = useWithdraw()
  const [comment, setComment] = useState(""), [stale, setStale] = useState(false)
  if (q.isPending) return <Loading />
  if (q.isError || !q.data) return <NotFound what="request" back="/app/approvals" />
  const a = q.data, open = a.status === "pending" || a.status === "info_requested", im = a.impact
  const fail = (e: unknown) => { if (e instanceof ApiError && e.code === "approval_stale") setStale(true); else if (e instanceof ApiError && e.status === 403) toast.error(e.message); else toast.error(errorMessage(e)) }
  const go = (decision: "approve" | "reject" | "request_info", confirm = false) => {
    if (decision === "reject" && !comment.trim()) return toast.error("Give a reason for rejecting. It is recorded in the audit log.")
    if (decision === "request_info" && !comment.trim()) return toast.error("Say what information you need.")
    decide.mutate({ id, decision, comment, confirm_stale: confirm }, { onSuccess: () => { setComment(""); setStale(false); toast.success("Decision recorded") }, onError: fail })
  }
  return (
    <>
      <Title back={["/app/approvals", role === "owner" ? "Approvals" : "My requests"]} sub={`Requested by ${a.requested_by} on ${day(a.requested_at)}`}>{TYPE_LABEL[a.type]} · {formatMoney(a.amount, a.currency)} <Pill tone={TONE[a.status]}>{label(a.status)}</Pill></Title>
      {open && (im.stale || stale) && <div role="alert" className="mb-4 rounded-xl border border-[#e0b13a] bg-[#fff8e1] p-4 text-sm">The invoice changed since this was requested: its balance was {formatMoney(im.balance_at_request, a.currency)} and is now {formatMoney(im.balance_now, a.currency)}. Check the impact before you approve.
        {role === "owner" && <div className="mt-2"><Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => go("approve", true)}>Approve anyway</Button></div>}</div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Box title="Request" pad><Row k="Request"><span className="font-mono text-xs">{a.number}</span></Row><Row k="Customer">{a.customer}</Row><Row k="Invoice"><Link className="underline-offset-2 hover:underline" to={"/app/invoices/" + a.invoice_id}>{a.invoice_number}</Link></Row><Row k="Reason">{a.reason}</Row><Row k="Expires">{day(a.expires_at)}</Row></Box>
          {im.affects_balance && <Box title="Impact" pad><div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]"><div className="rounded-lg bg-muted p-4"><div className="text-xs text-hushed">Balance now</div><div className="text-2xl tabular-nums">{formatMoney(im.balance_now, a.currency)}</div></div><span className="text-center text-hushed">→</span><div className="rounded-lg bg-muted p-4"><div className="text-xs text-hushed">After approval</div><div className="text-2xl tabular-nums">{formatMoney(a.status === "approved" ? im.balance_now : im.balance_after, a.currency)}</div></div></div></Box>}
          {!im.affects_balance && <Box title="Impact" pad><p className="text-sm text-hushed">A refund due is recorded against the invoice. It does not change the balance, and venn does not move money.</p></Box>}
          {role === "owner" && open && (
            <Box title="Decision" pad>
              <Field label="Comment"><TextArea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional for approval. Required to reject or ask for information." /></Field>
              <div className="mt-4 flex flex-wrap gap-2"><Button disabled={decide.isPending} onClick={() => go("approve")}><Check className="size-4" />Approve</Button><Button variant="outline" disabled={decide.isPending} onClick={() => go("reject")}>Reject</Button><Button variant="outline" disabled={decide.isPending} onClick={() => go("request_info")}>Ask for information</Button></div>
              <p className="mt-2 text-xs text-hushed">You cannot decide a request you submitted yourself.</p>
            </Box>)}
          {a.status === "info_requested" && <Box title="Reply" pad><Field label="Your reply"><TextArea value={comment} onChange={(e) => setComment(e.target.value)} /></Field><Button className="mt-3" disabled={!comment.trim() || reply.isPending} onClick={() => reply.mutate({ id, comment }, { onSuccess: () => { setComment(""); toast.success("Reply sent") }, onError: fail })}>Send reply</Button></Box>}
          {open && <Button variant="outline" disabled={withdraw.isPending} onClick={() => withdraw.mutate(id, { onSuccess: () => toast.success("Request withdrawn"), onError: fail })}>Withdraw request</Button>}
        </div>
        <aside><Box title="History" pad>{a.decisions.length ? a.decisions.map((d, i) => <div key={i} className="border-b border-border py-2 text-sm last:border-0"><div className="capitalize">{label(d.decision)}{d.by ? ` · ${d.by}` : ""}</div>{d.comment && <div className="text-hushed">{d.comment}</div>}<div className="text-xs text-hushed">{new Date(d.at).toLocaleString("en-GB")}</div></div>) : <p className="text-sm text-hushed">No decisions yet.</p>}<p className="mt-2 text-xs text-hushed">Decisions cannot be edited.</p></Box></aside>
      </div>
    </>
  )
}

/** Button and form on an invoice: anyone who can request an adjustment sends it for approval. */
export function RequestAdjustment({ invoiceId, number, balance, paid, currency }: { invoiceId: string; number: string; balance: string; paid: string; currency: string }) {
  const [open, setOpen] = useState(false), [type, setType] = useState<AdjType>("write_off"), [amount, setAmount] = useState(""), [reason, setReason] = useState(""), [err, setErr] = useState("")
  const req = useRequestAdjustment(), nav = useNavigate(), limit = type === "refund_due" ? paid : balance
  const close = () => { setOpen(false); setErr(""); setAmount(""); setReason("") }
  const submit = () => {
    if (!isDecimal(amount) || cmp(amount, "0") <= 0) return setErr("Enter an amount above zero.")
    if (cmp(amount, limit) > 0) return setErr(`The most that can be requested is ${formatMoney(limit, currency)}.`)
    if (!reason.trim()) return setErr("A reason is required.")
    req.mutate({ type, invoice_id: invoiceId, amount, reason }, { onSuccess: (r) => { toast.success(r.status === "approved" ? "Approved within the auto-approve limit" : "Sent for approval"); close(); if (r.status === "pending") nav("/app/approvals/" + r.id) }, onError: (e) => setErr(errorMessage(e)) })
  }
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>Request adjustment</Button>
      <Modal open={open} onOpenChange={(o) => !o && close()} title={`Adjust ${number}`} desc="A person other than you decides. Nothing changes until it is approved." footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={req.isPending} onClick={submit}>Submit request</Button></>}>
        <div className="space-y-3">
          <Field label="Type"><NativeSelect value={type} onChange={(e) => setType(e.target.value as AdjType)}>{(Object.keys(TYPE_LABEL) as AdjType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</NativeSelect></Field>
          <Field label="Amount" hint={`Up to ${formatMoney(limit, currency)}`}><Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" /></Field>
          <Field label="Reason"><TextArea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        </div>
      </Modal>
    </>
  )
}

/** Settings → Approvals: one row per request type. */
export function RemotePolicies() {
  const q = usePolicies()
  if (q.isPending) return <Loading />
  return (
    <Box pad>
      <p className="mb-4 max-w-[560px] text-sm text-hushed">Requests at or below the limit are approved automatically. A limit of 0 means every request needs an owner. Refunds always need an owner. Nobody approves their own request.</p>
      <div className="space-y-4">{(q.data ?? []).map((p) => <PolicyRow key={p.type + p.auto_approve_below + p.expiry_days} p={p} />)}</div>
    </Box>
  )
}

function PolicyRow({ p }: { p: Policy }) {
  const [below, setBelow] = useState(p.auto_approve_below.replace(/\.?0+$/, "") || "0"), [days, setDays] = useState(String(p.expiry_days)), save = useSetPolicy()
  const submit = () => {
    if (!isDecimal(below) || cmp(below, "0") < 0) return toast.error("Enter a limit of 0 or more.")
    const n = Number(days)
    if (!Number.isInteger(n) || n < 1 || n > 365) return toast.error("Expiry must be 1 to 365 days.")
    save.mutate({ type: p.type, auto_approve_below: below, expiry_days: n }, { onSuccess: () => toast.success(`${TYPE_LABEL[p.type]} policy saved`), onError: (e) => toast.error(errorMessage(e)) })
  }
  return (
    <div className="grid max-w-[640px] items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <div className="pb-2 text-sm">{TYPE_LABEL[p.type]}</div>
      <Field label="Auto-approve up to"><Input value={below} disabled={p.type === "refund_due"} onChange={(e) => setBelow(e.target.value)} inputMode="decimal" /></Field>
      <Field label="Expires after (days)"><Input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" /></Field>
      <Button disabled={save.isPending} onClick={submit}>Save</Button>
    </div>
  )
}

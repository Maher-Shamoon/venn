import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Box, DataTable, Empty, Field, Modal, Mono, NativeSelect, Pill, Seg, TextArea, Title, type Tone } from "@/components/app/ui"
import { NotFound } from "@/components/app/System"
import { useRole } from "@/components/app/Shell"
import { ApiError } from "@/api/errors"
import { errorMessage } from "@/lib/errors"
import { cmp, formatMoney, isDecimal } from "@/lib/money"
import { useCase, useCaseNote, useCases, useDraft, useFinalNotice, usePromise, useSend, type CaseRow } from "./api"

const day = (iso: string) => new Date(iso + (iso.length === 10 ? "T00:00:00Z" : "")).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
const label = (s: string) => s.replace(/_/g, " ")
const STAGE_TONE: Record<string, Tone> = { reminder_1: "grey", reminder_2: "amber", final_notice: "red", promise: "blue" }
const Loading = () => <div role="status" aria-busy="true" className="h-48 animate-pulse rounded-xl bg-muted" />
const FILTERS = [{ v: "all", label: "All" }, { v: "due_today", label: "Due today" }, { v: "reminder_1", label: "Reminder 1" }, { v: "reminder_2", label: "Reminder 2" }, { v: "final_notice", label: "Final notice" }, { v: "promise", label: "Promise to pay" }, { v: "paused", label: "Paused" }] as const

export function RemoteCollections() {
  const [f, setF] = useState<(typeof FILTERS)[number]["v"]>("all"), q = useCases(f), nav = useNavigate()
  const rows = q.data ?? []
  return (
    <>
      <Title sub="One case per customer with overdue invoices. venn drafts from your records. A person sends.">Collections</Title>
      <Seg items={FILTERS} value={f} onChange={setF} />
      {q.isPending ? <Loading /> : (
        <Box><DataTable rows={rows} id={(c: CaseRow) => c.id} onRow={(c) => nav("/app/collections/" + c.id)} search={(c) => c.customer + c.number} defaultSort={["p", -1]} empty={<Empty title={f === "all" ? "Nothing is overdue" : "No cases in this view"} sub={f === "all" ? "A case opens by itself when an invoice passes its due date." : undefined} />}
          cols={[{ key: "c", label: "Customer", sort: (c) => c.customer, render: (c) => <div>{c.customer}<div className="font-mono text-[0.75rem] text-hushed">{c.number}</div></div> }, { key: "b", label: "Overdue", right: true, sort: (c) => Number(c.balance), render: (c) => formatMoney(c.balance) },
            { key: "d", label: "Days late", right: true, hide: "md", sort: (c) => c.days_late, render: (c) => c.days_late }, { key: "p", label: "Priority", right: true, hide: "md", sort: (c) => Number(c.priority), render: (c) => <span title="Balance weighted by days overdue">{Number(c.priority).toLocaleString("en-GB")}</span> },
            { key: "s", label: "Stage", render: (c) => <span className="inline-flex gap-1"><Pill tone={STAGE_TONE[c.stage]}>{label(c.stage)}</Pill>{c.paused_reason && <Pill tone="amber">paused</Pill>}{c.broken_promise && <Pill tone="red">promise broken</Pill>}</span> },
            { key: "n", label: "Next", hide: "lg", render: (c) => (c.next_action_date ? day(c.next_action_date) : "") }]} /></Box>)}
    </>
  )
}

export function RemoteCollectionDetail() {
  const { id = "" } = useParams(), role = useRole(), q = useCase(id), draft = useDraft(), send = useSend(), promise = usePromise(), note = useCaseNote(), final = useFinalNotice()
  const [tone, setTone] = useState("friendly"), [subject, setSubject] = useState(""), [body, setBody] = useState(""), [modal, setModal] = useState<null | "promise" | "note">(null), [txt, setTxt] = useState(""), [pd, setPd] = useState(""), [pa, setPa] = useState(""), [err, setErr] = useState("")
  if (q.isPending) return <Loading />
  if (q.isError || !q.data) return <NotFound what="case" back="/app/collections" />
  const c = q.data, close = () => { setModal(null); setTxt(""); setErr("") }
  const fail = (e: unknown) => toast.error(e instanceof ApiError && (e.status === 403 || e.status === 409 || e.status === 422) ? e.message : errorMessage(e))
  const make = () => draft.mutate({ id, tone }, { onSuccess: (d) => { setSubject(d.subject); setBody(d.body) }, onError: fail })
  const go = (mode: "email" | "mark_sent") => send.mutate({ id, subject, body, mode }, { onSuccess: () => { toast.success(mode === "email" ? "Sent" : "Marked as sent"); setSubject(""); setBody("") }, onError: fail })
  const savePromise = () => {
    if (!pd || !isDecimal(pa) || cmp(pa, "0") <= 0) return setErr("Choose a date and enter the promised amount.")
    promise.mutate({ id, promise_date: pd, promise_amount: pa }, { onSuccess: () => { toast.success("Promise recorded"); close() }, onError: (e) => setErr(errorMessage(e)) })
  }
  return (
    <>
      <Title back={["/app/collections", "Collections"]} sub={<><Mono>{c.number}</Mono> · {c.overdue_invoices} overdue invoice{c.overdue_invoices === 1 ? "" : "s"} · {formatMoney(c.balance)}</>}
        right={<><Button variant="outline" onClick={() => setModal("promise")}>Record a promise</Button><Button variant="outline" onClick={() => setModal("note")}>Add note</Button></>}>{c.customer}</Title>
      <div className="mb-4 flex flex-wrap gap-2"><Pill tone={STAGE_TONE[c.stage]}>{label(c.stage)}</Pill>{c.paused_reason && <Pill tone="amber">paused: {c.paused_reason}</Pill>}{c.broken_promise && <Pill tone="red">promise broken</Pill>}{c.stage === "promise" && c.promise_date && <Pill tone="blue">promised {formatMoney(c.promise_amount ?? "0")} by {day(c.promise_date)}</Pill>}</div>
      {c.paused_reason && <div role="status" className="mb-4 rounded-xl border border-[#e0b13a] bg-[#fff8e1] p-4 text-sm">This case is paused because of a {c.paused_reason}. Nothing can be sent until it is resolved.</div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <Box title="Overdue invoices"><DataTable rows={c.invoices} id={(i) => i.id} pageSize={20} cols={[{ key: "n", label: "Invoice", render: (i) => <Link className="font-mono text-xs underline-offset-2 hover:underline" to={"/app/invoices/" + i.id}>{i.number}</Link> }, { key: "d", label: "Due", render: (i) => day(i.due_date) }, { key: "l", label: "Days late", right: true, render: (i) => i.days_late }, { key: "b", label: "Balance", right: true, render: (i) => <span>{formatMoney(i.balance, i.currency)}{i.disputed && <Pill tone="amber">disputed</Pill>}</span> }]} /></Box>
          <Box title="Message" pad>
            <div className="flex flex-wrap items-end gap-3"><Field label="Tone"><NativeSelect value={tone} onChange={(e) => setTone(e.target.value)}><option value="friendly">Friendly</option><option value="firm">Firm</option><option value="final">Final notice</option></NativeSelect></Field><Button variant="outline" disabled={draft.isPending} onClick={make}>Draft from records</Button></div>
            <p className="mt-2 text-xs text-hushed">The draft uses only invoice numbers, amounts and dates from this case. Anything else you type is checked before it can be sent.</p>
            {(subject || body) && <div className="mt-4 space-y-3"><Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field><Field label="Message"><TextArea className="min-h-[220px]" value={body} onChange={(e) => setBody(e.target.value)} /></Field>
              {c.stage === "final_notice" && !c.final_approved && <p className="rounded-lg bg-muted p-3 text-sm">A final notice needs an approved request before it can be sent. {c.final_approval_id ? <Link className="underline underline-offset-2" to={"/app/approvals/" + c.final_approval_id}>See the request</Link> : <Button size="sm" className="ml-2" disabled={final.isPending} onClick={() => final.mutate(id, { onSuccess: () => toast.success("Sent for approval"), onError: fail })}>Request approval</Button>}</p>}
              <div className="flex flex-wrap gap-2"><Button disabled={send.isPending || !subject.trim() || !body.trim()} onClick={() => go("email")}>{role === "owner" ? "Send email" : "Send email (owners)"}</Button><Button variant="outline" disabled={send.isPending || !subject.trim() || !body.trim()} onClick={() => go("mark_sent")}>Mark as sent</Button></div>
              <p className="text-xs text-hushed">{c.has_email ? `Goes to ${c.contact_email}.` : "This customer has no contact email, so use Mark as sent after sending it yourself."} In this version sending is recorded and logged, and real delivery needs the mail settings of the deployment.</p></div>}
          </Box>
        </div>
        <aside className="space-y-4">
          <Box title="Priority" pad><div className="text-3xl tabular-nums">{Number(c.priority).toLocaleString("en-GB")}</div><p className="mt-1 text-xs text-hushed">{c.priority_note}</p>{c.next_action_date && <p className="mt-2 text-sm">Next action {day(c.next_action_date)}</p>}</Box>
          <Box title="Timeline" pad>{c.events.slice().reverse().map((e, i) => <div key={i} className="border-b border-border py-2 text-sm last:border-0"><div>{e.text}</div><div className="text-xs text-hushed">{e.by ?? "venn"} · {when(e.at)}</div></div>)}</Box>
        </aside>
      </div>
      <Modal open={modal === "promise"} onOpenChange={(o) => !o && close()} title="Record a promise to pay" desc="The case waits until the date. If the money has not arrived by then it returns to the queue." footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={promise.isPending} onClick={savePromise}>Save</Button></>}>
        <div className="space-y-3"><Field label="Promised date"><Input type="date" value={pd} onChange={(e) => setPd(e.target.value)} /></Field><Field label="Promised amount"><Input value={pa} inputMode="decimal" onChange={(e) => setPa(e.target.value)} /></Field>{err && <p role="alert" className="text-sm text-destructive">{err}</p>}</div></Modal>
      <Modal open={modal === "note"} onOpenChange={(o) => !o && close()} title="Add note" footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={!txt.trim() || note.isPending} onClick={() => note.mutate({ id, text: txt }, { onSuccess: () => { toast.success("Note added"); close() }, onError: fail })}>Add note</Button></>}><TextArea aria-label="Note" value={txt} onChange={(e) => setTxt(e.target.value)} /></Modal>
    </>
  )
}

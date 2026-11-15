import { useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Box, DataTable, Empty, Field, Modal, Mono, NativeSelect, Pill, Seg, TextArea, Title, type Tone } from "@/components/app/ui"
import { NotFound } from "@/components/app/System"
import { ApiError } from "@/api/errors"
import { errorMessage } from "@/lib/errors"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import { useMembers } from "@/features/team/api"
import { useUploadDocument } from "@/features/documents/api"
import { useCaseEmails, useIntegrations, type Mail } from "@/features/integrations/api"
import { useAct, useAddEvidence, useCase, useCases, useDismissCase, useMove, useNote, useRemoveEvidence, useRerun, useResolveCase, type Card, type Finding, type Status } from "./api"

const COLS: { k: Status; label: string }[] = [{ k: "new", label: "New" }, { k: "in_progress", label: "In progress" }, { k: "ready_for_review", label: "Ready for review" }, { k: "awaiting_approval", label: "Awaiting approval" }, { k: "monitoring", label: "Monitoring" }, { k: "resolved", label: "Resolved" }]
const STATUS_TONE: Record<Status, Tone> = { new: "grey", in_progress: "blue", ready_for_review: "amber", awaiting_approval: "blue", monitoring: "grey", resolved: "green", dismissed: "grey" }
const PRI_TONE: Record<string, Tone> = { critical: "red", high: "red", medium: "amber", low: "grey" }
const label = (s: string) => s.replace(/_/g, " ")
const day = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
const Loading = () => <div role="status" aria-busy="true" className="h-48 animate-pulse rounded-xl bg-muted" />
const sum = (rows: Card[]) => rows.reduce((n, g) => n + Number(g.exposure), 0)

function Board({ rows }: { rows: Card[] }) {
  const nav = useNavigate(), move = useMove(), [over, setOver] = useState<string | null>(null)
  const go = (id: string, to: Status) => { const g = rows.find((x) => x.id === id); if (g && g.status !== to) move.mutate({ id, status: to }, { onSuccess: () => toast.success(`Moved to ${label(to)}`), onError: (e) => toast.error(errorMessage(e)) }) }
  return (
    <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-3" role="list" aria-label="Investigations board">
      {COLS.map(({ k, label: name }) => {
        const col = rows.filter((g) => (k === "resolved" ? g.status === "resolved" || g.status === "dismissed" : g.status === k))
        return (
          <section key={k} role="listitem" aria-label={name} onDragOver={(e) => { e.preventDefault(); setOver(k) }} onDragLeave={() => setOver(null)} onDrop={(e) => { e.preventDefault(); setOver(null); go(e.dataTransfer.getData("text/plain"), k) }}
            className={cn("w-[290px] shrink-0 snap-start rounded-xl border-[0.8px] bg-muted/60 p-2 transition-colors", over === k ? "border-[#f472b6] bg-[#fdf2f8]" : "border-border")}>
            <header className="flex items-baseline gap-2 px-2 pb-2 pt-1"><h2 className="text-sm">{name}</h2><span className="text-xs text-hushed">{col.length}</span><span className="ml-auto text-xs tabular-nums text-hushed">{formatMoney(sum(col).toFixed(2))}</span></header>
            <div className="space-y-2">
              {col.map((g) => (
                <div key={g.id} draggable={g.status !== "resolved" && g.status !== "dismissed"} onDragStart={(e) => e.dataTransfer.setData("text/plain", g.id)} className="relative cursor-grab rounded-lg border-[0.8px] border-border bg-white p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-22px_rgba(12,10,8,.5)] active:cursor-grabbing">
                  <button type="button" onClick={() => nav("/app/investigations/" + g.id)} className="block w-full text-left">
                    <div className="flex items-center gap-2 font-mono text-[11px] text-hushed">{g.number}<span className="ml-auto"><Pill tone={PRI_TONE[g.priority]}>{g.priority}</Pill></span></div>
                    <div className="mt-1.5 text-sm leading-5">{g.title}</div>
                    {g.analysis_status === "insufficient_evidence" && <div className="mt-1"><Pill tone="amber">needs evidence</Pill></div>}
                    <div className="truncate text-xs text-hushed">{g.customer}</div>
                    <div className="mt-2 flex items-center justify-between text-sm"><span className="tabular-nums">{formatMoney(g.exposure, g.currency)}</span><span className="text-xs text-hushed">{g.assignee ?? "Unassigned"}</span></div>
                  </button>
                  {g.status !== "resolved" && g.status !== "dismissed" && <select aria-label={"Move " + g.number} value={g.status} onChange={(e) => go(g.id, e.target.value as Status)} className="sr-only focus:not-sr-only focus:mt-2 focus:h-8 focus:w-full focus:rounded-md focus:border focus:border-input focus:bg-white focus:px-2 focus:text-sm">{COLS.filter((c) => c.k !== "resolved").map((c) => <option key={c.k} value={c.k}>{c.label}</option>)}</select>}
                </div>))}
              {!col.length && <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-hushed">Nothing here.</div>}
            </div>
          </section>)
      })}
    </div>
  )
}

export function RemoteInvestigations() {
  const nav = useNavigate(), [params] = useSearchParams(), [view, setView] = useState<"board" | "table">("board"), [f, setF] = useState<"all" | "mine" | "ready" | "awaiting" | "monitoring">(["mine", "ready", "awaiting", "monitoring"].includes(params.get("filter") ?? "") ? (params.get("filter") as "mine") : "all")
  const q = useCases(f, ""), all = useCases("all", "")
  const open = (all.data ?? []).filter((g) => g.status !== "resolved" && g.status !== "dismissed")
  const rows = q.data ?? []
  return (
    <>
      <Title sub={`${open.length} open · ${formatMoney(sum(open).toFixed(2))} exposure`} right={<Seg className="!mb-0" items={["board", "table"] as const} value={view} onChange={setView} />}>Investigations</Title>
      <Seg items={[{ v: "all", label: "All" }, { v: "mine", label: "Assigned to me" }, { v: "ready", label: "Ready for review" }, { v: "awaiting", label: "Awaiting approval" }, { v: "monitoring", label: "Monitoring" }] as const} value={f} onChange={setF} />
      {q.isPending ? <Loading /> : !rows.length && f === "all" ? <Box><Empty title="No investigations yet" sub="Cases open on their own when reconciliation finds a short payment, an overpayment or a duplicate. You can also open one from an invoice." action={<Button render={<Link to="/app/reconciliation" />}>Run reconciliation</Button>} /></Box> :
        view === "board" ? <Board rows={rows} /> : (
          <Box><DataTable rows={rows} id={(g) => g.id} onRow={(g) => nav("/app/investigations/" + g.id)} search={(g) => g.number + g.title + (g.customer ?? "")} defaultSort={["exp", -1]} empty={<Empty title="Nothing in this view" />}
            cols={[{ key: "n", label: "Case", render: (g) => <Mono>{g.number}</Mono> }, { key: "t", label: "Title", sort: (g) => g.title, render: (g) => g.title }, { key: "c", label: "Customer", hide: "md", sort: (g) => g.customer ?? "", render: (g) => g.customer }, { key: "exp", label: "Exposure", right: true, sort: (g) => Number(g.exposure), render: (g) => formatMoney(g.exposure, g.currency) },
              { key: "p", label: "Priority", render: (g) => <Pill tone={PRI_TONE[g.priority]}>{g.priority}</Pill> }, { key: "s", label: "Status", render: (g) => <Pill tone={STATUS_TONE[g.status]}>{label(g.status)}</Pill> }, { key: "a", label: "Assigned", hide: "lg", render: (g) => g.assignee ?? "Unassigned" }]} /></Box>)}
    </>
  )
}

const KIND: Record<Finding["kind"], { label: string; box: string; tag: string }> = {
  confirmed: { label: "CONFIRMED FACT", box: "border-l-[3px] border-l-[#2f9e44] border-border bg-white", tag: "text-[#17692b]" },
  calculated: { label: "CALCULATED BY venn, NOT BY AI", box: "border-transparent bg-muted font-mono text-[13px]", tag: "text-hushed" },
  possible: { label: "POSSIBLE EXPLANATION", box: "border-dashed border-[#d2cecb] bg-white", tag: "text-hushed" },
  claim: { label: "UNVERIFIED CLAIM · NOT CONFIRMED BY A PAYMENT RECORD", box: "border-dashed border-[#e0b13a] bg-[#fff8e1]", tag: "text-[#8a5a00]" },
  missing: { label: "MISSING EVIDENCE", box: "border-dashed border-[#a24a10]/40 bg-[#fdf3ec]", tag: "text-[#a24a10]" },
}
type Modal = null | "note" | "assign" | "dismiss" | "evidence" | "resolve" | "emails"

export function RemoteInvestigationDetail() {
  const { id = "" } = useParams(), q = useCase(id), move = useMove(), note = useNote(), addEv = useAddEvidence(), rmEv = useRemoveEvidence(), rerun = useRerun(), act = useAct(), resolve = useResolveCase(), dismiss = useDismissCase()
  const members = useMembers(), upload = useUploadDocument(), ints = useIntegrations(), mails = useCaseEmails(), [found, setFound] = useState<Mail[] | null>(null)
  const gmail = ints.data?.find((x) => x.provider === "gmail" && x.connected && x.status === "connected")
  const [tab, setTab] = useState<"findings" | "activity">("findings"), [modal, setModal] = useState<Modal>(null), [txt, setTxt] = useState(""), [kind, setKind] = useState<"document" | "email" | "manual">("document"), [assignee, setAssignee] = useState("")
  if (q.isPending) return <Loading />
  if (q.isError || !q.data) return <NotFound what="investigation" back="/app/investigations" />
  const g = q.data, a = g.analysis, ro = g.status === "resolved" || g.status === "dismissed", rec = a?.recommendation
  const close = () => { setModal(null); setTxt("") }
  const ok = (msg: string) => ({ onSuccess: () => { toast.success(msg); close() }, onError: (e: unknown) => toast.error(e instanceof ApiError && e.status === 403 ? e.message : errorMessage(e)) })
  const groups: Finding["kind"][] = ["confirmed", "calculated", "possible", "claim", "missing"]
  return (
    <>
      <Title back={["/app/investigations", "Investigations"]} sub={<><Mono>{g.number}</Mono> · {label(g.type)} · {g.customer} · {g.assignee ? `assigned to ${g.assignee}` : "unassigned"}</>} right={!ro && <>
        <Button variant="outline" onClick={() => rerun.mutate(id, ok("Analysis updated"))} disabled={rerun.isPending}>{rerun.isPending ? "Analysing…" : "Re-run analysis"}</Button>
        {members.data && <Button variant="outline" onClick={() => setModal("assign")}>Assign</Button>}<Button variant="outline" onClick={() => setModal("note")}>Add note</Button><Button variant="outline" onClick={() => setModal("dismiss")}>Dismiss</Button></>}>{g.title}</Title>
      <div className="mb-4 flex flex-wrap gap-2"><Pill tone={STATUS_TONE[g.status]}>{label(g.status)}</Pill><Pill tone={PRI_TONE[g.priority]}>{g.priority} priority</Pill><Pill tone="grey">exposure {formatMoney(g.exposure, g.currency)}</Pill>{a && <Pill tone="grey">analysis v{a.version}</Pill>}</div>
      {ro && <div className="mb-4 rounded-xl bg-muted p-4 text-sm">This investigation is {g.status}. It is read-only.{g.dismiss_reason ? ` Reason: ${g.dismiss_reason}` : ""}</div>}
      {!ro && a?.stale && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#e0b13a] bg-[#fff8e1] p-4 text-sm"><span className="flex-1">The records or evidence changed since this analysis. Run it again to see the current facts.</span><Button size="sm" onClick={() => rerun.mutate(id, ok("Analysis updated"))}>Re-run analysis</Button></div>}
      {!ro && a?.status === "insufficient_evidence" && <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#e0b13a] bg-[#fff8e1] p-4 text-sm"><AlertTriangle className="size-5 shrink-0 text-[#8a5a00]" /><span className="min-w-[220px] flex-1"><b className="font-normal text-[#8a5a00]">Not enough evidence.</b> {g.evidence.length} records are linked. Add a remittance advice, a document or a message from the customer, then run the analysis again.</span><Button size="sm" onClick={() => setModal("evidence")}>Add evidence</Button></div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <Seg items={["findings", "activity"] as const} value={tab} onChange={setTab} />
          {tab === "findings" ? (
            <div className="space-y-4">
              <Box title="What happened" pad><p>{a?.summary ?? "No analysis yet."}</p></Box>
              {a?.ai && a.ai.status === "ok" && <Box title="Explained by AI" right={<Pill tone="grey">checked against the findings</Pill>} pad>
                <div className="space-y-2">{a.ai.sentences.map((x, i) => <p key={i} className="text-sm">{x.text} <span className="font-mono text-[11px] text-hushed">[{x.cites.map((n) => "F" + n).join(", ")}]</span></p>)}</div>
                <p className="mt-3 text-xs text-hushed">Written by {a.ai.model} from the findings below, numbered F1 onward in the order listed. Sentences that stated something not in the findings were removed{a.ai.dropped ? ` (${a.ai.dropped} removed)` : ""}. It does not choose the recommendation.</p></Box>}
              {a?.ai?.status === "failed" && <p role="status" className="rounded-lg bg-muted p-3 text-sm text-hushed">The AI explanation was not available this time. The findings and recommendation below come from the records and are not affected.</p>}
              <Box title="Findings" pad><div className="space-y-2">{groups.flatMap((k) => (a?.findings ?? []).filter((x) => x.kind === k).map((x, i) => (
                <div key={k + i} className={cn("rounded-lg border p-4", KIND[k].box)}><div className={cn("mb-1 font-mono text-[11px]", KIND[k].tag)}>{KIND[k].label}</div><p className="text-sm">{x.text}</p></div>)))}</div></Box>
              <Box title="Recommendation" pad right={rec && <Pill tone="grey">{rec.gate === "approval" ? "needs approval" : "no approval needed"}</Pill>}>
                {rec ? <><p className="text-lg">{rec.label}{rec.amount ? ` · ${formatMoney(rec.amount, g.currency)}` : ""}</p><p className="mt-1 text-sm">{rec.why}</p><p className="mt-1 text-sm text-hushed">venn proposes. A person decides. It cannot approve, allocate or send on its own.</p>
                  {!ro && <div className="mt-4"><Button disabled={act.isPending} onClick={() => act.mutate({ id, action: rec.action }, ok(rec.gate === "approval" ? "Sent for approval" : "Moved to monitoring"))}>{rec.gate === "approval" ? "Submit for approval" : rec.label}</Button></div>}</>
                  : <p className="text-sm text-hushed">{a?.status === "insufficient_evidence" ? "No recommendation until there is enough evidence. Link more evidence and run the analysis again." : "No recommendation for this case. Add notes and resolve it when it is settled."}</p>}
              </Box>
              {g.approval_id && <Box title="Approval" right={<Pill tone={g.approval_status === "approved" ? "green" : g.approval_status === "pending" ? "amber" : "grey"}>{label(g.approval_status ?? "")}</Pill>} pad><Link to={"/app/approvals/" + g.approval_id} className="text-sm underline underline-offset-2">Open the request</Link></Box>}
              {g.resolution && <Box title="Resolution" pad><p className="text-sm">{g.resolution}</p></Box>}
              {!ro && <Box title="Resolution" pad><p className="text-sm text-hushed">Close this investigation when the exposure is settled or explained. venn adds the invoice balance from its records.</p><Button className="mt-3" variant="outline" onClick={() => setModal("resolve")}>Mark resolved</Button></Box>}
              {g.versions.length > 1 && <Box title="Earlier analyses" pad>{g.versions.slice(1).map((v) => <div key={v.version} className="border-b border-border py-2 text-sm last:border-0">v{v.version} · {day(v.at)}<div className="text-hushed">{v.summary}</div></div>)}</Box>}
            </div>
          ) : <Box><ol className="p-5">{g.events.map((t, i) => <li key={i} className="relative border-l border-border pb-5 pl-5 last:pb-0"><span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-lime-light" /><div className="text-sm">{t.text}</div><div className="text-xs text-hushed">{t.by ?? "venn"} · {day(t.at)}</div></li>)}</ol></Box>}
        </div>
        <aside><Box title="Evidence" right={!ro && <span className="flex gap-1">{gmail && <Button variant="ghost" size="sm" disabled={mails.isPending} onClick={() => mails.mutate(id, { onSuccess: (d) => { setFound(d); setModal("emails") }, onError: (e) => toast.error(errorMessage(e)) })}>{mails.isPending ? "Searching…" : "Find emails"}</Button>}<Button variant="ghost" size="sm" onClick={() => setModal("evidence")}>Add</Button></span>} pad>
          <div className="space-y-2">{g.evidence.map((e) => (
            <div key={e.id} className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"><span className="min-w-0 flex-1"><span className="block truncate">{e.type === "invoice" && g.invoice_id ? <Link className="underline underline-offset-2" to={"/app/invoices/" + g.invoice_id}>{e.label}</Link> : e.type === "payment" && g.payment_id ? <Link className="underline underline-offset-2" to={"/app/payments/" + g.payment_id}>{e.label}</Link> : e.label}</span><span className="text-xs capitalize text-hushed">{e.type} · {e.tier}</span></span>
              {!ro && ["document", "email", "manual"].includes(e.type) && <Button variant="ghost" size="sm" aria-label={"Remove " + e.label} onClick={() => rmEv.mutate({ id, evidence: e.id }, ok("Evidence removed"))}>Remove</Button>}</div>))}</div>
        </Box></aside>
      </div>
      <Modal open={modal === "emails"} onOpenChange={(o) => !o && close()} title="Emails that may belong to this case" desc="Found in your connected Gmail by invoice number and customer address. Link only what is relevant." footer={<Button variant="outline" onClick={close}>Done</Button>}>
        <div className="max-h-80 space-y-2 overflow-auto">{found?.length ? found.map((m) => (
          <div key={m.id} className="rounded-lg border border-border p-3 text-sm"><div className="font-medium">{m.subject}</div><div className="text-xs text-hushed">{m.from} · {m.date}</div><p className="mt-1 text-xs">{m.snippet}</p>
            <Button size="sm" variant="outline" className="mt-2" disabled={addEv.isPending} onClick={() => addEv.mutate({ id, type: "email", label: `${m.subject} (${m.from})`.slice(0, 280), tier: "claim" }, ok("Email linked as evidence"))}>Link as evidence</Button></div>)) : <p className="text-sm text-hushed">No messages found.</p>}</div></Modal>
      <Modal open={modal === "note"} onOpenChange={(o) => !o && close()} title="Add note" footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={!txt.trim() || note.isPending} onClick={() => note.mutate({ id, text: txt }, ok("Note added"))}>Add note</Button></>}><TextArea aria-label="Note" value={txt} onChange={(e) => setTxt(e.target.value)} /></Modal>
      <Modal open={modal === "evidence"} onOpenChange={(o) => !o && close()} title="Add evidence" desc="Upload the document, or describe a message or call you want on record." footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={!txt.trim() || addEv.isPending} onClick={() => addEv.mutate({ id, type: kind, label: txt, tier: kind === "email" ? "claim" : "manual" }, ok("Evidence linked"))}>Link</Button></>}>
        <div className="space-y-3"><Field label="Upload a file" hint="PDF, PNG, JPEG, CSV or text, up to 20 MB. PDF text is read and searchable."><input type="file" aria-label="Upload evidence file" accept=".pdf,.png,.jpg,.jpeg,.csv,.txt" disabled={upload.isPending} className="block w-full text-sm" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload.mutate({ file: f, investigationId: id }, ok(`${f.name} linked`)) }} /></Field><p className="text-xs text-hushed">Or record something without a file:</p><Field label="Kind"><NativeSelect value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="document">Document</option><option value="email">Message from the customer</option><option value="manual">Note of a phone call or other</option></NativeSelect></Field><Field label="Description"><Input value={txt} onChange={(e) => setTxt(e.target.value)} /></Field></div></Modal>
      <Modal open={modal === "assign"} onOpenChange={(o) => !o && close()} title="Assign investigation" footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={move.isPending} onClick={() => move.mutate({ id, assignee_id: assignee || undefined, clear_assignee: !assignee }, ok("Assignment saved"))}>Assign</Button></>}>
        <Field label="Assignee"><NativeSelect value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">Unassigned</option>{(members.data ?? []).filter((m) => m.status === "active").map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}</NativeSelect></Field></Modal>
      <Modal open={modal === "resolve"} onOpenChange={(o) => !o && close()} title="Mark resolved" desc="Say how it was settled. It becomes read-only." footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={!txt.trim() || resolve.isPending} onClick={() => resolve.mutate({ id, outcome: txt }, ok("Investigation resolved"))}>Resolve</Button></>}><TextArea aria-label="Outcome" value={txt} onChange={(e) => setTxt(e.target.value)} /></Modal>
      <Modal open={modal === "dismiss"} onOpenChange={(o) => !o && close()} title="Dismiss this investigation?" desc="It becomes read-only. The reason is recorded in the audit log." footer={<><Button variant="outline" onClick={close}>Keep open</Button><Button variant="destructive" disabled={!txt.trim() || dismiss.isPending} onClick={() => dismiss.mutate({ id, reason: txt }, ok("Investigation dismissed"))}>Dismiss</Button></>}><TextArea aria-label="Reason" value={txt} onChange={(e) => setTxt(e.target.value)} /></Modal>
    </>
  )
}

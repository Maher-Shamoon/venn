import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Box, Empty, Seg, Title } from "@/components/app/ui"
import { errorMessage } from "@/lib/errors"
import { useAddTask, useMarkRead, useNotifications, useTasks, useToggleTask } from "./api"

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
const dueDay = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })

export function RemoteNotifications() {
  const [tab, setTab] = useState<"all" | "unread">("all"), q = useNotifications(tab === "unread"), read = useMarkRead(), nav = useNavigate()
  const rows = q.data?.data ?? []
  return (
    <>
      <Title sub="What needs your attention. Each item opens its record." right={<Button variant="outline" disabled={!q.data?.unread || read.isPending} onClick={() => read.mutate(undefined)}>Mark all read</Button>}>Notifications</Title>
      <Seg items={[{ v: "all", label: "All" }, { v: "unread", label: "Unread", n: q.data?.unread }] as const} value={tab} onChange={setTab} />
      <Box>{rows.length ? rows.map((n) => (
        <button key={n.id} type="button" onClick={() => { if (!n.read) read.mutate([n.id]); if (n.link) nav(n.link) }} className="flex w-full items-start gap-3 border-b border-border px-5 py-4 text-left last:border-0 hover:bg-muted/60">
          <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: n.read ? "transparent" : "#f472b6" }} /><span className="min-w-0 flex-1"><span className="block text-sm">{n.title}</span>{n.body && <span className="block truncate text-xs text-hushed">{n.body}</span>}</span><span className="text-xs text-hushed">{when(n.created_at)}</span>
        </button>)) : <Empty title={tab === "unread" ? "Nothing unread" : "No notifications yet"} sub="You will see approval requests and decisions, assignments, new disputes and broken promises here." />}</Box>
    </>
  )
}

/** The bell menu in the app frame for real organizations. */
export function BellList({ close }: { close: () => void }) {
  const q = useNotifications(false), read = useMarkRead(), nav = useNavigate(), rows = (q.data?.data ?? []).slice(0, 5)
  return (
    <div><div className="flex items-center justify-between px-3 py-2"><span className="text-sm">Notifications</span><button type="button" className="text-xs text-hushed hover:text-foreground" onClick={() => read.mutate(undefined)}>Mark all read</button></div>
      {rows.length ? rows.map((n) => <button key={n.id} type="button" onClick={() => { if (!n.read) read.mutate([n.id]); close(); if (n.link) nav(n.link) }} className="flex w-full gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-muted"><span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: n.read ? "transparent" : "#f472b6" }} /><span className="min-w-0 text-sm">{n.title}</span></button>) : <p className="px-3 py-6 text-center text-sm text-hushed">No notifications yet.</p>}
      <Link to="/app/notifications" onClick={close} className="block border-t border-border px-3 py-2.5 text-center text-sm hover:bg-muted">See all</Link></div>
  )
}

export function RemoteTasks() {
  const q = useTasks(), add = useAddTask(), toggle = useToggleTask(), [title, setTitle] = useState(""), [due, setDue] = useState("")
  const rows = q.data ?? []
  const submit = () => { if (title.trim()) add.mutate({ title, due_date: due || undefined }, { onSuccess: () => { setTitle(""); setDue("") }, onError: (e) => toast.error(errorMessage(e)) }) }
  return (
    <>
      <Title sub="Your own to-do list. Follow-ups from collections appear in the queue there.">Tasks</Title>
      <Box pad><form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); submit() }}><div className="min-w-[220px] flex-1"><Input aria-label="Task" placeholder="What needs doing?" value={title} onChange={(e) => setTitle(e.target.value)} /></div><Input aria-label="Due date" type="date" className="w-auto" value={due} onChange={(e) => setDue(e.target.value)} /><Button type="submit" disabled={!title.trim() || add.isPending}>Add task</Button></form></Box>
      <Box className="mt-3">{rows.length ? rows.map((t) => (
        <label key={t.id} className="flex cursor-pointer items-center gap-3 border-b border-border px-5 py-3 text-sm last:border-0 hover:bg-muted/50"><input type="checkbox" checked={t.done} onChange={() => toggle.mutate(t.id)} className="size-4 accent-[#f472b6]" /><span className={t.done ? "flex-1 text-hushed line-through" : "flex-1"}>{t.title}</span>{t.due_date && <span className="text-xs text-hushed">{dueDay(t.due_date)}</span>}</label>)) : <Empty title="No tasks" sub="Add one above." />}</Box>
    </>
  )
}

/** Integrations need accounts and keys that are set up per deployment. Until then this page says so instead of showing sample connections. */
export function RemoteIntegrations() {
  const items: [string, string][] = [["Gmail", "Customer emails become evidence. Needs a Google Cloud OAuth client."], ["QuickBooks Online", "Read invoices and payments. Needs an Intuit developer app."], ["Stripe", "Read payouts and charges. Needs a Stripe account."], ["Bank feeds", "Source-verified payments. Needs a bank data provider."]]
  return (
    <>
      <Title sub="No integration is connected. venn works from invoices and payments you import.">Integrations</Title>
      <Box>{items.map(([n, d]) => <div key={n} className="flex items-center gap-3 border-b border-border px-5 py-4 last:border-0"><span className="size-2 rounded-full bg-[#d2cecb]" /><div className="min-w-0 flex-1"><div className="text-sm">{n}</div><div className="text-xs text-hushed">{d}</div></div><span className="text-xs text-hushed">Not available yet</span></div>)}</Box>
      <p className="mt-3 text-sm text-hushed">Payments that come from a bank or accounting source are marked source-verified. Imported and manual payments are not, and are never counted as verified recovered.</p>
    </>
  )
}

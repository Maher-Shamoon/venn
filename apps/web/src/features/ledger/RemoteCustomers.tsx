import { useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Box, DataTable, Field, Kpi, Modal, Seg, TextArea, Title } from "@/components/app/ui"
import { NotFound } from "@/components/app/System"
import { errorMessage } from "@/lib/errors"
import { formatMoney } from "@/lib/money"
import { useUrlTable } from "@/lib/tableState"
import { useCreateCustomer, useCustomer, useCustomers, useInvoices, usePayments, useUpdateCustomer, type Customer } from "./api"

const LIMIT = 25
const day = (iso?: string | null) => (iso ? new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "—")
const Loading = () => <div role="status" aria-busy="true" className="h-48 animate-pulse rounded-xl bg-muted" />

export function RemoteCustomers() {
  const nav = useNavigate(), t = useUrlTable("", { sort: ["name", 1] }), [params, setParams] = useSearchParams()
  const flt = params.get("filter") ?? "all"
  const q = useCustomers({ q: t.q || undefined, filter: flt, sort: t.sort?.[0] ?? "name", desc: t.sort?.[1] === -1, page: t.page + 1, limit: LIMIT })
  const [open, setOpen] = useState(false)
  const rows = q.data?.data ?? []
  return (
    <>
      <Title sub={`${q.data?.total ?? 0} customers`} right={<Button onClick={() => setOpen(true)}><Plus className="size-4" />New customer</Button>}>Customers</Title>
      <Seg items={[{ v: "all", label: "All" }, { v: "overdue", label: "Has overdue" }] as const} value={flt as "all" | "overdue"} onChange={(v) => { setParams((p) => { const n = new URLSearchParams(p); if (v === "all") n.delete("filter"); else n.set("filter", v); n.delete("page"); return n }, { replace: true }) }} />
      <Box>
        {q.isError ? <p role="alert" className="p-5 text-sm text-destructive">{errorMessage(q.error)}</p> : (
          <DataTable rows={rows} id={(c) => c.id} loading={q.isPending} onRow={(c) => nav("/app/customers/" + c.id)} search={() => ""} pageSize={LIMIT} ctl={{ ...t, total: q.data?.total ?? 0 }}
            cols={[
              { key: "name", label: "Customer", sort: () => 0, render: (c) => <div><div>{c.name}</div><div className="text-xs text-hushed">{c.city}</div></div> },
              { key: "open_balance", label: "Open balance", right: true, sort: () => 0, render: (c) => formatMoney(c.open_balance) },
              { key: "overdue", label: "Overdue", right: true, sort: () => 0, render: (c) => (c.overdue === "0.00" ? "—" : <span className="text-[#a24a10]">{formatMoney(c.overdue)}</span>) },
              { key: "open_invoices", label: "Open invoices", right: true, hide: "md", sort: () => 0, render: (c) => c.open_invoices },
              { key: "avg_days_to_pay", label: "Avg days to pay", right: true, hide: "lg", sort: () => 0, render: (c) => c.avg_days_to_pay ?? "—" },
              { key: "last_payment", label: "Last payment", right: true, hide: "lg", sort: () => 0, render: (c) => day(c.last_payment) },
            ]} />)}
      </Box>
      <CustomerModal open={open} onOpenChange={setOpen} />
    </>
  )
}

export function CustomerModal({ open, onOpenChange, customer }: { open: boolean; onOpenChange: (o: boolean) => void; customer?: Customer }) {
  const [f, setF] = useState({ name: customer?.name ?? "", contact_name: customer?.contact_name ?? "", contact_email: customer?.contact_email ?? "", payment_terms_days: String(customer?.payment_terms_days ?? ""), city: customer?.city ?? "", aliases: (customer?.payer_aliases ?? []).join(", "), notes: customer?.notes ?? "" })
  const [err, setErr] = useState(""), create = useCreateCustomer(), update = useUpdateCustomer()
  const submit = () => {
    if (!f.name.trim()) return setErr("Customer name is required.")
    if (f.contact_email && !/^\S+@\S+\.\S+$/.test(f.contact_email)) return setErr("Enter a valid email address.")
    const body = { name: f.name, contact_name: f.contact_name || null, contact_email: f.contact_email || null, city: f.city || null, notes: f.notes || null,
      payment_terms_days: f.payment_terms_days === "" ? null : Number(f.payment_terms_days), payer_aliases: f.aliases.split(",").map((a) => a.trim()).filter(Boolean) }
    const done = () => { setErr(""); onOpenChange(false); toast.success(customer ? "Customer updated" : "Customer added") }
    const fail = (e: unknown) => setErr(errorMessage(e))
    if (customer) update.mutate({ id: customer.id, version: customer.version, body }, { onSuccess: done, onError: fail })
    else create.mutate(body, { onSuccess: done, onError: fail })
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={customer ? "Edit customer" : "New customer"} footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={create.isPending || update.isPending} onClick={submit}>{customer ? "Save" : "Add customer"}</Button></>}>
      <div className="space-y-3">
        <Field label="Customer name *"><Input value={f.name} onChange={set("name")} /></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Contact"><Input value={f.contact_name} onChange={set("contact_name")} /></Field><Field label="Email"><Input type="email" value={f.contact_email} onChange={set("contact_email")} /></Field></div>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Payment terms (days)"><Input type="number" value={f.payment_terms_days} onChange={set("payment_terms_days")} /></Field><Field label="City"><Input value={f.city} onChange={set("city")} /></Field></div>
        <Field label="Payer aliases" hint="Names this customer's payments may arrive under, separated by commas."><Input value={f.aliases} onChange={set("aliases")} /></Field>
        <Field label="Notes"><TextArea value={f.notes} onChange={set("notes")} /></Field>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      </div>
    </Modal>
  )
}

export function RemoteCustomerDetail() {
  const { id = "" } = useParams(), c = useCustomer(id), inv = useInvoices({ customer_id: id, tab: "all", limit: 50, sort: "due" }), pay = usePayments({ customer_id: id, limit: 50 }), nav = useNavigate()
  const [edit, setEdit] = useState(false)
  if (c.isPending) return <Loading />
  if (c.isError) return <NotFound what="customer" back="/app/customers" />
  const x = c.data
  return (
    <>
      <Title back={["/app/customers", "Customers"]} sub={[x.contact_name, x.contact_email, x.city].filter(Boolean).join(" · ") || undefined} right={<Button variant="outline" onClick={() => setEdit(true)}>Edit</Button>}>{x.name}</Title>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <Kpi dark label="Open balance" value={formatMoney(x.open_balance)} note={`${x.open_invoices} open invoices`} />
        <Kpi label="Overdue" value={formatMoney(x.overdue)} />
        <Kpi label="Avg days to pay" value={x.avg_days_to_pay == null ? "—" : String(x.avg_days_to_pay)} note={x.payment_terms_days == null ? undefined : `Terms are ${x.payment_terms_days} days`} />
        <Kpi label="Last payment" value={day(x.last_payment)} />
      </div>
      <Box className="mt-4" title="Invoices">
        <DataTable rows={inv.data?.data ?? []} id={(i) => i.id} loading={inv.isPending} onRow={(i) => nav("/app/invoices/" + i.id)} pageSize={50}
          cols={[{ key: "n", label: "Invoice", render: (i) => i.invoice_number }, { key: "d", label: "Due", render: (i) => day(i.due_date) }, { key: "t", label: "Total", right: true, render: (i) => formatMoney(i.total_amount, i.currency) }, { key: "b", label: "Balance", right: true, render: (i) => formatMoney(i.balance_due, i.currency) }, { key: "s", label: "Status", render: (i) => i.status.replace("_", " ") }]} />
      </Box>
      <Box className="mt-3" title="Payments">
        <DataTable rows={pay.data?.data ?? []} id={(p) => p.id} loading={pay.isPending} onRow={(p) => nav("/app/payments/" + p.id)} pageSize={50}
          cols={[{ key: "n", label: "Payment", render: (p) => p.number }, { key: "d", label: "Date", render: (p) => day(p.payment_date) }, { key: "a", label: "Amount", right: true, render: (p) => formatMoney(p.amount, p.currency) }, { key: "s", label: "Status", render: (p) => p.status.replace("_", " ") }]} />
      </Box>
      {x.payer_aliases.length > 0 && <Box className="mt-3" title="Payer aliases" pad><p className="text-sm">{x.payer_aliases.join(", ")}</p></Box>}
      {x.notes && <Box className="mt-3" title="Notes" pad><p className="text-sm">{x.notes}</p></Box>}
      {edit && <CustomerModal key={x.version} open={edit} onOpenChange={setEdit} customer={x} />}
    </>
  )
}

import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Check, Download, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Box, DataTable, Field, NativeSelect, Pill, Title, type Tone } from "@/components/app/ui"
import { errorMessage } from "@/lib/errors"
import { downloadProblems, useCommit, useDiscard, useImportRows, useRemap, useUpload, type CommitResult, type ImportJob, type ImportRow, type Kind } from "./api"

const SAMPLE: Record<Kind, string> = {
  invoices: "invoice_number,customer,issue_date,due_date,total_amount,currency,po_number\nINV-2001,Northwind Labs,2026-10-01,2026-11-01,5000.00,USD,PO-77\nINV-2002,Meridian Retail Group,2026-10-08,2026-11-08,9600.00,USD,\n",
  payments: "date,amount,currency,reference,payer_name,external_id\n2026-11-10,5000.00,USD,INV-2001,Northwind Labs,TXN-1001\n2026-11-11,9600.00,USD,INV-2002,Meridian Retail Group,TXN-1002\n",
}
const CLASS_TONE: Record<string, Tone> = { valid: "green", warning: "amber", error: "red", duplicate: "grey" }
const FIELD_LABEL: Record<string, string> = { invoice_number: "Invoice number", customer: "Customer", issue_date: "Issue date", due_date: "Due date", total_amount: "Total amount", currency: "Currency", po_number: "PO number", description: "Description", external_id: "External ID", date: "Date", amount: "Amount", reference: "Reference", payer_name: "Payer name", method: "Method", memo: "Memo" }

/** Import wizard for real organizations: nothing is saved until the person confirms the reviewed rows. */
export function RemoteImport({ kind }: { kind: Kind }) {
  const [job, setJob] = useState<ImportJob | null>(null), [result, setResult] = useState<CommitResult | null>(null), [err, setErr] = useState("")
  const upload = useUpload(), commit = useCommit(), discard = useDiscard(), file = useRef<HTMLInputElement>(null)
  const label = kind === "invoices" ? "invoices" : "payments"
  const pick = (f?: File) => {
    if (!f) return
    setErr("")
    upload.mutate({ kind, file: f }, { onSuccess: setJob, onError: (e) => setErr(errorMessage(e)) })
  }
  const sample = () => pick(new File([SAMPLE[kind]], `${kind}-sample.csv`, { type: "text/csv" }))
  const save = () => job && commit.mutate(job.id, { onSuccess: setResult, onError: (e) => toast.error(errorMessage(e)) })
  const cancel = () => { if (job) discard.mutate(job.id); setJob(null); setErr("") }

  if (result && job) return <Done kind={kind} result={result} onAgain={() => { setJob(null); setResult(null) }} />
  return (
    <>
      <Title back={[`/app/${kind}`, kind === "invoices" ? "Invoices" : "Payments"]} sub="Upload a CSV, review every row, then confirm. Nothing is saved until you confirm.">Import {label}</Title>
      {!job ? (
        <Box pad>
          <div className="mx-auto max-w-[560px] rounded-xl border border-dashed border-border p-8 text-center">
            <Upload className="mx-auto size-6 text-hushed" />
            <p className="mt-3 text-lg">Choose a CSV file</p>
            <p className="mt-1 text-sm text-hushed">{kind === "invoices" ? "Needs invoice number, customer, issue date, due date and total." : "Needs date and amount. Reference and payer name help matching."} Up to 20 MB.</p>
            <input ref={file} aria-label="Choose CSV file" type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            <div className="mt-4 flex flex-wrap justify-center gap-2"><Button disabled={upload.isPending} onClick={() => file.current?.click()}>{upload.isPending ? "Reading…" : "Choose file"}</Button><Button variant="outline" disabled={upload.isPending} onClick={sample}>Use a sample file</Button></div>
            {err && <p role="alert" className="mt-4 text-sm text-destructive">{err}</p>}
          </div>
        </Box>
      ) : <Review job={job} setJob={setJob} onSave={save} saving={commit.isPending} onCancel={cancel} />}
    </>
  )
}

function Review({ job, setJob, onSave, saving, onCancel }: { job: ImportJob; setJob: (j: ImportJob) => void; onSave: () => void; saving: boolean; onCancel: () => void }) {
  const [cls, setCls] = useState<ImportRow["class"]>(job.counts.error ? "error" : job.counts.warning ? "warning" : "valid"), [page, setPage] = useState(1)
  const rows = useImportRows(job.id, cls, page), remap = useRemap()
  const [map, setMap] = useState<Record<string, string>>(job.mapping), [fmt, setFmt] = useState(job.date_format)
  const c = job.counts, savable = c.valid + c.warning, blocked = job.missing.length > 0 || c.ambiguous_dates > 0
  const apply = (v: { mapping?: Record<string, string>; date_format?: string }) => remap.mutate({ id: job.id, ...v }, { onSuccess: setJob, onError: (e) => toast.error(errorMessage(e)) })
  return (
    <div className="space-y-4">
      <p className="text-sm text-hushed">{job.filename} · {c.total} rows</p>
      {job.missing.length > 0 && (
        <Box title="Match the columns" pad>
          <p className="mb-3 text-sm text-hushed">venn could not find: {job.missing.map((m) => FIELD_LABEL[m] ?? m).join(", ")}. Choose the column that holds each one.</p>
          <div className="grid gap-3 sm:grid-cols-2">{job.targets.map((t) => (
            <Field key={t} label={`${FIELD_LABEL[t] ?? t}${job.required.includes(t) ? " *" : ""}`}><NativeSelect value={map[t] ?? ""} onChange={(e) => setMap({ ...map, [t]: e.target.value })}><option value="">Not in the file</option>{job.headers.map((h) => <option key={h}>{h}</option>)}</NativeSelect></Field>))}</div>
          <Button className="mt-3" disabled={remap.isPending} onClick={() => apply({ mapping: Object.fromEntries(Object.entries(map).filter(([, v]) => v)) })}>Apply columns</Button>
        </Box>)}
      {c.ambiguous_dates > 0 && (
        <Box title="Confirm the date format" pad>
          <p className="mb-3 text-sm text-hushed">Dates like 03/04/2026 can mean 3 April or 4 March. Tell venn which.</p>
          <div className="flex flex-wrap items-end gap-3"><Field label="Dates are written as"><NativeSelect value={fmt === "iso" ? "dmy" : fmt} onChange={(e) => setFmt(e.target.value)}><option value="dmy">Day / month / year</option><option value="mdy">Month / day / year</option></NativeSelect></Field><Button disabled={remap.isPending} onClick={() => apply({ date_format: fmt === "iso" ? "dmy" : fmt })}>Use this format</Button></div>
        </Box>)}
      <div className="grid gap-3 sm:grid-cols-4">{(["valid", "warning", "error", "duplicate"] as const).map((k) => (
        <button key={k} type="button" onClick={() => { setCls(k); setPage(1) }} aria-pressed={cls === k} className={`rounded-xl border-[0.8px] p-4 text-left transition-colors ${cls === k ? "border-foreground bg-white" : "border-border bg-muted hover:bg-white"}`}>
          <div className="text-xs capitalize text-hushed">{k === "duplicate" ? "Duplicates" : k === "valid" ? "Valid" : k + "s"}</div><div className="text-3xl tabular-nums">{c[k]}</div></button>))}</div>
      <Box title="Rows">
        <DataTable rows={rows.data?.data ?? []} id={(r) => String(r.row_number)} loading={rows.isPending} pageSize={10} ctl={{ q: "", sort: null, page: page - 1, total: rows.data?.total ?? 0, onChange: (n) => n.page !== undefined && setPage(n.page + 1) }}
          empty={<p className="px-5 py-8 text-center text-sm text-hushed">No rows in this group.</p>}
          cols={[{ key: "n", label: "Row", render: (r) => r.row_number }, { key: "c", label: "Result", render: (r) => <Pill tone={CLASS_TONE[r.class]}>{r.class}</Pill> }, { key: "m", label: "What venn found", render: (r) => (r.messages.length ? r.messages.join(" ") : "Ready to save.") }, { key: "r", label: "Row data", hide: "lg", render: (r) => <span className="line-clamp-1 font-mono text-xs text-hushed">{Object.values(r.raw).join(" · ")}</span> }]} />
      </Box>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onCancel}>Discard</Button>
        {c.error + c.duplicate > 0 && <Button variant="outline" onClick={() => void downloadProblems(job.id).catch((e) => toast.error(errorMessage(e)))}><Download className="size-4" />Download problem rows</Button>}
        <Button className="ml-auto" disabled={saving || blocked || savable === 0} onClick={onSave}>{saving ? "Saving…" : `Confirm and save ${savable} row${savable === 1 ? "" : "s"}`}</Button>
      </div>
      {savable === 0 && !blocked && <p className="text-sm text-hushed">There are no rows to save. Fix the problems in your file and upload it again.</p>}
    </div>
  )
}

function Done({ kind, result, onAgain }: { kind: Kind; result: CommitResult; onAgain: () => void }) {
  return (
    <Box pad>
      <div className="mx-auto max-w-[480px] py-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-lime"><Check className="size-6" /></span>
        <h2 className="mt-4 text-2xl">{result.created} {kind} saved</h2>
        <p className="mt-1 text-hushed">{[result.customers_created ? `${result.customers_created} new customers created` : null, result.skipped_duplicates ? `${result.skipped_duplicates} duplicates skipped` : null, result.errors ? `${result.errors} rows with problems left out` : null].filter(Boolean).join(" · ") || "Every row was saved."}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2"><Button render={<Link to={`/app/${kind}`} />}>View {kind}</Button><Button variant="outline" onClick={onAgain}>Import another file</Button></div>
      </div>
    </Box>
  )
}


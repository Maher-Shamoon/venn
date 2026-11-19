import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Check, Download, FileUp, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { A, download, toCsv, useApp, usd, type Inv, type Pay } from "./store"
import { Box, Field, Mono, NativeSelect, Pill, Seg, Title } from "./ui"
import { cn } from "@/lib/utils"

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cur = "", q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') q = false; else cur += c }
    else if (c === '"') q = true
    else if (c === ",") { row.push(cur); cur = "" }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some((x) => x.trim())) rows.push(row); row = [] }
    else cur += c
  }
  row.push(cur); if (row.some((x) => x.trim())) rows.push(row)
  return rows
}
const iso = (v: string) => { const t = v.trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t; const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : "" }
const num = (v: string) => Number(v.replace(/[$,\s]/g, ""))

const KINDS = {
  invoices: { title: "Import invoices", fields: [["number", "Invoice number", true], ["customer", "Customer", true], ["issued", "Issue date", true], ["due", "Due date", true], ["amount", "Total amount", true]] as [string, string, boolean][],
    sample: "Invoice,Customer,Issued,Due,Total\nINV-1055,Tessera Robotics,2026-11-13,2026-12-13,8400.00\nINV-1056,Northwind Labs,2026-11-13,2026-12-13,3150.50\nINV-1057,Brand New Co,2026-11-13,2026-12-13,2200\nINV-1042,Northwind Labs,2026-09-01,2026-10-01,5000\nINV-1058,Quillon Media,2026-11-13,2026-11-01,900\nINV-1059,Alder Health Systems,2026-11-13,2026-12-13,abc", back: "/app/invoices" },
  payments: { title: "Import payments", fields: [["payer", "Payer", true], ["date", "Date", true], ["amount", "Amount", true], ["method", "Method", false], ["ref", "Reference", false]] as [string, string, boolean][],
    sample: "Payer,Date,Amount,Method,Reference\nTessera Robotics,2026-11-12,15600.00,Wire,WIRE 93001\nH&P Legal,2026-11-12,2400.00,ACH,ACH 57001\nUnknown Holdings,2026-11-13,780.00,ACH,ACH 57002\nNorthwind Labs,2026-10-09,4000,Wire,WIRE 88213\nQuillon Media,2026-11-13,-50,ACH,ACH 57003", back: "/app/payments" },
}
type Kind = keyof typeof KINDS
type Out = { n: number; raw: string[]; status: "valid" | "warning" | "error" | "duplicate"; msg: string; inv?: Omit<Inv, "id">; pay?: Omit<Pay, "id"> }
const GUESS: Record<string, string[]> = { number: ["invoice", "number", "id"], customer: ["customer", "client"], issued: ["issued", "issue"], due: ["due"], amount: ["total", "amount"], payer: ["payer", "from", "name"], date: ["date"], method: ["method", "type"], ref: ["reference", "ref"] }

export function ImportWizard({ kind }: { kind: Kind }) {
  const K = KINDS[kind], s = useApp(), nav = useNavigate()
  const [step, setStep] = useState(0)
  const [text, setText] = useState(""), [name, setName] = useState("")
  const [map, setMap] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<"valid" | "warning" | "error" | "duplicate">("valid")
  const [prog, setProg] = useState(0)
  const file = useRef<HTMLInputElement>(null)
  const rows = text ? parseCsv(text) : [], head = rows[0] ?? []
  const load = (t: string, n: string) => { setText(t); setName(n); const h = parseCsv(t)[0] ?? []; const m: Record<string, string> = {}; K.fields.forEach(([k]) => { const hit = h.find((x) => GUESS[k]?.some((g) => x.toLowerCase().includes(g))); if (hit) m[k] = hit }); setMap(m); setStep(1) }
  const onFile = async (f?: File) => { if (!f) return; if (f.size > 2e6) return alert("Choose a file under 2 MB."); load(await f.text(), f.name) }
  const col = (r: string[], k: string) => r[head.indexOf(map[k])] ?? ""
  const seen = new Set<string>()
  const out: Out[] = rows.slice(1).map((r, i) => {
    const o: Out = { n: i + 2, raw: r, status: "valid", msg: "" }
    const miss = K.fields.filter(([k, , req]) => req && !col(r, k).trim()).map(([, l]) => l)
    if (miss.length) return { ...o, status: "error", msg: `Missing ${miss.join(", ")}` }
    if (kind === "invoices") {
      const [id, cust, iss, due, amt] = [col(r, "number").trim(), col(r, "customer").trim(), iso(col(r, "issued")), iso(col(r, "due")), num(col(r, "amount"))]
      if (!iss || !due) return { ...o, status: "error", msg: "Dates must look like 2026-11-13 or 11/13/2026" }
      if (!(amt > 0)) return { ...o, status: "error", msg: "Amount must be a number above zero" }
      if (due < iss) return { ...o, status: "error", msg: "Due date is before the issue date" }
      if (s.invoices.some((x) => x.id === id) || seen.has(id)) return { ...o, status: "duplicate", msg: `${id} already exists` }
      seen.add(id)
      const known = s.customers.some((c) => c.name === cust)
      return { ...o, status: known ? "valid" : "warning", msg: known ? "" : `New customer “${cust}” will be created`, inv: { cust, issued: iss, due, po: id, lines: [{ d: "Imported invoice", qty: 1, price: amt }] } }
    }
    const [payer, date, amt, method, ref] = [col(r, "payer").trim(), iso(col(r, "date")), num(col(r, "amount")), col(r, "method").trim() || "ACH", col(r, "ref").trim() || "—"]
    if (!date) return { ...o, status: "error", msg: "Date must look like 2026-11-13 or 11/13/2026" }
    if (!(amt > 0)) return { ...o, status: "error", msg: "Amount must be above zero. Refunds and reversals are not imported here." }
    if (s.payments.some((x) => x.payer === payer && x.amount === amt && x.ref === ref) ) return { ...o, status: "duplicate", msg: "Same payer, amount and reference already imported" }
    const cust = s.customers.find((c) => c.name === payer || c.aliases.includes(payer))?.name
    return { ...o, status: cust ? "valid" : "warning", msg: cust ? "" : "No customer matches this payer. It will need review.", pay: { payer, cust, date, amount: amt, method, ref, source: "CSV import", status: "open" } }
  })
  const by = (t: Out["status"]) => out.filter((o) => o.status === t)
  const ok = out.filter((o) => o.status === "valid" || o.status === "warning")
  useEffect(() => {
    if (step !== 3) return
    const t = setInterval(() => setProg((p) => Math.min(100, p + 8)), 120)
    return () => clearInterval(t)
  }, [step])
  useEffect(() => {
    if (step === 3 && prog >= 100) { if (kind === "invoices") A.importInvoices(ok.map((o) => o.inv!)); else A.importPayments(ok.map((o) => o.pay!))
      setStep(4) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prog, step])
  const errCsv = () => download("rows-with-problems.csv", toCsv([[...head, "Problem"], ...out.filter((o) => o.status === "error" || o.status === "duplicate").map((o) => [...o.raw, o.msg])]))
  const steps = ["Upload", "Map columns", "Review", "Importing", "Summary"]
  const mapped = K.fields.filter(([, , req]) => req).every(([k]) => map[k])
  return (
    <>
      <Title back={[K.back, kind === "invoices" ? "Invoices" : "Payments"]} sub="Rows are checked before anything changes. Nothing is imported until you confirm.">{K.title}</Title>
      <ol className="mb-6 flex flex-wrap gap-2 text-sm">{steps.map((t, i) => <li key={t} className={cn("flex items-center gap-2 rounded-full px-3 py-1.5", i === step ? "bg-foreground text-white" : i < step ? "bg-lime" : "bg-muted text-hushed")}><span className="font-mono text-xs">{i < step ? <Check className="size-3.5" /> : i + 1}</span>{t}</li>)}</ol>

      {step === 0 && (
        <Box pad>
          <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }} className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-medium px-6 py-14 text-center">
            <Upload className="size-8 text-hushed" /><div className="mt-3 text-xl">Drop a CSV file here</div><p className="mt-1 text-hushed">Up to 2 MB. The first row must be column names.</p>
            <input ref={file} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Choose CSV file" onChange={(e) => onFile(e.target.files?.[0])} />
            <div className="mt-5 flex flex-wrap justify-center gap-2"><Button onClick={() => file.current?.click()}>Choose file</Button><Button variant="outline" onClick={() => load(K.sample, kind + "-sample.csv")}>Use a sample file</Button></div>
          </div>
        </Box>
      )}
      {step === 1 && (
        <Box title={`Match columns in ${name}`} pad right={<span className="text-sm text-hushed">{rows.length - 1} rows</span>}>
          <div className="grid gap-3 sm:grid-cols-2">{K.fields.map(([k, label, req]) => <Field key={k} label={label + (req ? " *" : "")}><NativeSelect value={map[k] ?? ""} onChange={(e) => setMap({ ...map, [k]: e.target.value })}><option value="">{req ? "Choose a column…" : "Not in file"}</option>{head.map((h) => <option key={h}>{h}</option>)}</NativeSelect></Field>)}</div>
          <div className="mt-5 overflow-x-auto rounded-lg border border-border"><table className="w-full text-xs"><thead className="bg-muted/60 text-hushed"><tr>{head.map((h) => <th key={h} className="px-3 py-2 text-left font-normal">{h}</th>)}</tr></thead><tbody>{rows.slice(1, 4).map((r, i) => <tr key={i} className="border-t border-border">{r.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}</tr>)}</tbody></table></div>
          <div className="mt-5 flex gap-2"><Button variant="outline" onClick={() => setStep(0)}>Back</Button><Button disabled={!mapped} onClick={() => { setTab(by("valid").length ? "valid" : by("error").length ? "error" : "warning"); setStep(2) }}>Review rows</Button></div>
        </Box>
      )}
      {step === 2 && (
        <Box pad>
          <Seg items={[{ v: "valid", label: "Valid", n: by("valid").length }, { v: "warning", label: "Warnings", n: by("warning").length }, { v: "error", label: "Errors", n: by("error").length }, { v: "duplicate", label: "Duplicates", n: by("duplicate").length }] as const} value={tab} onChange={setTab} />
          <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-sm"><thead className="bg-muted/60 text-xs text-hushed"><tr><th className="px-3 py-2 text-left font-normal">Row</th>{K.fields.map(([k, l]) => <th key={k} className="px-3 py-2 text-left font-normal">{l}</th>)}<th className="px-3 py-2 text-left font-normal">Note</th></tr></thead>
            <tbody>{by(tab).map((o) => <tr key={o.n} className="border-t border-border"><td className="px-3 py-2"><Mono>{o.n}</Mono></td>{K.fields.map(([k]) => <td key={k} className="px-3 py-2">{col(o.raw, k)}</td>)}<td className="px-3 py-2 text-xs text-hushed">{o.msg}</td></tr>)}</tbody></table>{!by(tab).length && <div className="p-6 text-center text-sm text-hushed">No rows in this group.</div>}</div>
          <div className="mt-5 flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => setStep(1)}>Back</Button><Button disabled={!ok.length} onClick={() => { setProg(0); setStep(3) }}>Import {ok.length} row{ok.length === 1 ? "" : "s"}</Button>{(by("error").length > 0 || by("duplicate").length > 0) && <Button variant="ghost" onClick={errCsv}><Download className="size-4" />Download problem rows</Button>}<span className="text-sm text-hushed">Errors and duplicates are skipped.</span></div>
        </Box>
      )}
      {step === 3 && <Box pad><div className="py-8 text-center"><div className="text-xl">Importing {ok.length} rows…</div><Progress value={prog} className="mx-auto mt-5 max-w-[420px]" aria-label="Import progress" /></div></Box>}
      {step === 4 && (
        <Box pad>
          <div className="py-6 text-center"><span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#e3f6e6]"><Check className="size-6 text-[#17692b]" /></span><div className="mt-3 text-2xl">Import finished</div>
            <div className="mx-auto mt-4 flex max-w-[460px] flex-wrap justify-center gap-2"><Pill tone="green">{ok.length} created</Pill><Pill tone="amber">{by("warning").length} with warnings</Pill><Pill tone="red">{by("error").length} errors skipped</Pill><Pill tone="grey">{by("duplicate").length} duplicates skipped</Pill></div>
            <div className="mt-6 flex flex-wrap justify-center gap-2"><Button onClick={() => nav(K.back)}>View {kind}</Button>{kind === "payments" && <Button variant="outline" render={<Link to="/app/reconciliation" />}>Run reconciliation</Button>}{(by("error").length > 0 || by("duplicate").length > 0) && <Button variant="outline" onClick={errCsv}><Download className="size-4" />Download problem rows</Button>}</div></div>
        </Box>
      )}
    </>
  )
}
export const ImportInvoices = () => <ImportWizard kind="invoices" />
export const ImportPayments = () => <ImportWizard kind="payments" />

/* PDF review: source region highlights on hover */
const FIELDS = [["payer", "Payer", "Northwind Labs", 0.97, "top-[84px]"], ["invoice", "Invoice reference", "INV-1050", 0.92, "top-[150px]"], ["amount", "Amount", "4300.00", 0.95, "top-[188px]"], ["date", "Payment date", "2026-11-06", 0.88, "top-[226px]"], ["ref", "Bank reference", "ACH 56120", 0.71, "top-[264px]"]] as const
export function PdfReview() {
  const nav = useNavigate()
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(FIELDS.map(([k, , v]) => [k, v])))
  const [hl, setHl] = useState("")
  return (
    <>
      <Title back={["/app/invoices", "Invoices"]} sub="Check what venn read from the document. Low-confidence fields are marked.">Review remittance PDF</Title>
      <div className="grid gap-4 lg:grid-cols-2">
        <Box title="remittance-northwind-nov.pdf" right={<FileUp className="size-4 text-hushed" />}>
          <div className="bg-muted/60 p-4 sm:p-6"><div className="relative mx-auto h-[360px] max-w-[420px] rounded-md bg-white p-6 text-[0.75rem] shadow-sm">
            <div className="text-[0.9375rem]">Remittance advice</div><div className="mt-1 text-hushed">Northwind Labs · Accounts Payable</div>
            <div className="absolute inset-x-6 top-[84px] h-5 text-hushed">Paying entity: <span>Northwind Labs</span></div>
            <div className="absolute inset-x-6 top-[120px] border-t border-border pt-2 text-hushed">Details</div>
            <div className="absolute inset-x-6 top-[150px]">Invoice: <span>INV-1050</span></div>
            <div className="absolute inset-x-6 top-[188px]">Amount paid: <span>$4,300.00</span></div>
            <div className="absolute inset-x-6 top-[226px]">Payment date: <span>06 Nov 2026</span></div>
            <div className="absolute inset-x-6 top-[264px]">Bank ref: <span>ACH 56120</span></div>
            {FIELDS.map(([k, , , , top]) => <div key={k} aria-hidden="true" className={cn("pointer-events-none absolute inset-x-4 h-7 -translate-y-1 rounded border-2 transition-all duration-200", top, hl === k ? "border-[#f472b6] bg-[#f9a8d4]/30 opacity-100" : "border-transparent opacity-0")} />)}
          </div></div>
        </Box>
        <Box title="Extracted fields" pad>
          <div className="space-y-3">{FIELDS.map(([k, label, , conf]) => (
            <div key={k} onMouseEnter={() => setHl(k)} onMouseLeave={() => setHl("")} onFocus={() => setHl(k)} onBlur={() => setHl("")} className="rounded-lg border border-border p-3 transition-colors hover:bg-muted/50">
              <div className="mb-1.5 flex items-center justify-between text-sm"><span>{label}</span><Pill tone={conf >= 0.9 ? "green" : "amber"}>{Math.round(conf * 100)}% confident</Pill></div>
              <Input aria-label={label} value={vals[k]} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} className="h-9" />
            </div>))}</div>
          <div className="mt-5 flex flex-wrap gap-2"><Button onClick={() => { A.addDoc("remittance-northwind-nov.pdf", "92 KB", vals.invoice); nav("/app/documents") }}>Confirm and save</Button><Button variant="outline" onClick={() => nav("/app/invoices")}>Discard</Button></div>
          <p className="mt-3 text-xs text-hushed">Confirming stores the document and its extracted values. It does not allocate a payment by itself. Amount: {usd(+vals.amount || 0)}</p>
        </Box>
      </div>
    </>
  )
}

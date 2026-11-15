import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Box, DataTable, Drawer, Empty, Mono, Pill, Row, Title } from "@/components/app/ui"
import { errorMessage } from "@/lib/errors"
import { Input } from "@/components/ui/input"
import { downloadDocument, kb, useDeleteDocument, useDocument, useDocuments, useUploadDocument, type Doc } from "./api"

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
const KIND: Record<string, string> = { "application/pdf": "PDF", "image/png": "Image", "image/jpeg": "Image", "text/csv": "CSV", "text/plain": "Text" }

export function RemoteDocuments() {
  const file = useRef<HTMLInputElement>(null), [q, setQ] = useState(""), [page, setPage] = useState(1), [open, setOpen] = useState<string | null>(null)
  const list = useDocuments(q, page), up = useUploadDocument(), del = useDeleteDocument(), d = useDocument(open)
  const pick = (f?: File) => {
    if (!f) return
    if (f.size > 20 * 1024 * 1024) return toast.error("Files can be up to 20 MB.")
    up.mutate({ file: f }, { onSuccess: (r) => toast.success(r.extraction === "done" ? `${r.filename} uploaded and read` : `${r.filename} uploaded`), onError: (e) => toast.error(errorMessage(e)) })
  }
  const rows = list.data?.data ?? []
  return (
    <>
      <Title sub={`${list.data?.total ?? 0} documents. PDF, PNG, JPEG, CSV or text, up to 20 MB.`} right={<><input ref={file} type="file" className="sr-only" aria-label="Upload document" accept=".pdf,.png,.jpg,.jpeg,.csv,.txt" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = "" }} /><Button disabled={up.isPending} onClick={() => file.current?.click()}><Upload className="size-4" />{up.isPending ? "Uploading…" : "Upload"}</Button></>}>Documents</Title>
      <div className="mb-4 max-w-sm"><Input aria-label="Search documents" placeholder="Search names and text" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} /></div>
      <Box><DataTable rows={rows} id={(x: Doc) => x.id} loading={list.isPending} onRow={(x) => setOpen(x.id)} pageSize={25} ctl={{ q: "", sort: null, page: page - 1, total: list.data?.total ?? 0, onChange: (n) => n.page !== undefined && setPage(n.page + 1) }}
        empty={<Empty title={q ? "No documents match" : "No documents yet"} sub={q ? undefined : "Upload a remittance advice, a statement or a message so it can be linked to a case."} />}
        cols={[{ key: "n", label: "Name", render: (x) => x.filename }, { key: "t", label: "Type", hide: "md", render: (x) => KIND[x.content_type] ?? x.content_type }, { key: "s", label: "Size", hide: "md", right: true, render: (x) => kb(x.size_bytes) },
          { key: "x", label: "Text", render: (x) => <Pill tone={x.extraction === "done" ? "green" : x.extraction === "failed" ? "red" : "grey"}>{x.extraction === "done" ? "read" : x.extraction === "failed" ? "failed" : "not read"}</Pill> }, { key: "w", label: "Uploaded", hide: "lg", render: (x) => `${day(x.created_at)}${x.uploaded_by ? ` by ${x.uploaded_by}` : ""}` }]} /></Box>
      <Drawer open={!!open} onOpenChange={(o) => !o && setOpen(null)} title={d.data?.filename ?? "Document"} desc={d.data ? `${KIND[d.data.content_type] ?? d.data.content_type} · ${kb(d.data.size_bytes)}` : ""}>
        {d.data && <>
          <div className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm">{d.data.text_preview || d.data.extraction_note || "No text was extracted."}</div>
          <div className="mt-4"><Row k="Uploaded by">{d.data.uploaded_by ?? "Unknown"}</Row><Row k="On">{day(d.data.created_at)}</Row>{d.data.page_count && <Row k="Pages">{d.data.page_count}</Row>}
            <Row k="Linked to">{d.data.linked_cases.length ? d.data.linked_cases.map((c) => <Link key={c.id} to={"/app/investigations/" + c.id} className="mr-2 underline underline-offset-2"><Mono>{c.number}</Mono></Link>) : "No case"}</Row></div>
          <div className="mt-5 flex gap-2"><Button variant="outline" onClick={() => void downloadDocument(d.data).catch((e) => toast.error(errorMessage(e)))}>Download</Button>
            <Button variant="outline" disabled={del.isPending} onClick={() => del.mutate(d.data.id, { onSuccess: () => { toast.success("Document deleted"); setOpen(null) }, onError: (e) => toast.error(errorMessage(e)) })}>Delete</Button></div>
        </>}
      </Drawer>
    </>
  )
}

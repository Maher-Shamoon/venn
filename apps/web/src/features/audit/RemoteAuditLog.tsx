import { useState } from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Box, DataTable, Drawer, Empty, Locked, Mono, Row, Seg, Title } from "@/components/app/ui"
import { download, toCsv } from "@/components/app/store"
import { errorMessage } from "@/lib/errors"
import { useAuditEvents, type AuditEvent } from "./api"

const GROUPS = ["all", "organization", "member", "invitation", "role", "settings"]
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
const kv = (o: Record<string, unknown> | null) => (o ? Object.entries(o).map(([k, v]) => `${k}: ${String(v)}`).join("\n") : "—")

/** The real, append-only audit log. Owners only (the API requires audit.view). */
export function RemoteAuditLog() {
  const [g, setG] = useState("all"), [sel, setSel] = useState<AuditEvent | null>(null)
  const q = useAuditEvents(g)
  if (q.isError && (q.error as { status?: number }).status === 403) return <Locked what="The audit log" />
  const rows = q.data?.pages.flatMap((p) => p.data) ?? []
  const exportCsv = () => {
    download("audit-log.csv", toCsv([["Time", "Actor", "Action", "Record"], ...rows.map((x) => [x.occurred_at, x.actor_name ?? "system", x.action, x.record_id ?? ""])]))
    toast.success("Exported")
  }
  return (
    <>
      <Title sub="Every decision, send and change. Entries cannot be edited." right={<Button variant="outline" onClick={exportCsv}><Download className="size-4" />Export CSV</Button>}>Audit log</Title>
      <Seg items={GROUPS} value={g} onChange={setG} />
      {q.isError ? <p role="alert" className="text-sm text-destructive">{errorMessage(q.error)}</p> : (
        <Box>
          <DataTable rows={rows} id={(x) => x.id} loading={q.isPending} onRow={setSel} search={(x) => x.action + (x.actor_name ?? "") + (x.record_id ?? "")} pageSize={12} empty={<Empty title="No entries yet" />}
            cols={[
              { key: "t", label: "Time", render: (x) => <span className="whitespace-nowrap">{when(x.occurred_at)}</span> },
              { key: "a", label: "Actor", hide: "md", render: (x) => x.actor_name ?? "system" },
              { key: "ac", label: "Action", render: (x) => x.action },
              { key: "r", label: "Record", hide: "lg", render: (x) => <Mono>{(x.record_id ?? "").slice(0, 8)}</Mono> },
            ]} />
          {q.hasNextPage && (
            <div className="border-t border-border p-3 text-center">
              <Button variant="outline" size="sm" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>Load older entries</Button>
            </div>
          )}
        </Box>
      )}
      <Drawer open={!!sel} onOpenChange={(o) => !o && setSel(null)} title={sel?.action ?? ""} desc={sel ? when(sel.occurred_at) : ""}>
        {sel && (
          <div className="mt-3">
            <Row k="Actor">{sel.actor_name ?? "system"}</Row>
            <Row k="Record"><Mono>{sel.record_type} {sel.record_id}</Mono></Row>
            <Row k="Request ID"><Mono>{sel.request_id ?? "—"}</Mono></Row>
            {(sel.before || sel.after) && (
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <pre className="whitespace-pre-wrap rounded-lg bg-[#fbe9dd] p-3 text-xs"><b className="block font-normal text-hushed">Before</b>{kv(sel.before)}</pre>
                <pre className="whitespace-pre-wrap rounded-lg bg-[#e3f6e6] p-3 text-xs"><b className="block font-normal text-hushed">After</b>{kv(sel.after)}</pre>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  )
}

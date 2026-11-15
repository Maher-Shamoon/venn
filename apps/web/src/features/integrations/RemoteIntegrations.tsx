import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Box, Field, Modal, Pill, Title } from "@/components/app/ui"
import { useRole } from "@/components/app/Shell"
import { errorMessage } from "@/lib/errors"
import { startGmail, useConnectStripe, useDisconnect, useIntegrations, useSyncStripe, type Integration } from "./api"

const ago = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "never")
const NOTE: Record<string, string> = {
  stripe: "Reads charges (read-only). They become payments marked source-verified, so reconciliation and Verified recovered can trust them.",
  gmail: "Searches your mailbox (read-only) for messages about a case. A message becomes evidence only when you link it.",
  quickbooks: "Reads invoices and payments from QuickBooks. Needs an Intuit developer app, which is not set up yet.",
}

export function RemoteIntegrations() {
  const owner = useRole() === "owner", q = useIntegrations(), [params, setParams] = useSearchParams()
  const [stripe, setStripe] = useState(false), [key, setKey] = useState(""), connect = useConnectStripe(), sync = useSyncStripe(), off = useDisconnect()
  useEffect(() => {
    if (params.get("connected")) toast.success("Gmail connected")
    if (params.get("error")) toast.error("Gmail could not be connected. Try again.")
    if (params.get("connected") || params.get("error")) setParams({}, { replace: true })
  }, [params, setParams])
  const act = (i: Integration) => {
    if (i.provider === "gmail") return void startGmail().then((u) => { window.location.href = u }).catch((e) => toast.error(errorMessage(e)))
    if (i.provider === "stripe") setStripe(true)
  }
  const doSync = () => sync.mutate(undefined, { onSuccess: (r) => toast.success(`${r.new} new payments from ${r.seen} charges`), onError: (e) => toast.error(errorMessage(e)) })
  const close = () => { setStripe(false); setKey("") }
  return (
    <>
      <Title sub={owner ? "Connect only what you need. venn reads. It never writes to these accounts." : "Read-only view of connection status."}>Integrations</Title>
      <Box>{(q.data ?? []).map((i) => (
        <div key={i.provider} className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4 last:border-0">
          <span className={"size-2 rounded-full " + (i.status === "error" ? "bg-destructive" : i.connected ? "bg-[#2f9e44]" : "bg-[#d2cecb]")} />
          <div className="min-w-0 flex-1"><div className="text-sm">{i.name} {i.connected && <Pill tone={i.status === "error" ? "red" : "green"}>{i.status === "error" ? "needs attention" : "connected"}</Pill>}</div>
            <div className="text-xs text-hushed">{i.connected ? `${i.account ?? ""} · last sync ${ago(i.last_sync_at)}` : NOTE[i.provider]}</div>{i.last_error && <div role="alert" className="text-xs text-destructive">{i.last_error}</div>}</div>
          {owner && i.available && (i.connected ? <div className="flex gap-2">{i.provider === "stripe" && <Button size="sm" disabled={sync.isPending} onClick={doSync}>{sync.isPending ? "Syncing…" : "Sync now"}</Button>}{i.provider === "gmail" && i.status === "error" && <Button size="sm" onClick={() => act(i)}>Connect again</Button>}
            <Button size="sm" variant="outline" disabled={off.isPending} onClick={() => off.mutate(i.provider, { onSuccess: () => toast.success(`${i.name} disconnected`), onError: (e) => toast.error(errorMessage(e)) })}>Disconnect</Button></div> : <Button size="sm" onClick={() => act(i)}>Connect</Button>)}
          {!i.available && <span className="text-xs text-hushed">Not available yet</span>}
        </div>))}</Box>
      <p className="mt-3 text-sm text-hushed">Payments from a connected source are marked source-verified. Imported and manual payments are not, and are never counted as verified recovered. Keys are stored encrypted and are never shown again.</p>
      <Modal open={stripe} onOpenChange={(o) => !o && close()} title="Connect Stripe" desc="Paste a restricted key that can only read Charges." footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={!key.trim() || connect.isPending} onClick={() => connect.mutate(key, { onSuccess: () => { toast.success("Stripe connected"); close(); doSync() }, onError: (e) => toast.error(errorMessage(e)) })}>Connect</Button></>}>
        <Field label="Restricted API key" hint="In Stripe: Developers, API keys, Create restricted key, read access to Charges. It starts with rk_."><Input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} /></Field></Modal>
    </>
  )
}

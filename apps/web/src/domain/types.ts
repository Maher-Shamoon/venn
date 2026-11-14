/** Domain types shared by the UI, the API client and (later) the backend contract. */
export type Role = "owner" | "ar"
export type Customer = { id: string; name: string; contact: string; email: string; terms: number; city: string; aliases: string[]; notes: string }
export type Line = { d: string; qty: number; price: number }
export type Inv = { id: string; cust: string; issued: string; due: string; po: string; lines: Line[]; cancelled?: boolean }
export type Alloc = { id: string; pay: string; inv: string; amount: number; by: string; at: string; kind: "payment" | "writeoff" | "credit"; void?: boolean }
export type Pay = { id: string; payer: string; cust?: string; date: string; amount: number; method: string; ref: string; source: string; status: "open" | "under review" | "reversed" | "duplicate" }
export type Sugg = { id: string; pay: string; invs: [string, number][]; rule: string; conf: "high" | "medium" | "review"; reason: string; status: "pending" | "confirmed" | "rejected" }
export type Finding = { kind: "confirmed" | "calc" | "possible" | "claim" | "missing"; text: string }
export type Invg = { id: string; type: string; cust: string; inv?: string; pay?: string; exposure: number; priority: "high" | "medium" | "low"; status: "new" | "in progress" | "ready for review" | "awaiting approval" | "monitoring" | "resolved" | "dismissed"; assignee: string; created: string; title: string; summary: string; findings: Finding[]; rec: { action: string; gate: string; kind: "request-proof" | "refund" | "final-notice" | "monitor" | "allocate" }; evidence: string[]; timeline: { at: string; by: string; text: string }[]; version: number; analysis?: "failed" | "insufficient" }
export type Apr = { id: string; type: "write-off" | "refund due" | "final notice" | "credit"; rec: string; cust: string; amount: number; by: string; reason: string; status: "pending" | "info requested" | "approved" | "rejected" | "withdrawn"; created: string; decided?: string; decidedBy?: string; comment?: string; link?: string }
export type Col = { id: string; cust: string; invs: string[]; stage: "reminder 1" | "reminder 2" | "final notice" | "promise to pay" | "paused"; owner: string; next: string; last: string; promise?: string; timeline: { at: string; by: string; text: string }[] }
export type Dsp = { id: string; cust: string; inv: string; amt: number; cat: string; reason: string; status: "open" | "awaiting customer" | "resolved"; owner: string; due: string; notes: { at: string; by: string; text: string }[]; outcome?: string }
export type Doc = { id: string; name: string; type: string; link: string; by: string; at: string; status: string; size: string }
export type Notif = { id: string; at: string; text: string; to: string; read: boolean }
export type Task = { id: string; text: string; due: string; link: string; done: boolean; owner: Role }
export type Member = { id: string; name: string; email: string; role: Role; status: "active" | "invited" | "suspended"; last: string; perms: Record<string, boolean> }
export type Integ = { id: string; name: string; cat: string; desc: string; status: "connected" | "available" | "planned" | "needs attention"; account?: string; last?: string; scopes: string[]; syncs: { at: string; n: number; ok: boolean; msg: string }[] }
export type Audit = { id: string; at: string; actor: string; action: string; rec: string; group: string; before?: string; after?: string }
export type Settings = { company: { name: string; legal: string; address: string; industry: string; size: string; website: string }; financial: { currency: string; timezone: string; terms: number; autoApply: boolean; shortGrace: number; claimGrace: number }; approvals: Record<string, number>; notifications: Record<string, boolean>; security: { mfa: boolean }; remittance: { bank: string; account: string; changedAt: string } }
export type State = {
  session: { name: string; email: string } | null; role: Role; onboarded: boolean; setup: Record<string, boolean>; seq: number
  customers: Customer[]; invoices: Inv[]; allocs: Alloc[]; payments: Pay[]; suggs: Sugg[]; invgs: Invg[]; aprs: Apr[]; cols: Col[]; dsps: Dsp[]; docs: Doc[]; notifs: Notif[]; tasks: Task[]; team: Member[]; integs: Integ[]; audit: Audit[]; settings: Settings
}

export type Tone = "green" | "amber" | "blue" | "grey" | "red"

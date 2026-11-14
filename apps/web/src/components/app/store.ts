import { useSyncExternalStore } from "react"
import { toast } from "sonner"

import type { Apr, Col, Customer, Dsp, Integ, Inv, Invg, Line, Member, Pay, Role, Settings, State } from "@/domain/types"
export * from "@/domain/types"
export * from "@/domain/format"
export * from "@/domain/finance"
import { NOW, usd } from "@/domain/format"
import { balOf, paidOf, lateOf, invTotal } from "@/domain/finance"
/* ------------------------------------------------------------------ types */
/* ------------------------------------------------------------------- seed */
const C = (id: string, name: string, contact: string, email: string, terms: number, city: string, aliases: string[] = [], notes = ""): Customer => ({ id, name, contact, email, terms, city, aliases, notes })
const DESC = ["Platform engineering", "Design sprint", "Managed services", "Implementation fee", "Support retainer", "Discovery workshop", "Analytics build", "Data migration"]
const lines = (amount: number, n: number): Line[] => {
  const a = Math.round(amount * 0.6 * 100) / 100
  const ls: Line[] = [{ d: DESC[n % 8], qty: 1, price: a }]
  if (amount - a > 0) ls.push({ d: DESC[(n + 3) % 8], qty: 1, price: Math.round((amount - a) * 100) / 100 })
  return ls
}
const I = (id: string, cust: string, issued: string, due: string, amount: number, n: number): Inv => ({ id, cust, issued, due, po: "PO-" + (4000 + n * 7), lines: lines(amount, n) })

const seed = (): State => ({
  session: null, role: "owner", onboarded: false, setup: { sources: true, email: true, import: true, team: false, prefs: false }, seq: 100,
  customers: [
    C("c1", "Northwind Labs", "Hannah Cole", "hannah.cole@northwindlabs.example", 30, "Austin, US", ["N. Labs LLC"], "Pays in two instalments for large projects."),
    C("c2", "Meridian Retail Group", "Owen Pratt", "ap@meridianretail.example", 30, "Chicago, US", ["Meridian Retail"], "Large AP team, pays by ACH."),
    C("c3", "Cobalt Energy Partners", "Lena Fischer", "lena.fischer@cobaltenergy.example", 24, "Houston, US", ["Cobalt Energy"], "Often pays by wire. Slow to confirm."),
    C("c4", "Alder Health Systems", "Marcus Bell", "mbell@alderhealth.example", 30, "Denver, US", [], "Disputed the scope of phase 2."),
    C("c5", "Harbor & Pine Legal", "Ines Duarte", "ines@harborpine.example", 30, "Boston, US", ["H&P Legal"], "Pays several invoices in one transfer."),
    C("c6", "Fernhill Logistics", "Theo Marsh", "theo.marsh@fernhill.example", 30, "Atlanta, US", [], "Combines invoices in a single wire."),
    C("c7", "Quillon Media", "Sara Ng", "sara@quillonmedia.example", 30, "Seattle, US", [], "Small balances, slow to respond."),
    C("c8", "Tessera Robotics", "Raj Patel", "raj.patel@tessera.example", 30, "San Jose, US", [], "New customer, on time so far."),
  ],
  invoices: [
    I("INV-1037", "Quillon Media", "2026-08-20", "2026-09-19", 340, 1), I("INV-1040", "Fernhill Logistics", "2026-09-02", "2026-10-02", 9800, 2), I("INV-1042", "Northwind Labs", "2026-09-01", "2026-10-01", 5000, 3),
    I("INV-1043", "Meridian Retail Group", "2026-09-05", "2026-10-05", 9600, 4), I("INV-1044", "Cobalt Energy Partners", "2026-10-01", "2026-10-25", 22500, 5), I("INV-1045", "Alder Health Systems", "2026-09-15", "2026-10-15", 18000, 6),
    I("INV-1047", "Harbor & Pine Legal", "2026-10-10", "2026-11-09", 12000, 7), I("INV-1048", "Harbor & Pine Legal", "2026-10-12", "2026-11-11", 7400, 8), I("INV-1049", "Fernhill Logistics", "2026-10-14", "2026-11-13", 8000, 9),
    I("INV-1050", "Northwind Labs", "2026-10-08", "2026-11-07", 4300, 10), I("INV-1051", "Tessera Robotics", "2026-11-01", "2026-12-01", 15600, 11), I("INV-1052", "Quillon Media", "2026-11-05", "2026-12-05", 6250, 12),
    I("INV-1053", "Tessera Robotics", "2026-11-10", "2026-12-10", 9700, 13), I("INV-1054", "Alder Health Systems", "2026-11-12", "2026-12-12", 7800, 14),
  ],
  allocs: [
    { id: "AL-1", pay: "PAY-0005", inv: "INV-1042", amount: 4000, by: "venn", at: "2026-10-09", kind: "payment" },
    { id: "AL-2", pay: "PAY-0006", inv: "INV-1043", amount: 9600, by: "venn", at: "2026-10-08", kind: "payment" },
    { id: "AL-3", pay: "PAY-0008", inv: "INV-1045", amount: 9000, by: "Priya R.", at: "2026-10-20", kind: "payment" },
  ],
  payments: [
    { id: "PAY-0005", payer: "Northwind Labs", cust: "Northwind Labs", date: "2026-10-09", amount: 4000, method: "Wire", ref: "WIRE 88213", source: "Bank statement CSV", status: "open" },
    { id: "PAY-0006", payer: "Meridian Retail Group", cust: "Meridian Retail Group", date: "2026-10-08", amount: 9600, method: "ACH", ref: "ACH 55102", source: "Bank statement CSV", status: "open" },
    { id: "PAY-0007", payer: "Meridian Retail Group", cust: "Meridian Retail Group", date: "2026-10-12", amount: 9600, method: "ACH", ref: "ACH 55102", source: "Bank statement CSV", status: "duplicate" },
    { id: "PAY-0008", payer: "Alder Health Systems", cust: "Alder Health Systems", date: "2026-10-20", amount: 9000, method: "Wire", ref: "WIRE 90377", source: "Bank statement CSV", status: "open" },
    { id: "PAY-0009", payer: "Harbor & Pine Legal", cust: "Harbor & Pine Legal", date: "2026-11-04", amount: 19400, method: "Wire", ref: "WIRE 91520", source: "Bank statement CSV", status: "open" },
    { id: "PAY-0013", payer: "N. Labs LLC", date: "2026-11-06", amount: 4300, method: "ACH", ref: "ACH 56120", source: "Bank statement CSV", status: "open" },
    { id: "PAY-0015", payer: "Fernhill Logistics", cust: "Fernhill Logistics", date: "2026-11-09", amount: 17800, method: "Wire", ref: "WIRE 92044", source: "Bank statement CSV", status: "open" },
    { id: "PAY-0016", payer: "Unknown payer", date: "2026-11-10", amount: 2150, method: "ACH", ref: "ACH 56990", source: "Bank statement CSV", status: "open" },
  ],
  suggs: [
    { id: "S-1", pay: "PAY-0009", invs: [["INV-1047", 12000], ["INV-1048", 7400]], rule: "R3 · sum of open invoices", conf: "high", reason: "The payment equals INV-1047 plus INV-1048 exactly and comes from the same customer.", status: "pending" },
    { id: "S-2", pay: "PAY-0013", invs: [["INV-1050", 4300]], rule: "R2 · alias and exact amount", conf: "high", reason: "Payer “N. Labs LLC” is a saved alias of Northwind Labs and the amount equals INV-1050.", status: "pending" },
    { id: "S-3", pay: "PAY-0015", invs: [["INV-1040", 9800], ["INV-1049", 8000]], rule: "R6 · combined invoices", conf: "medium", reason: "17,800.00 equals INV-1040 (9,800.00) plus INV-1049 (8,000.00). INV-1049 is due today.", status: "pending" },
    { id: "S-4", pay: "PAY-0007", invs: [], rule: "R9 · duplicate reference", conf: "review", reason: "Same payer, amount and reference (ACH 55102) as PAY-0006, which already settles INV-1043.", status: "pending" },
  ],
  invgs: [
    { id: "INVG-0001", type: "Short payment", cust: "Northwind Labs", inv: "INV-1042", pay: "PAY-0005", exposure: 1000, priority: "high", status: "ready for review", assignee: "Priya R.", created: "2026-10-28", title: "INV-1042 was paid $4,000.00 of $5,000.00", summary: "One bank payment settled four fifths of the invoice. The remaining balance has been open since the due date.",
      findings: [{ kind: "confirmed", text: "One bank payment of $4,000.00 was received on 9 Oct (PAY-0005) and allocated to INV-1042." }, { kind: "calc", text: "5,000.00 − 4,000.00 = 1,000.00 outstanding, 43 days past due." }, { kind: "possible", text: "The second instalment may be in transit. The remittance advice says “1 of 2”." }, { kind: "claim", text: "Email from Hannah Cole, 28 Oct: “We sent the remaining $1,000 last Friday.” No matching bank record." }, { kind: "missing", text: "Proof of payment for the second transfer." }],
      rec: { action: "Request proof of payment", gate: "No approval needed", kind: "request-proof" }, evidence: ["INV-1042", "PAY-0005", "remittance-northwind-oct.pdf", "email-hannah-cole-28oct.eml"], timeline: [{ at: "28 Oct 10:12", by: "venn", text: "Opened from a short payment on INV-1042" }, { at: "28 Oct 10:13", by: "venn", text: "Analysis v1 completed" }, { at: "28 Oct 15:40", by: "Priya R.", text: "Assigned to Priya R." }], version: 1 },
    { id: "INVG-0002", type: "Duplicate payment", cust: "Meridian Retail Group", inv: "INV-1043", pay: "PAY-0007", exposure: 9600, priority: "high", status: "awaiting approval", assignee: "Priya R.", created: "2026-11-02", title: "Meridian paid INV-1043 twice", summary: "Two bank payments of $9,600.00 carry the same reference. The first already settles the invoice.",
      findings: [{ kind: "confirmed", text: "PAY-0006 ($9,600.00, 8 Oct) fully settles INV-1043." }, { kind: "confirmed", text: "PAY-0007 ($9,600.00, 12 Oct) carries the same reference ACH 55102." }, { kind: "calc", text: "9,600.00 + 9,600.00 − 9,600.00 = 9,600.00 overpaid." }, { kind: "possible", text: "The second transfer was a bank re-send and a refund is expected." }, { kind: "claim", text: "Remittance note: “re-sent due to bank error.” Not confirmed by the bank." }],
      rec: { action: "Record a refund due", gate: "Owner approval required", kind: "refund" }, evidence: ["INV-1043", "PAY-0006", "PAY-0007"], timeline: [{ at: "2 Nov 09:02", by: "venn", text: "Opened from a duplicate-reference suggestion" }, { at: "13 Nov 09:05", by: "Priya R.", text: "Submitted refund record for approval (APR-0002)" }], version: 1 },
    { id: "INVG-0003", type: "Claimed payment not found", cust: "Cobalt Energy Partners", inv: "INV-1044", exposure: 22500, priority: "high", status: "in progress", assignee: "Priya R.", created: "2026-11-08", title: "Claimed wire for INV-1044 not found", summary: "The customer says a wire was released. Nothing matching appears on the bank statement.",
      findings: [{ kind: "confirmed", text: "INV-1044 for $22,500.00 is 19 days past due with no allocated payment." }, { kind: "calc", text: "22,500.00 − 0.00 = 22,500.00 outstanding." }, { kind: "possible", text: "The wire may be delayed, rejected, or sent to another account." }, { kind: "claim", text: "Customer says a wire was released “on Monday”. No wire confirmation attached." }, { kind: "missing", text: "Wire confirmation or reference from the customer." }],
      rec: { action: "Request wire confirmation", gate: "Final notice needs approval", kind: "request-proof" }, evidence: ["INV-1044", "wire-confirmation-cobalt.pdf"], timeline: [{ at: "8 Nov 08:50", by: "venn", text: "Opened from an overdue invoice with a payment claim" }], version: 1 },
    { id: "INVG-0004", type: "Disputed invoice", cust: "Alder Health Systems", inv: "INV-1045", exposure: 9000, priority: "medium", status: "monitoring", assignee: "Priya R.", created: "2026-10-25", title: "INV-1045 partly paid while scope is disputed", summary: "Half of the invoice is paid. The customer disputes the scope of phase 2.",
      findings: [{ kind: "confirmed", text: "PAY-0008 ($9,000.00) is allocated to INV-1045." }, { kind: "calc", text: "18,000.00 − 9,000.00 = 9,000.00 outstanding." }, { kind: "possible", text: "A credit note for part of phase 2 may settle the dispute." }, { kind: "missing", text: "Signed scope change for phase 2." }],
      rec: { action: "Keep monitoring the dispute", gate: "No approval needed", kind: "monitor" }, evidence: ["INV-1045", "PAY-0008", "msa-alder-health.pdf"], timeline: [{ at: "25 Oct 11:00", by: "venn", text: "Opened from dispute DSP-001" }], version: 1 },
    { id: "INVG-0005", type: "Unapplied payment", cust: "Unknown payer", pay: "PAY-0016", exposure: 2150, priority: "low", status: "new", analysis: "insufficient", assignee: "Unassigned", created: "2026-11-10", title: "$2,150.00 received from an unknown payer", summary: "No customer or alias matches the payer name, and no open invoice has this amount.",
      findings: [{ kind: "confirmed", text: "PAY-0016 for $2,150.00 arrived on 10 Nov by ACH." }, { kind: "possible", text: "It may be a part-payment from Quillon Media or Tessera Robotics." }, { kind: "missing", text: "A remittance note naming the customer." }],
      rec: { action: "Find the payer and allocate", gate: "No approval needed", kind: "allocate" }, evidence: ["PAY-0016"], timeline: [{ at: "10 Nov 14:20", by: "venn", text: "Opened from an unmatched payment" }, { at: "10 Nov 14:21", by: "venn", text: "Analysis v1 stopped: not enough evidence to name a payer" }], version: 1 },
    { id: "INVG-0006", type: "Manual investigation", cust: "Quillon Media", inv: "INV-1037", exposure: 0, priority: "medium", status: "new", analysis: "failed", assignee: "Priya R.", created: "2026-11-13", title: "Remittance advice for INV-1037 could not be read", summary: "",
      findings: [], rec: { action: "Request proof of payment", gate: "No approval needed", kind: "request-proof" }, evidence: ["INV-1037", "remittance-quillon-nov.pdf"], timeline: [{ at: "13 Nov 08:58", by: "Priya R.", text: "Opened manually from an uploaded remittance PDF" }, { at: "13 Nov 08:59", by: "venn", text: "Analysis v1 failed: the PDF reader timed out. No records were changed" }], version: 0 },
  ],
  aprs: [
    { id: "APR-0001", type: "write-off", rec: "INV-1037", cust: "Quillon Media", amount: 340, by: "Priya R.", reason: "55 days overdue, below the collection threshold. Two reminders went unanswered.", status: "pending", created: "2026-11-11", link: "INV-1037" },
    { id: "APR-0002", type: "refund due", rec: "INVG-0002", cust: "Meridian Retail Group", amount: 9600, by: "Priya R.", reason: "Duplicate payment PAY-0007 on a fully paid invoice.", status: "pending", created: "2026-11-13", link: "INVG-0002" },
    { id: "APR-0003", type: "final notice", rec: "INV-1044", cust: "Cobalt Energy Partners", amount: 22500, by: "Priya R.", reason: "No wire confirmation after two requests.", status: "pending", created: "2026-11-13", link: "INV-1044" },
    { id: "APR-0004", type: "credit", rec: "INV-1045", cust: "Alder Health Systems", amount: 410, by: "Priya R.", reason: "Agreed goodwill credit.", status: "approved", created: "2026-11-05", decided: "2026-11-06", decidedBy: "Dana W.", comment: "Fine, record it.", link: "INV-1045" },
  ],
  cols: [
    { id: "COL-001", cust: "Northwind Labs", invs: ["INV-1050"], stage: "reminder 1", owner: "Priya R.", next: "2026-11-14", last: "2026-11-07", timeline: [{ at: "7 Nov", by: "venn", text: "Due date passed" }] },
    { id: "COL-002", cust: "Cobalt Energy Partners", invs: ["INV-1044"], stage: "reminder 2", owner: "Priya R.", next: "2026-11-13", last: "2026-11-06", timeline: [{ at: "6 Nov", by: "Priya R.", text: "Reminder sent" }, { at: "10 Nov", by: "Lena Fischer", text: "Replied: “wire sent Monday”" }] },
    { id: "COL-003", cust: "Quillon Media", invs: ["INV-1037"], stage: "final notice", owner: "Priya R.", next: "2026-11-20", last: "2026-10-30", timeline: [{ at: "30 Oct", by: "Priya R.", text: "Second reminder sent" }] },
    { id: "COL-004", cust: "Fernhill Logistics", invs: ["INV-1040", "INV-1049"], stage: "promise to pay", owner: "Priya R.", next: "2026-11-18", last: "2026-11-09", promise: "2026-11-18", timeline: [{ at: "9 Nov", by: "Theo Marsh", text: "Promised payment by 18 Nov" }] },
  ],
  dsps: [
    { id: "DSP-001", cust: "Alder Health Systems", inv: "INV-1045", amt: 9000, cat: "Scope", reason: "Customer disputes the scope of phase 2.", status: "open", owner: "Priya R.", due: "2026-11-20", notes: [{ at: "25 Oct", by: "Marcus Bell", text: "“Phase 2 deliverables were reduced in the March call.”" }, { at: "27 Oct", by: "Priya R.", text: "Requested the signed scope change from delivery." }] },
    { id: "DSP-002", cust: "Cobalt Energy Partners", inv: "INV-1044", amt: 22500, cat: "Payment claimed", reason: "Claims a wire was sent; none on statement.", status: "awaiting customer", owner: "Priya R.", due: "2026-11-18", notes: [{ at: "10 Nov", by: "Lena Fischer", text: "“Wire released on Monday.”" }] },
    { id: "DSP-003", cust: "Meridian Retail Group", inv: "INV-1043", amt: 9600, cat: "Duplicate payment", reason: "Duplicate payment, refund expected.", status: "resolved", owner: "Priya R.", due: "2026-11-05", outcome: "Refund recorded", notes: [{ at: "5 Nov", by: "Priya R.", text: "Resolved with a refund due record." }] },
  ],
  docs: [
    { id: "D-1", name: "remittance-northwind-oct.pdf", type: "Remittance advice", link: "INV-1042", by: "Priya R.", at: "2026-10-28", status: "extracted", size: "84 KB" },
    { id: "D-2", name: "bank-statement-oct.csv", type: "Bank statement", link: "8 payments", by: "Dana W.", at: "2026-11-10", status: "imported", size: "12 KB" },
    { id: "D-3", name: "invoices-export-nov.csv", type: "Invoice export", link: "14 invoices", by: "Dana W.", at: "2026-11-10", status: "imported", size: "9 KB" },
    { id: "D-4", name: "email-hannah-cole-28oct.eml", type: "Email", link: "INVG-0001", by: "venn", at: "2026-10-28", status: "linked", size: "6 KB" },
    { id: "D-5", name: "wire-confirmation-cobalt.pdf", type: "Proof of payment", link: "INV-1044", by: "Priya R.", at: "2026-11-12", status: "needs review", size: "120 KB" },
    { id: "D-6", name: "msa-alder-health.pdf", type: "Contract", link: "Alder Health Systems", by: "Dana W.", at: "2026-09-02", status: "stored", size: "310 KB" },
  ],
  notifs: [
    { id: "N-1", at: "13 Nov 09:05", text: "Priya R. submitted APR-0002 (refund due, $9,600.00) for approval.", to: "/app/approvals", read: false },
    { id: "N-2", at: "13 Nov 08:50", text: "3 payments need review in reconciliation.", to: "/app/reconciliation", read: false },
    { id: "N-3", at: "12 Nov 16:40", text: "INV-1049 is due today.", to: "/app/invoices", read: false },
    { id: "N-4", at: "12 Nov 11:20", text: "Wire confirmation uploaded for INV-1044 needs review.", to: "/app/documents", read: true },
    { id: "N-5", at: "11 Nov 15:02", text: "Gmail connected (read-only).", to: "/app/integrations", read: true },
  ],
  tasks: [
    { id: "T-1", text: "Follow up with Cobalt on the wire confirmation", due: "2026-11-13", link: "/app/collections", done: false, owner: "ar" },
    { id: "T-2", text: "Review short payment on INV-1042", due: "2026-11-14", link: "/app/investigations/INVG-0001", done: false, owner: "ar" },
    { id: "T-3", text: "Allocate the $2,150.00 unknown payment", due: "2026-11-15", link: "/app/investigations/INVG-0005", done: false, owner: "ar" },
    { id: "T-4", text: "Decide on APR-0001 to APR-0003", due: "2026-11-14", link: "/app/approvals", done: false, owner: "owner" },
    { id: "T-5", text: "Invite the rest of the AR team", due: "2026-11-20", link: "/app/team", done: false, owner: "owner" },
  ],
  team: [
    { id: "M-1", name: "Dana Whitfield", email: "dana@brightpath.example", role: "owner", status: "active", last: "Today", perms: { approve: true, send: true, integrations: true, audit: true } },
    { id: "M-2", name: "Priya Raman", email: "priya@brightpath.example", role: "ar", status: "active", last: "Today", perms: { approve: false, send: true, integrations: false, audit: false } },
    { id: "M-3", name: "Sam Keller", email: "sam@brightpath.example", role: "ar", status: "invited", last: "Invited 11 Nov", perms: { approve: false, send: true, integrations: false, audit: false } },
  ],
  integs: [
    { id: "gmail", name: "Gmail", cat: "Email", desc: "Read replies and remittance emails, send reminders from your own mailbox.", status: "connected", account: "ar@brightpath.example", last: "13 Nov 09:30", scopes: ["Read messages that match your filters", "Send messages you approve", "Never deletes or edits mail"], syncs: [{ at: "13 Nov 09:30", n: 4, ok: true, msg: "4 messages linked" }, { at: "13 Nov 03:30", n: 0, ok: true, msg: "No new messages" }, { at: "12 Nov 21:30", n: 2, ok: true, msg: "2 messages linked" }] },
    { id: "csv", name: "CSV import", cat: "Imports", desc: "Upload invoice and payment exports. Nothing else is needed to start.", status: "connected", account: "Manual uploads", last: "10 Nov 08:15", scopes: ["Reads only the files you upload"], syncs: [{ at: "10 Nov 08:15", n: 8, ok: true, msg: "8 payments imported" }, { at: "10 Nov 08:10", n: 14, ok: true, msg: "14 invoices imported" }] },
    { id: "pdf", name: "PDF remittances", cat: "Imports", desc: "Extract amounts, dates and references from remittance PDFs for review.", status: "available", scopes: ["Reads only the files you upload"], syncs: [] },
    { id: "quickbooks", name: "QuickBooks Online", cat: "Accounting", desc: "Read invoices, customers and payments. Planned for the first release.", status: "planned", scopes: ["Read invoices", "Read customers", "Read payments"], syncs: [] },
    { id: "stripe", name: "Stripe", cat: "Payments and banking", desc: "Read charges and payouts. Read-only. Planned for the first release.", status: "planned", scopes: ["Read charges", "Read payouts"], syncs: [] },
    { id: "outlook", name: "Outlook", cat: "Email", desc: "The same as Gmail for Microsoft mailboxes.", status: "planned", scopes: [], syncs: [] },
    { id: "xero", name: "Xero", cat: "Accounting", desc: "Read invoices and payments from Xero.", status: "planned", scopes: [], syncs: [] },
    { id: "bank", name: "Bank feeds", cat: "Payments and banking", desc: "Daily bank transactions without manual exports.", status: "planned", scopes: [], syncs: [] },
  ],
  audit: [
    { id: "A-1", at: "13 Nov 09:12", actor: "Dana W. (owner)", action: "Approved credit request", rec: "APR-0004", group: "approvals", before: "pending", after: "approved" },
    { id: "A-2", at: "13 Nov 09:05", actor: "Priya R. (AR)", action: "Submitted refund record for approval", rec: "APR-0002", group: "approvals" },
    { id: "A-3", at: "12 Nov 16:40", actor: "venn", action: "Suggested match for PAY-0015 (rule R6)", rec: "PAY-0015", group: "reconciliation" },
    { id: "A-4", at: "12 Nov 16:38", actor: "venn", action: "Linked email to investigation", rec: "INVG-0001", group: "investigations" },
    { id: "A-5", at: "12 Nov 11:20", actor: "Priya R. (AR)", action: "Confirmed match PAY-0008 → INV-1045", rec: "PAY-0008", group: "reconciliation", before: "unallocated", after: "allocated" },
    { id: "A-6", at: "11 Nov 15:02", actor: "Dana W. (owner)", action: "Connected Gmail (read-only)", rec: "gmail", group: "integrations" },
    { id: "A-7", at: "11 Nov 10:30", actor: "Dana W. (owner)", action: "Invited Sam K. as AR specialist", rec: "M-3", group: "team" },
    { id: "A-8", at: "10 Nov 08:15", actor: "venn", action: "Imported 8 payments from CSV", rec: "Import", group: "imports" },
  ],
  settings: {
    company: { name: "Brightpath Digital", legal: "Brightpath Digital LLC", address: "400 Congress Ave, Austin, TX", industry: "Software agency", size: "11 to 50", website: "brightpath.example" },
    financial: { currency: "USD", timezone: "America/Chicago", terms: 30, autoApply: true, shortGrace: 3, claimGrace: 5 },
    approvals: { "write-off": 250, "refund due": 0, "final notice": 0, credit: 250 },
    notifications: { approvals: true, reconciliation: true, dueToday: true, integrations: true, digest: false },
    security: { mfa: false },
    remittance: { bank: "First Meridian Bank", account: "•••• 4821", changedAt: "2026-08-14" },
  },
})

/* ---------------------------------------------------------------- store */
const KEY = "venn.app.v5"
const load = (): State => { try { const r = localStorage.getItem(KEY); if (r) return { ...seed(), ...JSON.parse(r) } } catch { /* storage blocked */ } return seed() }
let state: State = load()
const subs = new Set<() => void>()
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* storage blocked */ } }
export const getState = () => state
export function mut(fn: (d: State) => void) { const d = structuredClone(state); fn(d); state = d; persist(); subs.forEach((f) => f()) }
export const useApp = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, getState)

/* --------------------------------------------------------------- derived */
export const nextId = (d: State, p: string) => { d.seq += 1; return `${p}-${String(d.seq).padStart(4, "0")}` }
export const actor = (s: State) => (s.role === "owner" ? "Dana W. (owner)" : "Priya R. (AR)")
const log = (d: State, action: string, rec: string, group: string, before?: string, after?: string) => d.audit.unshift({ id: nextId(d, "A"), at: NOW, actor: actor(d), action, rec, group, before, after })
const note = (d: State, text: string, to: string) => d.notifs.unshift({ id: nextId(d, "N"), at: NOW, text, to, read: false })
const who = (d: State) => (d.role === "owner" ? "Dana W." : "Priya R.")

/* --------------------------------------------------------------- actions */
export const A = {
  openInvg(inv: string): string { let id = ""; mut((d) => { const i = d.invoices.find((x) => x.id === inv)!; const ex = d.invgs.find((g) => g.inv === inv && !["resolved", "dismissed"].includes(g.status)); if (ex) { id = ex.id; return } id = nextId(d, "INVG"); const b = balOf(d, i); d.invgs.unshift({ id, type: "Manual investigation", cust: i.cust, inv, exposure: b, priority: "medium", status: "new", assignee: who(d), created: "2026-11-13", title: `Review ${inv} for ${i.cust}`, summary: "Opened manually from the invoice.", findings: [{ kind: "confirmed", text: `${inv} has a balance of ${usd(b)}.` }, { kind: "calc", text: `${usd(invTotal(i))} − ${usd(paidOf(d, inv))} = ${usd(b)} outstanding.` }, { kind: "missing", text: "A reason for the open balance." }], rec: { action: "Request proof of payment", gate: "No approval needed", kind: "request-proof" }, evidence: [inv], timeline: [{ at: NOW, by: who(d), text: `Opened from ${inv}` }], version: 1 }); log(d, `Opened investigation ${id}`, id, "investigations") }); toast.success(id + " opened"); return id },
  setPayStatus: (id: string, status: Pay["status"]) => { mut((d) => { const p = d.payments.find((x) => x.id === id); if (p) { p.status = status; log(d, `Marked ${id} ${status}`, id, "payments") } }); toast(`Marked ${status}`) },
  // Signing in as the sample owner on an emptied workspace brings the sample records back.
  signIn: (name: string, email: string) => { if (email === "dana@brightpath.example" && !state.invoices.length) { state = { ...seed(), session: { name, email } }; persist(); subs.forEach((f) => f()) } else mut((d) => { d.session = { name, email } }) },
  signOut: () => mut((d) => { d.session = null }),
  setRole: (r: Role) => mut((d) => { d.role = r }),
  finishOnboarding: () => mut((d) => { d.onboarded = true }),
  setSetup: (k: string, v: boolean) => mut((d) => { d.setup[k] = v }),
  startFresh: (name: string, email: string) => { const e = seed(); state = { ...e, session: { name, email }, role: "owner", setup: {}, settings: { ...e.settings, company: { ...e.settings.company, name: "Your workspace" } }, customers: [], invoices: [], allocs: [], payments: [], suggs: [], invgs: [], aprs: [], cols: [], dsps: [], docs: [], notifs: [], tasks: [], integs: e.integs.map((g) => ({ ...g, status: g.status === "connected" ? "available" : g.status, last: undefined, syncs: [] })), audit: [], team: e.team.filter((m) => m.role === "owner").slice(0, 1).map((m) => ({ ...m, name, email })) }; persist(); subs.forEach((f) => f()) },
  reset: () => { state = seed(); persist(); subs.forEach((f) => f()); toast.success("Workspace reset") },

  confirmSugg(id: string, amounts?: number[]) {
    mut((d) => {
      const g = d.suggs.find((x) => x.id === id); if (!g || g.status !== "pending") return
      if (!g.invs.length) { g.status = "confirmed"; const p = d.payments.find((x) => x.id === g.pay); if (p) p.status = "duplicate"; log(d, `Confirmed ${g.pay} as a duplicate`, g.pay, "reconciliation", "open", "duplicate"); return }
      g.invs.forEach(([inv, amt], k) => d.allocs.push({ id: nextId(d, "AL"), pay: g.pay, inv, amount: amounts?.[k] ?? amt, by: who(d), at: "2026-11-13", kind: "payment" }))
      g.status = "confirmed"; const p = d.payments.find((x) => x.id === g.pay); if (p && !p.cust) p.cust = d.invoices.find((i) => i.id === g.invs[0][0])?.cust
      log(d, `Confirmed match ${g.pay} → ${g.invs.map((i) => i[0]).join(" + ")}`, g.pay, "reconciliation", "unallocated", "allocated")
    })
    toast.success("Match confirmed and recorded")
  },
  rejectSugg: (id: string) => { mut((d) => { const g = d.suggs.find((x) => x.id === id); if (g) { g.status = "rejected"; log(d, `Rejected suggestion for ${g.pay}`, g.pay, "reconciliation") } }); toast("Suggestion rejected") },
  allocate(pay: string, inv: string, amount: number) {
    mut((d) => { d.allocs.push({ id: nextId(d, "AL"), pay, inv, amount, by: who(d), at: "2026-11-13", kind: "payment" }); log(d, `Allocated ${usd(amount)} from ${pay} to ${inv}`, pay, "reconciliation", "unallocated", "allocated") })
    toast.success(`Allocated ${usd(amount)} to ${inv}`)
  },
  undoAlloc: (id: string) => { mut((d) => { const a = d.allocs.find((x) => x.id === id); if (a) { a.void = true; log(d, `Voided allocation ${a.pay} → ${a.inv}`, a.pay, "reconciliation", "allocated", "voided") } }); toast("Allocation voided") },
  runRecon() { mut((d) => { log(d, "Ran reconciliation", "Run", "reconciliation"); note(d, "Reconciliation finished. No new suggestions.", "/app/reconciliation") }); toast.success("Reconciliation finished. Nothing new to review.") },

  recordPayment(inv: string, amount: number, method: string, ref: string) {
    mut((d) => { const i = d.invoices.find((x) => x.id === inv)!; const id = nextId(d, "PAY"); d.payments.unshift({ id, payer: i.cust, cust: i.cust, date: "2026-11-13", amount, method, ref: ref || "manual", source: "Manual entry", status: "open" }); d.allocs.push({ id: nextId(d, "AL"), pay: id, inv, amount, by: who(d), at: "2026-11-13", kind: "payment" }); log(d, `Recorded payment ${usd(amount)} on ${inv}`, inv, "invoices") })
    toast.success("Payment recorded")
  },
  cancelInvoice: (id: string) => { mut((d) => { const i = d.invoices.find((x) => x.id === id); if (i) { i.cancelled = true; log(d, `Cancelled ${id}`, id, "invoices") } }); toast("Invoice cancelled") },
  addInvoice(i: Omit<Inv, "id">) { let id = ""; mut((d) => { id = "INV-" + (1055 + d.invoices.length - 14); d.invoices.unshift({ ...i, id }); log(d, `Created ${id}`, id, "invoices") }); toast.success(`${id} created`); return id },
  addCustomer(c: Omit<Customer, "id">) { mut((d) => { d.customers.push({ ...c, id: nextId(d, "c") }); log(d, `Added customer ${c.name}`, c.name, "customers") }); toast.success(`${c.name} added`) },
  updateCustomer: (id: string, p: Partial<Customer>) => { mut((d) => { const c = d.customers.find((x) => x.id === id); if (c) { Object.assign(c, p); log(d, `Updated customer ${c.name}`, c.name, "customers") } }); toast.success("Customer saved") },
  importInvoices(rows: Omit<Inv, "id">[]) { mut((d) => { rows.forEach((r, k) => { const id = r.po.startsWith("INV-") ? r.po : "INV-" + (2000 + d.invoices.length + k); d.invoices.push({ ...r, id }); if (!d.customers.some((c) => c.name === r.cust)) d.customers.push({ id: nextId(d, "c"), name: r.cust, contact: "", email: "", terms: 30, city: "", aliases: [], notes: "Created by import" }) }); log(d, `Imported ${rows.length} invoices from CSV`, "Import", "imports"); d.docs.unshift({ id: nextId(d, "D"), name: "invoices-import.csv", type: "Invoice export", link: `${rows.length} invoices`, by: who(d), at: "2026-11-13", status: "imported", size: "—" }) }); toast.success(`${rows.length} invoices imported`) },
  importPayments(rows: Omit<Pay, "id">[]) { mut((d) => { rows.forEach((r) => d.payments.unshift({ ...r, id: nextId(d, "PAY") })); log(d, `Imported ${rows.length} payments from CSV`, "Import", "imports"); d.docs.unshift({ id: nextId(d, "D"), name: "payments-import.csv", type: "Bank statement", link: `${rows.length} payments`, by: who(d), at: "2026-11-13", status: "imported", size: "—" }) }); toast.success(`${rows.length} payments imported`) },

  setInvgStatus: (id: string, status: Invg["status"], text: string) => { mut((d) => { const g = d.invgs.find((x) => x.id === id); if (g) { g.status = status; g.timeline.push({ at: NOW, by: who(d), text }); log(d, text, id, "investigations") } }); toast.success(text) },
  assignInvg: (id: string, to: string) => { mut((d) => { const g = d.invgs.find((x) => x.id === id); if (g) { g.assignee = to; g.timeline.push({ at: NOW, by: who(d), text: `Assigned to ${to}` }); log(d, `Assigned ${id} to ${to}`, id, "investigations") } }); toast.success(`Assigned to ${to}`) },
  addEvidence: (id: string, e: string) => { mut((d) => { const g = d.invgs.find((x) => x.id === id); if (g && !g.evidence.includes(e)) { g.evidence.push(e); g.timeline.push({ at: NOW, by: who(d), text: `Linked evidence ${e}` }) } }); toast.success("Evidence linked") },
  addInvgNote: (id: string, text: string) => { mut((d) => { const g = d.invgs.find((x) => x.id === id); if (g) g.timeline.push({ at: NOW, by: who(d), text: `Note: ${text}` }) }); toast.success("Note added") },
  rerun: (id: string) => {
    let note = "Analysis updated"
    mut((d) => {
      const g = d.invgs.find((x) => x.id === id); if (!g) return
      if (g.analysis === "insufficient" && g.evidence.length < 2) { note = "Still not enough evidence. Add a document or email, then re-run."; g.timeline.push({ at: NOW, by: "venn", text: "Re-run stopped: still not enough evidence" }); return }
      const i = g.inv ? d.invoices.find((x) => x.id === g.inv) : undefined
      if (g.analysis === "failed" && i) { const bal = balOf(d, i); g.exposure = bal; g.summary = `${i.id} has an open balance of ${usd(bal)}, ${lateOf(i)} days past due. The remittance advice is attached but not yet matched to a bank record.`; g.findings = [{ kind: "confirmed", text: `${i.id} has ${usd(bal)} outstanding.` }, { kind: "calc", text: `Due ${i.due}, ${lateOf(i)} days past due.` }, { kind: "possible", text: "The remittance advice may describe a payment still in transit." }, { kind: "missing", text: "A bank record that matches the remittance advice." }] }
      if (g.analysis === "insufficient") g.findings.push({ kind: "possible", text: "The attached document suggests a payer name to check against your customer list." })
      if (g.analysis) delete g.analysis
      else if (g.inv && ["Short payment", "Manual investigation"].includes(g.type)) { const i2 = d.invoices.find((x) => x.id === g.inv); if (i2) g.exposure = balOf(d, i2) }
      g.version += 1; g.timeline.push({ at: NOW, by: "venn", text: `Analysis v${g.version} completed. Records unchanged.` }); log(d, `Re-ran analysis on ${id}`, id, "investigations")
    })
    note.startsWith("Still") ? toast.error(note) : toast.success(note)
  },
  actOnInvg(id: string) {
    mut((d) => {
      const g = d.invgs.find((x) => x.id === id); if (!g) return
      if (g.rec.kind === "request-proof") { const cust = g.cust; let c = d.cols.find((x) => x.cust === cust); if (!c) { c = { id: nextId(d, "COL"), cust, invs: g.inv ? [g.inv] : [], stage: "reminder 1", owner: who(d), next: "2026-11-14", last: "—", timeline: [] }; d.cols.push(c) } c.timeline.push({ at: NOW, by: "venn", text: "Proof-of-payment request drafted from " + id }); note(d, `Draft ready: ${g.rec.action} for ${cust}.`, "/app/collections"); g.status = "in progress"; g.timeline.push({ at: NOW, by: who(d), text: "Drafted: " + g.rec.action }) }
      else if (g.rec.kind === "refund") { const a: Apr = { id: nextId(d, "APR"), type: "refund due", rec: g.id, cust: g.cust, amount: g.exposure, by: who(d), reason: g.title, status: "pending", created: "2026-11-13", link: g.id }; d.aprs.unshift(a); g.status = "awaiting approval"; g.timeline.push({ at: NOW, by: who(d), text: `Submitted refund record for approval (${a.id})` }); log(d, `Submitted refund record for approval`, a.id, "approvals") }
      else if (g.rec.kind === "final-notice") { g.status = "awaiting approval"; g.timeline.push({ at: NOW, by: who(d), text: "Final notice sent for approval" }) }
      else { g.status = "monitoring"; g.timeline.push({ at: NOW, by: who(d), text: "Monitoring" }) }
    })
    toast.success("Done. See the timeline.")
  },
  decide(id: string, decision: "approved" | "rejected" | "info requested", comment: string) {
    mut((d) => {
      const a = d.aprs.find((x) => x.id === id); if (!a || a.status !== "pending" && a.status !== "info requested") return
      a.status = decision; a.decided = "2026-11-13"; a.decidedBy = "Dana W."; a.comment = comment
      if (decision === "approved") {
        if ((a.type === "write-off" || a.type === "credit") && a.link) { const i = d.invoices.find((x) => x.id === a.link); if (i) { const b = Math.min(a.amount, balOf(d, i)); if (b > 0) d.allocs.push({ id: nextId(d, "AL"), pay: a.id, inv: i.id, amount: b, by: "Dana W.", at: "2026-11-13", kind: a.type === "credit" ? "credit" : "writeoff" }) } }
        const g = d.invgs.find((x) => x.id === a.link || x.id === a.rec); if (g) { g.status = "resolved"; g.timeline.push({ at: NOW, by: "Dana W.", text: `${a.id} approved. Investigation resolved.` }) }
        if (a.type === "final notice") { const c = d.cols.find((x) => x.invs.includes(a.link ?? "")); if (c) { c.stage = "final notice"; c.timeline.push({ at: NOW, by: "Dana W.", text: "Final notice approved" }) } }
      } else { const g = d.invgs.find((x) => x.id === a.link || x.id === a.rec); if (g && decision === "rejected") { g.status = "in progress"; g.timeline.push({ at: NOW, by: "Dana W.", text: `${a.id} rejected: ${comment || "no comment"}` }) } }
      note(d, `${a.id} ${decision} by Dana W.`, "/app/approvals"); log(d, `${decision[0].toUpperCase() + decision.slice(1)} ${a.type} request`, a.id, "approvals", "pending", decision)
    })
    toast.success(`Request ${decision}`)
  },
  requestApproval(type: Apr["type"], rec: string, cust: string, amount: number, reason: string, link?: string) { let id = ""; mut((d) => { id = nextId(d, "APR"); d.aprs.unshift({ id, type, rec, cust, amount, by: who(d), reason, status: "pending", created: "2026-11-13", link }); note(d, `${who(d)} submitted ${id} (${type}, ${usd(amount)}) for approval.`, "/app/approvals"); log(d, `Submitted ${type} request`, id, "approvals") }); toast.success(`${id} submitted for approval`); return id },
  withdraw: (id: string) => { mut((d) => { const a = d.aprs.find((x) => x.id === id); if (a) { a.status = "withdrawn"; log(d, "Withdrew request", id, "approvals") } }); toast("Request withdrawn") },

  sendCollection(id: string, subject: string) { mut((d) => { const c = d.cols.find((x) => x.id === id); if (!c) return; c.timeline.push({ at: NOW, by: who(d), text: `Sent: ${subject}` }); c.last = "2026-11-13"; c.next = "2026-11-20"; if (c.stage === "reminder 1") c.stage = "reminder 2"; log(d, `Sent ${subject}`, id, "collections") }); toast.success("Sent from your connected mailbox") },
  setStage: (id: string, stage: Col["stage"]) => { mut((d) => { const c = d.cols.find((x) => x.id === id); if (c) { c.stage = stage; c.timeline.push({ at: NOW, by: who(d), text: `Stage set to ${stage}` }) } }); toast(`Stage: ${stage}`) },
  addDispute(x: Omit<Dsp, "id" | "notes" | "status" | "owner">) { let id = ""; mut((d) => { id = nextId(d, "DSP"); d.dsps.unshift({ ...x, id, status: "open", owner: who(d), notes: [{ at: NOW, by: who(d), text: "Dispute opened" }] }); log(d, "Opened dispute", id, "disputes") }); toast.success(`${id} opened`) },
  noteDispute: (id: string, text: string) => { mut((d) => { d.dsps.find((x) => x.id === id)?.notes.push({ at: NOW, by: who(d), text }) }); toast.success("Note added") },
  resolveDispute: (id: string, outcome: string) => { mut((d) => { const x = d.dsps.find((y) => y.id === id); if (x) { x.status = "resolved"; x.outcome = outcome; x.notes.push({ at: NOW, by: who(d), text: `Resolved: ${outcome}` }); log(d, `Resolved dispute: ${outcome}`, id, "disputes") } }); toast.success("Dispute resolved") },
  addDoc: (name: string, size: string, link: string) => { mut((d) => { d.docs.unshift({ id: nextId(d, "D"), name, type: name.endsWith(".pdf") ? "PDF" : name.endsWith(".csv") ? "CSV" : "File", link, by: who(d), at: "2026-11-13", status: "uploaded", size }); log(d, `Uploaded ${name}`, name, "documents") }); toast.success("Uploaded") },
  markRead: (id?: string) => mut((d) => { d.notifs.forEach((n) => { if (!id || n.id === id) n.read = true }) }),
  toggleTask: (id: string) => mut((d) => { const t = d.tasks.find((x) => x.id === id); if (t) t.done = !t.done }),
  addTask: (text: string, due: string) => { mut((d) => { d.tasks.unshift({ id: nextId(d, "T"), text, due, link: "/app", done: false, owner: d.role }) }); toast.success("Task added") },

  invite(email: string, role: Role) { mut((d) => { d.team.push({ id: nextId(d, "M"), name: email.split("@")[0], email, role, status: "invited", last: "Invited today", perms: { approve: role === "owner", send: true, integrations: role === "owner", audit: role === "owner" } }); log(d, `Invited ${email} as ${role}`, email, "team") }); toast.success(`Invitation sent to ${email}`) },
  setMember: (id: string, p: Partial<Member>) => { mut((d) => { const m = d.team.find((x) => x.id === id); if (m) { Object.assign(m, p); log(d, `Updated ${m.name}`, id, "team") } }); toast.success("Member updated") },
  setPerm: (id: string, k: string, v: boolean) => mut((d) => { const m = d.team.find((x) => x.id === id); if (m) { m.perms[k] = v; log(d, `Set ${k} permission to ${v} for ${m.name}`, id, "team") } }),
  setInteg(id: string, status: Integ["status"]) { mut((d) => { const x = d.integs.find((y) => y.id === id); if (x) { x.status = status; if (status === "connected") { x.account = "ar@brightpath.example"; x.last = NOW; x.syncs.unshift({ at: NOW, n: 0, ok: true, msg: "Connected" }) } log(d, `${status === "connected" ? "Connected" : status === "available" ? "Disconnected" : "Requested early access to"} ${x.name}`, id, "integrations") } }); toast.success(status === "connected" ? "Connected" : "Updated") },
  syncInteg: (id: string) => { mut((d) => { const x = d.integs.find((y) => y.id === id); if (x) { x.last = NOW; x.syncs.unshift({ at: NOW, n: 1, ok: true, msg: "1 new record" }) } }); toast.success("Sync finished") },
  saveSettings: <K extends keyof Settings>(k: K, v: Settings[K]) => { mut((d) => { d.settings[k] = v; log(d, `Updated ${k} settings`, "Settings", "settings") }); toast.success("Settings saved") },
}
export const toCsv = (rows: (string | number)[][]) => rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
export const download = (name: string, text: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name; a.click(); URL.revokeObjectURL(a.href) }

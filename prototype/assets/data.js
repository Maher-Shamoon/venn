/* Venn prototype — DEMO DATA ONLY. All companies, people and amounts are fictional.
   Prototype uses JS numbers for money (whole-cent demo values). The real product uses Decimal/NUMERIC end to end. */
const TODAY = '2026-11-13';
const D = {
  org: { name: 'Brightpath Digital (demo)', currency: 'USD', tz: 'America/New_York', country: 'US' },
  users: [
    { id: 'u1', name: 'Dana Whitfield', email: 'dana@brightpath.example', role: 'owner', status: 'active', last: '2026-11-13 09:12' },
    { id: 'u2', name: 'Priya Raman', email: 'priya@brightpath.example', role: 'ar', status: 'active', last: '2026-11-13 09:40' },
    { id: 'u3', name: 'Marcus Oyelaran', email: 'marcus@brightpath.example', role: 'ar', status: 'active', last: '2026-11-12 16:05' },
    { id: 'u4', name: 'Tom Ellery', email: 'tom@brightpath.example', role: 'ar', status: 'invited', last: '' },
  ],
  customers: [
    { id: 'c1', name: 'Northwind Labs', terms: 30, cur: 'USD', alias: ['NORTHWIND LABS INC', 'NORTHWIND LABS'], contacts: [{ n: 'Hannah Cole', e: 'ap@northwind.example', r: 'AP lead', b: true }] },
    { id: 'c2', name: 'Harbor & Finch LLP', terms: 30, cur: 'USD', alias: ['HARBOR FINCH LLP'], contacts: [{ n: 'Ravi Menon', e: 'accounts@harborfinch.example', r: 'Office manager', b: true }] },
    { id: 'c3', name: 'Quantum Freight', terms: 30, cur: 'USD', alias: ['QUANTUM FREIGHT'], contacts: [{ n: 'Sofia Alvarez', e: 'payables@quantumfreight.example', r: 'Payables', b: true }] },
    { id: 'c4', name: 'Alder Health Systems', terms: 30, cur: 'USD', alias: ['ALDER HEALTH SYSTEMS', 'ALDER HEALTH'], contacts: [{ n: 'Greg Tran', e: 'finance@alderhealth.example', r: 'Controller', b: true }] },
    { id: 'c5', name: 'Meridian Retail Group', terms: 30, cur: 'USD', alias: ['MERIDIAN RETAIL GRP'], contacts: [{ n: 'Elena Park', e: 'ap@meridianretail.example', r: 'AP manager', b: true }] },
    { id: 'c6', name: 'Cobalt Energy Partners', terms: 45, cur: 'USD', alias: ['COBALT ENERGY'], contacts: [{ n: 'Wes Hartley', e: 'invoices@cobaltenergy.example', r: 'Finance', b: true }] },
    { id: 'c7', name: 'Lumen Education', terms: 30, cur: 'USD', alias: ['LUMEN EDU'], contacts: [{ n: 'Aisha Bello', e: 'bursar@lumenedu.example', r: 'Bursar', b: true }] },
    { id: 'c8', name: 'Stratus Cloud GmbH', terms: 30, cur: 'EUR', alias: ['STRATUS CLOUD GMBH'], contacts: [{ n: 'Jonas Weber', e: 'buchhaltung@stratus.example', r: 'Accounting', b: true }] },
  ],
  // [id, number, customer, issue, due, total, currency, lifecycle, po, description]
  invoices: [
    ['i35', 'INV-1035', 'c5', '2026-08-10', '2026-09-09', 5500, 'USD', 'issued', 'PO-7714', 'Platform build — August'],
    ['i36', 'INV-1036', 'c1', '2026-07-15', '2026-08-14', 6000, 'USD', 'cancelled', '', 'Duplicate of INV-1030 (cancelled)'],
    ['i37', 'INV-1037', 'c6', '2026-07-30', '2026-09-13', 8200, 'USD', 'issued', 'CE-2201', 'Data pipeline — July'],
    ['i38', 'INV-1038', 'c2', '2026-08-20', '2026-09-19', 12400, 'USD', 'issued', '', 'Retainer — Q3'],
    ['i39', 'INV-1039', 'c3', '2026-08-28', '2026-09-27', 7850, 'USD', 'issued', 'QF-882', 'Routing dashboard'],
    ['i40', 'INV-1040', 'c4', '2026-09-01', '2026-10-01', 18000, 'USD', 'issued', 'AH-4410', 'Patient portal — milestones 1 & 2'],
    ['i42', 'INV-1042', 'c1', '2026-09-01', '2026-10-01', 5000, 'USD', 'issued', 'NW-1190', 'Mobile app sprint 14–16'],
    ['i43', 'INV-1043', 'c5', '2026-09-05', '2026-10-05', 9600, 'USD', 'issued', 'PO-7790', 'Checkout optimisation'],
    ['i44', 'INV-1044', 'c6', '2026-09-10', '2026-10-25', 22500, 'USD', 'issued', 'CE-2230', 'SCADA integration phase 1'],
    ['i45', 'INV-1045', 'c7', '2026-09-12', '2026-10-12', 3200, 'USD', 'issued', 'LE-301', 'LMS customisation — 40 hours'],
    ['i46', 'INV-1046', 'c2', '2026-09-18', '2026-10-18', 6750, 'USD', 'issued', '', 'Document portal'],
    ['i47', 'INV-1047', 'c3', '2026-09-25', '2026-10-25', 14200, 'USD', 'issued', 'QF-901', 'Fleet tracking module'],
    ['i48', 'INV-1048', 'c3', '2026-10-02', '2026-11-01', 5200, 'USD', 'issued', 'QF-901', 'Fleet tracking — support'],
    ['i49', 'INV-1049', 'c4', '2026-10-05', '2026-11-04', 8800, 'USD', 'issued', 'AH-4455', 'Scheduling API'],
    ['i50', 'INV-1050', 'c1', '2026-10-08', '2026-11-07', 4300, 'USD', 'issued', 'NW-1204', 'October services'],
    ['i51', 'INV-1051', 'c5', '2026-10-12', '2026-11-11', 11000, 'USD', 'issued', 'PO-7822', 'Loyalty app'],
    ['i52', 'INV-1052', 'c6', '2026-10-15', '2026-11-29', 7400, 'USD', 'issued', 'CE-2251', 'Dashboard hosting'],
    ['i53', 'INV-1053', 'c7', '2026-10-20', '2026-11-19', 2950, 'USD', 'issued', 'LE-318', 'Training sessions'],
    ['i54', 'INV-1054', 'c8', '2026-10-22', '2026-11-21', 6000, 'EUR', 'issued', '', 'Cloud migration — EU'],
    ['i55', 'INV-1055', 'c2', '2026-11-01', '2026-12-01', 15600, 'USD', 'issued', '', 'Retainer — Q4'],
    ['i56', 'INV-1056', 'c4', '2026-11-03', '2026-12-03', 9300, 'USD', 'issued', 'AH-4480', 'Analytics module'],
    ['i57', 'INV-1057', 'c3', '2026-11-05', '2026-12-05', 4100, 'USD', 'draft', 'QF-933', 'Draft — maintenance'],
    ['i58', 'INV-1058', 'c6', '2026-11-08', '2026-12-23', 3900, 'USD', 'issued', 'CE-2270', 'Change request 4'],
  ].map(a => ({ id: a[0], number: a[1], cust: a[2], issue: a[3], due: a[4], total: a[5], cur: a[6], life: a[7], po: a[8], desc: a[9] })),
  // [id, number, date, amount, cur, cust, payer, ref, method, verification, underReview, reversed]
  payments: [
    ['pa1', 'PAY-0001', '2026-09-24', 12400, 'USD', 'c2', 'HARBOR FINCH LLP', 'INV-1038', 'Wire', 'source_verified'],
    ['pa2', 'PAY-0002', '2026-09-30', 6850, 'USD', 'c3', 'QUANTUM FREIGHT', 'INV-1039', 'ACH', 'source_verified'],
    ['pa3', 'PAY-0003', '2026-10-14', 1000, 'USD', 'c3', 'QUANTUM FREIGHT', 'INV-1039 balance', 'ACH', 'source_verified'],
    ['pa4', 'PAY-0004', '2026-10-08', 9000, 'USD', 'c4', 'ALDER HEALTH SYSTEMS', 'INV-1040 milestone 1', 'ACH', 'source_verified'],
    ['pa5', 'PAY-0005', '2026-10-09', 4000, 'USD', 'c1', 'NORTHWIND LABS INC', 'INV-1042', 'Wire', 'source_verified'],
    ['pa6', 'PAY-0006', '2026-10-04', 9600, 'USD', 'c5', 'MERIDIAN RETAIL GRP', 'INV-1043', 'ACH', 'source_verified'],
    ['pa7', 'PAY-0007', '2026-10-18', 9600, 'USD', 'c5', 'MERIDIAN RETAIL GRP', 'INV-1043', 'ACH', 'source_verified', true],
    ['pa8', 'PAY-0008', '2026-10-16', 6750, 'USD', 'c2', 'HARBOR FINCH LLP', 'INV-1046', 'ACH', 'source_verified'],
    ['pa9', 'PAY-0009', '2026-11-10', 19400, 'USD', 'c3', 'QUANTUM FREIGHT', 'INV-1047 INV-1048', 'ACH', 'source_verified'],
    ['pa10', 'PAY-0010', '2026-11-09', 6540, 'USD', 'c8', 'STRATUS CLOUD GMBH', 'INV-1054', 'Wire', 'source_verified', true],
    ['pa11', 'PAY-0011', '2026-09-12', 7860, 'USD', 'c6', 'COBALT ENERGY', 'INV-1037', 'Wire', 'source_verified'],
    ['pa12', 'PAY-0012', '2026-09-15', 5200, 'USD', 'c5', 'MERIDIAN RETAIL GRP', 'INV-1035', 'ACH', 'source_verified'],
    ['pa13', 'PAY-0013', '2026-11-12', 4300, 'USD', null, 'NORTHWIND LABS', 'Oct services', 'Wire', 'source_verified'],
    ['pa14', 'PAY-0014', '2026-11-11', 2150, 'USD', null, 'J SMITH CONSULTING', 'thanks', 'Wire', 'source_verified'],
    ['pa15', 'PAY-0015', '2026-11-12', 17800, 'USD', 'c4', 'ALDER HEALTH SYSTEMS', 'Nov payment', 'ACH', 'source_verified'],
  ].map(a => ({ id: a[0], number: a[1], date: a[2], amount: a[3], cur: a[4], cust: a[5], payer: a[6], ref: a[7], method: a[8], ver: a[9], review: !!a[10], reversed: !!a[11], source: 'Bank CSV import' })),
  allocations: [
    ['al1', 'pa1', 'i38', 12400, 'auto_rule', '2026-09-24'], ['al2', 'pa2', 'i39', 6850, 'auto_rule', '2026-09-30'],
    ['al3', 'pa3', 'i39', 1000, 'suggestion_confirmed', '2026-10-14'], ['al4', 'pa4', 'i40', 9000, 'suggestion_confirmed', '2026-10-09'],
    ['al5', 'pa5', 'i42', 4000, 'suggestion_confirmed', '2026-10-10'], ['al6', 'pa6', 'i43', 9600, 'auto_rule', '2026-10-04'],
    ['al8', 'pa8', 'i46', 6750, 'auto_rule', '2026-10-16'], ['al9', 'pa11', 'i37', 7860, 'suggestion_confirmed', '2026-09-13'],
    ['al10', 'pa12', 'i35', 5200, 'auto_rule', '2026-09-15'],
  ].map(a => ({ id: a[0], pay: a[1], inv: a[2], amount: a[3], method: a[4], at: a[5], voided: false })),
  adjustments: [
    { id: 'adj1', number: 'ADJ-0001', inv: 'i35', type: 'credit', amount: 300, status: 'applied', reason: 'Agreed credit: scope reduction on August build', approval: 'ap3' },
    { id: 'adj2', number: 'ADJ-0002', inv: 'i37', type: 'write_off', amount: 340, status: 'pending_approval', reason: 'Residual after bank fee deduction; customer unreachable', approval: 'ap1' },
  ],
  matches: [
    { id: 'm1', pay: 'pa9', rule: 'R4', conf: 'high', status: 'suggested', alloc: [['i47', 14200], ['i48', 5200]], why: 'Reference lists INV-1047 and INV-1048; 14,200.00 + 5,200.00 = 19,400.00, the payment amount.' },
    { id: 'm2', pay: 'pa13', rule: 'R5', conf: 'high', status: 'suggested', alloc: [['i50', 4300]], why: 'Payer "NORTHWIND LABS" is a known alias of Northwind Labs, and exactly one open invoice (INV-1050) has a balance of 4,300.00.' },
    { id: 'm3', pay: 'pa15', rule: 'R6', conf: 'medium', status: 'suggested', alloc: [['i40', 9000], ['i49', 8800]], why: 'Alder Health Systems has open balances of 9,000.00 (INV-1040), 8,800.00 (INV-1049) and 9,300.00 (INV-1056). Only INV-1040 + INV-1049 sum to 17,800.00. No reference number was given, so this needs review.' },
  ],
  discrepancies: [
    { id: 'dsc1', number: 'DSC-0001', type: 'short_payment', cust: 'c1', inv: 'i42', pay: 'pa5', exposure: 1000, cur: 'USD', status: 'investigating', inv_id: 'iv1', age: 35 },
    { id: 'dsc2', number: 'DSC-0002', type: 'duplicate_payment', cust: 'c5', inv: 'i43', pay: 'pa7', exposure: 9600, cur: 'USD', status: 'investigating', inv_id: 'iv2', age: 26 },
    { id: 'dsc3', number: 'DSC-0003', type: 'short_payment', cust: 'c4', inv: 'i40', pay: 'pa4', exposure: 9000, cur: 'USD', status: 'investigating', inv_id: 'iv3', age: 36 },
    { id: 'dsc4', number: 'DSC-0004', type: 'currency_mismatch', cust: 'c8', inv: 'i54', pay: 'pa10', exposure: 6000, cur: 'EUR', status: 'open', inv_id: null, age: 4 },
    { id: 'dsc5', number: 'DSC-0005', type: 'missing_payment_claimed', cust: 'c6', inv: 'i44', pay: null, exposure: 22500, cur: 'USD', status: 'investigating', inv_id: 'iv4', age: 8 },
    { id: 'dsc6', number: 'DSC-0006', type: 'unmatched_payment', cust: null, inv: null, pay: 'pa14', exposure: 2150, cur: 'USD', status: 'open', inv_id: null, age: 2 },
    { id: 'dsc7', number: 'DSC-0007', type: 'short_payment', cust: 'c3', inv: 'i39', pay: 'pa2', exposure: 1000, cur: 'USD', status: 'resolved', inv_id: 'iv5', age: 44 },
    { id: 'dsc8', number: 'DSC-0008', type: 'short_payment', cust: 'c5', inv: 'i35', pay: 'pa12', exposure: 300, cur: 'USD', status: 'resolved', inv_id: 'iv6', age: 50 },
  ],
  disputes: [
    { id: 'd1', number: 'DSP-0001', inv: 'i45', cust: 'c7', cat: 'Quantity / hours', amount: 800, status: 'under_review', assignee: 'u2', due: '2026-11-20', expl: 'We were billed for 40 hours but our records show the vendor logged 32 hours in the LMS customisation. Please correct the invoice.', created: '2026-10-30' },
    { id: 'd2', number: 'DSP-0002', inv: 'i49', cust: 'c4', cat: 'Pricing', amount: 1200, status: 'awaiting_customer', assignee: 'u3', due: '2026-11-25', expl: 'The scheduling API was quoted at a lower day rate in the proposal. Awaiting their copy of the proposal.', created: '2026-11-08' },
    { id: 'd3', number: 'DSP-0003', inv: 'i35', cust: 'c5', cat: 'Quantity / hours', amount: 300, status: 'resolved', assignee: 'u2', due: '2026-10-05', expl: 'Reduced scope on two screens not delivered in August.', created: '2026-09-18', resolution: 'Partially upheld — credit of 300.00 approved (ADJ-0001)' },
  ],
  approvals: [
    { id: 'ap1', number: 'APR-0001', type: 'write_off', subject: 'i37', amount: 340, by: 'u2', status: 'pending', created: '2026-11-12', reason: 'Residual 340.00 on INV-1037 after the customer short-paid by their bank fee. Two reminders sent without reply; cost of further chasing exceeds the amount.', ev: ['Invoice INV-1037', 'Payment PAY-0011 (7,860.00)', 'Collection timeline'] },
    { id: 'ap2', number: 'APR-0002', type: 'refund_record', subject: 'i43', amount: 9600, by: 'u2', status: 'pending', created: '2026-11-12', reason: 'Customer paid INV-1043 twice (PAY-0006 and PAY-0007). Record a refund of 9,600.00 owed to Meridian Retail Group. The refund itself is executed in the bank, not in Venn.', ev: ['Payments PAY-0006, PAY-0007', 'Investigation INVG-0002', 'Meridian remittance PDF'], inv: 'iv2' },
    { id: 'ap3', number: 'APR-0003', type: 'credit', subject: 'i35', amount: 300, by: 'u2', status: 'approved', created: '2026-10-05', reason: 'Agreed credit for scope reduction (DSP-0003).', decided: 'u1', decidedAt: '2026-10-06', comment: 'Agreed with client on call.', ev: ['Dispute DSP-0003'] },
    { id: 'ap4', number: 'APR-0004', type: 'collection_email', subject: 'i44', amount: 22500, by: 'u2', status: 'pending', created: '2026-11-13', reason: 'Final notice to Cobalt Energy Partners for INV-1044 (34 days overdue). Customer email claims a wire was sent but no bank record exists.', ev: ['Email 5 Nov (claim)', 'Investigation INVG-0004', 'Invoice INV-1044'] },
    { id: 'ap5', number: 'APR-0005', type: 'discount', subject: 'i50', amount: 215, by: 'u3', status: 'rejected', created: '2026-10-28', reason: '5% early-payment discount requested by customer after due date.', decided: 'u1', decidedAt: '2026-10-29', comment: 'Terms do not allow discounts after the due date.', ev: ['Contract terms'] },
  ],
  investigations: [],
  cases: [
    { id: 'cc1', inv: 'i40', stage: 'reminder_2', owner: 'u2', next: '2026-11-17', last: '2026-11-05', promise: '2026-11-20', status: 'open' },
    { id: 'cc2', inv: 'i44', stage: 'final_notice', owner: 'u2', next: '2026-11-14', last: '2026-11-05', promise: '', status: 'open', pendingApproval: true },
    { id: 'cc3', inv: 'i48', stage: 'reminder_1', owner: 'u3', next: '2026-11-15', last: '', promise: '', status: 'open' },
    { id: 'cc4', inv: 'i49', stage: 'reminder_1', owner: 'u3', next: '2026-11-16', last: '2026-11-08', promise: '', status: 'paused', note: 'Paused: open dispute DSP-0002' },
    { id: 'cc5', inv: 'i50', stage: 'reminder_1', owner: 'u2', next: '2026-11-14', last: '', promise: '', status: 'open' },
    { id: 'cc6', inv: 'i51', stage: 'reminder_1', owner: 'u2', next: '2026-11-18', last: '', promise: '', status: 'open' },
    { id: 'cc7', inv: 'i42', stage: 'reminder_2', owner: 'u2', next: '2026-11-20', last: '2026-11-04', promise: '', status: 'open' },
    { id: 'cc8', inv: 'i45', stage: 'paused', owner: 'u2', next: '', last: '2026-10-29', promise: '', status: 'paused', note: 'Paused: open dispute DSP-0001' },
  ],
  docs: [
    { id: 'dc1', name: 'Northwind_MSA_2025.pdf', type: 'Contract', cust: 'c1', by: 'u1', at: '2026-09-02', status: 'ready', pages: 14 },
    { id: 'dc2', name: 'Northwind_remittance_Oct09.pdf', type: 'Remittance advice', cust: 'c1', by: 'u2', at: '2026-10-12', status: 'ready', pages: 1 },
    { id: 'dc3', name: 'AlderHealth_SOW_milestones.pdf', type: 'Contract', cust: 'c4', by: 'u1', at: '2026-09-01', status: 'ready', pages: 9 },
    { id: 'dc4', name: 'Meridian_remittance_Oct04_Oct18.pdf', type: 'Remittance advice', cust: 'c5', by: 'u2', at: '2026-11-11', status: 'ready', pages: 2 },
    { id: 'dc5', name: 'Cobalt_PO_CE-2230.pdf', type: 'Purchase order', cust: 'c6', by: 'u3', at: '2026-09-09', status: 'ready', pages: 2 },
    { id: 'dc6', name: 'INV-1059_scan.pdf', type: 'Invoice (scan)', cust: null, by: 'u2', at: '2026-11-13', status: 'extracted — needs review', pages: 1 },
  ],
  emails: [
    { id: 'em1', cust: 'c1', from: 'Hannah Cole <ap@northwind.example>', date: '2026-10-28', subject: 'RE: INV-1042 balance', body: 'Hi Priya — apologies for the delay. We sent the remaining $1,000 on INV-1042 by wire last Friday. Let us know if it has not arrived by Wednesday.' },
    { id: 'em2', cust: 'c6', from: 'Wes Hartley <invoices@cobaltenergy.example>', date: '2026-11-05', subject: 'INV-1044 payment', body: 'The $22,500 wire for INV-1044 was released from our treasury on Monday. Please confirm receipt.' },
    { id: 'em3', cust: 'c7', from: 'Aisha Bello <bursar@lumenedu.example>', date: '2026-10-30', subject: 'INV-1045 — hours', body: 'Our project lead logged 32 hours, not 40. Please issue a corrected invoice before we can pay.' },
    { id: 'em4', cust: 'c4', from: 'Greg Tran <finance@alderhealth.example>', date: '2026-10-20', subject: 'RE: INV-1040', body: 'Per the SOW the second 50% is payable on milestone 2 acceptance. We expect to accept next week.' },
  ],
  notifications: [
    { t: 'Approval requested', b: 'Priya Raman requested a write-off of 340.00 on INV-1037.', at: '12 Nov 16:20', link: '#/approvals/ap1', unread: true, perm: 'owner' },
    { t: 'Approval requested', b: 'Priya Raman requested a refund record of 9,600.00 (Meridian).', at: '12 Nov 15:48', link: '#/approvals/ap2', unread: true, perm: 'owner' },
    { t: 'Import finished', b: 'Payments import: 15 rows, 15 created, 0 errors.', at: '12 Nov 09:03', link: '#/payments', unread: false },
    { t: 'Assigned to you', b: 'INVG-0001 was assigned to you by Dana Whitfield.', at: '09 Oct 11:20', link: '#/investigations/iv1', unread: true, perm: 'ar' },
    { t: 'Integration needs attention', b: 'Stripe: token expired. Reconnect to resume sync.', at: '11 Nov 22:10', link: '#/integrations/stripe', unread: true, perm: 'owner' },
    { t: 'Follow-up due', b: 'Reminder for INV-1050 (Northwind Labs) is due tomorrow.', at: '13 Nov 08:00', link: '#/collections/cc5', unread: false, perm: 'ar' },
  ],
  tasks: [
    { id: 't1', title: 'Review suggested match for PAY-0009', due: '2026-11-13', link: '#/reconciliation', who: 'u2' },
    { id: 't2', title: 'Ask Northwind for wire confirmation (INV-1042)', due: '2026-11-14', link: '#/investigations/iv1', who: 'u2' },
    { id: 't3', title: 'Send reminder: INV-1050', due: '2026-11-14', link: '#/collections/cc5', who: 'u2' },
    { id: 't4', title: 'Chase Alder Health second milestone', due: '2026-11-17', link: '#/collections/cc1', who: 'u2' },
    { id: 't5', title: 'Reply to Lumen about corrected hours', due: '2026-11-18', link: '#/disputes/d1', who: 'u2' },
  ],
  audit: [
    ['2026-11-13 09:40', 'u2', 'collection.submitted_for_approval', 'APR-0004', 'Final notice for INV-1044 submitted'],
    ['2026-11-12 16:20', 'u2', 'approval.requested', 'APR-0001', 'Write-off 340.00 on INV-1037'],
    ['2026-11-12 15:48', 'u2', 'approval.requested', 'APR-0002', 'Refund record 9,600.00 on INV-1043'],
    ['2026-11-12 09:03', 'u2', 'import.completed', 'Batch 9f1c', 'Payments: 15 created, 0 skipped'],
    ['2026-11-12 09:01', 'system', 'reconciliation.run', 'Run #12', '2 auto-applied, 3 suggested, 2 unmatched, 3 discrepancies'],
    ['2026-11-11 22:10', 'system', 'integration.needs_attention', 'Stripe', 'Token expired'],
    ['2026-11-10 14:02', 'u1', 'member.invited', 'tom@brightpath.example', 'Role: AR Specialist'],
    ['2026-11-06 10:31', 'u2', 'investigation.analysis_completed', 'INVG-0001', 'Analysis version 2'],
    ['2026-10-29 10:14', 'u1', 'approval.rejected', 'APR-0005', 'Discount 215.00 on INV-1050'],
    ['2026-10-16 09:11', 'system', 'allocation.created', 'PAY-0008 → INV-1046', 'Auto-applied (R1) 6,750.00'],
    ['2026-10-14 13:22', 'u2', 'allocation.created', 'PAY-0003 → INV-1039', 'Suggestion confirmed 1,000.00'],
    ['2026-10-06 11:00', 'u1', 'approval.approved', 'APR-0003', 'Credit 300.00 on INV-1035'],
    ['2026-09-02 08:55', 'u1', 'settings.updated', 'Organization', 'Auto-apply exact matches: on'],
    ['2026-09-01 08:30', 'u1', 'organization.created', 'Brightpath Digital', 'Owner membership created'],
  ],
  integrations: [
    { id: 'csv', name: 'CSV import', cat: 'Imports', status: 'connected', desc: 'Upload invoice and payment exports. Always available.', note: 'No connection needed' },
    { id: 'pdf', name: 'PDF upload', cat: 'Imports', status: 'connected', desc: 'Upload invoices, contracts and remittance advices for extraction.', note: 'No connection needed' },
    { id: 'gmail', name: 'Gmail', cat: 'Email', status: 'connected', desc: 'Read financial correspondence and send approved messages from your mailbox.', acct: 'priya@brightpath.example', sync: '13 Nov 09:35', scopes: ['Read email matching your financial filter', 'Send email you approve'] },
    { id: 'outlook', name: 'Outlook (Microsoft 365)', cat: 'Email', status: 'soon', desc: 'Planned after the first release.' },
    { id: 'quickbooks', name: 'QuickBooks Online', cat: 'Accounting', status: 'disconnected', desc: 'Sync customers, invoices and payments (read-only).', scopes: ['Read customers, invoices, payments'] },
    { id: 'xero', name: 'Xero', cat: 'Accounting', status: 'soon', desc: 'Planned after the first release.' },
    { id: 'stripe', name: 'Stripe', cat: 'Payments & Banking', status: 'attention', desc: 'Read charges, payouts and refunds (read-only). Venn never creates charges or refunds.', acct: 'acct_demo (Brightpath)', sync: '11 Nov 22:09', err: 'Access token expired. Reconnect to resume sync.', scopes: ['Read charges, payouts, refunds, customers'] },
    { id: 'bank', name: 'Bank feeds', cat: 'Payments & Banking', status: 'soon', desc: 'Planned. Until then, upload bank statement CSV files.' },
  ],
  trend: { labels: ['Sep 18', 'Sep 25', 'Oct 2', 'Oct 9', 'Oct 16', 'Oct 23', 'Oct 30', 'Nov 6', 'Nov 13'], total: [88, 94, 101, 108, 112, 115, 117, 118, 119], overdue: [30, 36, 45, 52, 58, 66, 72, 77, 80] },
};

/* investigations: iv1 is fully detailed; others use the same shape with less content */
D.investigations = [
  { id: 'iv1', number: 'INVG-0001', disc: 'dsc1', title: 'Short payment on INV-1042 — Northwind Labs', cust: 'c1', inv: 'i42', priority: 'high', status: 'ready_for_review', assignee: 'u2', created: '2026-10-09', version: 2, followUp: '',
    narrative: [
      ['Invoice INV-1042 was issued for 5,000.00 USD and fell due on 1 Oct 2026.', ['ev1']],
      ['One bank payment of 4,000.00 USD (PAY-0005) was received on 9 Oct 2026 and is allocated to the invoice, leaving 1,000.00 USD outstanding.', ['ev2']],
      ['The customer\'s remittance advice labels the payment "1 of 2", and an email dated 28 Oct says the remaining 1,000.00 was wired — but no matching bank transaction appears in the imported records.', ['ev5', 'ev3', 'ev8']],
    ],
    evidence: [
      { id: 'ev1', kind: 'Invoice', title: 'INV-1042', tier: 2, link: '#/invoices/i42', facts: 'Total 5,000.00 USD · issued 1 Sep 2026 · due 1 Oct 2026', q: 'Source: CSV import, row 42', used: true },
      { id: 'ev2', kind: 'Payment', title: 'PAY-0005 — 4,000.00 USD', tier: 1, link: '#/payments/pa5', facts: 'Received 9 Oct 2026 · wire · reference "INV-1042" · allocated to INV-1042', q: 'Source: bank statement import (verified)', used: true },
      { id: 'ev3', kind: 'Email', title: 'RE: INV-1042 balance — Hannah Cole', tier: 4, link: '#/customers/c1', facts: '28 Oct 2026 · from ap@northwind.example', q: '"We sent the remaining $1,000 on INV-1042 by wire last Friday."', used: true },
      { id: 'ev4', kind: 'Contract', title: 'Northwind MSA 2025 — p.3', tier: 4, link: '#/documents', facts: 'Payment terms: net 30 from invoice date', q: '"Invoices are payable within thirty (30) days of the invoice date."', used: true },
      { id: 'ev5', kind: 'Remittance advice', title: 'Remittance advice 9 Oct (PDF)', tier: 4, link: '#/documents', facts: 'Page 1 · amount 4,000.00 · "Payment 1 of 2 — INV-1042"', q: '"Payment 1 of 2 against INV-1042; balance to follow."', used: true },
      { id: 'ev6', kind: 'Customer facts', title: 'Northwind Labs payment history', tier: 2, link: '#/customers/c1', facts: 'Open balance 5,300.00 USD across 2 open invoices (INV-1042, INV-1050)', q: 'Computed from stored invoices and payments', used: false },
      { id: 'ev7', kind: 'Note', title: 'Internal note — Priya Raman', tier: 4, link: '', facts: '10 Oct 2026', q: '"Spoke to Hannah; she believes the second wire went out before month-end."', used: false },
      { id: 'ev8', kind: 'Search result', title: 'No further bank payment found', tier: 1, link: '#/payments', facts: 'Searched imported bank payments from Northwind Labs after 9 Oct 2026, last import 12 Nov 2026: none', q: 'Calculated by Venn from stored payments', used: true },
    ],
    facts: [
      ['Invoice INV-1042 was issued 1 Sep 2026 for 5,000.00 USD, due 1 Oct 2026.', ['ev1']],
      ['One verified bank payment of 4,000.00 USD was received on 9 Oct 2026 and allocated to this invoice.', ['ev2']],
      ['No other bank payment from Northwind Labs exists in imported data through 12 Nov 2026.', ['ev8']],
    ],
    calcs: [
      { label: 'Outstanding', expr: '5,000.00 − 4,000.00 = 1,000.00 USD' },
      { label: 'Days overdue', expr: '13 Nov 2026 − 1 Oct 2026 = 43 days' },
    ],
    poss: [
      ['The second wire of 1,000.00 may be in transit or fall in a period not yet imported (last bank import: 12 Nov).', ['ev3', 'ev8'], 'moderate'],
      ['The customer intended to pay in two instalments, as the remittance advice says "1 of 2".', ['ev5'], 'moderate'],
      ['The MSA states net 30, so the full amount was due on 1 Oct; an instalment arrangement is not documented.', ['ev4'], 'weak'],
    ],
    unv: [['Customer email (28 Oct) says the remaining 1,000.00 was wired "last Friday".', ['ev3'], 'Not confirmed by any payment record']],
    miss: ['Wire confirmation or proof of payment for the second transfer', 'Bank statement coverage after 12 Nov 2026'],
    recs: [
      { key: 'request_proof_of_payment', title: 'Request proof of payment', why: 'The customer claims a transfer that does not appear in bank records. A wire confirmation would resolve whether it exists and where it went.', primary: true, approval: false },
      { key: 'contact_customer_balance_due', title: 'Contact customer about the balance due', why: 'If no confirmation arrives, remind the customer that 1,000.00 remains due under net-30 terms.', approval: false },
      { key: 'escalate_to_owner', title: 'Escalate to owner', why: 'Escalate if the customer does not respond within the follow-up window.', approval: true },
    ],
    timeline: [
      ['2026-11-06 10:31', 'Analysis version 2 generated (added remittance advice)', 'g'], ['2026-10-12', 'Priya uploaded remittance advice 9 Oct', 'n'], ['2026-10-10', 'Note added by Priya Raman', 'n'],
      ['2026-10-09', 'Investigation opened from DSC-0001 (short payment)', 'b'],
    ] },
  { id: 'iv2', number: 'INVG-0002', disc: 'dsc2', title: 'Possible duplicate payment — Meridian Retail Group', cust: 'c5', inv: 'i43', priority: 'high', status: 'awaiting_approval', assignee: 'u2', created: '2026-10-19', version: 1, followUp: '', approvalId: 'ap2',
    narrative: [['Meridian paid INV-1043 (9,600.00) on 4 Oct (PAY-0006). A second payment of 9,600.00 with the same reference arrived on 18 Oct (PAY-0007) and could not be allocated because the invoice was already fully paid.', ['ev1', 'ev2']], ['The customer\'s remittance document lists both transfers.', ['ev3']]],
    evidence: [
      { id: 'ev1', kind: 'Payment', title: 'PAY-0006 — 9,600.00 USD', tier: 1, link: '#/payments/pa6', facts: '4 Oct 2026 · ACH · "INV-1043" · allocated', q: 'Bank statement import (verified)', used: true },
      { id: 'ev2', kind: 'Payment', title: 'PAY-0007 — 9,600.00 USD', tier: 1, link: '#/payments/pa7', facts: '18 Oct 2026 · ACH · "INV-1043" · unallocated', q: 'Bank statement import (verified)', used: true },
      { id: 'ev3', kind: 'Remittance advice', title: 'Meridian remittance 4 & 18 Oct', tier: 4, link: '#/documents', facts: 'Two lines of 9,600.00 against INV-1043', q: '"Second line: re-sent due to bank error."', used: true },
    ],
    facts: [['Two verified payments of 9,600.00 USD reference INV-1043.', ['ev1', 'ev2']], ['INV-1043 total is 9,600.00 USD and is fully paid by PAY-0006.', ['ev1']]],
    calcs: [{ label: 'Overpaid', expr: '9,600.00 + 9,600.00 − 9,600.00 = 9,600.00 USD' }],
    poss: [['The second transfer was a bank re-send and the customer expects a refund.', ['ev3'], 'strong']], unv: [], miss: ['Written refund request from the customer'],
    recs: [{ key: 'record_refund_due', title: 'Record a refund due (9,600.00 USD)', why: 'The overpayment is confirmed by bank records. Venn records the decision; the refund itself is made from your bank.', primary: true, approval: true }],
    timeline: [['2026-11-12 15:48', 'Refund record submitted for approval (APR-0002)', 'b'], ['2026-10-19', 'Investigation opened from DSC-0002', 'b']] },
  { id: 'iv3', number: 'INVG-0003', disc: 'dsc3', title: 'Half payment on INV-1040 — Alder Health Systems', cust: 'c4', inv: 'i40', priority: 'medium', status: 'monitoring', assignee: 'u3', created: '2026-10-09', version: 1, followUp: '2026-11-20', actionDate: '2026-11-05', action: 'Reminder sent referencing SOW milestone 2',
    narrative: [['Alder paid 9,000.00 of 18,000.00 on 8 Oct. The SOW makes the second 50% payable on milestone 2 acceptance, and the customer\'s email expects to accept "next week".', ['ev1', 'ev2', 'ev3']]],
    evidence: [
      { id: 'ev1', kind: 'Payment', title: 'PAY-0004 — 9,000.00 USD', tier: 1, link: '#/payments/pa4', facts: '8 Oct 2026 · ACH · "INV-1040 milestone 1"', q: 'Bank statement import (verified)', used: true },
      { id: 'ev2', kind: 'Contract', title: 'Alder SOW — p.4', tier: 4, link: '#/documents', facts: 'Milestone 2: 50% on acceptance', q: '"The remaining fifty percent is invoiced upon Milestone 2 acceptance."', used: true },
      { id: 'ev3', kind: 'Email', title: 'RE: INV-1040 — Greg Tran', tier: 4, link: '#/customers/c4', facts: '20 Oct 2026', q: '"The second 50% is payable on milestone 2 acceptance."', used: true },
    ],
    facts: [['PAY-0004 of 9,000.00 USD is allocated to INV-1040 (18,000.00 USD).', ['ev1']]],
    calcs: [{ label: 'Outstanding', expr: '18,000.00 − 9,000.00 = 9,000.00 USD' }],
    poss: [['The invoice was issued for both milestones, but the SOW only makes the second half payable on acceptance.', ['ev2', 'ev3'], 'strong']], unv: [], miss: ['Milestone 2 acceptance record'],
    recs: [{ key: 'review_contract_terms', title: 'Review contract terms and re-issue per milestone', why: 'Terms support the customer\'s timing.', primary: true, approval: false }],
    timeline: [['2026-11-05', 'Action recorded: reminder referencing SOW milestone 2', 'g'], ['2026-10-09', 'Investigation opened from DSC-0003', 'b']] },
  { id: 'iv4', number: 'INVG-0004', disc: 'dsc5', title: 'Claimed wire not received — Cobalt Energy Partners', cust: 'c6', inv: 'i44', priority: 'critical', status: 'new', assignee: 'u2', created: '2026-11-05', version: 0, followUp: '',
    narrative: [], evidence: [{ id: 'ev1', kind: 'Email', title: 'INV-1044 payment — Wes Hartley', tier: 4, link: '#/customers/c6', facts: '5 Nov 2026', q: '"The $22,500 wire for INV-1044 was released from our treasury on Monday."', used: false }],
    facts: [['INV-1044 for 22,500.00 USD is unpaid and 19 days past due (due 25 Oct).', []]], calcs: [{ label: 'Outstanding', expr: '22,500.00 − 0.00 = 22,500.00 USD' }], poss: [], unv: [], miss: [], recs: [],
    timeline: [['2026-11-05', 'Investigation opened from DSC-0005 (claimed payment, none found)', 'b']] },
  { id: 'iv5', number: 'INVG-0005', disc: 'dsc7', title: 'Short payment on INV-1039 — Quantum Freight', cust: 'c3', inv: 'i39', priority: 'medium', status: 'resolved', assignee: 'u2', created: '2026-09-30', version: 1, followUp: '', actionDate: '2026-10-02', action: 'Contacted customer about 1,000.00 balance', outcome: 'recovered_verified', resolved: '2026-10-14',
    narrative: [['Quantum paid 6,850.00 of 7,850.00. After a reminder they paid the remaining 1,000.00 on 14 Oct.', ['ev1']]],
    evidence: [{ id: 'ev1', kind: 'Payment', title: 'PAY-0003 — 1,000.00 USD', tier: 1, link: '#/payments/pa3', facts: '14 Oct 2026 · ACH', q: 'Bank statement import (verified)', used: true }],
    facts: [], calcs: [], poss: [], unv: [], miss: [], recs: [], timeline: [['2026-10-14', 'Resolved: verified payment PAY-0003 of 1,000.00 USD', 'g'], ['2026-10-02', 'Action recorded', 'n'], ['2026-09-30', 'Investigation opened', 'b']] },
  { id: 'iv6', number: 'INVG-0006', disc: 'dsc8', title: 'Short payment on INV-1035 — Meridian Retail Group', cust: 'c5', inv: 'i35', priority: 'low', status: 'resolved', assignee: 'u2', created: '2026-09-16', version: 1, followUp: '', actionDate: '2026-10-05', action: 'Credit of 300.00 approved (APR-0003)', outcome: 'adjusted', resolved: '2026-10-06',
    narrative: [['The 300.00 shortfall was a disputed scope reduction; an approved credit closed the balance.', []]], evidence: [], facts: [], calcs: [], poss: [], unv: [], miss: [], recs: [], timeline: [['2026-10-06', 'Resolved: credit 300.00 applied', 'g'], ['2026-09-16', 'Investigation opened', 'b']] },
];

/* ---------- derived values (single source of truth for every page) ---------- */
const byId = (arr, id) => arr.find(x => x.id === id);
const cust = id => byId(D.customers, id), inv = id => byId(D.invoices, id), pay = id => byId(D.payments, id), user = id => byId(D.users, id);
const invPaid = i => D.allocations.filter(a => a.inv === i.id && !a.voided).reduce((s, a) => s + a.amount, 0);
const invAdj = i => D.adjustments.filter(a => a.inv === i.id && a.status === 'applied' && a.type !== 'refund_record').reduce((s, a) => s + a.amount, 0);
const invBal = i => (i.life === 'issued' ? i.total - invPaid(i) - invAdj(i) : (i.life === 'draft' ? i.total : 0));
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const invOverdue = i => i.life === 'issued' && invBal(i) > 0 && i.due < TODAY;
const invDaysOver = i => invOverdue(i) ? days(i.due, TODAY) : 0;
const invDisputed = i => D.disputes.some(d => d.inv === i.id && !['resolved', 'rejected'].includes(d.status));
const invState = i => invPaid(i) + invAdj(i) === 0 ? 'unpaid' : invBal(i) === 0 ? 'paid' : 'partial';
function invStatus(i) {
  if (i.life === 'cancelled') return 'cancelled'; if (i.life === 'draft') return 'draft';
  if (invBal(i) === 0) return 'paid'; if (invDisputed(i)) return 'disputed'; if (invOverdue(i)) return 'overdue';
  if (invState(i) === 'partial') return 'partial'; return 'issued';
}
const payAlloc = p => D.allocations.filter(a => a.pay === p.id && !a.voided).reduce((s, a) => s + a.amount, 0);
const payUnalloc = p => p.reversed ? 0 : p.amount - payAlloc(p);
const payStatus = p => p.reversed ? 'reversed' : p.review ? 'review' : payAlloc(p) === 0 ? 'unmatched' : payUnalloc(p) > 0 ? 'partial' : 'full';
const openInvoices = () => D.invoices.filter(i => i.life === 'issued' && invBal(i) > 0);
function verifiedRecovered(ivx) {
  if (!ivx.actionDate) return 0;
  return D.allocations.filter(a => a.inv === ivx.inv && !a.voided && pay(a.pay).ver === 'source_verified' && pay(a.pay).date >= ivx.actionDate).reduce((s, a) => s + a.amount, 0);
}

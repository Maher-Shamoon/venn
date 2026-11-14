/* Venn prototype — shared UI helpers, shell, router. Demo only: no network, no auth. */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n);
const mshort = n => n >= 1000 ? '$' + (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'k' : '$' + n;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dt = s => { if (!s) return '—'; const [y, m, d] = s.slice(0, 10).split('-'); return `${+d} ${MON[+m - 1]} ${y}`; };
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };

const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10', users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5', card: 'M2 5h20v14H2zM2 10h20',
  git: 'M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 9a9 9 0 0 1-9 9', search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.3-4.3',
  mail: 'M3 5h18v14H3zM3 7l9 6 9-6', flag: 'M4 22V4M4 4h13l-2 4 2 4H4', check: 'M20 6L9 17l-5-5', chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  folder: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', plug: 'M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', gear: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0', lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4', menu: 'M3 6h18M3 12h18M3 18h18',
  x: 'M18 6L6 18M6 6l12 12', plus: 'M12 5v14M5 12h14', dl: 'M12 3v12M7 10l5 5 5-5M5 21h14', info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 16v-4M12 8h.01',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 6v6l4 2', tasks: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9', up: 'M12 19V5M5 12l7-7 7 7',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6', link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1', undo: 'M3 7v6h6M3 13a9 9 0 1 0 3-7',
};
const ic = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n] || ICONS.info}"/></svg>`;
const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="12" cy="16" r="9" fill="none" stroke="#9fb4ff" stroke-width="2.2"/><circle cx="20" cy="16" r="9" fill="none" stroke="#fff" stroke-width="2.2"/><path d="M16 8.6a9 9 0 0 1 0 14.8 9 9 0 0 1 0-14.8z" fill="#4169E1"/></svg>`;
const LOGO_D = LOGO.replace('#9fb4ff', '#14213D').replace('stroke="#fff"', 'stroke="#3157D5"');

/* status vocabulary (DESIGN_SYSTEM §7) */
const ST = {
  draft: ['Draft', 'neutral'], issued: ['Issued', 'blue'], partial: ['Partially paid', 'amber'], paid: ['Paid', 'green'], overdue: ['Overdue', 'red'], disputed: ['Disputed', 'amber'], cancelled: ['Cancelled', 'neutral'],
  unmatched: ['Unmatched', 'amber'], full: ['Fully allocated', 'green'], review: ['Under review', 'blue'], reversed: ['Reversed', 'red'], unpaid: ['Unpaid', 'neutral'],
  exact: ['Exact', 'teal'], high: ['High', 'green'], medium: ['Medium', 'amber'], low: ['Low', 'neutral'],
  new: ['New', 'neutral'], investigating: ['Investigating', 'blue'], ready_for_review: ['Ready for review', 'amber'], awaiting_approval: ['Awaiting approval', 'amber'], action_taken: ['Action taken', 'blue'], monitoring: ['Monitoring', 'blue'], resolved: ['Resolved', 'green'], dismissed: ['Dismissed', 'neutral'], open: ['Open', 'amber'],
  under_review: ['Under review', 'blue'], awaiting_customer: ['Awaiting customer', 'neutral'], awaiting_internal: ['Awaiting internal approval', 'amber'], rejected: ['Rejected', 'neutral'],
  pending: ['Pending', 'amber'], info_requested: ['Info requested', 'blue'], approved: ['Approved', 'green'], stale: ['Stale', 'neutral'], withdrawn: ['Withdrawn', 'neutral'],
  connected: ['Connected', 'green'], connecting: ['Connecting', 'blue'], attention: ['Needs attention', 'amber'], error: ['Error', 'red'], disconnected: ['Not connected', 'neutral'], soon: ['Coming soon', 'neutral'],
  critical: ['Critical', 'red'], active: ['Active', 'green'], suspended: ['Suspended', 'red'], invited: ['Invited', 'blue'], applied: ['Applied', 'green'], pending_approval: ['Awaiting approval', 'amber'],
  reminder_1: ['Reminder 1', 'blue'], reminder_2: ['Reminder 2', 'amber'], final_notice: ['Final notice', 'red'], paused: ['Paused', 'neutral'], closed: ['Closed', 'neutral'],
};
const badge = (k, extra = '') => { const [l, c] = ST[k] || [k, 'neutral']; return `<span class="badge b-${c} ${extra}">${esc(l)}</span>`; };
const DTYPE = { short_payment: 'Short payment', overpayment: 'Overpayment', duplicate_payment: 'Duplicate payment', unmatched_payment: 'Unmatched payment', missing_payment_claimed: 'Claimed payment not found', misallocation: 'Misallocation', currency_mismatch: 'Currency mismatch', duplicate_invoice: 'Duplicate invoice' };
const ATYPE = { write_off: 'Write-off', credit: 'Credit', discount: 'Discount', refund_record: 'Refund record', collection_email: 'Collection email', allocation_reversal: 'Allocation reversal' };
const TIER = { 1: ['Verified source', 'teal'], 2: ['Accounting record', 'green'], 3: ['Manual entry', 'neutral'], 4: ['Supporting only', 'amber'] };
const tierBadge = t => `<span class="badge b-${TIER[t][1]}">${TIER[t][0]}</span>`;
const invBadges = i => { const s = invStatus(i); let h = badge(s); if (s === 'overdue' && invState(i) === 'partial') h += ' ' + badge('partial'); if (s === 'overdue' && invDisputed(i)) h += ' ' + badge('disputed'); return h; };

/* ---------- role, permissions ---------- */
const S = { role: store.get('venn_role') === 'ar' ? 'ar' : 'owner' };
const me = () => user(S.role === 'owner' ? 'u1' : 'u2');
const AR_OFF = ['approvals.decide', 'integrations.manage', 'team.manage', 'settings.manage', 'audit.view', 'dashboard.executive', 'reports.financial', 'collections.send'];
const can = k => S.role === 'owner' || !AR_OFF.includes(k);
const OWNER_ONLY_ROUTES = ['analytics', 'integrations', 'team', 'audit-log', 'settings'];

/* ---------- view state, routing ---------- */
const V = {}; let NAVID = 0, Q = {};
const vs = (name, def) => { V.__n = V.__n || {}; V.__def = V.__def || {}; V.__def[name] = def; if (V.__n[name] !== NAVID) { V[name] = { ...def, ...Q }; V.__n[name] = NAVID; } return V[name]; };
const ROUTES = [];
const R = (re, fn, o = {}) => ROUTES.push({ re, fn, o });
const go = h => { location.hash = h; };
const pageH = (title, sub = '', actions = '', crumbs = '') => `${crumbs ? `<div class="crumbs">${crumbs}</div>` : ''}<div class="page-h"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="sp"></div><div class="row wrap">${actions}</div></div>`;
const card = (title, body, actions = '', flush = false) => `<section class="card">${title ? `<div class="card-h"><h3>${title}</h3>${actions}</div>` : ''}<div class="card-b ${flush ? 'flush' : ''}">${body}</div></section>`;
const empty = (msg, btn = '') => `<div class="empty">${ic('folder')}<p>${msg}</p>${btn}</div>`;
const denied = (m = 'You don\'t have access to this page. Ask an owner if you need it.') => `${pageH('No access')}<div class="card"><div class="empty">${ic('lock')}<p>${m}</p><a class="btn" href="#/dashboard">Back to dashboard</a></div></div>`;

function table(cols, rows, o = {}) {
  if (!rows.length) return o.empty || empty('No results for these filters.', '<button class="btn btn-sm" data-act="clearFilters">Clear filters</button>');
  const head = cols.map(c => `<th class="${c.cls || ''}">${c.h}</th>`).join('');
  const body = rows.map(r => `<tr class="${o.href || o.attr ? 'click' : ''}" ${o.href ? `data-href="${esc(o.href(r))}"` : ''} ${o.attr ? o.attr(r) : ''}>${cols.map(c => `<td class="${c.cls || ''}">${c.f(r)}</td>`).join('')}</tr>`).join('');
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${o.foot ? `<tfoot><tr>${o.foot}</tr></tfoot>` : ''}</table></div>`;
}
const chipset = (key, opts, cur) => opts.map(([v, l]) => `<button class="chip ${cur === v ? 'on' : ''}" data-act="setV" data-k="${key}" data-v="${v}">${l}</button>`).join('');
const searchIn = (key, ph) => `<input class="in" style="min-width:220px" placeholder="${ph}" value="${esc(V[key.split('.')[0]][key.split('.')[1]] || '')}" data-vin="${key}" aria-label="${ph}">`;
const tabs = (key, list, cur) => `<div class="tabs" role="tablist">${list.map(([v, l, c]) => `<button class="tab ${cur === v ? 'on' : ''}" role="tab" data-act="setV" data-k="${key}" data-v="${v}">${l}${c != null ? `<span class="c">${c}</span>` : ''}</button>`).join('')}</div>`;
const person = id => { const u = user(id); return u ? esc(u.name) : '—'; };
const custLink = id => id ? `<a href="#/customers/${id}">${esc(cust(id).name)}</a>` : '<span class="muted">Unknown payer</span>';
const evChip = (ids = []) => ids.map(i => `<button class="cite" data-act="cite" data-id="${i}" title="Go to evidence ${i}">${i.replace('ev', 'E')}</button>`).join('');

/* ---------- charts ---------- */
const AGE = [['Current', i => !invOverdue(i)], ['1–30', i => invDaysOver(i) >= 1 && invDaysOver(i) <= 30], ['31–60', i => invDaysOver(i) >= 31 && invDaysOver(i) <= 60], ['61–90', i => invDaysOver(i) >= 61 && invDaysOver(i) <= 90], ['90+', i => invDaysOver(i) > 90]];
const AGE_COL = ['#3157D5', '#7C98EC', '#D97706', '#DC2626', '#7F1D1D'];
const aging = () => { const inv = openInvoices().filter(i => i.cur === 'USD'); return AGE.map(([l, f], k) => ({ l, v: sum(inv.filter(f), invBal), n: inv.filter(f).length, c: AGE_COL[k] })); };
function agingChart(a) {
  const tot = sum(a, x => x.v) || 1;
  return `<div style="display:flex;height:22px;border-radius:6px;overflow:hidden;background:var(--neutral-100)" role="img" aria-label="Receivables aging">${a.map(x => `<div title="${x.l}: ${money(x.v)}" style="width:${x.v / tot * 100}%;background:${x.c}"></div>`).join('')}</div>
  <div class="row wrap mt8 small">${a.map(x => `<span><i class="sw" style="background:${x.c}"></i>${x.l}</span>`).join('')}</div>
  <div class="tbl-wrap mt8"><table class="tbl"><thead><tr><th>Bucket (days overdue)</th><th class="num">Invoices</th><th class="num">Balance (USD)</th><th class="num">Share</th></tr></thead><tbody>${a.map(x => `<tr><td><i class="sw" style="background:${x.c}"></i>${x.l}</td><td class="num">${x.n}</td><td class="num">${money(x.v)}</td><td class="num">${(x.v / tot * 100).toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>`;
}
function lineChart(labels, series, colors) {
  const W = 560, H = 190, p = { l: 36, r: 10, t: 10, b: 24 }, mx = Math.max(...series.flat()) * 1.1, x = i => p.l + i * (W - p.l - p.r) / (labels.length - 1), y = v => p.t + (1 - v / mx) * (H - p.t - p.b);
  const grid = [0, .5, 1].map(f => { const v = mx * f; return `<line x1="${p.l}" x2="${W - p.r}" y1="${y(v)}" y2="${y(v)}" stroke="#E2E8F0"/><text x="${p.l - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#64748B">$${Math.round(v)}k</text>`; }).join('');
  const xl = labels.map((l, i) => i % 2 === 0 ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" font-size="11" fill="#64748B">${l}</text>` : '').join('');
  const lines = series.map((s, k) => `<polyline fill="none" stroke="${colors[k]}" stroke-width="2" points="${s.map((v, i) => `${x(i)},${y(v)}`).join(' ')}"/>${s.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="2.5" fill="${colors[k]}"><title>${labels[i]}: $${v}k</title></circle>`).join('')}`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Trend chart">${grid}${xl}${lines}</svg>`;
}
const hbars = rows => { const m = Math.max(...rows.map(r => r.v), 1); return `<div class="bars">${rows.map(r => `<div class="bar"><a href="${r.href || '#'}">${esc(r.l)}</a><div class="trk"><i style="width:${r.v / m * 100}%"></i></div><span class="num right">${money(r.v)}</span></div>`).join('')}</div>`; };
const chartCard = (title, chart, tbl = '') => { const id = 'ch' + Math.random().toString(36).slice(2, 7); return card(title, `<div id="${id}">${chart}</div>${tbl ? `<div id="${id}t" hidden>${tbl}</div>` : ''}`, tbl ? `<button class="btn btn-sm btn-ghost" data-act="toggleTbl" data-id="${id}">Show table</button>` : ''); };

/* ---------- overlays ---------- */
function closeOv() { $$('.ov').forEach(o => o.remove()); document.body.style.overflow = ''; }
function overlay(kind, title, body, foot = '', wide = false) {
  closeOv();
  const el = document.createElement('div');
  el.className = 'ov' + (kind === 'modal' ? ' center' : '');
  el.innerHTML = kind === 'modal'
    ? `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="ov-h"><h2>${title}</h2><button class="btn btn-ghost btn-sm" data-act="closeOv" aria-label="Close">${ic('x')}</button></div><div class="ov-b">${body}</div>${foot ? `<div class="ov-f">${foot}</div>` : ''}</div>`
    : `<aside class="drawer ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="ov-h"><h2>${title}</h2><button class="btn btn-ghost btn-sm" data-act="closeOv" aria-label="Close">${ic('x')}</button></div><div class="ov-b">${body}</div>${foot ? `<div class="ov-f">${foot}</div>` : ''}</aside>`;
  el.addEventListener('mousedown', e => { if (e.target === el) closeOv(); });
  document.body.appendChild(el); document.body.style.overflow = 'hidden';
  const f = $('input,select,textarea,button.btn-primary', el); if (f) f.focus();
}
const drawer = (t, b, f, w) => overlay('drawer', t, b, f, w), modal = (t, b, f) => overlay('modal', t, b, f);
function toast(msg) { let w = $('.toasts'); if (!w) { w = document.createElement('div'); w.className = 'toasts'; w.setAttribute('aria-live', 'polite'); document.body.appendChild(w); } const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; w.appendChild(t); setTimeout(() => t.remove(), 4200); }
function fld(label, input, hint = '', err = 'This field is required') { return `<div class="field"><label>${label}</label>${input}${hint ? `<div class="hint">${hint}</div>` : ''}<div class="err">${err}</div></div>`; }
function validate(root) {
  let ok = true;
  $$('.field', root).forEach(f => {
    const i = $('.in', f); if (!i) return; let bad = false;
    if (i.dataset.req !== undefined && !i.value.trim()) bad = true;
    if (i.dataset.money !== undefined && !(parseFloat(i.value) > 0)) bad = true;
    if (i.dataset.email !== undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(i.value)) bad = true;
    if (i.dataset.min && i.value.length < +i.dataset.min) bad = true;
    f.classList.toggle('bad', bad); if (bad) ok = false;
  });
  return ok;
}
const form = (id, inner) => `<form id="${id}" novalidate onsubmit="return false">${inner}</form>`;

/* ---------- actions (event delegation) ---------- */
const ACT = {
  closeOv, setV(el) { const [n, k] = el.dataset.k.split('.'); V[n][k] = el.dataset.v; render(); },
  clearFilters() { const n = Object.keys(V).find(k => k === currentView); if (n) { V[n] = { ...(V.__def?.[n] || {}) }; render(); } },
  toggleTbl(el) { const id = el.dataset.id, a = $('#' + id), b = $('#' + id + 't'), s = !b.hidden; b.hidden = s; a.hidden = !s; el.textContent = s ? 'Show table' : 'Show chart'; },
  cite(el) { const t = $('#ev-' + el.dataset.id); if (!t) return; t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash'); },
  menu(el) { const m = $('#' + el.dataset.id); const o = m.classList.contains('open'); $$('.menu').forEach(x => x.classList.remove('open')); if (!o) m.classList.add('open'); },
  nav() { $('.app').classList.toggle('nav-open'); },
  setRole(el) { S.role = el.dataset.role; store.set('venn_role', S.role); const h = location.hash.slice(2).split(/[/?]/)[0]; if (S.role === 'ar' && OWNER_ONLY_ROUTES.includes(h)) go('#/dashboard'); render(); toast('Now viewing as ' + (S.role === 'owner' ? 'Owner (Dana Whitfield)' : 'AR Specialist (Priya Raman)')); },
  sw(el) { el.classList.toggle('on'); },
  toast(el) { toast(el.dataset.msg); },
};
let currentView = '';
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (a && ACT[a.dataset.act]) { e.preventDefault(); ACT[a.dataset.act](a, e); return; }
  const r = e.target.closest('tr[data-href]'); if (r && !e.target.closest('a,button,input,select')) { go(r.dataset.href); return; }
  if (!e.target.closest('.menu-wrap')) $$('.menu.open').forEach(m => m.classList.remove('open'));
  if (e.target.closest('.nav a') && window.innerWidth < 1024) $('.app')?.classList.remove('nav-open');
});
document.addEventListener('input', e => {
  const i = e.target.closest('[data-vin]'); if (!i) return;
  const [n, k] = i.dataset.vin.split('.'); V[n][k] = i.value; const pos = i.selectionStart; render(); const j = $(`[data-vin="${i.dataset.vin}"]`); if (j) { j.focus(); try { j.setSelectionRange(pos, pos); } catch (x) { } }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeOv(); $$('.menu.open').forEach(m => m.classList.remove('open')); } });

/* ---------- shell ---------- */
const navFor = () => {
  const o = S.role === 'owner', pendAp = D.approvals.filter(a => a.status === 'pending').length, mine = D.approvals.filter(a => a.by === 'u2' && a.status === 'pending').length;
  const rev = D.matches.filter(m => m.status === 'suggested').length, inv = D.investigations.filter(x => x.status === 'ready_for_review').length;
  const g = [['', [['dashboard', 'Dashboard', 'home']]], ['Receivables', [['customers', 'Customers', 'users'], ['invoices', 'Invoices', 'file'], ['payments', 'Payments', 'card']]],
  ['Work', [['reconciliation', 'Reconciliation', 'git', rev], ['investigations', 'Investigations', 'search', inv], ['collections', 'Collections', 'mail'], ['disputes', 'Disputes', 'flag']]],
  ['Control', o ? [['approvals', 'Approvals', 'check', pendAp], ['analytics', 'Analytics', 'chart'], ['reports', 'Reports', 'file'], ['documents', 'Documents', 'folder']] : [['approvals', 'My requests', 'check', mine], ['reports', 'Reports', 'file'], ['documents', 'Documents', 'folder']]]];
  if (o) g.push(['Admin', [['integrations', 'Integrations', 'plug'], ['team', 'Team', 'users'], ['audit-log', 'Audit log', 'shield'], ['settings/company', 'Settings', 'gear']]]);
  return g;
};
function shell(content) {
  const path = location.hash.slice(2).split('?')[0], seg = path.split('/')[0], o = S.role === 'owner';
  const unread = D.notifications.filter(n => n.unread && (!n.perm || n.perm === S.role)).length;
  const nav = navFor().map(([s, items]) => `${s ? `<div class="nav-sec">${s}</div>` : ''}${items.map(([h, l, i, c]) => `<a href="#/${h}" class="${seg === h.split('/')[0] ? 'on' : ''}" ${seg === h.split('/')[0] ? 'aria-current="page"' : ''}>${ic(i)}${l}${c ? `<span class="ct">${c}</span>` : ''}</a>`).join('')}`).join('');
  const bell = D.notifications.filter(n => !n.perm || n.perm === S.role).map(n => `<a class="mi" href="${n.link}"><b>${esc(n.t)}</b>${n.unread ? ' <span class="badge b-blue nodot">new</span>' : ''}<div class="small muted">${esc(n.b)}</div><div class="cap">${n.at}</div></a>`).join('');
  return `<div class="proto"><b>PROTOTYPE</b><span class="hide-s">Demo data · simulated actions · no real operations</span><span class="sp"></span><span class="hide-s">View as</span><span class="seg" role="group" aria-label="Prototype role switcher"><button class="${o ? 'on' : ''}" data-act="setRole" data-role="owner">Owner</button><button class="${o ? '' : 'on'}" data-act="setRole" data-role="ar">AR Specialist</button></span><a class="hide-s" href="index.html">Website</a></div>
  <div class="app"><aside class="sidebar" aria-label="Main navigation"><div class="logo">${LOGO}Venn</div><nav class="nav">${nav}</nav><div class="side-foot">${esc(D.org.name)}<br>${o ? 'Owner' : 'AR Specialist'} · ${esc(me().name)}</div></aside>
  <div class="main" id="main"><header class="topbar"><button class="btn btn-ghost burger" data-act="nav" aria-label="Open navigation">${ic('menu')}</button>
  <div class="search">${ic('search')}<input class="in" id="gsearch" placeholder="Search invoices, customers, payments…  ( / )" aria-label="Global search"></div><div class="sp"></div>
  <div class="menu-wrap"><button class="btn btn-ghost bell" data-act="menu" data-id="mb" aria-label="Notifications">${ic('bell')}${unread ? `<span class="dot">${unread}</span>` : ''}</button><div class="menu" id="mb" style="width:340px">${bell}<a class="mi" href="#/notifications" style="text-align:center">View all notifications</a></div></div>
  <div class="menu-wrap"><button class="btn btn-ghost" data-act="menu" data-id="mp"><span class="avatar">${me().name.split(' ').map(x => x[0]).join('')}</span><span class="hide-s small">${esc(me().name)}</span></button><div class="menu" id="mp"><div class="mi" style="cursor:default"><b>${esc(me().name)}</b><div class="small muted">${esc(me().email)}</div><div class="small muted">${o ? 'Owner' : 'AR Specialist'} · ${esc(D.org.name)}</div></div><a href="#/profile">Profile &amp; security</a><a href="#/tasks">My tasks</a><a href="auth.html#/login">Sign out</a></div></div></header>
  <div class="page">${content}</div></div></div>`;
}

/* ---------- router ---------- */
function render() {
  const raw = location.hash.slice(1) || '/dashboard', [path, qs] = raw.split('?'), seg = path.split('/').filter(Boolean);
  Q = Object.fromEntries(new URLSearchParams(qs || ''));
  let out = null;
  if (S.role === 'ar' && OWNER_ONLY_ROUTES.includes(seg[0])) out = denied();
  else for (const r of ROUTES) { const m = path.match(r.re); if (m) { const o = r.fn(m); if (o !== null) { currentView = r.o.name || ''; out = o; break; } } }
  if (out === null) out = `${pageH('Page not found')}<div class="card"><div class="empty">${ic('search')}<p>We couldn't find that page.</p><a class="btn" href="#/dashboard">Back to dashboard</a></div></div>`;
  const keep = $('#main')?.scrollTop || 0;
  const scroller = $('#main'); const wasSame = scroller && scroller.dataset.p === path;
  document.getElementById('root').innerHTML = shell(out);
  const m = $('#main'); m.dataset.p = path; m.scrollTop = wasSame ? keep : 0;
  document.title = 'Venn prototype — ' + (seg[0] || 'dashboard');
  const gs = $('#gsearch'); if (gs) gs.addEventListener('keydown', e => { if (e.key === 'Enter' && gs.value.trim()) go('#/invoices?q=' + encodeURIComponent(gs.value.trim())); });
  if (window.afterRender) { const f = window.afterRender; window.afterRender = null; f(); }
}
window.addEventListener('hashchange', () => { NAVID++; closeOv(); render(); });
document.addEventListener('keydown', e => { if (e.key === '/' && !/input|textarea|select/i.test(e.target.tagName)) { const g = $('#gsearch'); if (g) { e.preventDefault(); g.focus(); } } });

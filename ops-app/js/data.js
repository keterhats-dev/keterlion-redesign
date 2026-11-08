// Data layer. Two stores with the same functions: a demo store in this browser
// (localStorage) and the real one in Supabase. config.js decides which one runs.
import { DEMO, SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { todayISO, addDays, STATUS, iso } from './util.js';

const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn());

// The last screen data, kept on this device so the app opens at once and refreshes in the background
const SNAP = 'kl-ops-snapshot-v1';
export const readSnapshot = () => { if (DEMO) return null; try { return JSON.parse(localStorage.getItem(SNAP)); } catch { return null; } };
export const saveSnapshot = (s) => { if (DEMO) return; try { localStorage.setItem(SNAP, JSON.stringify(s)); } catch {} };
export const clearSnapshot = () => { try { localStorage.removeItem(SNAP); } catch {} };

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

/* ---------- demo store ---------- */

const KEY = 'kl-ops-demo-v1';
const AREAS = [
  ['accounting', 'הנהלת חשבונות'], ['tech', 'טכני ומערכת'], ['stock', 'מלאי בחנות'], ['wholesale', 'סיטונאות'],
  ['web-orders', 'הזמנות באתר'], ['wolt', 'Wolt'], ['leads', 'לידים והצעות מחיר'], ['general', 'כללי'],
].map(([id, name], i) => ({ id, name, sort: i + 1 }));

function seed() {
  const t = todayISO();
  const at = (days, hh = 10) => { const d = new Date(addDays(t, days) + 'T12:00'); d.setHours(hh, 0); return d.toISOString(); };
  const owner = 'u-owner', ari = 'u-ari';
  const task = (o) => {
    const t = { id: uid(), notes: '', area_id: 'general', assignee_id: ari, created_by: owner, priority: 3, status: 'open',
      due_date: null, due_time: null, done_at: null, created_at: at(-1, 9), updated_at: at(-1, 9), acknowledged_at: null, ...o };
    if (t.created_by === t.assignee_id || t.status === 'done') t.acknowledged_at ||= t.created_at;
    return t;
  };
  const wholesale = task({ title: 'הזמנה סיטונאית ל[שם הלקוח]', area_id: 'wholesale', priority: 1, status: 'doing', due_date: t, due_time: '15:00', created_at: at(-1, 18), acknowledged_at: at(0, 9) });
  const tasks = [
    task({ title: 'חשבוניות אוקטובר לרואה החשבון', area_id: 'accounting', priority: 2, due_date: addDays(t, -1) }),
    wholesale,
    task({ title: 'לסמן ב-Wolt מוצרים שאזלו', area_id: 'wolt', priority: 2, due_date: t, due_time: '17:00', created_by: ari }),
    task({ title: 'לספור מלאי כובעי טמבל', area_id: 'stock', due_date: t, due_time: '12:00', created_by: ari }),
    task({ title: 'לחזור לליד עם הצעת מחיר', area_id: 'leads', priority: 1, due_date: addDays(t, 2) }),
    task({ title: 'לבדוק שהגיבוי של האתר עבר', area_id: 'tech', due_date: addDays(t, 3), created_by: ari }),
    task({ title: 'לענות ללידים מאתמול', area_id: 'leads', status: 'done', done_at: at(0, 11) }),
    task({ title: 'למסור לשליח את הזמנות הבוקר', area_id: 'web-orders', status: 'done', done_at: at(0, 10), created_by: ari }),
    task({ title: 'להזמין שקיות אריזה מהספק', area_id: 'general', status: 'done', done_at: at(0, 9), created_by: ari }),
    task({ title: 'לעדכן מחירים ב-Wolt', area_id: 'wolt', status: 'done', done_at: at(-1, 13), created_by: ari }),
    task({ title: 'לקלוט סחורה חדשה למלאי', area_id: 'stock', status: 'done', done_at: at(-1, 10), created_by: ari }),
  ];
  // Demo deals for Ari across the last months (made-up numbers, demo only)
  const day = (monthsAgo, d) => { const x = new Date(t + 'T12:00'); x.setDate(1); x.setMonth(x.getMonth() - monthsAgo); x.setDate(Math.min(d, 28)); return iso(x); };
  const deal = (o) => ({ id: uid(), kind: 'wholesale', items: null, notes: null, seller_id: ari, status: 'won', created_at: at(-1), updated_at: at(-1), ...o });
  const past = [[5, [2400, 1800]], [4, [3100, 900]], [3, [2600, 2200, 700]], [2, [3800, 1500]], [1, [4200, 2600, 1200]]];
  const deals = past.flatMap(([m, amounts]) => amounts.map((amount, i) => deal({
    customer: `[לקוח לדוגמה ${m}-${i + 1}]`, kind: i % 2 ? 'lead' : 'wholesale', amount, quote_date: day(m, 3 + i * 5), closed_date: day(m, 8 + i * 6) })));
  deals.push(
    deal({ customer: '[שם העסק]', items: '[כמות] כובעים ממותגים', amount: 3600, quote_date: day(0, 1), closed_date: day(0, 2) }),
    deal({ customer: '[ליד מהאתר]', kind: 'lead', items: '[כמות] כובעים רקומים', amount: 1900, quote_date: day(0, 1), closed_date: day(0, 3) }),
    deal({ customer: '[ליד מהאתר 2]', kind: 'lead', items: '[כמות] כובעים', amount: 2500, status: 'quote', quote_date: day(0, 2), closed_date: null }),
    deal({ customer: '[לקוח קבוע]', items: 'הזמנה חוזרת', amount: 1400, status: 'quote', quote_date: day(0, 3), closed_date: null }),
    deal({ customer: '[ליד שלא נסגר]', kind: 'lead', amount: 800, status: 'lost', quote_date: day(0, 1), closed_date: day(0, 2) }),
  );

  return {
    deals,
    profiles: [
      { id: owner, name: 'בעל העסק', role: 'owner', title: 'בעלים', email: null, active: true },
      { id: ari, name: 'ארי', role: 'staff', title: 'מנהל מערכת ותפעול', email: null, active: true },
    ],
    invites: [],
    orders: [
      { id: uid(), source: 'site', number: '[מספר]', customer: '[שם הלקוח]', items: '2 כובעים', amount: null, status: 'new', due_date: null, notes: null, assignee_id: ari, created_by: owner, created_at: at(0, 9), updated_at: at(0, 9), closed_at: null },
      { id: uid(), source: 'wholesale', number: null, customer: '[שם העסק]', items: '[כמות] כובעים ממותגים', amount: null, status: 'preparing', due_date: t, notes: null, assignee_id: ari, created_by: ari, created_at: at(-1, 12), updated_at: at(-1, 12), closed_at: null },
      { id: uid(), source: 'wolt', number: null, customer: 'Wolt', items: 'כובע אחד, איסוף מהחנות', amount: null, status: 'ready', due_date: t, notes: null, assignee_id: owner, created_by: owner, created_at: at(0, 11), updated_at: at(0, 11), closed_at: null },
    ],
    areas: AREAS,
    tasks,
    checklist: ['לבדוק מלאי', 'חשבונית', 'לארוז', 'שליח'].map((text, i) => ({ id: uid(), task_id: wholesale.id, text, done: i < 2, sort: i })),
    comments: [
      { id: uid(), task_id: wholesale.id, author_id: owner, kind: 'event', body: 'פתח/ה את המשימה', created_at: at(-1, 18) },
      { id: uid(), task_id: wholesale.id, author_id: owner, kind: 'comment', body: '@ארי הלקוח ביקש להוסיף גם כובעי טמבל', created_at: at(-1, 18) },
      { id: uid(), task_id: wholesale.id, author_id: ari, kind: 'event', body: 'שינה את הסטטוס ל"בטיפול"', created_at: at(0, 9) },
      { id: uid(), task_id: wholesale.id, author_id: ari, kind: 'comment', body: 'קיבלתי, יוצא עד 15:00', created_at: at(0, 11) },
    ],
    session: null,
  };
}

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.tasks) { s.invites ||= []; s.orders ||= []; s.deals ||= []; return s; } } catch {}
  const s = seed(); save(s); return s;
}
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }
window.addEventListener('storage', (e) => { if (e.key === KEY) emit(); });

// Same visibility as the database rules: a manager sees everything; anyone else sees
// tasks given to them or that they gave, and orders they handle or added
const viewer = (db) => { const me = db.profiles.find((p) => p.id === db.session); return me?.role === 'owner' ? null : me?.id; };
const seesTask = (who, t) => !who || t.assignee_id === who || t.created_by === who;
const seesOrder = (who, o) => !who || o.assignee_id === who || o.created_by === who;

const withCounts = (db, t) => {
  const items = db.checklist.filter((c) => c.task_id === t.id);
  return { ...t, check_total: items.length, check_done: items.filter((c) => c.done).length,
    comment_count: db.comments.filter((c) => c.task_id === t.id && c.kind === 'comment').length };
};

const demo = {
  demo: true,
  async session() {
    const db = load(); const p = db.session && db.profiles.find((x) => x.id === db.session);
    return p ? (p.active === false ? { noAccess: true, email: p.name } : p) : null;
  },
  async demoSignIn(id) { const db = load(); db.session = id; save(db); emit(); },
  // First login of an invited person: the invite becomes a profile (claim_invite() in the real database)
  async demoClaim(email) {
    const db = load(); const inv = db.invites.find((i) => i.email === email); if (!inv) return;
    const p = { id: uid(), name: inv.name, role: inv.role, title: inv.title, email: inv.email, active: true };
    db.profiles.push(p); db.invites = db.invites.filter((i) => i !== inv); db.session = p.id; save(db); emit();
  },
  async invites() { return load().invites; },
  async invite(inv) {
    const db = load(); const email = inv.email.trim().toLowerCase();
    if (db.invites.some((i) => i.email === email) || db.profiles.some((p) => p.email === email && p.active !== false)) throw new Error('האימייל הזה כבר בצוות');
    db.invites.push({ ...inv, email, created_at: new Date().toISOString() }); save(db); emit();
  },
  async cancelInvite(email) { const db = load(); db.invites = db.invites.filter((i) => i.email !== email); save(db); emit(); },
  async updateMember(id, patch) { const db = load(); Object.assign(db.profiles.find((p) => p.id === id) || {}, patch); save(db); emit(); },
  async removeMember(id, reassignTo) {
    const db = load();
    db.tasks.forEach((t) => { if (t.assignee_id === id && t.status !== 'done') t.assignee_id = reassignTo; });
    Object.assign(db.profiles.find((p) => p.id === id) || {}, { active: false }); save(db); emit();
  },
  async sendCode() { throw new Error('demo'); },
  async verifyCode() { throw new Error('demo'); },
  async signOut() { const db = load(); db.session = null; save(db); emit(); },
  async profiles() { return load().profiles; },
  async areas() { return load().areas; },
  async tasks() { const db = load(); const who = viewer(db); return db.tasks.filter((t) => seesTask(who, t)).map((t) => withCounts(db, t)); },
  async task(id) {
    const db = load(); const t = db.tasks.find((x) => x.id === id); if (!t || !seesTask(viewer(db), t)) return null;
    return { ...withCounts(db, t),
      checklist: db.checklist.filter((c) => c.task_id === id).sort((a, b) => a.sort - b.sort),
      comments: db.comments.filter((c) => c.task_id === id).sort((a, b) => (a.created_at < b.created_at ? -1 : 1)) };
  },
  async createTask(data, me) {
    const db = load(); const now = new Date().toISOString();
    const t = { id: uid(), notes: '', area_id: 'general', assignee_id: me.id, priority: 3, status: 'open', due_date: null, due_time: null,
      done_at: null, ...data, created_by: me.id, created_at: now, updated_at: now };
    t.acknowledged_at = t.assignee_id === me.id ? now : null;
    db.tasks.push(t);
    db.comments.push({ id: uid(), task_id: t.id, author_id: me.id, kind: 'event', body: 'פתח/ה את המשימה', created_at: now });
    save(db); emit(); return t;
  },
  async updateTask(id, patch, me) {
    const db = load(); const t = db.tasks.find((x) => x.id === id); if (!t) return;
    const now = new Date().toISOString();
    if (patch.status && patch.status !== t.status) {
      patch.done_at = patch.status === 'done' ? now : null;
      db.comments.push({ id: uid(), task_id: id, author_id: me.id, kind: 'event', body: statusEvent(patch.status), created_at: now });
    }
    Object.assign(t, reassigning(t, patch, me), { updated_at: now }); save(db); emit();
  },
  async ackTask(id, me) {
    const db = load(); const t = db.tasks.find((x) => x.id === id); if (!t) return;
    const now = new Date().toISOString();
    t.acknowledged_at = now;
    db.comments.push({ id: uid(), task_id: id, author_id: me.id, kind: 'event', body: ACK_EVENT, created_at: now });
    save(db); emit();
  },
  async savePush() { throw new Error('בהדגמה אין התראות'); },
  async pushStatus() { return []; },
  async calendarToken() { return null; },
  async notify() {},
  async deleteTask(id) { const db = load(); db.tasks = db.tasks.filter((t) => t.id !== id); save(db); emit(); },
  async addCheck(task_id, text) { const db = load(); db.checklist.push({ id: uid(), task_id, text, done: false, sort: db.checklist.length }); save(db); emit(); },
  async setCheck(id, done) { const db = load(); const c = db.checklist.find((x) => x.id === id); if (c) c.done = done; save(db); emit(); },
  async addComment(task_id, body, me) { const db = load(); db.comments.push({ id: uid(), task_id, author_id: me.id, kind: 'comment', body, created_at: new Date().toISOString() }); save(db); emit(); },
  async resetDemo() { const s = seed(); save(s); emit(); },
  async orders() { const db = load(); const who = viewer(db); return db.orders.filter((o) => seesOrder(who, o)); },
  async createOrder(data) {
    const db = load(); const now = new Date().toISOString();
    const o = { id: uid(), source: 'site', status: 'new', number: null, items: null, amount: null, due_date: null, notes: null, closed_at: null, ...data, created_by: db.session, created_at: now, updated_at: now };
    o.assignee_id ||= db.session; // every order has a handler: the one who added it, unless they picked someone
    db.orders.push(o); save(db); emit(); return o;
  },
  async updateOrder(id, patch) {
    const db = load(); const o = db.orders.find((x) => x.id === id); if (!o) return;
    Object.assign(o, closing(o, patch), { updated_at: new Date().toISOString() }); save(db); emit();
  },
  async deleteOrder(id) { const db = load(); db.orders = db.orders.filter((o) => o.id !== id); save(db); emit(); },
  async deals() { return load().deals; },
  async createDeal(data, me) {
    const db = load(); const now = new Date().toISOString();
    const d = { id: uid(), kind: 'wholesale', items: null, amount: null, status: 'quote', quote_date: todayISO(), closed_date: null,
      notes: null, seller_id: me.id, ...data, created_at: now, updated_at: now };
    db.deals.push(d); save(db); emit(); return d;
  },
  async updateDeal(id, patch) { const db = load(); Object.assign(db.deals.find((d) => d.id === id) || {}, patch, { updated_at: new Date().toISOString() }); save(db); emit(); },
  async deleteDeal(id) { const db = load(); db.deals = db.deals.filter((d) => d.id !== id); save(db); emit(); },
};

// An order leaving or returning to the open statuses gets / loses its closing time
const closing = (o, patch) => {
  if (!patch.status || patch.status === o.status) return patch;
  const closed = ['done', 'cancelled'].includes(patch.status);
  return { ...patch, closed_at: closed ? new Date().toISOString() : null };
};

// A task moved to someone else waits for their "קיבלתי"; moved to yourself counts as received
const reassigning = (t, patch, me) => {
  if (!patch.assignee_id || patch.assignee_id === t.assignee_id) return patch;
  return { ...patch, acknowledged_at: patch.assignee_id === me.id ? new Date().toISOString() : null };
};
const ACK_EVENT = 'אישר/ה שקיבל/ה את המשימה';

const statusEvent = (s) => (s === 'done' ? 'סימן/ה כבוצעה' : `שינה את הסטטוס ל"${STATUS[s]}"`);

/* ---------- Supabase store ---------- */

let sb = null;
async function client() {
  if (!sb) {
    // One-file build from index.html; the module import is only a fallback if that script failed
    const { createClient } = window.supabase || (await import('https://esm.sh/@supabase/supabase-js@2.45.4'));
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    sb.channel('ops').on('postgres_changes', { event: '*', schema: 'public' }, emit).subscribe();
    // The first event only reports the session we already loaded with; refresh on real changes
    sb.auth.onAuthStateChange((event) => { if (event !== 'INITIAL_SESSION') emit(); });
  }
  return sb;
}
const must = ({ data, error }) => { if (error) throw error; return data; };

const live = {
  demo: false,
  async session() {
    const c = await client(); const { data } = await c.auth.getSession();
    if (!data.session) return null;
    // Returns my profile, or creates it from my invite on the first login
    const p = must(await c.rpc('claim_invite'));
    if (!p || !p.id || p.active === false) return { noAccess: true, email: data.session.user.email };
    return p;
  },
  async sendCode(email) { const c = await client(); must(await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })); },
  async invites() { const c = await client(); return must(await c.from('team_invites').select('*').order('created_at')); },
  async invite(inv) {
    const c = await client();
    const { error } = await c.from('team_invites').insert({ ...inv, email: inv.email.trim().toLowerCase() });
    if (error) throw new Error(error.code === '23505' ? 'האימייל הזה כבר הוזמן' : error.message);
  },
  async cancelInvite(email) { const c = await client(); must(await c.from('team_invites').delete().eq('email', email)); },
  async updateMember(id, patch) { const c = await client(); must(await c.from('profiles').update(patch).eq('id', id)); },
  async removeMember(id, reassignTo) {
    const c = await client();
    must(await c.from('tasks').update({ assignee_id: reassignTo }).eq('assignee_id', id).neq('status', 'done'));
    must(await c.from('profiles').update({ active: false }).eq('id', id));
  },
  async verifyCode(email, token) { const c = await client(); must(await c.auth.verifyOtp({ email, token, type: 'email' })); emit(); },
  async signOut() { const c = await client(); clearSnapshot(); await c.auth.signOut(); emit(); },
  async profiles() { const c = await client(); return must(await c.from('profiles').select('*').order('created_at')); },
  async areas() { const c = await client(); return must(await c.from('areas').select('*').order('sort')); },
  async tasks() {
    const c = await client();
    const rows = must(await c.from('tasks').select('*, checklist_items(done), comments(kind)'));
    return rows.map(({ checklist_items: ci = [], comments: cm = [], ...t }) => ({
      ...t, check_total: ci.length, check_done: ci.filter((x) => x.done).length, comment_count: cm.filter((x) => x.kind === 'comment').length }));
  },
  async task(id) {
    const c = await client();
    const t = must(await c.from('tasks').select('*').eq('id', id).maybeSingle()); if (!t) return null;
    const checklist = must(await c.from('checklist_items').select('*').eq('task_id', id).order('sort'));
    const comments = must(await c.from('comments').select('*').eq('task_id', id).order('created_at'));
    return { ...t, checklist, comments, check_total: checklist.length, check_done: checklist.filter((x) => x.done).length };
  },
  async createTask(data, me) {
    const c = await client();
    const row = { assignee_id: me.id, ...data };
    row.acknowledged_at = row.assignee_id === me.id ? new Date().toISOString() : null;
    const t = must(await c.from('tasks').insert(row).select().single());
    await c.from('comments').insert({ task_id: t.id, kind: 'event', body: 'פתח/ה את המשימה' });
    return t;
  },
  async updateTask(id, patch, me) {
    const c = await client();
    if (patch.status || patch.assignee_id) {
      const cur = must(await c.from('tasks').select('status, assignee_id').eq('id', id).single());
      if (patch.status && cur.status !== patch.status) {
        patch.done_at = patch.status === 'done' ? new Date().toISOString() : null;
        await c.from('comments').insert({ task_id: id, kind: 'event', body: statusEvent(patch.status) });
      }
      patch = reassigning(cur, patch, me);
    }
    must(await c.from('tasks').update(patch).eq('id', id));
  },
  async ackTask(id) {
    const c = await client();
    must(await c.from('tasks').update({ acknowledged_at: new Date().toISOString() }).eq('id', id));
    await c.from('comments').insert({ task_id: id, kind: 'event', body: ACK_EVENT });
  },
  // Phone notifications: save this device, and ask the server to notify a task's assignee
  async savePush(sub) {
    const c = await client(); const k = sub.keys || {};
    must(await c.from('push_subscriptions').upsert({ endpoint: sub.endpoint, p256dh: k.p256dh, auth: k.auth }));
  },
  // Personal secret for the calendar feed (/cal/<token>), created on first use
  async calendarToken() { const c = await client(); return must(await c.rpc('my_calendar_token')); },
  async pushStatus() {
    const c = await client(); const { data } = await c.rpc('push_status');
    return (data || []).map((r) => (typeof r === 'string' ? r : r.push_status));
  },
  // what: a task id, or { order_id } for an order a manager handed to someone
  async notify(what) {
    const c = await client(); const { data } = await c.auth.getSession();
    if (!data.session) return;
    fetch('/.netlify/functions/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify(typeof what === 'string' ? { task_id: what } : what),
    }).catch(() => {});
  },
  async deleteTask(id) { const c = await client(); must(await c.from('tasks').delete().eq('id', id)); },
  async orders() {
    const c = await client();
    // open orders, plus the ones closed in the last 30 days
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    return must(await c.from('orders').select('*').or(`closed_at.is.null,closed_at.gte.${since}`).order('created_at'));
  },
  async createOrder(data) { const c = await client(); return must(await c.from('orders').insert(data).select().single()); },
  async updateOrder(id, patch) {
    const c = await client();
    const cur = must(await c.from('orders').select('status').eq('id', id).single());
    must(await c.from('orders').update(closing(cur, patch)).eq('id', id));
  },
  async deleteOrder(id) { const c = await client(); must(await c.from('orders').delete().eq('id', id)); },
  async deals() {
    const c = await client();
    // enough history for the 6-month chart
    const since = new Date(); since.setMonth(since.getMonth() - 7);
    return must(await c.from('deals').select('*').or(`status.eq.quote,quote_date.gte.${since.toISOString().slice(0, 10)},closed_date.gte.${since.toISOString().slice(0, 10)}`));
  },
  async createDeal(data) { const c = await client(); return must(await c.from('deals').insert(data).select().single()); },
  async updateDeal(id, patch) { const c = await client(); must(await c.from('deals').update(patch).eq('id', id)); },
  async deleteDeal(id) { const c = await client(); must(await c.from('deals').delete().eq('id', id)); },
  async addCheck(task_id, text) { const c = await client(); must(await c.from('checklist_items').insert({ task_id, text, sort: Date.now() % 1e9 })); },
  async setCheck(id, done) { const c = await client(); must(await c.from('checklist_items').update({ done }).eq('id', id)); },
  async addComment(task_id, body) { const c = await client(); must(await c.from('comments').insert({ task_id, body })); },
};

// Refresh this screen right after a write, without waiting for the realtime echo
for (const k of ['createTask', 'updateTask', 'ackTask', 'deleteTask', 'addCheck', 'setCheck', 'addComment', 'invite', 'cancelInvite', 'updateMember', 'removeMember', 'createOrder', 'updateOrder', 'deleteOrder', 'createDeal', 'updateDeal', 'deleteDeal']) {
  const f = live[k];
  live[k] = async (...a) => { const r = await f(...a); emit(); return r; };
}

export const store = DEMO ? demo : live;

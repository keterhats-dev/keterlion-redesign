// Data layer. Two stores with the same functions: a demo store in this browser
// (localStorage) and the real one in Supabase. config.js decides which one runs.
import { DEMO, SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { todayISO, addDays, STATUS } from './util.js';

const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn());

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
  const task = (o) => ({
    id: uid(), notes: '', area_id: 'general', assignee_id: ari, created_by: owner, priority: 3, status: 'open',
    due_date: null, due_time: null, done_at: null, created_at: at(-1, 9), updated_at: at(-1, 9), ...o,
  });
  const wholesale = task({ title: 'הזמנה סיטונאית ל[שם הלקוח]', area_id: 'wholesale', priority: 1, status: 'doing', due_date: t, due_time: '15:00', created_at: at(-1, 18) });
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
  return {
    profiles: [
      { id: owner, name: 'בעל העסק', role: 'owner', title: 'בעלים' },
      { id: ari, name: 'ארי', role: 'staff', title: 'מנהל מערכת ותפעול' },
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
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.tasks) return s; } catch {}
  const s = seed(); save(s); return s;
}
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }
window.addEventListener('storage', (e) => { if (e.key === KEY) emit(); });

const withCounts = (db, t) => {
  const items = db.checklist.filter((c) => c.task_id === t.id);
  return { ...t, check_total: items.length, check_done: items.filter((c) => c.done).length,
    comment_count: db.comments.filter((c) => c.task_id === t.id && c.kind === 'comment').length };
};

const demo = {
  demo: true,
  async session() { const db = load(); return db.session ? db.profiles.find((p) => p.id === db.session) || null : null; },
  async demoSignIn(id) { const db = load(); db.session = id; save(db); emit(); },
  async sendCode() { throw new Error('demo'); },
  async verifyCode() { throw new Error('demo'); },
  async signOut() { const db = load(); db.session = null; save(db); emit(); },
  async profiles() { return load().profiles; },
  async areas() { return load().areas; },
  async tasks() { const db = load(); return db.tasks.map((t) => withCounts(db, t)); },
  async task(id) {
    const db = load(); const t = db.tasks.find((x) => x.id === id); if (!t) return null;
    return { ...withCounts(db, t),
      checklist: db.checklist.filter((c) => c.task_id === id).sort((a, b) => a.sort - b.sort),
      comments: db.comments.filter((c) => c.task_id === id).sort((a, b) => (a.created_at < b.created_at ? -1 : 1)) };
  },
  async createTask(data, me) {
    const db = load(); const now = new Date().toISOString();
    const t = { id: uid(), notes: '', area_id: 'general', assignee_id: me.id, priority: 3, status: 'open', due_date: null, due_time: null,
      done_at: null, ...data, created_by: me.id, created_at: now, updated_at: now };
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
    Object.assign(t, patch, { updated_at: now }); save(db); emit();
  },
  async deleteTask(id) { const db = load(); db.tasks = db.tasks.filter((t) => t.id !== id); save(db); emit(); },
  async addCheck(task_id, text) { const db = load(); db.checklist.push({ id: uid(), task_id, text, done: false, sort: db.checklist.length }); save(db); emit(); },
  async setCheck(id, done) { const db = load(); const c = db.checklist.find((x) => x.id === id); if (c) c.done = done; save(db); emit(); },
  async addComment(task_id, body, me) { const db = load(); db.comments.push({ id: uid(), task_id, author_id: me.id, kind: 'comment', body, created_at: new Date().toISOString() }); save(db); emit(); },
  async resetDemo() { const s = seed(); save(s); emit(); },
};

const statusEvent = (s) => (s === 'done' ? 'סימן/ה כבוצעה' : `שינה את הסטטוס ל"${STATUS[s]}"`);

/* ---------- Supabase store ---------- */

let sb = null;
async function client() {
  if (!sb) {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4');
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    sb.channel('ops').on('postgres_changes', { event: '*', schema: 'public' }, emit).subscribe();
    sb.auth.onAuthStateChange(() => emit());
  }
  return sb;
}
const must = ({ data, error }) => { if (error) throw error; return data; };

const live = {
  demo: false,
  async session() {
    const c = await client(); const { data } = await c.auth.getSession();
    if (!data.session) return null;
    return must(await c.from('profiles').select('*').eq('id', data.session.user.id).maybeSingle());
  },
  async sendCode(email) { const c = await client(); must(await c.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })); },
  async verifyCode(email, token) { const c = await client(); must(await c.auth.verifyOtp({ email, token, type: 'email' })); emit(); },
  async signOut() { const c = await client(); await c.auth.signOut(); emit(); },
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
    const t = must(await c.from('tasks').insert({ assignee_id: me.id, ...data }).select().single());
    await c.from('comments').insert({ task_id: t.id, kind: 'event', body: 'פתח/ה את המשימה' });
    return t;
  },
  async updateTask(id, patch) {
    const c = await client();
    if (patch.status) {
      const cur = must(await c.from('tasks').select('status').eq('id', id).single());
      if (cur.status !== patch.status) {
        patch.done_at = patch.status === 'done' ? new Date().toISOString() : null;
        await c.from('comments').insert({ task_id: id, kind: 'event', body: statusEvent(patch.status) });
      }
    }
    must(await c.from('tasks').update(patch).eq('id', id));
  },
  async deleteTask(id) { const c = await client(); must(await c.from('tasks').delete().eq('id', id)); },
  async addCheck(task_id, text) { const c = await client(); must(await c.from('checklist_items').insert({ task_id, text, sort: Date.now() % 1e9 })); },
  async setCheck(id, done) { const c = await client(); must(await c.from('checklist_items').update({ done }).eq('id', id)); },
  async addComment(task_id, body) { const c = await client(); must(await c.from('comments').insert({ task_id, body })); },
};

// Refresh this screen right after a write, without waiting for the realtime echo
for (const k of ['createTask', 'updateTask', 'deleteTask', 'addCheck', 'setCheck', 'addComment']) {
  const f = live[k];
  live[k] = async (...a) => { const r = await f(...a); emit(); return r; };
}

export const store = DEMO ? demo : live;

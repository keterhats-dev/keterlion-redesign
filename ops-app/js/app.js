import { html, render, useState, useEffect, useMemo, useRef } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { store, onChange, readSnapshot, saveSnapshot } from './data.js';
import { DEMO, VAPID_PUBLIC_KEY } from './config.js';
import {
  PRIORITY, STATUS, todayISO, addDays, longDate, dueLabel, isOverdue, byPriority, parseQuick, gcalLink,
  timeAgo, clock, dayHeading, iso, ORDER_SOURCE, ORDER_STATUS, ORDER_NEXT, isOpenOrder,
  DEAL_KIND, DEAL_STATUS, monthOf, addMonths, monthName, monthShort, shekel,
} from './util.js';

/* ---------- icons (stroke, follow currentColor) ---------- */
const svg = (d, size = 20, w = 2) => html`<svg aria-hidden="true" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${w} stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  sun: (s) => svg(html`<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>`, s),
  hash: (s) => svg(html`<path d="M5 9h14M5 15h14M10 4l-2 16M16 4l-2 16"/>`, s),
  team: (s) => svg(html`<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 010 7M18 14.8c2 .6 3.2 2.4 3.5 5.2"/>`, s),
  check: (s = 14, w = 3) => svg(html`<path d="M5 12l5 5 9-10"/>`, s, w),
  plus: (s = 22) => svg(html`<path d="M12 5v14M5 12h14"/>`, s, 2.5),
  back: (s = 18) => svg(html`<path d="M9 6l6 6-6 6"/>`, s, 2.5),
  next: (s = 16) => svg(html`<path d="M15 6l-6 6 6 6"/>`, s),
  chat: (s = 13) => svg(html`<path d="M4 5h16v11H9l-5 4z"/>`, s),
  cal: (s = 15) => svg(html`<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>`, s),
  x: (s = 16) => svg(html`<path d="M6 6l12 12M18 6L6 18"/>`, s, 2.5),
  out: (s = 18) => svg(html`<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>`, s),
  box: (s = 20) => svg(html`<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>`, s),
};

/* ---------- routing ---------- */
const useRoute = () => {
  const get = () => location.hash.replace(/^#\/?/, '').split('/');
  const [r, setR] = useState(get());
  useEffect(() => { const f = () => { setR(get()); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return r;
};
const go = (path) => { location.hash = '#/' + path; };

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : 'ערב טוב'; };
const initial = (p) => (p?.name || '?').trim().charAt(0);
const doneOn = (t) => (t.done_at ? iso(new Date(t.done_at)) : null);

/* ---------- התראות לטלפון ---------- */
const pushSupported = () => !DEMO && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIOSBrowser = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone;
const b64ToU8 = (s) => Uint8Array.from(atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function subscribePush() {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(VAPID_PUBLIC_KEY) });
  await store.savePush(sub.toJSON());
}

const DISMISS_KEY = 'kl-push-dismissed';
function PushPrompt() {
  const [state, setState] = useState(() => {
    // "לא עכשיו" hides the prompt for 3 days, then it comes back while notifications are still off
    try { if (Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < 3 * 864e5) return 'hidden'; } catch {}
    if (pushSupported()) return Notification.permission === 'default' ? 'ask' : 'hidden';
    return isIOSBrowser() ? 'ios' : 'hidden';
  });
  const [err, setErr] = useState('');
  if (state === 'hidden') return null;
  const dismiss = () => { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {} setState('hidden'); };
  const enable = async () => {
    setErr('');
    try {
      if ((await Notification.requestPermission()) !== 'granted') return setState('hidden');
      await subscribePush(); setState('done');
    } catch (e) { setErr('לא הצלחנו להפעיל: ' + e.message); }
  };
  return html`<section class="card" style="padding:14px 16px;display:flex;flex-direction:column;gap:8px">
    ${state === 'done' ? html`<div style="font-weight:600">${I.check(16)} התראות פועלות בטלפון הזה</div>`
    : state === 'ios' ? html`<div style="font-weight:600">כדי לקבל התראות באייפון</div>
      <div class="sub" style="font-size:14px">מוסיפים את האפליקציה למסך הבית: כפתור השיתוף ← "הוספה למסך הבית". אחרי זה פותחים אותה משם.</div>`
    : html`<div style="font-weight:600">לקבל התראה כשמוסיפים לך משימה?</div>
      <div style="display:flex;gap:8px"><button class="btn sm" onClick=${enable}>להפעיל התראות</button>
      <button class="btn sm ghost" onClick=${dismiss}>לא עכשיו</button></div>`}
    ${state === 'ios' && html`<button class="link" style="align-self:flex-start;padding:0" onClick=${dismiss}>הבנתי</button>`}
    ${err && html`<div class="err">${err}</div>`}
  </section>`;
}

/* ---------- "קיבלתי" ---------- */
const needsAck = (t, me) => t.assignee_id === me.id && !t.acknowledged_at && t.status !== 'done';

function NewForMe({ ctx, items }) {
  if (!items.length) return null;
  const from = (t) => ctx.profiles.find((p) => p.id === t.created_by)?.name || '';
  return html`<section class="card" style="padding:6px 0 4px;outline:2px solid var(--ink)">
    <div class="section-h" style="margin:8px 16px 0"><span style="color:var(--ink)">חדש בשבילך</span><span>${items.length}</span></div>
    <div class="list">${items.map((t) => html`<div class="row">
      <a class="body" href=${'#/task/' + t.id} style="text-decoration:none"><div class="t">${t.title}</div>
        <div class="meta">${t.priority < 3 && html`<span class=${'pill ' + PRIORITY[t.priority].cls}>${PRIORITY[t.priority].label}</span>`}
          ${t.due_date && html`<span>${dueLabel(t)}</span>`}<span>מ${from(t)}</span></div></a>
      <button class="btn sm" style="height:40px;flex:none" onClick=${() => ctx.store.ackTask(t.id, ctx.me)}>${I.check(15)} קיבלתי</button>
    </div>`)}</div>
  </section>`;
}

function Mentions({ text }) {
  return text.split(/(@\S+)/).map((part) => (part.startsWith('@') ? html`<span class="mention">${part}</span>` : part));
}

/* ---------- one task row ---------- */
function TaskRow({ t, ctx, showWho }) {
  const area = ctx.areas.find((a) => a.id === t.area_id);
  const who = ctx.profiles.find((p) => p.id === t.assignee_id);
  const done = t.status === 'done';
  const late = isOverdue(t);
  const toggle = () => store.updateTask(t.id, { status: done ? 'open' : 'done' }, ctx.me);
  return html`<div class=${'row' + (done ? ' done' : '')}>
    <button class=${'ck ' + (done ? 'on' : PRIORITY[t.priority].cls)} aria-label=${done ? 'להחזיר לפתוחות' : 'סיימתי'} onClick=${toggle}>${done && I.check(14)}</button>
    <a class="body" href=${'#/task/' + t.id} style="text-decoration:none">
      <div class="t">${t.title}</div>
      <div class="meta">
        ${done ? html`<span>בוצע ${clock(t.done_at)}</span>` : html`
          ${late && html`<span class="pill late">${dueLabel(t)}</span>`}
          ${t.priority < 3 && html`<span class=${'pill ' + PRIORITY[t.priority].cls}>${PRIORITY[t.priority].label}</span>`}
          ${!late && t.due_date && html`<span>${dueLabel(t)}</span>`}
          ${t.status === 'doing' && html`<span class="pill blue">בטיפול</span>`}
          ${t.status === 'waiting' && html`<span class="pill">מחכה</span>`}`}
        ${!done && t.assignee_id !== ctx.me.id && (t.acknowledged_at
          ? html`<span style="color:var(--green-ink);font-weight:600">✓ התקבל</span>`
          : html`<span class="pill p2">ממתין לאישור</span>`)}
        ${needsAck(t, ctx.me) && html`<span class="pill blue">חדש</span>`}
        ${area && html`<span># ${area.name}</span>`}
        ${showWho && who && html`<span>· ${who.name}</span>`}
        ${t.comment_count > 0 && html`<span class="ic">${I.chat()}${t.comment_count}</span>`}
      </div>
    </a>
    ${!done && t.check_total > 0 && html`<span class="count">${t.check_done}/${t.check_total}</span>`}
    ${!done && t.due_date && html`<a class="cal-btn" href=${gcalLink(t)} target="_blank" rel="noopener" aria-label="להוסיף ליומן Google" title="להוסיף ליומן Google">${I.cal(16)}</a>`}
  </div>`;
}

function Group({ title, items, ctx, showWho, tone }) {
  if (!items.length) return null;
  return html`<div class="section-h" style=${tone ? 'color:var(--red-ink)' : ''}><span>${title}</span><span>${items.length}</span></div>
    <section class="card list">${items.map((t) => html`<${TaskRow} key=${t.id} t=${t} ctx=${ctx} showWho=${showWho} />`)}</section>`;
}

/* ---------- היום ---------- */
function Today({ ctx, personId, openAdd, openOrder }) {
  const openOrders = ctx.orders.filter(isOpenOrder);
  const newOrders = openOrders.filter((o) => o.status === 'new').length;
  const person = ctx.profiles.find((p) => p.id === personId) || ctx.me;
  const self = person.id === ctx.me.id;
  const [area, setArea] = useState('all');
  const today = todayISO();
  const mine = ctx.tasks.filter((t) => t.assignee_id === person.id);
  const open = mine.filter((t) => t.status !== 'done').sort(byPriority);
  const shown = area === 'all' ? open : open.filter((t) => t.area_id === area);
  const late = shown.filter((t) => t.due_date && t.due_date < today);
  const now = shown.filter((t) => t.due_date === today);
  const later = shown.filter((t) => t.due_date && t.due_date > today);
  const undated = shown.filter((t) => !t.due_date);
  const doneToday = mine.filter((t) => t.status === 'done' && doneOn(t) === today);
  const usedAreas = ctx.areas.filter((a) => open.some((t) => t.area_id === a.id));
  const lateCount = open.filter((t) => isOverdue(t)).length;

  return html`<main class="page">
    <div class="top">
      <div class="who">
        ${!self && html`<a class="icon-btn" href="#/team" aria-label="חזרה לצוות">${I.back()}</a>`}
        ${self ? html`<a class="av" href="#/me" aria-label="ההגדרות שלי" style="text-decoration:none">${initial(person)}</a>` : html`<span class="av">${initial(person)}</span>`}
        <div><div class="sub">${self ? `${greeting()}, ${person.name}` : person.title || ''}</div>
        <h1 class="h1">${self ? 'היום' : `המשימות של ${person.name}`}<span style="color:var(--gold)">.</span></h1>
        <div class="sub">${longDate(today)}</div></div>
      </div>
    </div>

    <div class="tiles">
      <div class="card tile"><span class="sub">משימות פתוחות</span><b>${open.length}</b>
        ${lateCount ? html`<span class="pill late" style="align-self:flex-start">${lateCount} באיחור</span>` : html`<span class="pill green" style="align-self:flex-start">אין איחורים</span>`}</div>
      <a class="card tile" href="#/orders" style="text-decoration:none"><span class="sub">הזמנות פתוחות</span><b>${openOrders.length}</b>
        ${newOrders ? html`<span class="pill blue" style="align-self:flex-start">${newOrders} חדשות</span>`
          : html`<span class="pill" style="align-self:flex-start">לכל ההזמנות</span>`}</a>
    </div>
    ${self && ctx.me.role !== 'owner' && html`<a class="card more" href="#/sales" style="border-radius:var(--r)">
      <span>המכירות שלי ב${monthName(monthOf(today)).split(' ')[0]}: <b style="color:var(--ink)">${shekel(sum(wonIn(ctx.deals.filter((d) => d.seller_id === ctx.me.id), monthOf(today))))}</b></span>${I.next()}</a>`}
    <div class="today-grid"><div class="col">

    ${usedAreas.length > 1 && html`<div class="chips" role="group" aria-label="סינון לפי תחום">
      <button class=${'chip' + (area === 'all' ? ' on' : '')} onClick=${() => setArea('all')}>הכול</button>
      ${usedAreas.map((a) => html`<button class=${'chip' + (area === a.id ? ' on' : '')} onClick=${() => setArea(a.id)}># ${a.name}</button>`)}
    </div>`}

    ${self && html`<${PushPrompt} />`}
    ${self && html`<${NewForMe} ctx=${ctx} items=${open.filter((t) => needsAck(t, ctx.me))} />`}
    ${!shown.length && html`<div class="card empty">${open.length ? 'אין משימות פתוחות בתחום הזה' : 'אין משימות פתוחות. יופי.'}</div>`}
    <${Group} title="באיחור" items=${late} ctx=${ctx} tone="late" />
    <${Group} title="היום" items=${now} ctx=${ctx} />
    <${Group} title="בהמשך" items=${later} ctx=${ctx} />
    <${Group} title="בלי תאריך" items=${undated} ctx=${ctx} />

    ${doneToday.length > 0 && html`<${DoneToday} items=${doneToday} ctx=${ctx} />`}
    ${!self && html`<button class="btn" onClick=${() => openAdd({ assignee_id: person.id })}>${I.plus(20)} משימה ל${person.name}</button>`}
    </div>
    <aside class="col desk-only" aria-label="הזמנות פתוחות">
      <div class="top"><h2 class="h1" style="font-size:20px">הזמנות פתוחות</h2>
        <button class="btn sm ghost" onClick=${() => openOrder({})}>${I.plus(18)} הזמנה</button></div>
      <${OrdersList} ctx=${ctx} compact onOpen=${openOrder} />
    </aside></div>
  </main>`;
}

function DoneToday({ items, ctx }) {
  const [open, setOpen] = useState(false);
  return html`<section class="card list" style="overflow:hidden">
    <button class="more" onClick=${() => setOpen(!open)} aria-expanded=${open}>
      <span style="display:flex;align-items:center;gap:8px"><span class="ck on sm">${I.check(11)}</span>${items.length} בוצעו היום</span>
      <span style=${open ? 'transform:rotate(-90deg)' : ''}>${I.next()}</span>
    </button>
    ${open && items.map((t) => html`<${TaskRow} key=${t.id} t=${t} ctx=${ctx} />`)}
  </section>`;
}

/* ---------- הוספה מהירה ---------- */
function AddSheet({ ctx, preset, onClose }) {
  const [text, setText] = useState('');
  const [ov, setOv] = useState({});
  const [notes, setNotes] = useState('');
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef();
  useEffect(() => { input.current?.focus(); }, []);
  const parsed = useMemo(() => parseQuick(text, ctx), [text]);
  const val = {
    priority: 3, area_id: preset?.area_id || 'general', assignee_id: preset?.assignee_id || ctx.me.id, due_date: null, due_time: null,
    ...Object.fromEntries(Object.entries(parsed).filter(([k, v]) => k !== 'title' && v != null)), ...ov,
  };
  const set = (k) => (e) => setOv({ ...ov, [k]: e.target ? e.target.value || null : e });
  const submit = async (e) => {
    e.preventDefault();
    if (!parsed.title || busy) return;
    setBusy(true);
    try {
      const created = await ctx.store.createTask({ title: parsed.title, notes: notes || null, ...val }, ctx.me);
      if (val.assignee_id !== ctx.me.id) ctx.store.notify(created.id);
      // A dated task of my own: offer it to my Google Calendar right away
      if (val.due_date && val.assignee_id === ctx.me.id) ctx.toast({ text: 'המשימה נוספה', action: 'להוסיף ליומן Google', href: gcalLink({ ...val, title: parsed.title }) });
      onClose();
    }
    catch (err) { alert('לא נשמר: ' + err.message); setBusy(false); }
  };
  const who = ctx.profiles.find((p) => p.id === val.assignee_id);
  const area = ctx.areas.find((a) => a.id === val.area_id);
  const t = { ...val, title: parsed.title };

  return html`<div class="scrim" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <form class="sheet" onSubmit=${submit} role="dialog" aria-label="משימה חדשה">
      <div class="grab"></div>
      <div class="top"><h2 class="h1" style="font-size:20px">משימה חדשה</h2>
        <button type="button" class="icon-btn" style="width:36px;height:36px;background:var(--bg);box-shadow:none" aria-label="סגירה" onClick=${onClose}>${I.x()}</button></div>
      <label class="sr" for="q">מה צריך לעשות</label>
      <input id="q" ref=${input} class="field" value=${text} onInput=${(e) => setText(e.target.value)} placeholder="לספור מלאי מחר 12:00 !דחוף #מלאי" autocomplete="off" />
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${val.due_date && html`<span class="pill big">${I.cal(13)} ${dueLabel(t)}</span>`}
        ${val.priority < 3 && html`<span class=${'pill big ' + PRIORITY[val.priority].cls}>${PRIORITY[val.priority].label}</span>`}
        ${area && html`<span class="pill big"># ${area.name}</span>`}
        ${who && html`<span class="pill big"><span class="av sm" style="width:20px;height:20px;font-size:10px">${initial(who)}</span>${who.name}</span>`}
      </div>

      <div><span class="lbl">עדיפות</span><div class="seg" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <button type="button" class=${val.priority === 1 ? 'on r' : ''} onClick=${() => set('priority')(1)}>דחוף</button>
        <button type="button" class=${val.priority === 2 ? 'on a' : ''} onClick=${() => set('priority')(2)}>חשוב</button>
        <button type="button" class=${val.priority === 3 ? 'on' : ''} onClick=${() => set('priority')(3)}>רגיל</button>
      </div></div>

      ${!more ? html`<button type="button" class="link" style="align-self:flex-start" onClick=${() => setMore(true)}>תאריך, תחום, למי והערה</button>` : html`
        <div class="two">
          <div><label class="lbl" for="d">תאריך</label><input id="d" type="date" class="field soft" value=${val.due_date || ''} onInput=${set('due_date')} /></div>
          <div><label class="lbl" for="h">שעה</label><input id="h" type="time" class="field soft" value=${val.due_time || ''} onInput=${set('due_time')} /></div>
        </div>
        <div class="two">
          <div><label class="lbl" for="a">תחום</label><select id="a" class="field soft" value=${val.area_id} onChange=${set('area_id')}>${ctx.areas.map((a) => html`<option value=${a.id}>${a.name}</option>`)}</select></div>
          <div><label class="lbl" for="w">למי</label><select id="w" class="field soft" value=${val.assignee_id} onChange=${set('assignee_id')}>${ctx.team.map((p) => html`<option value=${p.id}>${p.name}</option>`)}</select></div>
        </div>
        <div><label class="lbl" for="n">הערה</label><textarea id="n" class="field soft" style="height:80px;padding:12px 14px" value=${notes} onInput=${(e) => setNotes(e.target.value)}></textarea></div>`}

      <div class="sub">אפשר לכתוב בשורה: מחר, יום חמישי, 15:00, !דחוף, #מלאי, @ארי</div>
      <button class="btn" disabled=${!parsed.title || busy}>${busy ? 'שומר…' : 'להוסיף'}</button>
    </form>
  </div>`;
}

/* ---------- משימה ---------- */
function TaskPage({ id, ctx }) {
  const [t, setT] = useState(undefined);
  const [msg, setMsg] = useState('');
  const [item, setItem] = useState('');
  const load = () => ctx.store.task(id).then(setT);
  useEffect(() => { load(); return onChange(load); }, [id]);
  if (t === undefined) return html`<main class="page"><div class="empty">טוען…</div></main>`;
  if (t === null) return html`<main class="page"><div class="card empty">המשימה לא נמצאה. <a href="#/today">ליום שלי</a></div></main>`;
  const up = (patch) => ctx.store.updateTask(id, patch, ctx.me);
  const area = ctx.areas.find((a) => a.id === t.area_id);
  const author = (cid) => ctx.profiles.find((p) => p.id === cid);
  const cal = gcalLink(t);
  const send = async (e) => { e.preventDefault(); const b = msg.trim(); if (!b) return; setMsg(''); await ctx.store.addComment(id, b, ctx.me); };
  const addItem = async (e) => { e.preventDefault(); const x = item.trim(); if (!x) return; setItem(''); await ctx.store.addCheck(id, x); };

  return html`<main class="page" style="padding-bottom:110px">
    <div class="top">
      <button class="icon-btn" aria-label="חזרה" onClick=${() => history.length > 1 ? history.back() : go('today')}>${I.back()}</button>
      ${area && html`<a href=${'#/area/' + area.id} class="sub" style="font-weight:600;font-size:14px;text-decoration:none"># ${area.name}</a>`}
      <span style="width:44px"></span>
    </div>

    ${needsAck(t, ctx.me) && html`<section class="card" style="padding:14px 16px;display:flex;align-items:center;gap:12px;outline:2px solid var(--ink)">
      <div style="flex:1"><div style="font-weight:700">משימה חדשה בשבילך</div><div class="sub">מ${author(t.created_by)?.name || ''} · ${timeAgo(t.created_at)}</div></div>
      <button class="btn sm" onClick=${() => ctx.store.ackTask(id, ctx.me)}>${I.check(15)} קיבלתי</button></section>`}
    ${t.assignee_id !== ctx.me.id && t.status !== 'done' && html`<div class="sub" style="padding:0 4px">${t.acknowledged_at
      ? html`<span style="color:var(--green-ink);font-weight:600">✓ ${author(t.assignee_id)?.name || ''} אישר/ה קבלה · ${timeAgo(t.acknowledged_at)}</span>`
      : html`<span class="pill p2">ממתין לאישור של ${author(t.assignee_id)?.name || ''}</span>`}</div>`}
    <section class="card" style="padding:16px;display:flex;flex-direction:column;gap:14px">
      <label class="sr" for="tt">כותרת</label>
      <textarea id="tt" class="task-h" rows="2" onBlur=${(e) => e.target.value.trim() && e.target.value !== t.title && up({ title: e.target.value.trim() })}>${t.title}</textarea>
      <div><span class="lbl">סטטוס</span><div class="seg" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        ${Object.entries(STATUS).map(([k, label]) => html`<button class=${t.status === k ? 'on' : ''} onClick=${() => up({ status: k })}>${label}</button>`)}
      </div></div>
      <div><span class="lbl">עדיפות</span><div class="seg" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <button class=${t.priority === 1 ? 'on r' : ''} onClick=${() => up({ priority: 1 })}>דחוף</button>
        <button class=${t.priority === 2 ? 'on a' : ''} onClick=${() => up({ priority: 2 })}>חשוב</button>
        <button class=${t.priority === 3 ? 'on' : ''} onClick=${() => up({ priority: 3 })}>רגיל</button>
      </div></div>
      <div class="two">
        <div><label class="lbl" for="td">תאריך</label><input id="td" type="date" class="field soft" value=${t.due_date || ''} onChange=${(e) => up({ due_date: e.target.value || null })} /></div>
        <div><label class="lbl" for="th">שעה</label><input id="th" type="time" class="field soft" value=${(t.due_time || '').slice(0, 5)} onChange=${(e) => up({ due_time: e.target.value || null })} /></div>
      </div>
      <div class="two">
        <div><label class="lbl" for="ta">תחום</label><select id="ta" class="field soft" value=${t.area_id} onChange=${(e) => up({ area_id: e.target.value })}>${ctx.areas.map((a) => html`<option value=${a.id}>${a.name}</option>`)}</select></div>
        <div><label class="lbl" for="tw">אצל</label><select id="tw" class="field soft" value=${t.assignee_id} onChange=${async (e) => { const v = e.target.value; await up({ assignee_id: v }); if (v !== ctx.me.id) ctx.store.notify(id); }}>${ctx.profiles.filter((p) => p.active !== false || p.id === t.assignee_id).map((p) => html`<option value=${p.id}>${p.name}</option>`)}</select></div>
      </div>
      ${cal && html`<a href=${cal} target="_blank" rel="noopener" class="pill big" style="align-self:flex-start;text-decoration:none">${I.cal(14)} להוסיף ליומן Google</a>`}
    </section>

    <section class="card" style="padding:12px 16px">
      <div class="section-h" style="margin:0 0 4px"><span>צ'קליסט</span>${t.check_total > 0 && html`<span>${t.check_done}/${t.check_total}</span>`}</div>
      ${t.checklist.map((c) => html`<div class=${'chk-row' + (c.done ? ' done' : '')}>
        <button class=${'ck sm' + (c.done ? ' on' : '')} aria-label=${c.done ? 'לבטל' : 'לסמן'} onClick=${() => ctx.store.setCheck(c.id, !c.done)}>${c.done && I.check(11)}</button><span>${c.text}</span></div>`)}
      <form class="add-line" onSubmit=${addItem}><label class="sr" for="ci">שלב חדש</label>
        <input id="ci" value=${item} onInput=${(e) => setItem(e.target.value)} placeholder="להוסיף שלב" /><button class="btn sm ghost" style="height:40px">הוספה</button></form>
    </section>

    <section class="card" style="padding:12px 16px">
      <label class="lbl" for="tn">הערה</label>
      <textarea id="tn" class="field soft" style="height:70px;padding:10px 12px" onBlur=${(e) => e.target.value !== (t.notes || '') && up({ notes: e.target.value || null })}>${t.notes || ''}</textarea>
    </section>

    <div class="section-h"><span>שרשור</span></div>
    <div class="thread">
      ${t.comments.map((c) => {
        const a = author(c.author_id);
        if (c.kind === 'event') return html`<div class="ev">${a?.name || ''} ${c.body} · ${timeAgo(c.created_at)}</div>`;
        const mine = c.author_id === ctx.me.id;
        return html`<div class=${'msg' + (mine ? ' mine' : '')}><span class=${'av sm' + (mine ? '' : ' light')}>${initial(a)}</span>
          <div class="bubble"><${Mentions} text=${c.body} /><small>${mine ? '' : (a?.name || '') + ' · '}${timeAgo(c.created_at)}</small></div></div>`;
      })}
      ${!t.comments.some((c) => c.kind === 'comment') && html`<div class="ev">עוד אין תגובות</div>`}
    </div>
    <button class="link" style="align-self:center;color:var(--red-ink)" onClick=${async () => { if (confirm('למחוק את המשימה?')) { await ctx.store.deleteTask(id); go('today'); } }}>למחוק משימה</button>

    <div class="composer"><form onSubmit=${send}>
      <label class="sr" for="cm">תגובה</label>
      <input id="cm" value=${msg} onInput=${(e) => setMsg(e.target.value)} placeholder="תגובה… @ כדי לתייג" autocomplete="off" />
      ${msg.trim() ? html`<button class="btn sm">שליחה</button>`
        : t.status === 'done' ? html`<button type="button" class="btn sm ghost" onClick=${() => up({ status: 'open' })}>לפתוח מחדש</button>`
        : html`<button type="button" class="btn sm" onClick=${() => up({ status: 'done' })}>${I.check(16)} סיימתי</button>`}
    </form></div>
  </main>`;
}

/* ---------- הזמנות ---------- */
function OrderRow({ o, ctx, onOpen }) {
  const st = ORDER_STATUS[o.status];
  const next = ORDER_NEXT[o.status];
  const late = isOpenOrder(o) && o.due_date && o.due_date < todayISO();
  const who = ctx.profiles.find((p) => p.id === o.assignee_id);
  // Moving an order forward takes it, if nobody handles it yet
  const advance = () => ctx.store.updateOrder(o.id, { status: next[0], ...(o.assignee_id ? {} : { assignee_id: ctx.me.id }) });
  return html`<div class="row" style="align-items:flex-start">
    <button class="body" style="border:0;background:none;padding:0;text-align:right;cursor:pointer" onClick=${() => onOpen(o)}>
      <div class="meta" style="margin:0 0 4px"><span style="font-weight:600">${ORDER_SOURCE[o.source]}${o.number ? ` · #${o.number}` : ''}</span>
        <span class=${'pill ' + st.cls}>${st.label}</span>
        ${who ? html`<span style="display:inline-flex;align-items:center;gap:4px"><span class=${'av sm' + (who.id === ctx.me.id ? '' : ' light')} style="width:20px;height:20px;font-size:10px">${initial(who)}</span>${who.id === ctx.me.id ? 'אצלי' : who.name}</span>`
          : ''}</div>
      <div class="t">${o.customer}${o.is_custom && html` <span class="pill custom">עיצוב אישי</span>`}</div>
      <div class="meta">
        ${o.items && html`<span>${o.items}</span>`}
        ${o.shipping && html`<span>· ${o.shipping}</span>`}
        ${o.due_date && html`<span class=${late ? 'pill late' : ''}>${late ? 'באיחור · ' : 'עד '}${dueLabel({ due_date: o.due_date })}</span>`}
        ${o.amount != null && html`<span>₪${Number(o.amount).toLocaleString('he-IL')}</span>`}
        ${!isOpenOrder(o) && o.closed_at && html`<span>${timeAgo(o.closed_at)}</span>`}
      </div>
    </button>
    ${next && html`<button class=${'btn sm' + (o.status === 'new' ? '' : ' ghost')} style="height:38px;padding:0 14px;font-size:14px;flex:none"
      onClick=${advance}>${next[1]}</button>`}
  </div>`;
}

const sortOrders = (a, b) => {
  const da = a.due_date || '9999', db = b.due_date || '9999';
  return da !== db ? (da < db ? -1 : 1) : a.created_at < b.created_at ? -1 : 1;
};

function OrdersList({ ctx, compact, onOpen }) {
  const [src, setSrc] = useState('all');
  // A manager starts on everything, everyone else on their own orders
  const [whoF, setWhoF] = useState(compact || ctx.me.role === 'owner' ? 'all' : 'mine');
  const byWho = (o) => whoF === 'all' || (whoF === 'mine' ? o.assignee_id === ctx.me.id : whoF === 'none' ? !o.assignee_id : o.assignee_id === whoF);
  const allOpen = ctx.orders.filter(isOpenOrder);
  const count = (f) => allOpen.filter(f).length;
  // Only a manager sees other people's orders, so only they get a chip per person
  const others = ctx.me.role === 'owner' ? ctx.team.filter((p) => p.id !== ctx.me.id) : [];
  const open = allOpen.filter(byWho).filter((o) => src === 'all' || o.source === src).sort(sortOrders);
  const today = todayISO();
  const closedToday = ctx.orders.filter((o) => o.status === 'done' && o.closed_at && iso(new Date(o.closed_at)) === today);
  const used = Object.keys(ORDER_SOURCE).filter((k) => ctx.orders.some((o) => isOpenOrder(o) && o.source === k));
  const groups = ['new', 'preparing', 'ready'].map((s) => [s, open.filter((o) => o.status === s)]).filter(([, l]) => l.length);
  const whoChip = (k, label, n) => html`<button class=${'chip' + (whoF === k ? ' on' : '')} onClick=${() => setWhoF(k)}>${label}${n ? ` · ${n}` : ''}</button>`;
  return html`
    ${!compact && html`<div class="chips" role="group" aria-label="סינון לפי מטפל">
      ${whoChip('mine', 'שלי', count((o) => o.assignee_id === ctx.me.id))}
      ${others.map((p) => whoChip(p.id, `של ${p.name}`, count((o) => o.assignee_id === p.id)))}
      ${whoChip('all', 'הכול', allOpen.length)}
    </div>`}
    ${!compact && used.length > 1 && html`<div class="chips" role="group" aria-label="סינון לפי מקור">
      <button class=${'chip' + (src === 'all' ? ' on' : '')} onClick=${() => setSrc('all')}>הכול</button>
      ${used.map((k) => html`<button class=${'chip' + (src === k ? ' on' : '')} onClick=${() => setSrc(k)}>${ORDER_SOURCE[k]}</button>`)}
    </div>`}
    ${!open.length && html`<div class="card empty">${allOpen.length ? 'אין הזמנות פתוחות בסינון הזה' : 'אין הזמנות פתוחות'}</div>`}
    ${groups.map(([s, list]) => html`<div class="section-h"><span>${ORDER_STATUS[s].label}</span><span>${list.length}</span></div>
      <section class="card list">${list.map((o) => html`<${OrderRow} key=${o.id} o=${o} ctx=${ctx} onOpen=${onOpen} />`)}</section>`)}
    ${!compact && closedToday.length > 0 && html`<div class="section-h"><span>נמסרו היום</span><span>${closedToday.length}</span></div>
      <section class="card list">${closedToday.map((o) => html`<${OrderRow} key=${o.id} o=${o} ctx=${ctx} onOpen=${onOpen} />`)}</section>`}`;
}

function Orders({ ctx, openOrder }) {
  const open = ctx.orders.filter(isOpenOrder).length;
  return html`<main class="page">
    <div><h1 class="h1">הזמנות פתוחות<span style="color:var(--gold)">.</span></h1>
      <div class="sub">${open ? `${open} פתוחות` : 'אין פתוחות'} · הזמנות מהאתר נכנסות לבד, את השאר מוסיפים כאן</div></div>
    <${OrdersList} ctx=${ctx} onOpen=${openOrder} />
    <button class="btn" onClick=${() => openOrder({})}>${I.plus(20)} הזמנה חדשה</button>
  </main>`;
}

function OrderSheet({ ctx, order, onClose }) {
  const isNew = !order.id;
  const [f, setF] = useState({
    source: order.source || 'site', number: order.number || '', customer: order.customer || '', items: order.items || '',
    amount: order.amount ?? '', due_date: order.due_date || '', status: order.status || 'new', notes: order.notes || '',
    assignee_id: order.assignee_id || ctx.me.id, // every order has a handler; by default whoever adds it
  });
  const manager = ctx.me.role === 'owner';
  const canPick = manager || isNew;
  const handler = ctx.profiles.find((p) => p.id === order.assignee_id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target ? e.target.value : e });
  const save = async (e) => {
    e.preventDefault();
    if (!f.customer.trim()) return setErr('צריך לכתוב למי ההזמנה');
    const data = { source: f.source, number: f.number.trim() || null, customer: f.customer.trim(), items: f.items.trim() || null,
      amount: f.amount === '' ? null : Number(f.amount), due_date: f.due_date || null, status: f.status, notes: f.notes.trim() || null };
    // Anyone picks the handler of a new order; changing it later is for a manager (the database enforces it too)
    const newHandler = f.assignee_id || null;
    if (canPick) data.assignee_id = newHandler;
    setBusy(true);
    try {
      const saved = await (isNew ? ctx.store.createOrder(data) : ctx.store.updateOrder(order.id, data));
      const id = isNew ? saved?.id : order.id;
      if (canPick && id && newHandler && newHandler !== ctx.me.id && newHandler !== (order.assignee_id || null)) ctx.store.notify({ order_id: id });
      onClose();
    }
    catch (x) { setErr('לא נשמר: ' + x.message); setBusy(false); }
  };
  const remove = async () => { if (!confirm('למחוק את ההזמנה מהרשימה?')) return; await ctx.store.deleteOrder(order.id); onClose(); };

  return html`<div class="scrim" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <form class="sheet" onSubmit=${save} role="dialog" aria-label=${isNew ? 'הזמנה חדשה' : 'עריכת הזמנה'}>
      <div class="grab"></div>
      <div class="top"><h2 class="h1" style="font-size:20px">${isNew ? 'הזמנה חדשה' : 'הזמנה'}</h2>
        <button type="button" class="icon-btn" style="width:36px;height:36px;background:var(--bg);box-shadow:none" aria-label="סגירה" onClick=${onClose}>${I.x()}</button></div>
      <div><span class="lbl">מאיפה</span><div class="seg" style="grid-template-columns:repeat(5,minmax(0,1fr))">
        ${Object.entries(ORDER_SOURCE).map(([k, l]) => html`<button type="button" class=${f.source === k ? 'on' : ''} onClick=${() => set('source')(k)}>${l}</button>`)}
      </div></div>
      <div><label class="lbl" for="oc">לקוח</label><input id="oc" class="field soft" value=${f.customer} onInput=${set('customer')} placeholder="שם הלקוח או העסק" /></div>
      <div><label class="lbl" for="oi">מה הוזמן</label><input id="oi" class="field soft" value=${f.items} onInput=${set('items')} placeholder="למשל: 2 כובעים, שחור ולבן" /></div>
      <div class="two">
        <div><label class="lbl" for="on">מספר הזמנה</label><input id="on" class="field soft" dir="ltr" value=${f.number} onInput=${set('number')} /></div>
        <div><label class="lbl" for="oa">סכום (₪)</label><input id="oa" type="number" inputmode="decimal" class="field soft" dir="ltr" value=${f.amount} onInput=${set('amount')} /></div>
      </div>
      <div class="two">
        <div><label class="lbl" for="od">להכין עד</label><input id="od" type="date" class="field soft" value=${f.due_date} onInput=${set('due_date')} /></div>
        ${canPick ? html`<div><label class="lbl" for="oh">מטפל</label><select id="oh" class="field soft" value=${f.assignee_id} onChange=${set('assignee_id')}>
            ${ctx.team.map((p) => html`<option value=${p.id}>${p.id === ctx.me.id ? `${p.name} (אני)` : p.name}</option>`)}</select></div>`
          : html`<div><span class="lbl">מטפל</span><div class="field soft" style="display:flex;align-items:center;color:var(--muted)">${handler ? handler.name : ''}</div></div>`}
      </div>
      <div><span class="lbl">סטטוס</span><div class="seg" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        ${['new', 'preparing', 'ready', 'done'].map((k) => html`<button type="button" class=${f.status === k ? 'on' : ''} onClick=${() => set('status')(k)}>${ORDER_STATUS[k].label}</button>`)}
      </div></div>
      ${order.external_id && html`<div class="card" style="background:var(--bg);box-shadow:none;padding:12px 14px;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <b style="font-size:14px">הגיעה מהאתר${order.shipping ? ` · ${order.shipping}` : ''}</b>
          ${order.is_custom && html`<span class="pill custom">עיצוב אישי</span>`}</div>
        ${order.design_urls?.length > 0 && html`<div style="display:flex;gap:8px;flex-wrap:wrap">${order.design_urls.map((u, i) => html`
          <a href=${u} target="_blank" rel="noopener" style="display:block;width:96px;height:96px;border-radius:12px;overflow:hidden;background:#fff">
            <img src=${u} alt=${`העיצוב ${i + 1}`} style="width:100%;height:100%;object-fit:contain" /></a>`)}</div>`}
        ${order.is_custom && !order.design_urls?.length && html`<div class="sub">תמונת העיצוב לא הגיעה מהאתר. אפשר לראות אותה בהזמנה ב-WooCommerce</div>`}
        ${/^\d+$/.test(order.external_id) && html`<a class="link" style="padding:0;align-self:flex-start" target="_blank" rel="noopener"
          href=${`https://keterlion.com/wp-admin/post.php?post=${order.external_id}&action=edit`}>לפתוח את ההזמנה באתר</a>`}
      </div>`}
      <div><label class="lbl" for="ox">הערה</label><textarea id="ox" class="field soft" style="height:70px;padding:10px 12px" value=${f.notes} onInput=${set('notes')}></textarea></div>
      ${err && html`<div class="err">${err}</div>`}
      <button class="btn" disabled=${busy}>${busy ? 'שומר…' : isNew ? 'להוסיף הזמנה' : 'לשמור'}</button>
      ${!isNew && html`<div style="display:flex;justify-content:space-between">
        <button type="button" class="link" onClick=${async () => { await ctx.store.updateOrder(order.id, { status: 'cancelled' }); onClose(); }}>ההזמנה בוטלה</button>
        <button type="button" class="link" style="color:var(--red-ink)" onClick=${remove}>למחוק</button></div>`}
    </form>
  </div>`;
}

/* ---------- מכירות: העסקאות שאדם סגר, וסיכום חודשי ---------- */
const wonIn = (deals, m) => deals.filter((d) => d.status === 'won' && monthOf(d.closed_date) === m);
const sum = (list) => list.reduce((s, d) => s + (Number(d.amount) || 0), 0);

// Who a sales page is about: a manager picks anyone (default: the first staff member), others see their own
const salesPerson = (ctx, personId) =>
  ctx.profiles.find((p) => p.id === personId) || (ctx.me.role === 'owner' ? ctx.team.find((p) => p.role !== 'owner') : null) || ctx.me;

function Sales({ ctx, personId, openDeal }) {
  const person = salesPerson(ctx, personId);
  const thisMonth = monthOf(todayISO());
  const [m, setM] = useState(thisMonth);
  const mine = ctx.deals.filter((d) => d.seller_id === person.id);
  const won = wonIn(mine, m);
  const total = sum(won);
  const prev = sum(wonIn(mine, addMonths(m, -1)));
  const change = prev ? Math.round(((total - prev) / prev) * 100) : null;
  const quotes = mine.filter((d) => monthOf(d.quote_date) === m);
  const decided = quotes.filter((d) => d.status !== 'quote');
  const rate = decided.length ? Math.round((decided.filter((d) => d.status === 'won').length / decided.length) * 100) : null;
  const months = [-5, -4, -3, -2, -1, 0].map((n) => addMonths(m, n));
  const bars = months.map((x) => sum(wonIn(mine, x)));
  const max = Math.max(...bars, 1);
  const byKind = Object.keys(DEAL_KIND).map((k) => [k, sum(won.filter((d) => d.kind === k))]);
  const open = mine.filter((d) => d.status === 'quote').sort((a, b) => (a.quote_date < b.quote_date ? -1 : 1));
  const others = ctx.me.role === 'owner' ? ctx.team.filter((p) => p.id !== person.id) : [];

  return html`<main class="page">
    <div class="top">
      <div><div class="sub">${person.id === ctx.me.id ? 'המכירות שלי' : `המכירות של ${person.name}`}</div><h1 class="h1">סיכום חודשי<span style="color:var(--gold)">.</span></h1></div>
      ${others.length > 0 && html`<label class="sr" for="sp">של מי</label><select id="sp" class="field soft" style="width:auto;height:40px"
        value=${person.id} onChange=${(e) => go('sales/' + e.target.value)}>${ctx.team.map((p) => html`<option value=${p.id}>${p.name}</option>`)}</select>`}
    </div>

    <div class="top">
      <button class="icon-btn" aria-label="החודש הקודם" onClick=${() => setM(addMonths(m, -1))}>${I.back(16)}</button>
      <div style="font-size:17px;font-weight:700">${monthName(m)}</div>
      <button class="icon-btn" aria-label="החודש הבא" disabled=${m >= thisMonth} style=${m >= thisMonth ? 'opacity:.35' : ''} onClick=${() => setM(addMonths(m, 1))}>${I.next(16)}</button>
    </div>

    <section class="card" style="padding:16px">
      <div class="sub" style="font-weight:600">עסקאות שנסגרו ב${monthName(m).split(' ')[0]}</div>
      <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-top:4px">
        <div style="font-size:36px;font-weight:800">${shekel(total)}</div>
        ${change !== null && html`<span class=${'pill ' + (change >= 0 ? 'green' : 'late')}>${change >= 0 ? '+' : ''}${change}% מהחודש הקודם</span>`}
      </div>
      <div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-top:14px;align-items:end;height:130px" role="img"
        aria-label=${'סכום העסקאות בחצי השנה האחרונה: ' + months.map((x, i) => `${monthName(x)} ${shekel(bars[i])}`).join(', ')}>
        ${months.map((x, i) => html`<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;height:100%">
          <span style="font-size:10px;color:var(--muted)">${bars[i] ? Math.round(bars[i] / 100) / 10 + 'K' : ''}</span>
          <i style=${`display:block;width:100%;max-width:30px;height:${Math.max(4, (bars[i] / max) * 92)}px;border-radius:8px 8px 3px 3px;background:${x === m ? 'var(--ink)' : '#dcdbd6'}`}></i>
          <span style=${`font-size:11px;${x === m ? 'font-weight:700;color:var(--ink)' : 'color:var(--muted)'}`}>${monthShort(x)}</span></div>`)}
      </div>
    </section>

    <div class="two">
      <div class="card tile"><b style="font-size:26px">${won.length}</b><span class="sub">עסקאות שנסגרו</span></div>
      <div class="card tile"><b style="font-size:26px">${quotes.length}</b><span class="sub">הצעות מחיר שנשלחו</span></div>
      <div class="card tile"><b style="font-size:26px">${rate === null ? '—' : rate + '%'}</b><span class="sub">אחוז סגירה</span></div>
      <div class="card tile"><b style="font-size:26px">${won.length ? shekel(total / won.length) : '—'}</b><span class="sub">עסקה ממוצעת</span></div>
    </div>

    ${total > 0 && html`<section class="card" style="padding:6px 16px">${byKind.map(([k, v]) => html`<div style="padding:10px 0">
      <div style="display:flex;justify-content:space-between;font-size:15px"><span>${DEAL_KIND[k]}</span><b>${shekel(v)}</b></div>
      <div style="height:8px;border-radius:999px;background:var(--line);margin-top:6px;overflow:hidden"><div style=${`width:${(v / total) * 100}%;height:8px;border-radius:999px;background:var(--ink)`}></div></div></div>`)}</section>`}

    ${m === thisMonth && open.length > 0 && html`<div class="section-h"><span>הצעות מחיר פתוחות</span><span>${open.length}</span></div>
      <section class="card list">${open.map((d) => html`<${DealRow} key=${d.id} d=${d} ctx=${ctx} onOpen=${openDeal} />`)}</section>`}

    <div class="section-h"><span>העסקאות של ${monthName(m).split(' ')[0]}</span><span>${won.length}</span></div>
    ${won.length ? html`<section class="card list">${won.sort((a, b) => (a.closed_date < b.closed_date ? 1 : -1)).map((d) => html`<${DealRow} key=${d.id} d=${d} ctx=${ctx} onOpen=${openDeal} />`)}</section>`
      : html`<div class="card empty">עוד אין עסקאות שנסגרו בחודש הזה</div>`}

    <button class="btn" onClick=${() => openDeal({ seller_id: person.id })}>${I.plus(20)} עסקה או הצעת מחיר</button>
  </main>`;
}

function DealRow({ d, ctx, onOpen }) {
  const close = (status) => ctx.store.updateDeal(d.id, { status, closed_date: todayISO() });
  return html`<div class="row" style="align-items:flex-start">
    <button class="body" style="border:0;background:none;padding:0;text-align:right;cursor:pointer" onClick=${() => onOpen(d)}>
      <div class="t">${d.customer}</div>
      <div class="meta"><span>${DEAL_KIND[d.kind]}</span>${d.items && html`<span>· ${d.items}</span>`}
        <span>· ${d.status === 'quote' ? 'נשלחה ' + dueLabel({ due_date: d.quote_date }) : dueLabel({ due_date: d.closed_date })}</span></div>
    </button>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:none">
      <b style="font-size:16px">${d.amount != null ? shekel(d.amount) : '—'}</b>
      ${d.status === 'quote' && html`<div style="display:flex;gap:6px">
        <button class="btn sm" style="height:34px;padding:0 12px;font-size:13px" onClick=${() => close('won')}>${I.check(13)} נסגרה</button>
        <button class="btn sm ghost" style="height:34px;padding:0 12px;font-size:13px" onClick=${() => close('lost')}>לא</button></div>`}
    </div>
  </div>`;
}

function DealSheet({ ctx, deal, onClose }) {
  const isNew = !deal.id;
  const manager = ctx.me.role === 'owner';
  const [f, setF] = useState({
    customer: deal.customer || '', kind: deal.kind || 'wholesale', items: deal.items || '', amount: deal.amount ?? '',
    status: deal.status || 'quote', quote_date: deal.quote_date || todayISO(), closed_date: deal.closed_date || '',
    seller_id: deal.seller_id || ctx.me.id, notes: deal.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target ? e.target.value : e });
  const save = async (e) => {
    e.preventDefault();
    if (!f.customer.trim()) return setErr('צריך לכתוב עם מי העסקה');
    const closed = f.status !== 'quote';
    const data = { customer: f.customer.trim(), kind: f.kind, items: f.items.trim() || null, amount: f.amount === '' ? null : Number(f.amount),
      status: f.status, quote_date: f.quote_date || todayISO(), closed_date: closed ? f.closed_date || todayISO() : null, notes: f.notes.trim() || null };
    if (manager) data.seller_id = f.seller_id; // others always record their own deals (the database enforces it)
    setBusy(true);
    try { await (isNew ? ctx.store.createDeal(data, ctx.me) : ctx.store.updateDeal(deal.id, data)); onClose(); }
    catch (x) { setErr('לא נשמר: ' + x.message); setBusy(false); }
  };
  const remove = async () => { if (!confirm('למחוק את העסקה?')) return; await ctx.store.deleteDeal(deal.id); onClose(); };

  return html`<div class="scrim" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <form class="sheet" onSubmit=${save} role="dialog" aria-label=${isNew ? 'עסקה חדשה' : 'עריכת עסקה'}>
      <div class="grab"></div>
      <div class="top"><h2 class="h1" style="font-size:20px">${isNew ? 'עסקה או הצעת מחיר' : 'עסקה'}</h2>
        <button type="button" class="icon-btn" style="width:36px;height:36px;background:var(--bg);box-shadow:none" aria-label="סגירה" onClick=${onClose}>${I.x()}</button></div>
      <div><span class="lbl">סטטוס</span><div class="seg" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        ${Object.entries(DEAL_STATUS).map(([k, l]) => html`<button type="button" class=${f.status === k ? 'on' : ''} onClick=${() => set('status')(k)}>${l}</button>`)}</div></div>
      <div><label class="lbl" for="dc">לקוח</label><input id="dc" class="field soft" value=${f.customer} onInput=${set('customer')} placeholder="שם העסק או הלקוח" /></div>
      <div><span class="lbl">סוג</span><div class="seg" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        ${Object.entries(DEAL_KIND).map(([k, l]) => html`<button type="button" class=${f.kind === k ? 'on' : ''} onClick=${() => set('kind')(k)}>${l}</button>`)}</div></div>
      <div><label class="lbl" for="di">מה</label><input id="di" class="field soft" value=${f.items} onInput=${set('items')} placeholder="למשל: 50 כובעים ממותגים" /></div>
      <div class="two">
        <div><label class="lbl" for="da">סכום (₪)</label><input id="da" type="number" inputmode="decimal" dir="ltr" class="field soft" value=${f.amount} onInput=${set('amount')} /></div>
        <div><label class="lbl" for="dq">הצעה נשלחה</label><input id="dq" type="date" class="field soft" value=${f.quote_date} onInput=${set('quote_date')} /></div>
      </div>
      ${f.status !== 'quote' && html`<div><label class="lbl" for="dd">${f.status === 'won' ? 'נסגרה בתאריך' : 'תאריך'}</label>
        <input id="dd" type="date" class="field soft" value=${f.closed_date || todayISO()} onInput=${set('closed_date')} /></div>`}
      ${manager && html`<div><label class="lbl" for="ds">של מי העסקה</label><select id="ds" class="field soft" value=${f.seller_id} onChange=${set('seller_id')}>
        ${ctx.team.map((p) => html`<option value=${p.id}>${p.name}</option>`)}</select></div>`}
      <div><label class="lbl" for="dn">הערה</label><textarea id="dn" class="field soft" style="height:64px;padding:10px 12px" value=${f.notes} onInput=${set('notes')}></textarea></div>
      ${err && html`<div class="err">${err}</div>`}
      <button class="btn" disabled=${busy}>${busy ? 'שומר…' : isNew ? 'להוסיף' : 'לשמור'}</button>
      ${!isNew && html`<button type="button" class="link" style="align-self:center;color:var(--red-ink)" onClick=${remove}>למחוק</button>`}
    </form>
  </div>`;
}

/* ---------- תחומים ---------- */
function Areas({ ctx }) {
  return html`<main class="page">
    <h1 class="h1">תחומים<span style="color:var(--gold)">.</span></h1>
    <div class="sub" style="margin-top:-8px">כל תחום הוא ערוץ: המשימות שלו של כל הצוות</div>
    <section class="card list">${ctx.areas.map((a) => {
      const open = ctx.tasks.filter((t) => t.area_id === a.id && t.status !== 'done');
      const late = open.filter((t) => isOverdue(t)).length;
      return html`<a class="row" href=${'#/area/' + a.id}>
        <span class="count" style="width:40px;height:40px;border-radius:14px;font-size:18px;color:var(--muted)">#</span>
        <div class="body"><div class="t">${a.name}</div><div class="meta">${open.length ? `${open.length} פתוחות` : 'אין פתוחות'}${late ? html` <span class="pill late">${late} באיחור</span>` : ''}</div></div>
        ${I.next()}</a>`;
    })}</section>
  </main>`;
}

function AreaPage({ id, ctx, openAdd }) {
  const a = ctx.areas.find((x) => x.id === id);
  if (!a) return html`<main class="page"><div class="card empty">התחום לא נמצא</div></main>`;
  const open = ctx.tasks.filter((t) => t.area_id === id && t.status !== 'done').sort(byPriority);
  const done = ctx.tasks.filter((t) => t.area_id === id && t.status === 'done').sort((x, y) => (x.done_at < y.done_at ? 1 : -1)).slice(0, 5);
  return html`<main class="page">
    <div class="who"><a class="icon-btn" href="#/areas" aria-label="חזרה">${I.back()}</a><h1 class="h1"># ${a.name}</h1></div>
    ${!open.length && html`<div class="card empty">אין משימות פתוחות בתחום</div>`}
    <${Group} title="פתוחות" items=${open} ctx=${ctx} showWho />
    <${Group} title="בוצעו לאחרונה" items=${done} ctx=${ctx} showWho />
    <button class="btn" onClick=${() => openAdd({ area_id: id })}>${I.plus(20)} משימה ב${a.name}</button>
  </main>`;
}

/* ---------- צוות (בעלים) ---------- */
function Team({ ctx, openAdd }) {
  const today = todayISO();
  const staff = ctx.team.filter((p) => p.id !== ctx.me.id);
  const [member, setMember] = useState(null); // null closed, {} new, profile = edit
  return html`<main class="page">
    <div><div class="sub">${greeting()}, ${ctx.me.name}</div><h1 class="h1">הצוות היום<span style="color:var(--gold)">.</span></h1></div>
    ${!staff.length && html`<div class="card empty">עוד אין אנשי צוות במערכת</div>`}
    ${staff.map((p) => {
      const mine = ctx.tasks.filter((t) => t.assignee_id === p.id);
      const open = mine.filter((t) => t.status !== 'done');
      const doneToday = mine.filter((t) => t.status === 'done' && doneOn(t) === today);
      const dueToday = open.filter((t) => t.due_date && t.due_date <= today).length + doneToday.length;
      const late = open.filter((t) => isOverdue(t));
      const attention = open.filter((t) => isOverdue(t) || t.priority === 1).sort(byPriority);
      const pct = dueToday ? Math.round((doneToday.length / dueToday) * 100) : 0;
      return html`<section class="card" style="padding:16px">
        <a href=${'#/person/' + p.id} class="who" style="text-decoration:none">
          <span class="av">${initial(p)}</span>
          <div style="flex:1"><div style="font-size:17px;font-weight:700">${p.name}</div><div class="sub">${p.title || ''}</div></div>${I.next()}
        </a>
        ${!DEMO && html`<div class="sub" style="margin-top:8px">${ctx.pushOn.includes(p.id)
          ? html`<span style="color:var(--green-ink);font-weight:600">✓ התראות פועלות</span>`
          : html`<span class="pill p2">התראות כבויות</span> ${p.name} צריך ללחוץ "להפעיל התראות" באפליקציה בטלפון שלו`}</div>`}
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px">
          <div><b style="display:block;font-size:28px;font-weight:800;line-height:1">${open.length}</b><span class="sub">פתוחות</span></div>
          <div><b style="display:block;font-size:28px;font-weight:800;line-height:1">${doneToday.length}</b><span class="sub">בוצעו היום</span></div>
          <div><b style="display:block;font-size:28px;font-weight:800;line-height:1;color:${late.length ? 'var(--red-ink)' : 'inherit'}">${late.length}</b><span class="sub">באיחור</span></div>
        </div>
        <a href="#/orders" class="sub" style="display:block;margin-top:10px;text-decoration:none">הזמנות פתוחות אצלו: <b style="color:var(--ink)">${ctx.orders.filter((o) => isOpenOrder(o) && o.assignee_id === p.id).length}</b></a>
        <a href=${'#/sales/' + p.id} class="sub" style="display:flex;justify-content:space-between;margin-top:6px;text-decoration:none">
          <span>מכירות החודש: <b style="color:var(--ink)">${shekel(sum(wonIn(ctx.deals.filter((d) => d.seller_id === p.id), monthOf(today))))}</b></span><span>לסיכום החודשי ›</span></a>
        ${dueToday > 0 && html`<div class="sub" style="margin-top:12px">היום: ${doneToday.length} מתוך ${dueToday}</div>
          <div style="height:8px;border-radius:999px;background:var(--line);margin-top:6px;overflow:hidden"><div style=${`width:${pct}%;height:8px;border-radius:999px;background:var(--ink)`}></div></div>`}
      </section>
      <${Group} title="צריך תשומת לב" items=${attention} ctx=${ctx} />
      ${doneToday.length > 0 && html`<${DoneToday} items=${doneToday} ctx=${ctx} />`}
      <button class="btn" onClick=${() => openAdd({ assignee_id: p.id })}>${I.plus(20)} משימה ל${p.name}</button>`;
    })}

    <div class="section-h" style="margin-top:14px"><span>אנשי הצוות</span><span>${ctx.team.length}</span></div>
    <section class="card list">
      ${ctx.team.map((p) => html`<button class="row" style="width:100%;border:0;background:none;text-align:right" onClick=${() => setMember(p)}>
        <span class=${'av sm' + (p.role === 'owner' ? '' : ' light')}>${initial(p)}</span>
        <div class="body"><div class="t">${p.name}${p.id === ctx.me.id ? ' (אני)' : ''}</div><div class="meta">${p.title || ''}${p.role === 'owner' ? html` <span class="pill">מנהל</span>` : ''}</div></div>${I.next()}</button>`)}
      ${ctx.invites.map((i) => html`<div class="row">
        <span class="av sm light">${initial(i)}</span>
        <div class="body"><div class="t">${i.name}</div><div class="meta"><span dir="ltr">${i.email}</span> <span class="pill p2">ממתין לכניסה ראשונה</span></div></div>
        <button class="link" style="color:var(--red-ink)" onClick=${() => confirm(`לבטל את ההזמנה של ${i.name}?`) && ctx.store.cancelInvite(i.email)}>ביטול</button></div>`)}
    </section>
    <button class="btn ghost" onClick=${() => setMember({})}>${I.plus(20)} הוספת איש צוות</button>
    ${member && html`<${MemberSheet} ctx=${ctx} member=${member} onClose=${() => setMember(null)} />`}
  </main>`;
}

/* ---------- הוספה ועריכה של איש צוות (מנהל בלבד) ---------- */
function MemberSheet({ ctx, member, onClose }) {
  const isNew = !member.id;
  const self = member.id === ctx.me.id;
  const [f, setF] = useState({ name: member.name || '', title: member.title || '', email: '', role: member.role || 'staff' });
  const others = ctx.team.filter((p) => p.id !== member.id);
  const openCount = isNew ? 0 : ctx.tasks.filter((t) => t.assignee_id === member.id && t.status !== 'done').length;
  const [to, setTo] = useState(ctx.me.id === member.id ? others[0]?.id : ctx.me.id);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target ? e.target.value : e });
  const run = async (fn) => { setErr(''); setBusy(true); try { await fn(); onClose(); } catch (e) { setErr(e.message); setBusy(false); } };
  const save = (e) => {
    e.preventDefault();
    if (!f.name.trim() || (isNew && !/^\S+@\S+\.\S+$/.test(f.email.trim()))) return setErr('צריך שם ואימייל תקין');
    run(() => isNew
      ? ctx.store.invite({ name: f.name.trim(), title: f.title.trim() || null, email: f.email, role: f.role })
      : ctx.store.updateMember(member.id, { name: f.name.trim(), title: f.title.trim() || null, ...(self ? {} : { role: f.role }) }));
  };
  const remove = () => confirm(`להסיר את ${member.name} מהצוות? הגישה שלו למערכת תיחסם מיד.`) && run(() => ctx.store.removeMember(member.id, to));

  return html`<div class="scrim" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <form class="sheet" onSubmit=${save} role="dialog" aria-label=${isNew ? 'הוספת איש צוות' : 'עריכת איש צוות'}>
      <div class="grab"></div>
      <div class="top"><h2 class="h1" style="font-size:20px">${isNew ? 'הוספת איש צוות' : member.name}</h2>
        <button type="button" class="icon-btn" style="width:36px;height:36px;background:var(--bg);box-shadow:none" aria-label="סגירה" onClick=${onClose}>${I.x()}</button></div>
      <div><label class="lbl" for="mn">שם</label><input id="mn" class="field soft" value=${f.name} onInput=${set('name')} required /></div>
      <div><label class="lbl" for="mt">תפקיד</label><input id="mt" class="field soft" value=${f.title} onInput=${set('title')} placeholder="למשל: מוכר בחנות" /></div>
      ${isNew ? html`<div><label class="lbl" for="me">אימייל</label><input id="me" type="email" dir="ltr" class="field soft" value=${f.email} onInput=${set('email')} required />
        <div class="sub" style="margin-top:6px">בכניסה הראשונה הוא יכתוב את האימייל הזה ויקבל קוד. בלי סיסמה.</div></div>`
        : member.email && html`<div class="sub">אימייל: <span dir="ltr">${member.email}</span></div>`}
      ${!self && html`<div><span class="lbl">הרשאה</span><div class="seg" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        <button type="button" class=${f.role === 'staff' ? 'on' : ''} onClick=${() => set('role')('staff')}>עובד</button>
        <button type="button" class=${f.role === 'owner' ? 'on' : ''} onClick=${() => set('role')('owner')}>מנהל</button></div>
        <div class="sub" style="margin-top:6px">${f.role === 'owner' ? 'מנהל רואה את מסך הצוות, ויכול להוסיף ולהסיר אנשי צוות.' : 'עובד רואה את כל המשימות ומנהל את שלו. אין לו מסך צוות.'}</div></div>`}
      ${err && html`<div class="err">${err}</div>`}
      <button class="btn" disabled=${busy}>${busy ? 'שומר…' : isNew ? 'להזמין לצוות' : 'לשמור'}</button>
      ${!isNew && !self && html`<div style="border-top:1px solid var(--line);padding-top:14px;display:flex;flex-direction:column;gap:10px">
        ${openCount > 0 && html`<div><label class="lbl" for="mto">להעביר את ${openCount} המשימות הפתוחות שלו אל</label>
          <select id="mto" class="field soft" value=${to} onChange=${(e) => setTo(e.target.value)}>${others.map((p) => html`<option value=${p.id}>${p.name}</option>`)}</select></div>`}
        <button type="button" class="btn ghost" style="color:var(--red-ink)" disabled=${busy} onClick=${remove}>להסיר מהצוות</button></div>`}
    </form>
  </div>`;
}

/* ---------- ההגדרות שלי: התראות, סנכרון ליומן Google, יציאה ---------- */
function Me({ ctx }) {
  const [feed, setFeed] = useState(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const pushState = !pushSupported() ? (isIOSBrowser() ? 'ios' : 'none') : Notification.permission;
  const getFeed = async () => {
    setErr('');
    try {
      const token = await ctx.store.calendarToken();
      if (!token) throw new Error('אין קישור');
      const url = `${location.origin}/cal/${token}`;
      setFeed(url); return url;
    } catch (e) { setErr('לא הצלחנו ליצור קישור: ' + e.message); return null; }
  };
  const addToGoogle = async () => {
    const url = feed || (await getFeed()); if (!url) return;
    window.open('https://calendar.google.com/calendar/render?cid=' + encodeURIComponent(url.replace(/^https?:/, 'webcal:')), '_blank', 'noopener');
  };
  const copy = async () => {
    const url = feed || (await getFeed()); if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setErr('לא הצלחנו להעתיק. אפשר לסמן את הקישור ולהעתיק ידנית'); }
  };

  return html`<main class="page">
    <div class="who"><span class="av">${initial(ctx.me)}</span>
      <div><h1 class="h1">${ctx.me.name}</h1><div class="sub">${ctx.me.title || ''}${ctx.me.role === 'owner' ? ' · מנהל' : ''}</div></div></div>

    <section class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px">
      <h2 style="margin:0;font-size:17px;font-weight:700;display:flex;align-items:center;gap:8px">${I.cal(18)} סנכרון ליומן Google</h2>
      <div class="sub" style="font-size:14px;line-height:1.6">המשימות שלך שיש להן תאריך יופיעו ביומן Google כלוח נפרד בשם "משימות כתרליון". מוסיפים פעם אחת, ומשם זה מתעדכן לבד.
        גוגל מרענן את הלוח כל כמה שעות. משימה שצריכה להיכנס ליומן מיד: בתוך המשימה יש כפתור יומן.</div>
      ${DEMO ? html`<div class="pill" style="align-self:flex-start">בהדגמה הסנכרון לא פעיל</div>` : html`
        <button class="btn" onClick=${addToGoogle}>${I.cal(18)} להוסיף ליומן Google</button>
        <button class="btn ghost" onClick=${copy}>${copied ? 'הקישור הועתק ✓' : 'להעתיק קישור (לאייפון או Outlook)'}</button>
        ${feed && html`<div class="sub" dir="ltr" style="word-break:break-all;font-size:12px">${feed}</div>`}
        <div class="sub" style="font-size:13px">הקישור אישי. מי שמחזיק בו יכול לראות את המשימות שלך ביומן, ולכן לא שולחים אותו לאחרים.</div>`}
      ${err && html`<div class="err">${err}</div>`}
    </section>

    <section class="card" style="padding:16px;display:flex;flex-direction:column;gap:8px">
      <h2 style="margin:0;font-size:17px;font-weight:700">התראות לטלפון</h2>
      <div class="sub" style="font-size:14px">${pushState === 'granted' ? '✓ פועלות במכשיר הזה'
        : pushState === 'denied' ? 'חסומות במכשיר הזה. מאפשרים אותן בהגדרות הטלפון או הדפדפן'
        : pushState === 'ios' ? 'באייפון: מוסיפים את האפליקציה למסך הבית ופותחים אותה משם'
        : pushState === 'none' ? 'המכשיר או הדפדפן הזה לא תומכים בהתראות'
        : 'עוד לא הופעלו במכשיר הזה'}</div>
      ${pushState === 'default' && html`<button class="btn sm" style="align-self:flex-start" onClick=${async () => {
        if ((await Notification.requestPermission()) === 'granted') { await subscribePush().catch(() => {}); ctx.reload(); } }}>להפעיל התראות</button>`}
    </section>

    ${!DEMO && html`<button class="btn ghost" onClick=${() => store.signOut()}>${I.out()} יציאה מהמערכת</button>`}
  </main>`;
}

function NoAccess({ email }) {
  return html`<main class="login">
    <div class="wordmark">KETERLION<i>.</i></div>
    <h1 class="h1" style="font-size:30px">אין לך גישה למערכת<span style="color:var(--gold)">.</span></h1>
    <p class="sub" style="font-size:15px;margin:0">${email ? html`<span dir="ltr">${email}</span> ` : ''}לא הוזמן לצוות, או שהוסר ממנו. מנהל יכול להוסיף אותך ממסך הצוות.</p>
    <button class="btn ghost" onClick=${() => store.signOut()}>כניסה עם אימייל אחר</button>
  </main>`;
}

/* ---------- בוצעו ---------- */
function Done({ ctx }) {
  const [range, setRange] = useState('week');
  const isOwner = ctx.me.role === 'owner';
  const today = todayISO();
  const from = range === 'today' ? today : range === 'week' ? addDays(today, -6) : addDays(today, -29);
  const items = ctx.tasks.filter((t) => t.status === 'done' && doneOn(t) >= from && (isOwner || t.assignee_id === ctx.me.id))
    .sort((a, b) => (a.done_at < b.done_at ? 1 : -1));
  const days = [...new Set(items.map(doneOn))];
  return html`<main class="page">
    <h1 class="h1">מה בוצע<span style="color:var(--gold)">.</span></h1>
    <div class="seg" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      ${[['today', 'היום'], ['week', 'השבוע'], ['month', 'החודש']].map(([k, l]) => html`<button class=${range === k ? 'on' : ''} onClick=${() => setRange(k)}>${l}</button>`)}
    </div>
    <div class="card tile"><span class="sub">בוצעו ${range === 'today' ? 'היום' : range === 'week' ? 'ב-7 הימים האחרונים' : 'ב-30 הימים האחרונים'}</span><b>${items.length}</b></div>
    ${!items.length && html`<div class="card empty">עוד לא סומנו משימות כבוצעו בתקופה הזו</div>`}
    ${days.map((d) => html`<${Group} title=${dayHeading(d)} items=${items.filter((t) => doneOn(t) === d)} ctx=${ctx} showWho=${isOwner} />`)}
  </main>`;
}

/* ---------- כניסה ---------- */
function Login({ ctx }) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('email');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [people, setPeople] = useState([]);
  const [invited, setInvited] = useState([]);
  useEffect(() => { if (DEMO) { store.profiles().then((ps) => setPeople(ps.filter((p) => p.active !== false))); store.invites().then(setInvited); } }, []);

  const sendCode = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await store.sendCode(email.trim()); setStep('code'); }
    catch { setErr('לא הצלחנו לשלוח קוד. בדקו שהאימייל נכון ושהוזמנתם למערכת.'); }
    setBusy(false);
  };
  const verify = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await store.verifyCode(email.trim(), code.trim()); ctx.reload(); }
    catch { setErr('הקוד לא נכון או שפג תוקפו. אפשר לבקש קוד חדש.'); setBusy(false); }
  };

  return html`<main class="login">
    <div class="wordmark">KETERLION<i>.</i></div>
    <div><h1 class="h1" style="font-size:36px">כניסה<span style="color:var(--gold)">.</span></h1>
      <p class="sub" style="font-size:15px;margin:6px 0 0">${DEMO ? 'מצב הדגמה: בוחרים מי נכנס. הנתונים נשמרים רק בדפדפן הזה.' : 'בלי סיסמה. שולחים קוד למייל, ונכנסים איתו.'}</p></div>
    ${DEMO ? html`<section class="card list">${people.map((p) => html`<button class="row" style="width:100%;border:0;background:none;text-align:right" onClick=${async () => { await store.demoSignIn(p.id); ctx.reload(); }}>
        <span class="av">${initial(p)}</span><div class="body"><div class="t">${p.name}</div><div class="meta">${p.title || ''}</div></div>${I.next()}</button>`)}
        ${invited.map((i) => html`<button class="row" style="width:100%;border:0;background:none;text-align:right" onClick=${async () => { await store.demoClaim(i.email); ctx.reload(); }}>
        <span class="av light">${initial(i)}</span><div class="body"><div class="t">${i.name}</div><div class="meta"><span class="pill p2">הוזמן · כניסה ראשונה</span></div></div>${I.next()}</button>`)}</section>`
    : step === 'email' ? html`<form onSubmit=${sendCode} style="display:flex;flex-direction:column;gap:12px">
        <label class="lbl" for="em">אימייל</label>
        <input id="em" type="email" class="field" dir="ltr" autocomplete="email" required value=${email} onInput=${(e) => setEmail(e.target.value)} />
        <button class="btn" disabled=${busy}>${busy ? 'שולח…' : 'לשלוח לי קוד'}</button></form>`
    : html`<form onSubmit=${verify} style="display:flex;flex-direction:column;gap:12px">
        <div class="sub" style="font-size:15px">שלחנו קוד ל-<b dir="ltr">${email}</b></div>
        <label class="lbl" for="cd">הקוד מהמייל</label>
        <input id="cd" class="field" dir="ltr" inputmode="numeric" autocomplete="one-time-code" maxlength="10" style="text-align:center;letter-spacing:.35em;font-size:26px;font-weight:800" value=${code} onInput=${(e) => setCode(e.target.value.replace(/\D/g, ''))} />
        <button class="btn" disabled=${busy || code.length < 6}>${busy ? 'נכנס…' : 'להיכנס'}</button>
        <button type="button" class="link" onClick=${() => { setStep('email'); setCode(''); }}>לשלוח קוד חדש או לשנות אימייל</button></form>`}
    ${err && html`<div class="err">${err}</div>`}
  </main>`;
}

/* ---------- shell ---------- */
function Tabs({ route, me }) {
  const owner = me.role === 'owner';
  const tabs = [['today', 'היום', I.sun], ['orders', 'הזמנות', I.box], ['areas', 'תחומים', I.hash], owner ? ['team', 'צוות', I.team] : ['done', 'בוצעו', I.check]];
  const cur = route[0] || 'today';
  const active = (k) => cur === k || (k === 'areas' && cur === 'area') || (k === 'team' && cur === 'person');
  return html`<div class="tabs"><nav aria-label="ניווט">${tabs.map(([k, l, icon]) => html`
    <a class=${'tab' + (active(k) ? ' on' : '')} href=${'#/' + k} aria-current=${active(k) ? 'page' : null}><span class="bub">${k === 'done' ? I.check(20, 2) : icon(20)}</span>${l}</a>`)}</nav></div>`;
}

function App() {
  const [state, setState] = useState({ loading: true });
  const route = useRoute();
  const [sheet, setSheet] = useState(null);
  const [order, setOrder] = useState(null);
  const [deal, setDeal] = useState(null);
  const [toast, setToast] = useState(null);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 9000); return () => clearTimeout(id); }, [toast]);

  const reload = async () => {
    try {
      // Everything in one go: who I am, and the data (the database rules decide what comes back)
      const [me, profiles, areas, tasks, invites, orders, pushOn, deals] = await Promise.all([
        store.session(), store.profiles(), store.areas(), store.tasks(), store.invites().catch(() => []), store.orders(),
        store.pushStatus().catch(() => []), store.deals().catch(() => []),
      ]);
      if (!me) return setState({ loading: false, me: null });
      if (me.noAccess) return setState({ loading: false, me: null, noAccess: me });
      const owner = me.role === 'owner';
      const next = { me, profiles, areas, tasks, orders, deals, invites: owner ? invites : [], pushOn: owner ? pushOn : [] };
      saveSnapshot(next);
      setState({ loading: false, ...next, team: profiles.filter((p) => p.active !== false) });
    } catch (e) {
      // Offline or the server is slow: keep showing the last data rather than an error
      setState((s) => (s.me ? s : { loading: false, error: e.message }));
    }
  };
  useEffect(() => {
    // Open at once with the last data from this device, then refresh
    const snap = readSnapshot();
    if (snap?.me) setState({ loading: false, ...snap, team: snap.profiles.filter((p) => p.active !== false) });
    reload();
    // Many changes arrive together (a task plus its line in the thread): refresh once
    let timer;
    return onChange(() => { clearTimeout(timer); timer = setTimeout(reload, 250); });
  }, []);
  // Keep this device's notification registration fresh once permission was given
  const meId = state.me?.id;
  useEffect(() => { if (meId && pushSupported() && Notification.permission === 'granted') subscribePush().catch(() => {}); }, [meId]);

  if (state.loading) return html`<div class="login"><div class="sub">טוען…</div></div>`;
  if (state.error) return html`<div class="login"><div class="err">שגיאה: ${state.error}</div><button class="btn" onClick=${reload}>לנסות שוב</button></div>`;
  const ctx = { ...state, store, reload, toast: setToast };
  if (state.noAccess) return html`<${NoAccess} email=${state.noAccess.email} />`;
  if (!state.me) return html`<${Login} ctx=${ctx} />`;

  const openAdd = (preset = {}) => setSheet(preset);
  const openOrder = (o) => setOrder(o);
  const [r0, r1] = route;
  let view;
  if (r0 === 'task' && r1) view = html`<${TaskPage} id=${r1} ctx=${ctx} />`;
  else if (r0 === 'orders') view = html`<${Orders} ctx=${ctx} openOrder=${openOrder} />`;
  else if (r0 === 'sales') view = html`<${Sales} ctx=${ctx} personId=${r1} openDeal=${setDeal} />`;
  else if (r0 === 'areas') view = html`<${Areas} ctx=${ctx} />`;
  else if (r0 === 'area' && r1) view = html`<${AreaPage} id=${r1} ctx=${ctx} openAdd=${openAdd} />`;
  else if (r0 === 'team' && state.me.role === 'owner') view = html`<${Team} ctx=${ctx} openAdd=${openAdd} />`;
  else if (r0 === 'person' && r1) view = html`<${Today} ctx=${ctx} personId=${r1} openAdd=${openAdd} openOrder=${openOrder} />`;
  else if (r0 === 'done') view = html`<${Done} ctx=${ctx} />`;
  else if (r0 === 'me') view = html`<${Me} ctx=${ctx} />`;
  else view = html`<${Today} ctx=${ctx} openAdd=${openAdd} openOrder=${openOrder} />`;
  const onTask = r0 === 'task';

  return html`<div class="app">
    ${DEMO && html`<div style="padding:10px 16px 0"><div class="banner"><span>מצב הדגמה: הנתונים נשמרים רק בדפדפן הזה</span>
      <span style="display:flex;gap:10px"><button class="link" style="padding:0;color:inherit" onClick=${() => store.signOut()}>החלפת משתמש</button>
      <button class="link" style="padding:0;color:inherit" onClick=${() => confirm('להחזיר את נתוני ההדגמה להתחלה?') && store.resetDemo()}>איפוס</button></span></div></div>`}
    ${view}
    ${!onTask && html`<button class="fab" aria-label=${r0 === 'orders' ? 'הזמנה חדשה' : r0 === 'sales' ? 'עסקה חדשה' : 'משימה חדשה'} onClick=${() => r0 === 'orders' ? openOrder({})
      : r0 === 'sales' ? setDeal({ seller_id: salesPerson(ctx, r1).id })
      : openAdd(r0 === 'person' ? { assignee_id: r1 } : r0 === 'area' ? { area_id: r1 } : {})}>${I.plus(24)}</button>`}
    ${!onTask && html`<${Tabs} route=${route} me=${state.me} />`}
    ${sheet && html`<${AddSheet} ctx=${ctx} preset=${sheet} onClose=${() => setSheet(null)} />`}
    ${order && html`<${OrderSheet} ctx=${ctx} order=${order} onClose=${() => setOrder(null)} />`}
    ${deal && html`<${DealSheet} ctx=${ctx} deal=${deal} onClose=${() => setDeal(null)} />`}
    ${toast && html`<div class="toast" role="status"><span>${toast.text}</span>
      ${toast.href && html`<a href=${toast.href} target="_blank" rel="noopener" onClick=${() => setToast(null)}>${I.cal(15)} ${toast.action}</a>`}
      <button aria-label="סגירה" onClick=${() => setToast(null)}>${I.x(14)}</button></div>`}
  </div>`;
}

render(html`<${App} />`, document.getElementById('app'));

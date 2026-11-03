// Dates, labels and the quick-add parser. All dates are local 'YYYY-MM-DD' strings.

export const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => iso(new Date());
export const addDays = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return iso(d); };

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export const PRIORITY = {
  1: { label: 'דחוף', cls: 'p1' },
  2: { label: 'חשוב', cls: 'p2' },
  3: { label: 'רגיל', cls: 'p3' },
};
export const STATUS = { open: 'פתוחה', doing: 'בטיפול', waiting: 'מחכה', done: 'בוצעה' };

export const ORDER_SOURCE = { site: 'אתר', wholesale: 'סיטונאות', wolt: 'Wolt', store: 'חנות', other: 'אחר' };
export const ORDER_STATUS = {
  new: { label: 'חדשה', cls: 'blue' },
  preparing: { label: 'בהכנה', cls: 'p2' },
  ready: { label: 'מוכנה', cls: 'green' },
  done: { label: 'נמסרה', cls: '' },
  cancelled: { label: 'בוטלה', cls: '' },
};
// The one-tap next step for an open order
export const ORDER_NEXT = { new: ['preparing', 'להתחיל להכין'], preparing: ['ready', 'מוכנה'], ready: ['done', 'נמסרה'] };
export const isOpenOrder = (o) => !['done', 'cancelled'].includes(o.status);

export function longDate(s = todayISO()) {
  const d = new Date(s + 'T12:00');
  return `${DAYS[d.getDay()]}, ${d.getDate()} ב${MONTHS[d.getMonth()]}`;
}

// "היום 15:00", "מחר", "יום ה׳", "12.11", "אתמול"
export function dueLabel(t, today = todayISO()) {
  if (!t.due_date) return t.due_time ? t.due_time.slice(0, 5) : '';
  const diff = Math.round((new Date(t.due_date + 'T12:00') - new Date(today + 'T12:00')) / 864e5);
  let day;
  if (diff === 0) day = 'היום';
  else if (diff === 1) day = 'מחר';
  else if (diff === -1) day = 'אתמול';
  else if (diff > 1 && diff < 7) day = `יום ${DAY_LETTERS[new Date(t.due_date + 'T12:00').getDay()]}׳`;
  else { const d = new Date(t.due_date + 'T12:00'); day = `${d.getDate()}.${d.getMonth() + 1}`; }
  return t.due_time ? `${day} ${t.due_time.slice(0, 5)}` : day;
}

export const isOverdue = (t, today = todayISO()) => t.status !== 'done' && t.due_date && t.due_date < today;

export function timeAgo(ts) {
  const m = Math.round((Date.now() - new Date(ts)) / 6e4);
  if (m < 1) return 'עכשיו';
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.round(m / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  const d = new Date(ts);
  return `${d.getDate()}.${d.getMonth() + 1} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const clock = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

export function dayHeading(s, today = todayISO()) {
  if (s === today) return 'היום';
  if (s === addDays(today, -1)) return 'אתמול';
  return longDate(s);
}

// Sort: priority first, then due date and time, undated last
export function byPriority(a, b) {
  if (a.priority !== b.priority) return a.priority - b.priority;
  const ka = (a.due_date || '9999') + (a.due_time || '99');
  const kb = (b.due_date || '9999') + (b.due_time || '99');
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

// One-tap "add to Google Calendar" link, until the automatic sync is connected
export function gcalLink(t) {
  if (!t.due_date) return null;
  const d = t.due_date.replaceAll('-', '');
  let dates;
  if (t.due_time) {
    const [h, m] = t.due_time.split(':').map(Number);
    const end = `${pad((h + 1) % 24)}${pad(m)}00`;
    dates = `${d}T${pad(h)}${pad(m)}00/${d}T${end}`;
  } else {
    dates = `${d}/${addDays(t.due_date, 1).replaceAll('-', '')}`;
  }
  const q = new URLSearchParams({ action: 'TEMPLATE', text: t.title, dates, ctz: 'Asia/Jerusalem' });
  return `https://calendar.google.com/calendar/render?${q}`;
}

// Quick add: "לספור מלאי מחר 12:00 !דחוף #מלאי @ארי"
// Hebrew letters are not \w in JS regex, so words are matched between spaces.
const W = '(?=\\s|$)';
export function parseQuick(text, { areas = [], profiles = [], today = todayISO() } = {}) {
  let s = ` ${text} `;
  const out = {};
  const take = (re, fn) => { const m = s.match(re); if (m) { fn(m); s = s.replace(m[0], ' '); } };

  take(new RegExp(`\\s!\\s?(דחוף|חשוב|רגיל)${W}`), (m) => { out.priority = { 'דחוף': 1, 'חשוב': 2, 'רגיל': 3 }[m[1]]; });

  take(/\s#(\S+)/, (m) => {
    const w = m[1];
    const a = areas.find((x) => x.name.startsWith(w) || x.name.split(' ').some((p) => p.startsWith(w)) || x.id === w);
    if (a) out.area_id = a.id;
  });

  take(/\s@(\S+)/, (m) => {
    const p = profiles.find((x) => x.name.startsWith(m[1]));
    if (p) out.assignee_id = p.id;
  });

  take(new RegExp(`\\s(?:בשעה\\s|ב-?)?(\\d{1,2}):(\\d{2})${W}`), (m) => {
    if (+m[1] < 24 && +m[2] < 60) out.due_time = `${pad(+m[1])}:${m[2]}`;
  });
  if (!out.due_time) take(new RegExp(`\\s(?:בשעה\\s|ב-)(\\d{1,2})${W}`), (m) => { if (+m[1] < 24) out.due_time = `${pad(+m[1])}:00`; });

  take(new RegExp(`\\s(מחרתיים|מחר|היום)${W}`), (m) => { out.due_date = addDays(today, { 'היום': 0, 'מחר': 1, 'מחרתיים': 2 }[m[1]]); });
  if (!out.due_date) take(new RegExp(`\\s(?:ב?יום\\s)?(${DAYS.join('|')})${W}`), (m) => {
    const want = DAYS.indexOf(m[1]);
    const now = new Date(today + 'T12:00').getDay();
    out.due_date = addDays(today, (want - now + 7) % 7);
  });
  if (!out.due_date) take(new RegExp(`\\s(?:ב-?)?(\\d{1,2})[./](\\d{1,2})${W}`), (m) => {
    const y = +today.slice(0, 4);
    let d = `${y}-${pad(+m[2])}-${pad(+m[1])}`;
    if (d < today) d = `${y + 1}-${pad(+m[2])}-${pad(+m[1])}`;
    out.due_date = d;
  });
  if (out.due_time && !out.due_date) out.due_date = today;

  out.title = s.replace(/\s+/g, ' ').trim();
  return out;
}

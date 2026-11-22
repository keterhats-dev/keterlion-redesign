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

// Deals (sales a person closes): wholesale to regular customers, or a new lead
export const DEAL_KIND = { wholesale: 'לקוח קבוע', lead: 'ליד חדש' };
export const DEAL_STATUS = { quote: 'הצעה נשלחה', won: 'נסגרה', lost: 'לא נסגרה' };
export const monthOf = (s) => (s || '').slice(0, 7); // 'YYYY-MM'
export const addMonths = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
export const monthName = (m) => { const [y, mo] = m.split('-').map(Number); return `${MONTHS[mo - 1]} ${y}`; };
export const monthShort = (m) => MONTHS[Number(m.split('-')[1]) - 1].slice(0, 3) + '׳';
export const shekel = (n) => '₪' + Math.round(Number(n) || 0).toLocaleString('he-IL');

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

// Recurring tasks: repeat = { freq: 'daily' } | { freq: 'weekly', days: [0..6] } | { freq: 'monthly', day: 1..31 }
export const DAY_NAMES = DAYS;
export const DAY_LETTER = DAY_LETTERS;
export function repeatLabel(r) {
  if (!r?.freq) return '';
  if (r.freq === 'daily') return 'כל יום';
  if (r.freq === 'weekly') {
    const ds = [...(r.days?.length ? r.days : [0])].sort();
    return 'כל ' + (ds.length === 7 ? 'יום' : ds.map((d) => DAYS[d]).join(' ו'));
  }
  return `כל ${r.day || 1} בחודש`;
}
// The next date after the current one (or after today, if the task was finished late)
export function nextDue(due, r, today = todayISO()) {
  const start = !due || due < today ? today : due;
  if (r.freq === 'daily') return addDays(start, 1);
  if (r.freq === 'weekly') {
    const days = r.days?.length ? r.days : [new Date(start + 'T12:00').getDay()];
    for (let i = 1; i <= 7; i++) { const d = addDays(start, i); if (days.includes(new Date(d + 'T12:00').getDay())) return d; }
  }
  const [y, m] = start.split('-').map(Number);
  const want = r.day || Number(start.slice(8, 10));
  for (let k = 0; k <= 2; k++) {
    const mm = m - 1 + k; const yy = y + Math.floor(mm / 12); const mi = mm % 12; // mi: 0-based month
    const daysInMonth = new Date(yy, mi + 1, 0).getDate(); // the 31st becomes the 30th or the 28th
    const cand = `${yy}-${pad(mi + 1)}-${pad(Math.min(want, daysInMonth))}`;
    if (cand > start) return cand;
  }
  return addDays(start, 30);
}

// Quick add: "לספור מלאי מחר 12:00 !דחוף #מלאי @ארי"
// Hebrew letters are not \w in JS regex, so words are matched between spaces.
const W = '(?=\\s|$)';
export function parseQuick(text, { areas = [], profiles = [], today = todayISO() } = {}) {
  let s = ` ${text} `;
  const out = {};
  const take = (re, fn) => { const m = s.match(re); if (m) { fn(m); s = s.replace(m[0], ' '); } };

  // "כל יום", "כל שבוע", "כל חודש", "כל ראשון" (before the dates, so "ראשון" is not read as a date)
  let repeatWord = null;
  take(new RegExp(`\\sכל\\s(יום|שבוע|חודש|${DAYS.join('|')})${W}`), (m) => { repeatWord = m[1]; });

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
  // Repeats are read before the dates (see top); fill in the day they repeat on
  if (repeatWord === 'יום') out.repeat = { freq: 'daily' };
  else if (repeatWord === 'חודש') out.repeat = { freq: 'monthly', day: Number((out.due_date || today).slice(8, 10)) };
  else if (repeatWord === 'שבוע') out.repeat = { freq: 'weekly', days: [new Date((out.due_date || today) + 'T12:00').getDay()] };
  else if (repeatWord) {
    const d = DAYS.indexOf(repeatWord); out.repeat = { freq: 'weekly', days: [d] };
    if (!out.due_date) out.due_date = addDays(today, (d - new Date(today + 'T12:00').getDay() + 7) % 7);
  }
  if (out.repeat && !out.due_date) out.due_date = today;
  if (out.due_time && !out.due_date) out.due_date = today;

  out.title = s.replace(/\s+/g, ' ').trim();
  return out;
}

// GET /cal/<token>  (see netlify.toml)  →  an iCalendar feed of one person's dated, open tasks.
// Google Calendar subscribes to it once and refreshes it every few hours.
// The token is the person's secret from calendar_feeds; calendar_feed() only answers for a valid one.

const SB_URL = 'https://nfpxripdgwrtpqyjqelu.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mcHhyaXBkZ3dydHBxeWpxZWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2OTYyMDUsImV4cCI6MjEwOTI3MjIwNX0.8LDICmTNxND-v08xMGdbEusRiG8u9IrC7RCvCAlrnIo';
const APP = 'https://keterlion-ops.netlify.app';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIORITY = { 1: 'דחוף · ', 2: 'חשוב · ', 3: '' };

const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const pad = (n) => String(n).padStart(2, '0');
const utcStamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const nextDay = (date) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10).replaceAll('-', ''); };

// iCalendar lines are at most 75 bytes; Hebrew is 2 bytes a letter, so fold by bytes
const fold = (line) => {
  const enc = new TextEncoder(); const out = []; let cur = ''; let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
};

export default async (req) => {
  const token = new URL(req.url).searchParams.get('t') || '';
  if (!UUID.test(token)) return new Response('not found', { status: 404 });

  const r = await fetch(`${SB_URL}/rest/v1/rpc/calendar_feed`, {
    method: 'POST', headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
  });
  if (!r.ok) return new Response('not found', { status: 404 });
  const tasks = await r.json();

  const now = utcStamp(new Date());
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Keterlion//Ops//HE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:משימות כתרליון', 'X-WR-TIMEZONE:Asia/Jerusalem', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
  ];
  for (const t of tasks) {
    const day = t.due_date.replaceAll('-', '');
    lines.push('BEGIN:VEVENT', `UID:${t.id}@keterlion-ops`, `DTSTAMP:${now}`, `LAST-MODIFIED:${utcStamp(new Date(t.updated_at))}`);
    if (t.due_time) {
      const [h, m] = t.due_time.split(':').map(Number);
      const endH = Math.min(h + 1, 23), endM = h + 1 > 23 ? 59 : m;
      lines.push(`DTSTART;TZID=Asia/Jerusalem:${day}T${pad(h)}${pad(m)}00`, `DTEND;TZID=Asia/Jerusalem:${day}T${pad(endH)}${pad(endM)}00`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${nextDay(t.due_date)}`);
    }
    lines.push(
      `SUMMARY:${esc((PRIORITY[t.priority] || '') + t.title)}`,
      `DESCRIPTION:${esc(`${t.area ? '# ' + t.area + '\n' : ''}לפתוח במערכת: ${APP}/#/task/${t.id}`)}`,
      `URL:${APP}/#/task/${t.id}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');

  return new Response(lines.map(fold).join('\r\n') + '\r\n', {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=900', 'X-Robots-Tag': 'noindex' },
  });
};

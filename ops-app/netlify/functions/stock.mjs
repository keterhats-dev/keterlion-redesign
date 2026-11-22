// /.netlify/functions/stock: "חסר בחנות" against the Retail Hub (Keterlion's stock system, Lovable).
// GET  → models, colours and sizes with stock in the store (MAIN) and the warehouse (WH)
// POST { lines: [{ variant_id, product, color, size, qty }], note } →
//      a transfer draft warehouse → store in the Retail Hub, and a task for Ari here.
// Only people logged in to the ops app get in. The Retail Hub side is two functions there
// (ops_stock, ops_request_transfer, see supabase/retail-hub.sql) that answer only with the link key;
// the first call with a key links it (ops_link keeps its hash), any other key is refused.
// The key: RETAIL_HUB_KEY in Netlify if set, else app_settings.retail_hub_key in our database
// (generated there, read with SUPABASE_SERVICE_ROLE_KEY; nobody has to copy it anywhere).

const OPS_URL = 'https://nfpxripdgwrtpqyjqelu.supabase.co';
const OPS_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mcHhyaXBkZ3dydHBxeWpxZWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2OTYyMDUsImV4cCI6MjEwOTI3MjIwNX0.8LDICmTNxND-v08xMGdbEusRiG8u9IrC7RCvCAlrnIo';
const HUB_URL = 'https://fzovcxvkmnqslyztjqxg.supabase.co';
const HUB_KEY = 'sb_publishable_BiAlLmq9nPKlRPYzXOT8FQ_oeB1xd5p'; // public key of the Retail Hub
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const line = (l) => `${l.qty} × ${l.product} · ${l.color}${l.size && l.size !== 'OS' ? ' · ' + l.size : ''}`;

let linkKey = process.env.RETAIL_HUB_KEY || null;
async function getLinkKey() {
  if (linkKey) return linkKey;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!service) return null;
  const r = await fetch(`${OPS_URL}/rest/v1/app_settings?key=eq.retail_hub_key&select=value`, { headers: { apikey: service, Authorization: `Bearer ${service}` } });
  const [row] = r.ok ? await r.json() : [];
  return (linkKey = row?.value || null);
}

async function hub(fn, args) {
  const r = await fetch(`${HUB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: { apikey: HUB_KEY, Authorization: `Bearer ${HUB_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_key: await getLinkKey(), ...args }),
  });
  if (!r.ok) throw new Error(`retail hub ${r.status}`);
  return r.json();
}

export default async (req) => {
  if (!(await getLinkKey())) return json({ error: 'החיבור למערכת המלאי עוד לא הוגדר' }, 500);
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'צריך להיות מחובר' }, 401);
  const h = { apikey: OPS_ANON, Authorization: auth, 'Content-Type': 'application/json' };
  const me = await (await fetch(`${OPS_URL}/auth/v1/user`, { headers: h })).json().catch(() => null);
  if (!me?.id) return json({ error: 'צריך להיות מחובר' }, 401);
  const [profile] = await (await fetch(`${OPS_URL}/rest/v1/profiles?id=eq.${me.id}&active=eq.true&select=name`, { headers: h })).json();
  if (!profile) return json({ error: 'אין גישה' }, 403);

  if (req.method === 'GET') {
    try { return json(await hub('ops_stock', {})); } catch { return json({ error: 'לא הצלחנו לקרוא את המלאי' }, 502); }
  }
  if (req.method !== 'POST') return json({ error: 'GET or POST' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad body' }, 400); }
  const lines = (body.lines || []).filter((l) => UUID.test(l.variant_id || '') && Number(l.qty) > 0).slice(0, 100)
    .map((l) => ({ ...l, qty: Math.min(999, Math.round(Number(l.qty))) }));
  if (!lines.length) return json({ error: 'לא נבחרו פריטים' }, 400);
  const note = String(body.note || '').slice(0, 300);

  // 1. Transfer draft in the Retail Hub
  let transfer;
  try {
    transfer = await hub('ops_request_transfer', {
      p_lines: lines.map(({ variant_id, qty }) => ({ variant_id, qty })),
      p_note: `בקשה מהדשבורד: ${profile.name}${note ? ' · ' + note : ''}`,
    });
  } catch { return json({ error: 'לא הצלחנו ליצור העברה במערכת המלאי' }, 502); }

  // 2. Task for Ari (whoever is named ארי and active; a manager if there is none)
  const people = await (await fetch(`${OPS_URL}/rest/v1/profiles?active=eq.true&select=id,name,role,created_at&order=created_at`, { headers: h })).json();
  const to = people.find((p) => p.name.trim() === 'ארי') || people.find((p) => p.role === 'owner');
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const title = lines.length === 1 ? `להביא לחנות: ${line(lines[0])}` : `להביא לחנות: ${count} פריטים`;
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' });
  const tr = await fetch(`${OPS_URL}/rest/v1/tasks?select=id`, {
    method: 'POST', headers: { ...h, Prefer: 'return=representation' },
    body: JSON.stringify({
      title, area_id: 'stock', priority: 2, assignee_id: to.id, due_date: today,
      acknowledged_at: to.id === me.id ? new Date().toISOString() : null,
      notes: `מבקש/ת: ${profile.name}${note ? '\n' + note : ''}\nטיוטת העברה נוצרה במערכת המלאי: מחסן ← חנות`,
    }),
  });
  if (!tr.ok) return json({ error: 'ההעברה נוצרה, אבל המשימה לא נוצרה', transfer }, 502);
  const [task] = await tr.json();
  await fetch(`${OPS_URL}/rest/v1/checklist_items`, { method: 'POST', headers: h, body: JSON.stringify(lines.map((l, i) => ({ task_id: task.id, text: line(l), sort: i }))) });
  await fetch(`${OPS_URL}/rest/v1/comments`, { method: 'POST', headers: h, body: JSON.stringify({ task_id: task.id, kind: 'event', body: 'ביקש/ה מלאי מהמחסן' }) });
  return json({ id: task.id, transfer_id: transfer?.id });
};

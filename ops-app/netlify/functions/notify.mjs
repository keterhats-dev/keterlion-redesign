// POST /.netlify/functions/notify  { task_id } or { order_id }
// Sends a phone notification to the task's assignee, or to whoever a manager put on an order. Runs as the logged-in user:
// every read goes through Supabase with their token, so the database rules apply.
// The private notification key is the VAPID_PRIVATE_KEY environment variable in Netlify.
import webpush from 'web-push';

const SB_URL = 'https://nfpxripdgwrtpqyjqelu.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mcHhyaXBkZ3dydHBxeWpxZWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2OTYyMDUsImV4cCI6MjEwOTI3MjIwNX0.8LDICmTNxND-v08xMGdbEusRiG8u9IrC7RCvCAlrnIo';
const VAPID_PUBLIC = 'BC3VJ-k5UO3AGYgP3ZQkFDLtZc_p5nMNX3sA-FSkU6ZII-2lFQR7mbmmxifLBiVLB86U_yiNLA5Lihll7aiIXU8';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIORITY = { 1: 'דחוף · ', 2: 'חשוב · ', 3: '' };

const json = (body, status = 200) => Response.json(body, { status });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'no token' }, 401);
  if (!process.env.VAPID_PRIVATE_KEY) return json({ error: 'VAPID_PRIVATE_KEY is not set' }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad body' }, 400); }
  const { task_id: taskId, order_id: orderId } = body || {};
  if (!UUID.test(taskId || orderId || '')) return json({ error: 'bad id' }, 400);

  const h = { apikey: SB_ANON, Authorization: auth, 'Content-Type': 'application/json' };
  const get = async (path) => { const r = await fetch(`${SB_URL}${path}`, { headers: h }); return r.ok ? r.json() : null; };

  const me = await get('/auth/v1/user');
  if (!me?.id) return json({ error: 'not logged in' }, 401);
  const [author] = (await get(`/rest/v1/profiles?id=eq.${me.id}&select=name`)) || [];
  const from = author?.name || 'הצוות';
  const ddmm = (d) => d.split('-').reverse().slice(0, 2).join('.');

  let to, message;
  if (taskId) {
    const [task] = (await get(`/rest/v1/tasks?id=eq.${taskId}&select=id,title,assignee_id,priority,due_date,due_time`)) || [];
    if (!task) return json({ error: 'task not found' }, 404); // also when the caller is not on the team
    const when = task.due_date ? ` · ${ddmm(task.due_date)}${task.due_time ? ' ' + task.due_time.slice(0, 5) : ''}` : '';
    to = task.assignee_id;
    message = { title: `משימה חדשה מ${from}`, body: `${PRIORITY[task.priority] || ''}${task.title}${when}`, url: `./#/task/${task.id}`, tag: task.id };
  } else {
    const [order] = (await get(`/rest/v1/orders?id=eq.${orderId}&select=id,customer,items,due_date,assignee_id`)) || [];
    if (!order) return json({ error: 'order not found' }, 404);
    to = order.assignee_id;
    message = { title: `הזמנה בטיפולך, מ${from}`, body: `${order.customer}${order.items ? ' · ' + order.items : ''}${order.due_date ? ' · עד ' + ddmm(order.due_date) : ''}`, url: './#/orders', tag: order.id };
  }
  if (!to || to === me.id) return json({ sent: 0, reason: 'nobody else to notify' });

  const r = await fetch(`${SB_URL}/rest/v1/rpc/push_targets`, { method: 'POST', headers: h, body: JSON.stringify({ p_user: to }) });
  const targets = r.ok ? await r.json() : [];

  webpush.setVapidDetails('mailto:info@keterlion.com', VAPID_PUBLIC, process.env.VAPID_PRIVATE_KEY);
  const payload = JSON.stringify(message);

  let sent = 0;
  for (const t of targets) {
    try {
      await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, { TTL: 86400, urgency: 'high' });
      sent++;
    } catch (e) {
      // the phone unsubscribed or the app was removed: forget this device
      if (e.statusCode === 404 || e.statusCode === 410) {
        await fetch(`${SB_URL}/rest/v1/rpc/remove_push`, { method: 'POST', headers: h, body: JSON.stringify({ p_endpoint: t.endpoint }) });
      }
    }
  }
  return json({ sent, devices: targets.length });
};

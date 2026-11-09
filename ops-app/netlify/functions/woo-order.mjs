// POST /.netlify/functions/woo-order  ← WooCommerce webhook (order created / order updated) on keterlion.com
// 1. Checks the webhook signature (WOO_WEBHOOK_SECRET, the "Secret" of the webhook in WooCommerce)
// 2. Hands the order to ingest_web_order() in Supabase, which decides what to keep (paid orders only)
//    and who is responsible (web_orders_assignee in app_settings). Needs SUPABASE_SERVICE_ROLE_KEY,
//    used only for that call and for reading the devices to notify.
// 3. A new order: phone notification to the person responsible and to the managers.
import crypto from 'node:crypto';
import webpush from 'web-push';

const SB_URL = 'https://nfpxripdgwrtpqyjqelu.supabase.co';
const VAPID_PUBLIC = 'BC3VJ-k5UO3AGYgP3ZQkFDLtZc_p5nMNX3sA-FSkU6ZII-2lFQR7mbmmxifLBiVLB86U_yiNLA5Lihll7aiIXU8';
const IMAGE = /^https?:\/\/\S+\.(png|jpe?g|webp|gif|svg)(\?\S*)?$/i;

const ok = (body = 'ok', status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

// Zakeke leaves its traces in the order item's details; collect any picture of the design from there
function zakeke(items) {
  const urls = new Set();
  let custom = false;
  for (const it of items || []) {
    const text = JSON.stringify(it).toLowerCase();
    if (text.includes('zakeke')) custom = true;
    const walk = (v) => {
      if (typeof v === 'string') { if (IMAGE.test(v.trim())) urls.add(v.trim()); }
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(it.meta_data);
    if (it.image?.src && text.includes('zakeke')) urls.add(it.image.src);
  }
  return { custom, urls: [...urls].slice(0, 6) };
}

export default async (req) => {
  if (req.method !== 'POST') return ok('POST only', 405);
  const { WOO_WEBHOOK_SECRET: secret, SUPABASE_SERVICE_ROLE_KEY: service } = process.env;
  if (!secret || !service) return ok('not configured', 500);

  const raw = await req.text();
  const sig = req.headers.get('x-wc-webhook-signature');
  // WooCommerce sends an unsigned "webhook_id=…" ping when the webhook is saved: just say ok
  if (!sig) return raw.startsWith('webhook_id=') ? ok() : ok('no signature', 401);
  const expected = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('base64');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return ok('bad signature', 401);

  let o;
  try { o = JSON.parse(raw); } catch { return ok('bad body', 400); }
  if (!o?.id) return ok(); // not an order

  const name = (p) => [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
  const { custom, urls } = zakeke(o.line_items);
  const order = {
    external_id: String(o.id),
    number: String(o.number || o.id),
    status: o.status,
    customer: name(o.billing) || name(o.shipping) || 'לקוח מהאתר',
    items: (o.line_items || []).map((i) => `${i.quantity} × ${i.name}`).join(', ') || null,
    amount: o.total != null ? Number(o.total) : null,
    shipping: o.shipping_lines?.[0]?.method_title || null,
    is_custom: custom,
    design_urls: urls,
  };

  const h = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' };
  const r = await fetch(`${SB_URL}/rest/v1/rpc/ingest_web_order`, { method: 'POST', headers: h, body: JSON.stringify({ p: order }) });
  if (!r.ok) return ok('database error', 502); // WooCommerce retries failed deliveries
  const [res] = await r.json();
  if (!res?.is_new || !process.env.VAPID_PRIVATE_KEY) return ok({ kept: !!res?.order_id });

  // Notify the person responsible and the managers
  const owners = await (await fetch(`${SB_URL}/rest/v1/profiles?role=eq.owner&active=eq.true&select=id`, { headers: h })).json();
  const people = [...new Set([res.assignee_id, ...owners.map((p) => p.id)])];
  const subs = await (await fetch(`${SB_URL}/rest/v1/push_subscriptions?user_id=in.(${people.join(',')})&select=endpoint,p256dh,auth`, { headers: h })).json();
  webpush.setVapidDetails('mailto:info@keterlion.com', VAPID_PUBLIC, process.env.VAPID_PRIVATE_KEY);
  const payload = JSON.stringify({
    title: `הזמנה חדשה מהאתר #${order.number}${custom ? ' · עיצוב אישי' : ''}`,
    body: `${order.customer}${order.items ? ' · ' + order.items : ''}${order.shipping ? ' · ' + order.shipping : ''}`,
    url: './#/orders', tag: `web-${order.external_id}`,
  });
  for (const s of subs) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: 'high' }); }
    catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await fetch(`${SB_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE', headers: h });
    }
  }
  return ok({ kept: true, notified: subs.length });
};

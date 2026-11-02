/* KETERLION go-live: copy one Elementor document from staging into the document open in this editor.
   Run it in the browser console of the target page or template in Elementor, on the live site, while logged in to staging too
   (same domain, so the staging login is sent with the request).
   - Keeps every element ID, because much of the CSS points at them ([data-id="..."], .elementor-element-...).
     Tested on staging 2.11.2026: a copy of Gift Card came out the same in 12 of 13 elements, the 13th only a transparent colour written differently.
   - Swaps staging links for live links, and staging photo IDs for live ones (go-live/media-map.json).
   - Puts the target's own page number into the Custom CSS (".elementor-<staging id>" becomes ".elementor-<live id>").
     Do not replace it with "selector": on pages and on the product and archive templates Elementor turns "selector"
     into "body.elementor-page-<id>", which also reaches the header and footer (found on staging 2.11.2026).
   Usage:
     await KLCOPY(23950, { media: { 24832: { id: 31001, url: 'https://keterlion.com/wp-content/uploads/2026/11/kl-home-hero.jpg' } } })
     then check the preview, and save with $e.run('document/save/publish') when it looks right. */
window.KLCOPY = async function (stagingId, opts) {
  opts = Object.assign({ media: {}, save: 'draft' }, opts);
  const doc = elementor.documents.getCurrent();

  // 1. read the staging document
  const html = await (await fetch('/staging/wp-admin/post.php?post=' + stagingId + '&action=elementor', { credentials: 'include' })).text();
  const m = html.match(/"ajax":\{"url":"[^"]*","nonce":"([0-9a-f]+)"/);
  if (!m) throw new Error('No staging nonce. Log in to staging in this browser first.');
  const body = new URLSearchParams({
    action: 'elementor_ajax', _nonce: m[1],
    actions: JSON.stringify({ kl: { action: 'get_document_config', data: { id: stagingId } } }),
  });
  const j = await (await fetch('/staging/wp-admin/admin-ajax.php', { method: 'POST', credentials: 'include', body })).json();
  const res = j && j.data && j.data.responses && j.data.responses.kl;
  if (!res || !res.success) throw new Error('Could not read staging document ' + stagingId);
  const src = res.data;

  // 2. links: staging to live
  const live = s => s
    .split('keterlion.com/staging/').join('keterlion.com/')
    .split('keterlion.com/staging"').join('keterlion.com/"')
    .split('"/staging/').join('"/');
  const elements = JSON.parse(live(JSON.stringify(src.elements)));
  const settings = JSON.parse(live(JSON.stringify((src.settings && src.settings.settings) || {})));

  // 3. photos: staging IDs to live IDs (V4 image-attachment-id, and V3 {url, id} controls)
  const swaps = [];
  const walk = o => {
    if (!o || typeof o !== 'object') return;
    if (o.$$type === 'image-attachment-id' && opts.media[o.value]) { swaps.push(o.value); o.value = opts.media[o.value].id; }
    if ('url' in o && 'id' in o && opts.media[o.id]) { swaps.push(o.id); const t = opts.media[o.id]; o.id = t.id; o.url = t.url; }
    for (const k in o) walk(o[k]);
  };
  walk(elements);

  // 4. page settings: own page number in the CSS, and nothing about the post itself
  const keep = {};
  for (const [k, v] of Object.entries(settings)) if (!/^post_/.test(k) && k !== 'id') keep[k] = v;
  if (keep.custom_css) keep.custom_css = keep.custom_css.replace(new RegExp('\\.elementor-' + stagingId + '(?![\\w-])', 'g'), '.elementor-' + doc.id);

  // 5. replace the content, keeping the element IDs
  $e.run('document/elements/empty', { force: true });
  elements.forEach((el, i) => $e.run('document/elements/create', { container: doc.container, model: el, options: { at: i, clone: false } }));
  $e.run('document/elements/settings', { container: doc.container, settings: keep, options: { external: true } });

  // 6. left over: staging links or staging photo IDs that have no live ID yet
  const after = JSON.stringify(elements) + JSON.stringify(keep);
  const leftLinks = (after.match(/keterlion\.com\/staging/g) || []).length;
  const leftPhotos = [...new Set((after.match(/"image-attachment-id","value":(\d+)/g) || []).map(s => +s.match(/(\d+)$/)[1]).filter(id => id > 23900))];
  if (opts.save === 'draft') await $e.run('document/save/draft');
  return { stagingId, liveId: doc.id, topLevel: elements.length, photoSwaps: swaps.length, leftLinks, leftPhotos, saved: opts.save };
};

// Simta fixes for classic (non-atomic) Elementor widgets, run in the editor of a page or template (26.10.2026). Need KLLIB.

// KLFIX(id): old colours in widget settings and HTML widgets -> Simta, 2px form fields -> 1px, 4px corners on form fields and buttons,
// product images 1:1 -> 4:5 and 0 corners on fields/buttons -> 4px in the page Custom CSS. Reports classic borders of 2px or more.
window.KLFIX = async function(id){
  eval(localStorage.getItem('KLLIB')); await KL.ready(id);
  const MAP = {'#111111':'#171717','#111':'#171717','#a88a4e':'#AE8E42','#e6d6ae':'#AE8E42','#e2e2df':'#DDD3BD'};
  const res = { id, widgets:0, keys:[], html:[], css:0, borders:[] };
  const root = elementor.getPreviewContainer();
  const walk = async c => {
    const m = c.model; const t = String(m.get('widgetType') || m.get('elType'));
    if (c !== root && !t.startsWith('e-')) {
      const sr = m.get('settings'); if (!sr) { for (const k of (c.children || [])) await walk(k); return; } const s = sr.toJSON ? sr.toJSON() : sr; const ch = {};
      for (const [k, v] of Object.entries(s)) {
        if (typeof v === 'string' && MAP[v.toLowerCase()]) ch[k] = MAP[v.toLowerCase()];
        if (v && typeof v === 'object' && /border_width/.test(k) && ['top','right','bottom','left'].some(x => parseFloat(v[x]) >= 2)) res.borders.push(c.id + ' ' + t + ' ' + k + '=' + [v.top,v.right,v.bottom,v.left].join('/') + v.unit);
      }
      if (t === 'html' && typeof s.html === 'string') {
        let h = s.html; const b = h;
        h = h.replace(/2px solid (#111111|#111|#171717)/gi, '1px solid #DDD3BD').replace(/#111111\b/gi, '#171717').replace(/#111\b/gi, '#171717').replace(/#A88A4E/gi, '#AE8E42').replace(/#E6D6AE/gi, '#AE8E42').replace(/#E2E2DF/gi, '#DDD3BD');
        if (h !== b) { ch.html = h; res.html.push(c.id); }
      }
      if (t === 'form') { const bwv = s.field_border_width; if (bwv && ['top','right','bottom','left'].some(x => parseFloat(bwv[x]) >= 2)) ch.field_border_width = {unit:'px', top:'1', right:'1', bottom:'1', left:'1', isLinked:true}; ch.field_border_radius = {unit:'px', top:'4', right:'4', bottom:'4', left:'4', isLinked:true}; ch.button_border_radius = {unit:'px', top:'4', right:'4', bottom:'4', left:'4', isLinked:true}; }
      if (Object.keys(ch).length) { await $e.run('document/elements/settings', { container: c, settings: ch }); res.widgets++; res.keys.push(c.id + ':' + Object.keys(ch).join(',')); }
    }
    for (const k of (c.children || [])) await walk(k);
  };
  await walk(root);
  const page = elementor.settings.page.model; const before = page.get('custom_css') || '';
  const after = before.replace(/([^{}]*li\.product[^{}]*\{[^}]*?)aspect-ratio:\s*1(?:\s*\/\s*1)?(?=\s*[;}])/g, '$1aspect-ratio:4 / 5');
  const after2 = after.replace(/([^{}]*(?:elementor-field|elementor-button|form-field)[^{}]*\{[^}]*?)border-radius:\s*0(?:px)?(\s*!important)?/g, '$1border-radius:4px$2').replace(/([^{}]*elementor-button[^{}]*\{[^}]*?)font-weight:\s*900/g, '$1font-weight:700');
  if (after2 !== before) { await KL.pageCss(after2); res.css = 1; }
  res.err = (res.widgets || res.css) ? await KL.save() : 'nochange';
  return res;
};

// KLOLDBORDER(): old-site classic sections with a light grey pill frame and gallery images with 5px grey frames and 20px corners
// -> 1px beige line, square corners (gallery 6994, video 6989).
window.KLOLDBORDER = async function(){
  eval(localStorage.getItem('KLLIB'));
  const Z = {unit:'px', top:'0', right:'0', bottom:'0', left:'0', isLinked:true}, ONE = {unit:'px', top:'1', right:'1', bottom:'1', left:'1', isLinked:true};
  const out = []; const walk = async c => { const m = c.model; const sr = m.get('settings'); if (sr && c !== elementor.getPreviewContainer()) { const s = sr.toJSON ? sr.toJSON() : sr; const t = m.get('widgetType') || m.get('elType'); const ch = {};
    if (['section','column','container'].includes(t) && s.border_border === 'solid' && /^#D5D5D5/i.test(s.border_color || '')) { ch.border_width = ONE; ch.border_color = '#DDD3BD'; ch.border_radius = Z; }
    if (t === 'gallery' && s.image_border_width && parseFloat(s.image_border_width.size) >= 2) { ch.image_border_width = {unit:'px', size:1, sizes:[]}; ch.image_border_color = '#DDD3BD'; ch.image_border_radius = {unit:'px', size:0, sizes:[]}; }
    if (Object.keys(ch).length) { await $e.run('document/elements/settings', { container: c, settings: ch }); out.push(c.id + ' ' + t + ':' + Object.keys(ch).join(',')); } }
    for (const k of (c.children || [])) await walk(k); };
  await walk(elementor.getPreviewContainer());
  return { out, err: out.length ? await KL.save() : 'nochange' };
};

// KLSTEPS(): the cart/checkout steps bar (HTML widget on 235 and 236): 2px frames and connector -> 1px.
window.KLSTEPS = async function(){
  eval(localStorage.getItem('KLLIB')); const out = [];
  const walk = async c => { if (!c || !c.model) return; if (c.model.get('widgetType') === 'html') { const h = c.model.get('settings').get('html') || ''; const n = h.replace(/border:2px solid #DDD3BD/g, 'border:1px solid #DDD3BD').replace(/\.kl-steps i\{flex:0 0 16px;height:2px;/g, '.kl-steps i{flex:0 0 16px;height:1px;'); if (n !== h) { await $e.run('document/elements/settings', { container: c, settings: { html: n } }); out.push(c.id); } } for (const k of (c.children || [])) await walk(k); };
  await walk(elementor.getPreviewContainer());
  return { out, err: out.length ? await KL.save() : 'nochange' };
};

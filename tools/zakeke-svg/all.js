// Traces every gallery design (one PNG per design, picked by pick.ps1) into a flat SVG whose fills are colours
// from the Zakeke "PC" palette, saves each SVG through the local helper (serve2.ps1, POST), and builds a review
// sheet. Runs on http://127.0.0.1:8767/all.html only; nothing is sent to Zakeke.
// overrides.json (optional): { "<categoryId>": { "classes": ["#ff0000", "#3cb371", "#000000"] } } fixes the thread
// colours of a multi-colour design instead of the automatic suggestion.
(async function () {
  const S = location.origin + '/';
  const PAL = ['#000000', '#ffffff', '#808080', '#c0c0c0', '#000080', '#0909ff', '#006a4e', '#3cb371', '#808000', '#f2f0df',
    '#ffff00', '#ffa500', '#ca762b', '#804a00', '#ff0000', '#ffc0cb', '#b93b8f', '#ff69b4', '#004400', '#ff5f1f'];
  const designs = await (await fetch(S + 'out/all/designs.json', { cache: 'no-store' })).json();
  let over = {}; try { over = await (await fetch(S + 'overrides.json', { cache: 'no-store' })).json(); } catch (e) { }
  const only = new URLSearchParams(location.search).get('only'); // e.g. ?only=multi or ?only=88482
  const post = (name, body) => fetch(S + name, { method: 'POST', body });
  const load = src => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
  const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lab = (r, g, b) => {
    r = lin(r); g = lin(g); b = lin(b);
    let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; x = f(x); y = f(y); z = f(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  // embroidery shading changes lightness a lot and hue very little, so hue counts most and lightness least
  const dist = (p, q) => {
    const Cp = Math.hypot(p[1], p[2]), Cq = Math.hypot(q[1], q[2]), dL = p[0] - q[0], dC = Cp - Cq;
    const dH2 = Math.max(0, (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2 - dC * dC);
    return Math.sqrt((dL * 0.35) ** 2 + (dC * 0.5) ** 2 + dH2 * 2);
  };
  const PLAB = PAL.map(h => lab(...hexRgb(h)));
  const nearestPal = c => { let b = 0, bd = 1e9; PLAB.forEach((q, i) => { const d = dist(c, q); if (d < bd) { bd = d; b = i; } }); return b; };

  // automatic suggestion: k-means (k=6) in Lab on opaque pixels, centres mapped to the palette, small groups dropped
  function suggest(L, idx) {
    const step = Math.max(1, Math.floor(idx.length / 20000)), smp = []; for (let i = 0; i < idx.length; i += step) smp.push(idx[i]);
    const K = Math.min(6, smp.length); const cen = [L.slice(smp[0] * 3, smp[0] * 3 + 3)];
    while (cen.length < K) { // farthest point init, deterministic
      let bi = smp[0], bd = -1; for (const i of smp) { const p = L.slice(i * 3, i * 3 + 3); const d = Math.min(...cen.map(c => dist(p, c))); if (d > bd) { bd = d; bi = i; } }
      cen.push(L.slice(bi * 3, bi * 3 + 3));
    }
    const asg = new Int32Array(smp.length);
    for (let it = 0; it < 12; it++) {
      const sum = cen.map(() => [0, 0, 0, 0]);
      smp.forEach((i, j) => { const p = [L[i * 3], L[i * 3 + 1], L[i * 3 + 2]]; let b = 0, bd = 1e9; cen.forEach((c, k) => { const d = dist(p, c); if (d < bd) { bd = d; b = k; } }); asg[j] = b; const s = sum[b]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
      sum.forEach((s, k) => { if (s[3]) cen[k] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
    }
    const share = {}; asg.forEach(k => { const p = nearestPal(cen[k]); share[p] = (share[p] || 0) + 1; });
    return Object.entries(share).filter(([, n]) => n / smp.length >= 0.015).sort((a, b) => b[1] - a[1]).map(([p, n]) => ({ hex: PAL[p], share: n / smp.length }));
  }

  const meta = []; const cards = [];
  const todo = designs.filter(d => !only || (only === 'multi' ? d.mode === 'multi' : String(d.cat) === only));
  for (const d of todo) {
    const img = await load(S + 'src/all/' + d.cat + '.png');
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const px = x.getImageData(0, 0, W, H).data;
    const L = new Float32Array(W * H * 3), idx = [];
    for (let i = 0; i < W * H; i++) if (px[i * 4 + 3] >= 110) { idx.push(i); const l = lab(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); L[i * 3] = l[0]; L[i * 3 + 1] = l[1]; L[i * 3 + 2] = l[2]; }
    let fills, auto = null;
    if (over[d.cat] && over[d.cat].classes) fills = over[d.cat].classes.map(h => h.toLowerCase());
    else if (d.mode === 'single') fills = ['#000000'];
    else { auto = suggest(L, idx); fills = auto.map(a => a.hex); }
    const FL = fills.map(h => lab(...hexRgb(h)));
    // 1. classify: 0 = background, 1..n = thread colour
    let cls = new Uint8Array(W * H);
    for (const i of idx) {
      if (fills.length === 1) { cls[i] = 1; continue; }
      const p = [L[i * 3], L[i * 3 + 1], L[i * 3 + 2]]; let b = 0, bd = 1e9; FL.forEach((q, k) => { const dd = dist(p, q); if (dd < bd) { bd = dd; b = k; } }); cls[i] = b + 1;
    }
    // 2. majority filter, twice, to drop single-stitch specks
    const K = fills.length + 1;
    for (let pass = 0; pass < 2; pass++) {
      const n = new Uint8Array(cls);
      for (let y = 1; y < H - 1; y++) for (let x0 = 1; x0 < W - 1; x0++) {
        const cnt = new Array(K).fill(0);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) cnt[cls[(y + dy) * W + x0 + dx]]++;
        let best = 0; for (let k = 1; k < K; k++) if (cnt[k] > cnt[best]) best = k;
        n[y * W + x0] = best;
      }
      cls = n;
    }
    // 3. flat image in palette colours, then trace
    const pal = [{ r: 255, g: 255, b: 255, a: 0 }].concat(fills.map(h => { const [r, g, b] = hexRgb(h); return { r, g, b, a: 255 }; }));
    const flat = new ImageData(W, H);
    for (let i = 0; i < W * H; i++) { const p = pal[cls[i]]; flat.data[i * 4] = p.r; flat.data[i * 4 + 1] = p.g; flat.data[i * 4 + 2] = p.b; flat.data[i * 4 + 3] = p.a; }
    let svg = ImageTracer.imagedataToSVG(flat, { ltres: 1, qtres: 1, pathomit: 20, colorsampling: 0, numberofcolors: pal.length, colorquantcycles: 1, pal, strokewidth: 0, linefilter: false, roundcoords: 1, viewbox: true, desc: false, blurradius: 0 });
    // 4. keep only the thread layers, hex fills, no strokes, explicit size
    svg = svg.replace(/<path[^>]*opacity="0"[^>]*\/>/g, '')
      .replace(/ stroke="[^"]*"/g, '').replace(/ stroke-width="[^"]*"/g, '').replace(/ opacity="1"/g, '')
      .replace(/ desc="[^"]*"/g, '')
      .replace(/fill="rgb\((\d+),(\d+),(\d+)\)"/g, (m, r, g, b) => 'fill="#' + [r, g, b].map(v => (+v).toString(16).padStart(2, '0')).join('') + '"')
      .replace('<svg viewBox="0 0 ' + W + ' ' + H + '"', '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '"');
    const used = fills.filter(h => svg.includes('fill="' + h + '"'));
    await post('out/all/svg/' + d.cat + '.svg', svg);
    // thumbnail of the original for the self-contained review sheet
    const t = document.createElement('canvas'), s = Math.min(1, 240 / Math.max(W, H)); t.width = Math.round(W * s); t.height = Math.round(H * s);
    t.getContext('2d').drawImage(img, 0, 0, t.width, t.height);
    const m = { cat: d.cat, macro: d.macro, sub: d.sub, n: d.n, h: d.h, w: d.w, mode: d.mode, fills: used, auto, paths: (svg.match(/<path/g) || []).length, kb: Math.round(svg.length / 1024), override: !!(over[d.cat] && over[d.cat].classes) };
    meta.push(m); cards.push({ m, svg, orig: t.toDataURL('image/png') });
  }
  if (!only) await post('out/all/svgmeta.json', JSON.stringify(meta, null, 1));
  // 5. review sheet
  const uri = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  const sample = (m, svg) => { // show that the colour can change: single → red, multi → first layer to navy
    const from = m.fills[0], to = m.fills.length === 1 ? '#ff0000' : (from === '#000080' ? '#ffa500' : '#000080');
    return svg.split('fill="' + from + '"').join('fill="' + to + '"');
  };
  const dot = h => `<i style="background:${h}"></i>`;
  let body = `<h1>הגלריה כ-SVG: עיצוב אחד במקום ${designs.reduce((a, d) => a + d.n, 0)} תמונות</h1>
<p class="sub">${todo.length} עיצובים. בכל שורה: התמונה היום ← SVG בצבע ברירת המחדל ← דוגמה לצביעה מחדש. הכול מקומי, ב-Zakeke לא השתנה כלום</p>`;
  let last = '';
  for (const { m, svg, orig } of cards) {
    if (m.macro !== last) { body += `<h2>${m.macro}</h2>`; last = m.macro; }
    body += `<article class="${m.mode}"><div class="row"><div class="tile"><img src="${orig}"></div><div class="tile"><img src="${uri(svg)}"></div><div class="tile"><img src="${uri(sample(m, svg))}"></div></div>
<h3>${m.sub}</h3><p>${m.n} תמונות ← 1 · ${m.h ? m.h + '×' + m.w + ' מ"מ' : 'בלי גודל'} · <span class="dots">${m.fills.map(dot).join('')}</span> ${m.fills.length > 1 ? m.fills.length + ' צבעים' : 'צבע אחד'}${m.override ? ' (ידני)' : ''}</p></article>`;
  }
  const css = `body{margin:0;background:#fff;color:#171717;font-family:Heebo,Arial,sans-serif;padding:24px 28px}
h1{font-weight:900;font-size:26px;margin:0 0 4px}h1::after{content:".";color:#AE8E42}.sub{color:#6B6B69;margin:0 0 8px;font-size:14px}
h2{font-weight:500;font-size:19px;margin:22px 0 8px;padding-top:12px;border-top:1px solid #DDD3BD;width:100%}
main{display:flex;flex-wrap:wrap;gap:18px 22px}article{width:330px}article.multi .tile{outline:1px dashed #AE8E42}
.row{display:flex;gap:6px}.tile{width:106px;height:96px;background:#F4F4F2;display:flex;align-items:center;justify-content:center}
.tile img{max-width:88%;max-height:88%}h3{font-weight:500;font-size:14px;margin:6px 0 0}p{font-size:12px;color:#6B6B69;margin:2px 0 0}
.dots i{display:inline-block;width:10px;height:10px;border-radius:50%;border:1px solid #DDD3BD;margin-left:2px;vertical-align:-1px}`;
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>הגלריה כ-SVG</title><style>${css}</style></head><body>${body.replace(/<h2>/, '<main><h2>').replace(/$/, '</main>')}</body></html>`;
  await post('out/all/review' + (only ? '-' + only : '') + '.html', html);
  document.open(); document.write(html); document.close();
  window.__result = { n: meta.length, multi: meta.filter(m => m.mode === 'multi').map(m => ({ cat: m.cat, sub: m.sub, fills: m.fills, auto: m.auto && m.auto.map(a => a.hex + ':' + Math.round(a.share * 100) + '%') })), big: meta.filter(m => m.kb > 40).map(m => m.sub + ' ' + m.kb + 'KB') };
  window.__done = true;
})().catch(e => { window.__error = String(e && e.stack || e); window.__done = true; document.body.insertAdjacentText('afterbegin', 'שגיאה: ' + window.__error); });

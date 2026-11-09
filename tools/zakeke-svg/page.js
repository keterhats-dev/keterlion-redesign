// Converts the embroidery PNGs (transparent background) into flat SVGs whose fills are colours from the
// Zakeke "PC" printing-method palette, then lays out a before/after comparison. Runs in a local page only.
(async function () {
  const T = window.KL_DESIGNS; // [{id, title, src, mode: 'single'|'multi', fill | classes}]
  const load = src => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
  const hsv = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return [h, mx ? d / mx : 0, mx]; };
  const hexRgb = h => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16), a: 255 });
  const out = {};
  for (const d of T) {
    const img = await load(d.src);
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const px = x.getImageData(0, 0, W, H).data;
    // 1. classify every pixel: 0 = background, 1..n = thread colour
    let cls = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const a = px[i * 4 + 3]; if (a < 110) continue;
      if (d.mode === 'single') { cls[i] = 1; continue; }
      const [h, s, v] = hsv(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
      cls[i] = (v < 0.3 || s < 0.3) ? 3 : (h > 70 && h < 170 ? 2 : 1); // 1 red, 2 green, 3 black
    }
    // 2. majority filter, twice, to drop single-stitch specks
    for (let pass = 0; pass < 2; pass++) {
      const n = new Uint8Array(cls);
      for (let y = 1; y < H - 1; y++) for (let x0 = 1; x0 < W - 1; x0++) {
        const cnt = [0, 0, 0, 0];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) cnt[cls[(y + dy) * W + x0 + dx]]++;
        let best = 0; for (let k = 1; k < 4; k++) if (cnt[k] > cnt[best]) best = k;
        n[y * W + x0] = best;
      }
      cls = n;
    }
    // 3. flat image in palette colours, then trace
    const fills = d.mode === 'single' ? [d.fill] : d.classes;
    const pal = [{ r: 255, g: 255, b: 255, a: 0 }].concat(fills.map(hexRgb));
    const flat = new ImageData(W, H);
    for (let i = 0; i < W * H; i++) { const p = pal[cls[i]]; flat.data[i * 4] = p.r; flat.data[i * 4 + 1] = p.g; flat.data[i * 4 + 2] = p.b; flat.data[i * 4 + 3] = p.a; }
    let svg = ImageTracer.imagedataToSVG(flat, { ltres: 1, qtres: 1, pathomit: 20, colorsampling: 0, numberofcolors: pal.length, colorquantcycles: 1, pal, strokewidth: 0, linefilter: false, roundcoords: 1, viewbox: true, desc: false, blurradius: 0 });
    // 4. keep only the thread layers, hex fills, no strokes
    svg = svg.replace(/<path[^>]*opacity="0"[^>]*\/>/g, '')
      .replace(/ stroke="[^"]*"/g, '').replace(/ stroke-width="[^"]*"/g, '').replace(/ opacity="1"/g, '')
      .replace(/fill="rgb\((\d+),(\d+),(\d+)\)"/g, (m, r, g, b) => 'fill="#' + [r, g, b].map(v => (+v).toString(16).padStart(2, '0')).join('') + '"');
    out[d.id] = { svg, w: W, h: H, paths: (svg.match(/<path/g) || []).length, bytes: svg.length };
  }
  // 5. comparison page
  const recolor = (svg, map) => Object.keys(map).reduce((s, k) => s.split('fill="' + k + '"').join('fill="' + map[k] + '"'), svg);
  const uri = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  const card = (label, inner, bg) => `<figure><div class="tile" style="background:${bg}">${inner}</div><figcaption>${label}</figcaption></figure>`;
  const capCard = (label, src) => `<figure><div class="tile cap"><img class="capimg" src="${window.KL_CAP}"><img class="on" src="${src}"></div><figcaption>${label}</figcaption></figure>`;
  let html = '<h1>בדיקה: רקמה כ-SVG עם בחירת צבע</h1><p class="sub">משמאל לימין: היום (תמונה לכל צבע) ← SVG אחד שהלקוח צובע. הכול מקומי, ב-Zakeke לא השתנה כלום</p>';
  for (const d of T) {
    const o = out[d.id];
    html += `<section><h2>${d.title}</h2><div class="row">`;
    html += card('היום: PNG עם תפרים', `<img src="${d.src}">`, '#F4F4F2');
    html += card('SVG, אותו צבע', `<img src="${uri(o.svg)}">`, '#F4F4F2');
    for (const v of d.variants) html += v.cap ? capCard(v.label, uri(recolor(o.svg, v.map))) : card(v.label, `<img src="${uri(recolor(o.svg, v.map))}">`, v.bg || '#F4F4F2');
    html += `</div><p class="meta">${o.paths} צורות · ${(o.bytes / 1024).toFixed(0)}KB</p></section>`;
  }
  document.getElementById('app').innerHTML = html;
  await new Promise(r => setTimeout(r, 1500));
  window.__result = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v]));
  window.__done = true;
})().catch(e => { window.__error = String(e && e.stack || e); window.__done = true; });

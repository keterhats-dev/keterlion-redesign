/* KL Studio – custom cap designer (front end).
   Reads its configuration from <script type="application/json" id="kls-config">, renders into #kl-studio,
   uploads logos and adds the finished cap to the WooCommerce cart through the plugin's wc-ajax endpoints.
   Prices shown here are a preview: the server recalculates every price in the cart. */
(function () {
  'use strict';
  var root = document.getElementById('kl-studio');
  var cfgEl = document.getElementById('kls-config');
  if (!root || !cfgEl) return;
  var C = JSON.parse(cfgEl.textContent);
  var SIDES = C.sides;                       // ['front','right','left','back']
  var LABEL = C.sideLabels;                  // {front:'חזית',...}
  var IMG = C.imageSize || 1024;
  var VB0 = C.viewBox || [112, 112, 800, 800]; // fallback crop of the 1024px side photos (square)
  function vbox(side) { // per photo (else per shape and side), so the cap fills the frame
    var v = variant(), sd = C.shapes[v.shape].sides[side];
    return (v.vb && v.vb[side]) || (sd && sd.vb) || VB0;
  }
  var TYPE_PRICE = C.prices.type, EXTRA = C.prices.extra, TIERS = C.prices.tiers, MAXQ = C.prices.maxQty;
  var THREAD = C.threads, FONTS = C.fonts;
  var STEPS = ['כובע', 'עיצוב', 'כמות', 'סיכום'];
  var GALLERY = [], CATS = [];
  var KEY = 'kls-state-v1';

  /* ---------- state ---------- */
  function blankItem(side) {
    return { type: null, id: null, thread: null, w: side === 'front' ? 6 : 4, text: '', font: FONTS[0].id, h: side === 'front' ? 1.4 : 1, logo: null, ok: false, dx: 0, dy: 0 };
  }
  var S = null;
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (!S || !S.items || !variantById(S.variant)) {
    var first = C.variants.find(function (v) { return v.stock && v.slug.indexOf('שחור') === 0; }) || C.variants.find(function (v) { return v.stock; }) || C.variants[0];
    S = { step: 0, shape: first.shape, variant: first.id, view: 'front', side: 'front', qty: 1, cat: 'הכול', items: {} };
  }
  SIDES.forEach(function (s) { if (S.items[s] && S.items[s].logo && !S.items[s].logo.token) S.items[s].logo = null; });
  if (S.qty > MAXQ) S.qty = MAXQ;
  if (S.step === 0) S.view = 'front';
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return C.currency + Math.round(n).toLocaleString('he-IL'); }
  function variantById(id) { return C.variants.find(function (v) { return v.id === +id; }); }
  function variants() { return C.variants.filter(function (v) { return v.shape === S.shape; }); }
  function variant() { return variantById(S.variant) || variants()[0]; }
  function shape() { return C.shapes[S.shape]; }
  function geo(side, v) {
    v = v || variant();
    var sd = C.shapes[v.shape].sides[side];
    var c = side === 'front' ? v.front : [sd.cx, sd.cy];
    var k = (v.ppcm && v.ppcm[side]) || sd.ppcm; // px per cm, measured from the cap's real width in this photo
    return { cx: IMG / 2 + c[0], cy: IMG / 2 + c[1], k: k, maxW: sd.maxW, maxH: sd.maxH };
  }
  function limits(side) { var sd = shape().sides[side]; return { maxW: sd.maxW, maxH: sd.maxH }; }
  function thread(code) { return THREAD.find(function (t) { return t.code === code; }) || THREAD[0]; }
  function font(id) { return FONTS.find(function (f) { return f.id === id; }) || FONTS[0]; }
  function hasHeb(t) { return /[֐-׿]/.test(t || ''); }
  function hasLat(t) { return /[A-Za-z]/.test(t || ''); }
  // the shop's Hebrew embroidery fonts have no English letters (and the English ones no Hebrew):
  // Hebrew text gets the Hebrew fonts, English text the English ones, empty text all of them
  function fontsFor(t) {
    if (hasHeb(t)) return FONTS.filter(function (f) { return f.he; });
    if (hasLat(t)) return FONTS.filter(function (f) { return f.en; });
    return FONTS;
  }
  function sampleFor(f, t) { var s = (t || '').trim().slice(0, 4); return s || (f.he ? 'אבג' : 'Abc'); }
  function design(id) { return GALLERY.find(function (g) { return g.id === id; }); }
  function item(side) { return S.items[side]; }
  function filled(it) {
    if (!it || !it.type) return false;
    if (it.type === 'gallery') return !!it.id;
    if (it.type === 'text') return it.text.trim().length > 0;
    if (it.type === 'logo') return !!it.logo;
    return false;
  }
  function active() { return SIDES.filter(function (s) { return filled(item(s)); }); }
  function light(hex) { var n = parseInt(hex.slice(1), 16); return ((n >> 16) * 299 + (n >> 8 & 255) * 587 + (n & 255) * 114) / 1000 > 150; }
  function contrastThread() { return light(variant().hex) ? THREAD[0].code : (THREAD.find(function (t) { return light(t.hex); }) || THREAD[1]).code; }
  function ensure(side) { if (!S.items[side]) S.items[side] = blankItem(side); if (!S.items[side].thread) S.items[side].thread = contrastThread(); return S.items[side]; }

  /* ---------- pricing (mirrors includes/pricing.php) ---------- */
  function tier(q) { return TIERS.find(function (t) { return q >= t.min && q <= t.max; }); }
  function perCap() {
    var base = variant().price, list = active();
    if (!list.length) return base;
    var first;
    if (S.qty === 1) { first = 0; list.forEach(function (s) { first = Math.max(first, TYPE_PRICE[item(s).type]); }); }
    else { var t = tier(S.qty); first = t ? t.add : 0; }
    return base + first + EXTRA * (list.length - 1);
  }

  /* ---------- geometry ---------- */
  var measure = document.createElement('canvas').getContext('2d');
  function textWidth(txt, f, size) { measure.font = f.w + ' ' + size + 'px ' + f.css; return measure.measureText(txt).width; }
  // sizes in units of 10 = 1 cm
  function designSize(side, it) {
    var L = limits(side), maxW = L.maxW * 10, maxH = L.maxH * 10, w, h;
    if (it.type === 'gallery') {
      var g = design(it.id); if (!g) return null; var vb = g.vb;
      w = it.w * 10; h = w * vb[3] / vb[2];
      if (w > maxW) { w = maxW; h = w * vb[3] / vb[2]; }
      if (h > maxH) { h = maxH; w = h * vb[2] / vb[3]; }
      return { w: w, h: h, fit: w < it.w * 10 - 0.5 };
    }
    if (it.type === 'text') {
      var f = font(it.font), fs = it.h * 10 / 0.72, tw = textWidth(it.text, f, fs), fit = false;
      if (tw > maxW) { fs = fs * maxW / tw; tw = maxW; fit = true; }
      if (fs * 0.72 > maxH) { fs = maxH / 0.72; tw = textWidth(it.text, f, fs); fit = true; }
      return { w: tw, h: fs * 0.72, fs: fs, font: f, fit: fit };
    }
    if (it.type === 'logo' && it.logo) {
      w = it.w * 10; h = w / it.logo.ar;
      if (w > maxW) { w = maxW; h = w / it.logo.ar; }
      if (h > maxH) { h = maxH; w = h * it.logo.ar; }
      return { w: w, h: h, fit: w < it.w * 10 - 0.5 };
    }
    return null;
  }
  /* offset of the design from the area centre, in cm, clamped so it stays inside the area */
  function offset(side, it, sz) {
    var L = limits(side), mx = Math.max(0, (L.maxW * 10 - sz.w) / 20), my = Math.max(0, (L.maxH * 10 - sz.h) / 20);
    it.dx = Math.max(-mx, Math.min(mx, +it.dx || 0)); it.dy = Math.max(-my, Math.min(my, +it.dy || 0));
    return [it.dx, it.dy];
  }
  function designSVG(side, editing, G) {
    var it = item(side), out = '', f = G.k / 10, ink = light(variant().hex) ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.7)';
    if (editing) {
      // the dashed area shows only while the side is empty or while moving/resizing; otherwise it is an invisible target
      var bw = G.maxW * G.k, bh = G.maxH * G.k, showArea = !filled(it) || drag || pinch;
      out += '<rect class="kls-area" x="' + (G.cx - bw / 2) + '" y="' + (G.cy - bh / 2) + '" width="' + bw + '" height="' + bh + '" fill="rgba(0,0,0,0)" stroke="' + (showArea ? ink : 'none') + '" stroke-dasharray="8 6" stroke-width="2.5"/>';
    }
    if (!filled(it)) return out;
    var sz = designSize(side, it); if (!sz) return out;
    var o = offset(side, it, sz);
    G = { cx: G.cx + o[0] * G.k, cy: G.cy + o[1] * G.k, k: G.k, maxW: G.maxW, maxH: G.maxH };
    var w = sz.w * f, h = sz.h * f, col = thread(it.thread).hex;
    var sel = '';
    if (editing) {
      // sizes in screen pixels, converted to drawing units, so the handle is easy to grab on a phone
      var cw = ($('kls-canvas') && $('kls-canvas').clientWidth) || 600, u = vbox(side)[2] / cw;
      var pad = 5 * u, hx = G.cx - w / 2 - pad, hy = G.cy + h / 2 + pad, a = 5 * u;
      // the frame and the handle show only while the customer touches or hovers the design (selActive)
      sel = '<rect class="kls-grab" x="' + (G.cx - w / 2 - pad) + '" y="' + (G.cy - h / 2 - pad) + '" width="' + (w + pad * 2) + '" height="' + (h + pad * 2) + '" fill="rgba(0,0,0,0)" stroke="' + (selActive ? ink : 'none') + '" stroke-width="' + 1.5 * u + '" style="cursor:move"/>';
      if (selActive) sel += '<g class="kls-handle" style="cursor:nesw-resize"><circle cx="' + hx + '" cy="' + hy + '" r="' + 22 * u + '" fill="rgba(0,0,0,0)"/><circle cx="' + hx + '" cy="' + hy + '" r="' + 13 * u + '" fill="#171717" stroke="#fff" stroke-width="' + 2 * u + '"/>' +
        '<path d="M' + (hx - a) + ',' + (hy + a) + ' L' + (hx + a) + ',' + (hy - a) + ' M' + (hx - a) + ',' + (hy) + ' L' + (hx - a) + ',' + (hy + a) + ' L' + (hx) + ',' + (hy + a) + ' M' + (hx + a) + ',' + (hy) + ' L' + (hx + a) + ',' + (hy - a) + ' L' + (hx) + ',' + (hy - a) + '" stroke="#fff" stroke-width="' + 1.6 * u + '" fill="none"/></g>';
    }
    if (it.type === 'gallery') {
      out += '<g filter="url(#kls-emb)" style="color:' + col + '">' + design(it.id).s.replace('<svg', '<svg x="' + (G.cx - w / 2) + '" y="' + (G.cy - h / 2) + '" width="' + w + '" height="' + h + '" preserveAspectRatio="xMidYMid meet"') + '</g>';
    } else if (it.type === 'text') {
      out += '<text filter="url(#kls-emb)" x="' + G.cx + '" y="' + G.cy + '" text-anchor="middle" dominant-baseline="central" direction="rtl" font-family="' + esc(sz.font.css) + '" font-weight="' + sz.font.w + '" font-size="' + (sz.fs * f).toFixed(2) + '" fill="' + col + '">' + esc(it.text) + '</text>';
    } else {
      out += '<image filter="url(#kls-emb)" href="' + esc(it.logo.src) + '" x="' + (G.cx - w / 2) + '" y="' + (G.cy - h / 2) + '" width="' + w + '" height="' + h + '" preserveAspectRatio="xMidYMid meet"/>';
    }
    return out + sel;
  }
  var DEFS = '<defs><filter id="kls-emb" x="-15%" y="-15%" width="130%" height="130%">' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.01 0.6" numOctaves="2" seed="4" result="n"/>' +
    '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 -0.12" result="st"/>' +
    '<feComposite in="st" in2="SourceAlpha" operator="in" result="tex"/>' +
    '<feMerge result="m"><feMergeNode in="SourceGraphic"/><feMergeNode in="tex"/></feMerge>' +
    '<feDropShadow in="m" dx="0" dy="1.6" stdDeviation="1.2" flood-color="#000" flood-opacity="0.45"/></filter></defs>';
  function sideSVG(side, editing, uid) {
    var v = variant(), s = DEFS + '<image href="' + esc(v.img[side]) + '" x="0" y="0" width="' + IMG + '" height="' + IMG + '"/><g id="' + (uid ? 'kls-layer-' + uid : 'kls-layer') + '">' + designSVG(side, editing, geo(side, v)) + '</g>';
    if (uid) s = s.replace(/kls-emb/g, 'kls-emb-' + uid);
    return '<svg viewBox="' + vbox(side).join(' ') + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(LABEL[side]) + '">' + s + '</svg>';
  }

  /* ---------- layout ---------- */
  root.className = 'kls';
  root.innerHTML =
    (C.showTitle ? '<div class="kls-hero"><div><div class="kls-eyebrow">עיצוב אישי</div><h1 class="kls-title">עצבו כובע משלכם<em>.</em></h1></div><div class="kls-sticker" aria-hidden="true">גם כובע<br>אחד</div></div>' : '') +
    '<div class="kls-app">' +
    '<section class="kls-stage" aria-label="תצוגה חיה של הכובע"><div class="kls-canvas" id="kls-canvas"></div>' +
    '<div class="kls-dims" id="kls-dims"></div><div class="kls-views" id="kls-views" role="group" aria-label="צד הכובע"></div>' +
    '<div class="kls-trust"><div><b>סקיצה לפני רקמה</b>שולחים לכם ב-WhatsApp לאישור</div><div><b>' + esc(C.facts.delivery) + '</b>מההזמנה ועד שהכובע אצלכם</div><div><b>בלי מינימום</b>גם כובע אחד</div></div></section>' +
    '<section class="kls-panel"><nav class="kls-stepper" id="kls-stepper" aria-label="שלבים"></nav><div id="kls-step"></div>' +
    '<div class="kls-bar"><div class="kls-price"><b id="kls-total"></b><small id="kls-per"></small></div>' +
    '<div class="kls-btns"><button class="kls-btn back" id="kls-back" type="button">חזרה</button><button class="kls-btn primary" id="kls-next" type="button">הבא</button></div></div>' +
    '<p class="kls-err" id="kls-err" hidden></p></section></div>' +
    '<div class="kls-overlay" id="kls-overlay" hidden><div class="kls-sheet" role="dialog" aria-modal="true" aria-labelledby="kls-sheet-title" id="kls-sheet"></div></div>';

  /* ---------- render ---------- */
  var stageKey = '';
  function editingNow() { return S.step === 1 && S.side === S.view; }
  function renderStage() {
    var cv = $('kls-canvas'), key = variant().id + '|' + S.view;
    if (key !== stageKey || !$('kls-layer')) {
      stageKey = key;
      cv.innerHTML = sideSVG(S.view, editingNow()) +
        // drawn chevrons, not the ‹ › characters: those are mirrored on a right-to-left page and ended up pointing inwards
        '<button type="button" class="kls-arrow prev" aria-label="הצד הקודם"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '<button type="button" class="kls-arrow next" aria-label="הצד הבא"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
      cv.querySelector('.prev').onclick = function () { turn(-1); };
      cv.querySelector('.next').onclick = function () { turn(1); };
    } else {
      $('kls-layer').innerHTML = designSVG(S.view, editingNow(), geo(S.view));
    }
    cv.classList.toggle('editing', editingNow() && filled(item(S.view)));
    hint();
    // while choosing the cap: front only, no side bar and no arrows (they appear from the design step on)
    var choosing = S.step === 0;
    cv.querySelectorAll('.kls-arrow').forEach(function (a) { a.hidden = choosing; });
    var vs = $('kls-views'); vs.innerHTML = ''; vs.hidden = choosing;
    SIDES.forEach(function (s) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'kls-chip'; b.setAttribute('aria-pressed', S.view === s);
      b.innerHTML = (filled(item(s)) ? '<i class="kls-dot"></i>' : '') + esc(LABEL[s]);
      b.onclick = function () { S.view = s; if (S.step === 1) S.side = s; render(); };
      vs.appendChild(b);
    });
    var it = item(S.view), L = limits(S.view), txt;
    var sz = filled(it) && designSize(S.view, it);
    if (sz) { txt =LABEL[S.view] + ' · ' + (sz.w / 10).toFixed(1) + ' × ' + (sz.h / 10).toFixed(1) + ' ס״מ'; }
    else txt = LABEL[S.view] + ' · אזור רקמה עד ' + L.maxW + ' × ' + L.maxH + ' ס״מ';
    $('kls-dims').textContent = txt;
  }
  function turn(d) { if (S.step === 0) return; var i = SIDES.indexOf(S.view); S.view = SIDES[(i + d + SIDES.length) % SIDES.length]; if (S.step === 1) S.side = S.view; render(); }
  function renderStepper() {
    var n = $('kls-stepper'); n.innerHTML = '';
    var subs = [shape().name + ' · ' + variant().name, active().length ? active().map(function (s) { return LABEL[s]; }).join(', ') : 'עוד לא נבחר', S.qty + (S.qty === 1 ? ' כובע' : ' כובעים'), money(perCap() * S.qty)];
    STEPS.forEach(function (st, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = (S.step === i ? 'on ' : '') + (i < S.step ? 'done' : '');
      b.innerHTML = '<b>' + (i + 1) + '. ' + st + '</b><small>' + esc(subs[i]) + '</small>';
      b.onclick = function () { go(i); }; n.appendChild(b);
    });
  }
  function renderBar() {
    var pc = perCap();
    $('kls-total').textContent = money(pc * S.qty);
    $('kls-per').textContent = S.qty > 1 ? S.qty + ' × ' + money(pc) + ' לכובע' : (active().length ? 'כובע אחד, כולל רקמה' : 'כובע אחד, בלי רקמה');
    $('kls-back').disabled = S.step === 0;
    $('kls-next').textContent = S.step === 3 ? 'להוסיף לסל' : S.step === 2 ? 'לסיכום' : 'הבא';
    $('kls-next').disabled = (S.step === 3 && !canBuy()) || busy;
  }
  function mixed(it) { return it && it.type === 'text' && hasHeb(it.text) && hasLat(it.text); }
  function canBuy() { var l = active(); return l.length > 0 && l.every(function (s) { return (item(s).type !== 'logo' || item(s).ok) && !mixed(item(s)); }) && variant().stock; }

  function stepHat() {
    var h = '<div class="kls-step"><h2>איזה כובע<em>?</em></h2><div class="kls-seg" role="radiogroup" aria-label="גזרה">';
    Object.keys(C.shapes).forEach(function (k) {
      var sh = C.shapes[k], list = C.variants.filter(function (v) { return v.shape === k; });
      if (!list.length) return;
      var min = Math.min.apply(null, list.map(function (v) { return v.price; }));
      h += '<button type="button" role="radio" data-shape="' + k + '" aria-pressed="' + (S.shape === k) + '" aria-checked="' + (S.shape === k) + '"><b>' + esc(sh.name) + '</b><small>' + esc(sh.desc.replace(/^גזרה\s+/, '')) + ' · ' + money(min) + '</small></button>';
    });
    h += '</div><div class="kls-label kls-color-label">צבע <span><i class="kls-dot-c" style="background:' + variant().hex + '"></i>' + esc(variant().name) + (variant().stock ? '' : ' · אזל מהמלאי') + '</span></div><div class="kls-swatches" role="radiogroup" aria-label="צבע">';
    variants().forEach(function (v) {
      // a small photo of the cap itself (front, cropped like the big view) instead of a plain colour dot
      var vb = (v.vb && v.vb.front) || VB0;
      h += '<button type="button" class="kls-capthumb" data-variant="' + v.id + '" title="' + esc(v.name) + (v.stock ? '' : ' (אזל)') + '" aria-label="' + esc(v.name) + '" aria-pressed="' + (variant().id === v.id) + '"' + (v.stock ? '' : ' disabled') + '>' +
        '<svg viewBox="' + vb.join(' ') + '" aria-hidden="true"><image href="' + esc(v.img.front) + '" width="' + IMG + '" height="' + IMG + '"/></svg></button>';
    });
    return h + '</div></div>';
  }
  function typePriceLabel(t, side) {
    var others = active().filter(function (s) { return s !== side; }).length;
    if (others) return '+' + money(EXTRA) + ' למקום נוסף';
    return S.qty === 1 ? '+' + money(TYPE_PRICE[t]) + ' לכובע אחד' : 'כלול במחיר לכמות';
  }
  function threadPicker(it) {
    var h = '<div class="kls-label">צבע החוט <span>' + esc(thread(it.thread).name) + '</span></div><div class="kls-threads">';
    THREAD.forEach(function (t) { h += '<button type="button" class="kls-th" data-thread="' + t.code + '" title="' + esc(t.name) + '" aria-label="' + esc(t.name) + '" aria-pressed="' + (it.thread === t.code) + '" style="background:' + t.hex + '"></button>'; });
    return h + '</div>';
  }
  function sizeRange(it, key, label, min, max, step) {
    var v = Math.min(Math.max(it[key], min), max);
    return '<div class="kls-label">' + label + '</div><div class="kls-range"><small>' + min + '</small><input type="range" id="kls-size" data-key="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + v + '" aria-label="' + label + ' בס״מ"><output id="kls-sizeout">' + v.toFixed(1) + ' ס״מ</output></div>';
  }
  function textWarnHTML(side, it) {
    if (mixed(it)) return '<p class="kls-warn">אפשר לרקום עברית או אנגלית, לא את שתיהן באותה שורה.</p>';
    var tz = designSize(side, it); if (!tz) return '';
    return (tz.fit ? '<p class="kls-note">הטקסט ארוך לאזור, אז הקטנו אותו ל-' + (tz.h / 10).toFixed(1) + ' ס״מ.</p>' : '') +
      (tz.h < C.text.minLetter * 10 - 0.05 ? '<p class="kls-warn">האותיות יוצאות קטנות מ-' + C.text.minLetter + ' ס״מ, ואז הרקמה לא נקראת. קצרו את הטקסט או העבירו אותו למקום גדול יותר.</p>' : '');
  }
  function stepDesign() {
    var side = S.side, L = limits(side), it = item(side) || {};
    var h = '<div class="kls-step"><h2>מה רוקמים<em>?</em></h2><p class="kls-lead">בוחרים מקום על הכובע, ואז עיצוב מספר הרקמות, טקסט או הלוגו שלכם. אפשר לרקום בכמה מקומות.</p>';
    h += '<div class="kls-label kls-places-label">איפה על הכובע</div><div class="kls-places">';
    SIDES.forEach(function (s) {
      var f = filled(item(s));
      h += '<button type="button" class="kls-card kls-place' + (f ? ' has' : '') + '" data-side="' + s + '" aria-pressed="' + (side === s) + '">' + esc(LABEL[s]) + '<small>' + (f ? typeName(item(s).type) : (active().length && !f ? '+' + money(EXTRA) : 'ריק')) + '</small></button>';
    });
    h += '</div><div class="kls-label">סוג העיצוב <span>' + esc(LABEL[side]) + ' · עד ' + L.maxW + '×' + L.maxH + ' ס״מ</span></div><div class="kls-types">';
    [['gallery', 'ספר הרקמות', 'עיצובים שלנו, מוכנים לרקמה'], ['text', 'טקסט', 'שם, משפט, תאריך'], ['logo', 'הלוגו שלכם', 'מעלים קובץ, ואנחנו מכינים אותו לרקמה']].forEach(function (t) {
      h += '<button type="button" class="kls-card kls-type" data-type="' + t[0] + '" aria-pressed="' + (it.type === t[0]) + '"><b>' + t[1] + '</b><small>' + t[2] + '</small><span class="kls-pr">' + typePriceLabel(t[0], side) + '</span></button>';
    });
    h += '</div><div class="kls-row"><button type="button" class="kls-link" id="kls-surprise">תפתיעו אותי</button>' +
      (filled(it) && (Math.abs(it.dx || 0) > 0.05 || Math.abs(it.dy || 0) > 0.05) ? '<button type="button" class="kls-link" id="kls-center">למרכז</button>' : '') +
      (it.type ? '<button type="button" class="kls-link" id="kls-clear">להסיר מ' + esc(LABEL[side]) + '</button>' : '') + '</div>';

    if (it.type === 'gallery') {
      h += '<div class="kls-label">ספר הרקמות <span>' + GALLERY.length + ' עיצובים</span></div><div class="kls-cats">';
      ['הכול'].concat(CATS).forEach(function (c) { h += '<button type="button" class="kls-chip' + (S.cat === c ? ' on' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>'; });
      h += '</div><div class="kls-grid" id="kls-grid">';
      if (!GALLERY.length) h += '<div class="kls-loading">טוענים את ספר הרקמות…</div>';
      GALLERY.filter(function (g) { return S.cat === 'הכול' || g.c === S.cat; }).forEach(function (g) {
        h += '<button type="button" class="kls-tile" data-id="' + g.id + '" aria-pressed="' + (it.id === g.id) + '" title="' + esc(g.n) + '"><div class="kls-art">' + g.s + '</div><span>' + esc(g.short) + '</span></button>';
      });
      h += '</div>';
      var g = design(it.id);
      h += (g && !g.m) ? '<p class="kls-note">לעיצוב הזה יש צבעים קבועים. צבע החוט לא משנה אותו.</p>' : threadPicker(it);
      h += sizeRange(it, 'w', 'רוחב', 1.5, L.maxW, 0.1);
      var sz = designSize(side, it); if (sz && sz.fit) h += '<p class="kls-note">הגודל הותאם לאזור הרקמה ב' + esc(LABEL[side]) + '.</p>';
    }
    if (it.type === 'text') {
      h += '<div class="kls-label">הטקסט <span>עד ' + C.text.max + ' תווים</span></div><input class="kls-field" id="kls-txt" maxlength="' + C.text.max + '" placeholder="למשל: אחי, יעל 2026" value="' + esc(it.text || '') + '" autocomplete="off"><div class="kls-count" id="kls-txtcount">' + (it.text || '').length + '/' + C.text.max + '</div>';
      h += '<div class="kls-label">גופן</div><div class="kls-fonts">';
      var fl = fontsFor(it.text);
      if (!fl.some(function (f) { return f.id === it.font; })) it.font = fl[0].id;
      fl.forEach(function (f) { h += '<button type="button" class="kls-card kls-font" data-font="' + f.id + '" aria-pressed="' + (it.font === f.id) + '" style="font-family:' + esc(f.css) + ';font-weight:' + f.w + '"><b>' + esc(sampleFor(f, it.text)) + '</b><small>' + esc(f.name) + '</small></button>'; });
      h += '</div>' + threadPicker(it) + sizeRange(it, 'h', 'גובה אות', C.text.minLetter, Math.min(4, L.maxH), 0.1);
      h += '<div id="kls-txtwarn">' + textWarnHTML(side, it) + '</div>';
    }
    if (it.type === 'logo') {
      h += '<div class="kls-label">הקובץ</div><label class="kls-drop" id="kls-drop" for="kls-logofile"><b id="kls-dropb">' + (it.logo ? 'הלוגו עלה ✓ להחליף קובץ' : 'לבחור קובץ או לגרור לכאן') + '</b><small>PNG או JPG, עד ' + C.upload.maxMb + 'MB. קובץ חד וברור</small><input type="file" id="kls-logofile" accept="image/png,image/jpeg"></label>';
      if (it.logo) h += sizeRange(it, 'w', 'רוחב', 1.5, L.maxW, 0.1);
      h += '<div class="kls-rules"><b>כמה דברים על רקמה</b><ul>' + C.logoRules.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>';
      h += '<label class="kls-check"><input type="checkbox" id="kls-logook"' + (it.ok ? ' checked' : '') + '> קראתי את הכללים, ומותר לי להשתמש בלוגו שאני מעלה</label>';
    }
    return h + '</div>';
  }
  function typeName(t) { return { gallery: 'ספר הרקמות', text: 'טקסט', logo: 'לוגו' }[t]; }

  function stepQty() {
    var base = variant().price;
    var h = '<div class="kls-step"><h2>כמה כובעים<em>?</em></h2><p class="kls-lead">מכובע אחד ועד ' + MAXQ + ', באותו עיצוב. ככל שמזמינים יותר, המחיר לכובע יורד.</p>';
    h += '<div class="kls-qty"><button type="button" id="kls-minus" aria-label="פחות">−</button><input id="kls-q" type="number" inputmode="numeric" min="1" max="' + MAXQ + '" value="' + S.qty + '" aria-label="כמות"><button type="button" id="kls-plus" aria-label="יותר">+</button></div>';
    h += '<table class="kls-tiers"><thead><tr><th>כמות</th><th>מחיר לכובע</th><th>מה כלול</th></tr></thead><tbody>';
    var tps = Object.keys(TYPE_PRICE).map(function (k) { return TYPE_PRICE[k]; });
    h += '<tr class="' + (S.qty === 1 ? 'on' : '') + '"><td>1</td><td>' + money(base + Math.min.apply(null, tps)) + '–' + money(base + Math.max.apply(null, tps)).slice(C.currency.length) + '</td><td>לפי סוג העיצוב</td></tr>';
    TIERS.forEach(function (t) { var on = S.qty >= t.min && S.qty <= t.max; h += '<tr class="' + (on ? 'on' : '') + '"><td>' + t.min + '–' + t.max + '</td><td>' + money(base + t.add) + '</td><td>עיצוב אחד</td></tr>'; });
    h += '</tbody></table>';
    var next = TIERS.find(function (t) { return t.min > S.qty; });
    if (next && active().length) { var save1 = perCap() - (base + next.add + EXTRA * (active().length - 1)); if (save1 > 0) h += '<p class="kls-nudge">עוד ' + (next.min - S.qty) + ' ' + (next.min - S.qty === 1 ? 'כובע' : 'כובעים') + ', וכל כובע יוצא זול ב-' + money(save1) + '.</p>'; }
    h += '<p class="kls-note">כל מקום רקמה נוסף: ' + money(EXTRA) + ' לכובע.</p>';
    h += '<div class="kls-b2b"><p>' + (MAXQ + 1) + ' ומעלה, לחברה או לקבוצה? יש לנו מחירון לעסקים.</p>' + (C.b2bUrl ? '<a class="kls-btn-gold" href="' + esc(C.b2bUrl) + '">הצעת מחיר לעסקים</a>' : '') + '</div></div>';
    return h;
  }
  function stepSum() {
    var list = active();
    var h = '<div class="kls-step"><h2>הכובע שלכם<em>.</em></h2><p class="kls-lead">בודקים שהכול נכון. אחרי ההזמנה נשלח סקיצה ב-WhatsApp, ורוקמים רק אחרי שתאשרו.</p><div class="kls-minis">';
    SIDES.forEach(function (s) { h += '<button type="button" class="kls-mini" data-view="' + s + '">' + sideSVG(s, false, 'm' + s) + '<span>' + esc(LABEL[s]) + (filled(item(s)) ? ' ●' : '') + '</span></button>'; });
    h += '</div><div class="kls-lines"><div class="kls-line"><span>' + esc(shape().name) + ', ' + esc(variant().name) + '</span><span>' + money(variant().price) + '</span></div>';
    if (!list.length) h += '<div class="kls-line"><span class="kls-warn">עוד לא בחרתם עיצוב</span><span></span></div>';
    list.forEach(function (s, i) { h += '<div class="kls-line"><span>' + esc(LABEL[s]) + ': ' + esc(describe(s)) + '</span><span>' + linePrice(s, i) + '</span></div>'; });
    h += '<div class="kls-line"><span>מחיר לכובע</span><span>' + money(perCap()) + '</span></div><div class="kls-line"><span>כמות</span><span>× ' + S.qty + '</span></div>';
    h += '<div class="kls-line total"><span>סה״כ</span><span>' + money(perCap() * S.qty) + '</span></div></div>';
    var need = list.filter(function (s) { return item(s).type === 'logo' && !item(s).ok; });
    if (need.length) h += '<p class="kls-warn">כדי להמשיך, צריך לאשר את כללי הלוגו ב' + esc(LABEL[need[0]]) + '.</p>';
    if (!variant().stock) h += '<p class="kls-warn">הצבע הזה אזל מהמלאי. בחרו צבע אחר.</p>';
    h += '<ul class="kls-facts">' + C.facts.list.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul></div>';
    return h;
  }
  function describe(s) {
    var it = item(s), t = thread(it.thread);
    if (it.type === 'gallery') { var g = design(it.id); return (g ? g.short : '') + (g && g.m ? ', חוט ' + t.name : ''); }
    if (it.type === 'text') return '"' + it.text + '", ' + font(it.font).name + ', חוט ' + t.name;
    if (it.type === 'logo') return 'הלוגו שלכם';
    return '';
  }
  function linePrice(s, i) { if (i === 0) return S.qty === 1 ? '+' + money(Math.max.apply(null, active().map(function (x) { return TYPE_PRICE[item(x).type]; }))) : '+' + money(tier(S.qty).add); return '+' + money(EXTRA); }

  function render() {
    renderStage(); renderStepper();
    $('kls-step').innerHTML = [stepHat, stepDesign, stepQty, stepSum][S.step]();
    bind(); renderBar(); save();
  }
  function refreshLive() { renderStage(); renderStepper(); renderBar(); save(); }
  function go(i) {
    S.step = i; if (i === 1) S.view = S.side; if (i === 0) S.view = 'front'; hideErr(); render();
    if (window.innerWidth <= 860) { // phone: back to the top of the tool, the cap stays pinned above the choices
      var top = root.getBoundingClientRect().top + window.pageYOffset;
      if (window.pageYOffset > top) window.scrollTo({ top: top, behavior: 'smooth' });
    }
  }
  function showErr(m) { var e = $('kls-err'); e.textContent = m; e.hidden = false; }
  function hideErr() { $('kls-err').hidden = true; }

  /* ---------- events ---------- */
  function keepGridScroll(fn) { var g = $('kls-grid'), sc = g ? g.scrollTop : 0; fn(); g = $('kls-grid'); if (g) g.scrollTop = sc; }
  function bind() {
    var R = $('kls-step');
    R.querySelectorAll('[data-shape]').forEach(function (b) { b.onclick = function () { var nm = variant().name; S.shape = b.dataset.shape; var m = variants().find(function (v) { return v.name === nm && v.stock; }) || variants().find(function (v) { return v.stock; }) || variants()[0]; S.variant = m.id; render(); }; });
    R.querySelectorAll('[data-variant]').forEach(function (b) { b.onclick = function () { S.variant = +b.dataset.variant; render(); }; });
    R.querySelectorAll('[data-side]').forEach(function (b) { b.onclick = function () { S.side = S.view = b.dataset.side; render(); }; });
    R.querySelectorAll('[data-type]').forEach(function (b) { b.onclick = function () { var it = ensure(S.side); it.type = b.dataset.type; if (it.type === 'gallery' && !it.id && GALLERY.length) it.id = GALLERY[0].id; render(); }; });
    R.querySelectorAll('[data-cat]').forEach(function (b) { b.onclick = function () { S.cat = b.dataset.cat; render(); }; });
    R.querySelectorAll('[data-id]').forEach(function (b) { b.onclick = function () { keepGridScroll(function () { ensure(S.side).id = b.dataset.id; render(); }); }; });
    R.querySelectorAll('[data-thread]').forEach(function (b) { b.onclick = function () { keepGridScroll(function () { ensure(S.side).thread = b.dataset.thread; render(); }); }; });
    R.querySelectorAll('[data-font]').forEach(function (b) { b.onclick = function () { ensure(S.side).font = b.dataset.font; render(); }; });
    R.querySelectorAll('[data-view]').forEach(function (b) { b.onclick = function () { S.view = b.dataset.view; render(); }; });
    var sz = $('kls-size'); if (sz) sz.oninput = function () { var it = ensure(S.side); it[sz.dataset.key] = parseFloat(sz.value); $('kls-sizeout').textContent = parseFloat(sz.value).toFixed(1) + ' ס״מ'; refreshLive(); var w = $('kls-txtwarn'); if (w) w.innerHTML = textWarnHTML(S.side, it); };
    var tx = $('kls-txt'); if (tx) tx.oninput = function () {
      var it = ensure(S.side), lang = function (t) { return (hasHeb(t) ? 'h' : '') + (hasLat(t) ? 'l' : ''); }, was = lang(it.text); it.text = tx.value;
      if (lang(it.text) !== was) { // Hebrew ↔ English: show the fonts for that language, keep typing
        var pos = tx.selectionStart; render(); var t2 = $('kls-txt'); if (t2) { t2.focus(); t2.setSelectionRange(pos, pos); } return;
      }
      $('kls-txtcount').textContent = tx.value.length + '/' + C.text.max;
      R.querySelectorAll('.kls-font').forEach(function (b) { var f = font(b.dataset.font); b.querySelector('b').textContent = sampleFor(f, tx.value); });
      refreshLive(); $('kls-txtwarn').innerHTML = textWarnHTML(S.side, it);
    };
    var sp = $('kls-surprise'); if (sp) sp.onclick = surprise;
    var ce = $('kls-center'); if (ce) ce.onclick = function () { var it = ensure(S.side); it.dx = 0; it.dy = 0; render(); };
    var cl = $('kls-clear'); if (cl) cl.onclick = function () { delete S.items[S.side]; render(); };
    var lf = $('kls-logofile'); if (lf) lf.onchange = function () { if (lf.files[0]) upload(lf.files[0]); };
    var dr = $('kls-drop'); if (dr) {
      dr.ondragover = function (e) { e.preventDefault(); dr.classList.add('drag'); };
      dr.ondragleave = function () { dr.classList.remove('drag'); };
      dr.ondrop = function (e) { e.preventDefault(); dr.classList.remove('drag'); if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]); };
    }
    var ok = $('kls-logook'); if (ok) ok.onchange = function () { ensure(S.side).ok = ok.checked; refreshLive(); };
    var m = $('kls-minus'), pl = $('kls-plus'), q = $('kls-q');
    if (m) {
      m.onclick = function () { S.qty = Math.max(1, S.qty - 1); render(); };
      pl.onclick = function () { if (S.qty < MAXQ) { S.qty++; render(); } };
      q.onchange = function () { S.qty = Math.max(1, Math.min(MAXQ, parseInt(q.value, 10) || 1)); render(); };
    }
  }
  function surprise() {
    if (!GALLERY.length) return;
    var monos = GALLERY.filter(function (g) { return g.m; }), g = monos[Math.floor(Math.random() * monos.length)];
    var it = ensure(S.side); it.type = 'gallery'; it.id = g.id;
    var lt = light(variant().hex), pool = THREAD.filter(function (t) { return light(t.hex) !== lt; });
    it.thread = pool[Math.floor(Math.random() * pool.length)].code; S.cat = 'הכול'; render();
  }

  /* ---------- logo upload ---------- */
  function upload(file) {
    hideErr();
    if (!/^image\/(png|jpeg)$/.test(file.type)) { showErr('אפשר להעלות רק PNG או JPG.'); return; }
    if (file.size > C.upload.maxMb * 1048576) { showErr('הקובץ גדול מ-' + C.upload.maxMb + 'MB. נסו קובץ קטן יותר.'); return; }
    var side = S.side, b = $('kls-dropb'); if (b) b.textContent = 'מעלים…';
    var done = function (logo) {
      var img = new Image();
      img.onload = function () { var it = ensure(side); logo.ar = (img.naturalWidth || 1) / (img.naturalHeight || 1); it.logo = logo; it.w = Math.min(limits(side).maxW, 8); render(); };
      img.onerror = function () { showErr('לא הצלחנו לקרוא את התמונה. נסו קובץ אחר.'); render(); };
      img.src = logo.src;
    };
    if (C.demo) { var r = new FileReader(); r.onload = function () { done({ token: 'demo', src: r.result, name: file.name }); }; r.readAsDataURL(file); return; }
    var fd = new FormData(); fd.append('file', file); fd.append('nonce', C.nonce);
    fetch(C.ajax.upload, { method: 'POST', body: fd, credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.success) throw new Error(j && j.data && j.data.message || 'ההעלאה נכשלה');
      done({ token: j.data.token, src: j.data.url, name: file.name });
    }).catch(function (e) { showErr(e.message || 'ההעלאה נכשלה. נסו שוב.'); render(); });
  }

  /* ---------- previews for the cart and the order (PNG per decorated side) ---------- */
  function loadImg(src) { return new Promise(function (ok, bad) { var i = new Image(); i.crossOrigin = 'anonymous'; i.onload = function () { ok(i); }; i.onerror = bad; i.src = src; }); }
  function preview(side) {
    var v = variant(), G = geo(side, v), it = item(side), VB = vbox(side), W = 600, sc = W / VB[2], H = Math.round(VB[3] * sc);
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var x = cv.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    var map = function (px, py) { return [(px - VB[0]) * sc, (py - VB[1]) * sc]; };
    return loadImg(v.img[side]).then(function (ph) {
      var o = map(0, 0); x.drawImage(ph, o[0], o[1], IMG * sc, IMG * sc);
      var sz = designSize(side, it), o = offset(side, it, sz), f = G.k / 10, w = sz.w * f * sc, h = sz.h * f * sc, c = map(G.cx + o[0] * G.k, G.cy + o[1] * G.k), col = thread(it.thread).hex;
      x.shadowColor = 'rgba(0,0,0,.4)'; x.shadowBlur = 2; x.shadowOffsetY = 1;
      if (it.type === 'text') {
        x.fillStyle = col; x.font = sz.font.w + ' ' + (sz.fs * f * sc) + 'px ' + sz.font.css; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
        x.fillText(it.text, c[0], c[1]); return;
      }
      var src = it.type === 'logo' ? it.logo.src : URL.createObjectURL(new Blob([design(it.id).s.replace('<svg', '<svg style="color:' + col + '"').replace(/currentColor/g, col)], { type: 'image/svg+xml' }));
      return loadImg(src).then(function (im) { x.drawImage(im, c[0] - w / 2, c[1] - h / 2, w, h); });
    }).then(function () { return cv.toDataURL('image/png'); });
  }

  /* ---------- add to cart ---------- */
  var busy = false;
  function payload() {
    var items = {};
    active().forEach(function (s) {
      var it = item(s), o = { type: it.type, dx: Math.round((it.dx || 0) * 10) / 10, dy: Math.round((it.dy || 0) * 10) / 10 };
      if (it.type === 'gallery') { o.id = it.id; o.thread = it.thread; o.w = it.w; }
      if (it.type === 'text') { o.text = it.text.trim(); o.font = it.font; o.thread = it.thread; o.h = it.h; }
      if (it.type === 'logo') { o.token = it.logo.token; o.w = it.w; o.ok = !!it.ok; }
      items[s] = o;
    });
    return { variation: variant().id, qty: S.qty, items: items, client_price: perCap() };
  }
  function addToCart() {
    if (busy || !canBuy()) return;
    busy = true; hideErr(); renderBar(); $('kls-next').textContent = 'מוסיפים לסל…';
    var list = active();
    Promise.all(list.map(function (s) { return preview(s).catch(function () { return ''; }); })).then(function (pngs) {
      var previews = {}; list.forEach(function (s, i) { if (pngs[i]) previews[s] = pngs[i]; });
      if (C.demo) { window.klsLastPreviews = previews; return { success: true, data: { cart_url: '#', price: perCap(), demo: true } }; }
      var fd = new FormData(); fd.append('nonce', C.nonce); fd.append('design', JSON.stringify(payload())); fd.append('previews', JSON.stringify(previews));
      return fetch(C.ajax.add, { method: 'POST', body: fd, credentials: 'same-origin' }).then(function (r) { return r.json(); });
    }).then(function (j) {
      busy = false;
      if (!j || !j.success) { showErr((j && j.data && j.data.message) || 'לא הצלחנו להוסיף לסל. נסו שוב.'); renderBar(); return; }
      openSheet(j.data);
      if (window.jQuery) window.jQuery(document.body).trigger('wc_fragment_refresh');
      renderBar();
    }).catch(function () { busy = false; showErr('לא הצלחנו להוסיף לסל. בדקו את החיבור ונסו שוב.'); renderBar(); });
  }
  function openSheet(d) {
    var h = '<div class="kls-ok"><i>✓</i><h3 id="kls-sheet-title">הכובע נוסף לסל</h3></div>';
    h += '<div class="kls-lines"><div class="kls-line"><span>' + esc(shape().name) + ', ' + esc(variant().name) + ' × ' + S.qty + '</span><span>' + money((d.price || perCap()) * S.qty) + '</span></div></div>';
    if (d.demo) h += '<p class="kls-note">זו הדמיה מקומית: לא נוסף כלום לסל באמת.</p>';
    h += '<div class="kls-btns" style="margin-top:14px"><a class="kls-btn primary" href="' + esc(d.cart_url) + '">לסל ולתשלום</a><button type="button" class="kls-btn" id="kls-again">לעצב עוד כובע</button></div>';
    $('kls-sheet').innerHTML = h; $('kls-overlay').hidden = false;
    $('kls-again').onclick = function () { $('kls-overlay').hidden = true; S.items = {}; S.qty = 1; S.step = 1; S.side = S.view = 'front'; render(); };
    $('kls-again').focus();
  }
  $('kls-overlay').onclick = function (e) { if (e.target.id === 'kls-overlay') $('kls-overlay').hidden = true; };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') $('kls-overlay').hidden = true; });
  $('kls-next').onclick = function () { if (S.step < 3) go(S.step + 1); else addToCart(); };
  $('kls-back').onclick = function () { if (S.step > 0) go(S.step - 1); };

  /* drag the design to move it inside the area; drag the round handle to resize */
  var drag = null, pinch = null, frame = 0, dragged = false, selActive = false, hideT = 0;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  /* the frame and the round handle appear while the customer touches or hovers the design, and fade 2 s later */
  function showSel() { clearTimeout(hideT); if (!selActive) { selActive = true; renderStage(); } }
  function hideSel(ms) {
    clearTimeout(hideT);
    hideT = setTimeout(function () { if (drag || pinch) return; if (selActive) { selActive = false; renderStage(); } }, ms == null ? 2000 : ms);
  }
  /* a one-time hint on the cap: how to move and resize */
  var HINT = 'kls-hint-seen', touchUI = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  function hintSeen() { try { return localStorage.getItem(HINT) === '1'; } catch (e) { return true; } }
  function hintDone() { try { localStorage.setItem(HINT, '1'); } catch (e) {} var h = root.querySelector('.kls-hint'); if (h) h.hidden = true; }
  function hint() {
    var cv = $('kls-canvas'), h = cv.querySelector('.kls-hint');
    if (!h) { h = document.createElement('div'); h.className = 'kls-hint'; cv.appendChild(h); }
    h.textContent = touchUI ? 'גוררים כדי להזיז · שתי אצבעות לשינוי גודל' : 'גוררים כדי להזיז · מהעיגול בפינה משנים גודל';
    h.hidden = !(editingNow() && filled(item(S.view)) && !hintSeen());
  }
  $('kls-canvas').addEventListener('pointermove', function (e) { // computer: hovering the design shows the frame
    if (e.pointerType !== 'mouse' || drag || !editingNow() || !filled(item(S.side)) || !e.target.closest) return;
    if (e.target.closest('.kls-grab, .kls-handle')) showSel(); else if (selActive) hideSel(600);
  });
  $('kls-canvas').addEventListener('pointerleave', function () { if (!drag) hideSel(600); });
  document.addEventListener('pointerdown', function (e) { // a tap outside the cap hides the frame at once
    if (selActive && !$('kls-canvas').contains(e.target)) hideSel(0);
  });
  function svgPoint(e) {
    var svg = $('kls-canvas').querySelector('svg'), p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse());
  }
  $('kls-canvas').addEventListener('pointerdown', function (e) {
    if (!editingNow() || !filled(item(S.side)) || !e.target.closest) return;
    var t = e.target.closest('.kls-handle, .kls-grab, .kls-area'); if (!t) return;
    e.preventDefault(); dragged = true; showSel(); hintDone();
    if (pinch) return; // a second finger: the pinch handler resizes
    var it = item(S.side), p = svgPoint(e), G = geo(S.side);
    if (t.classList.contains('kls-area')) { // tap inside the area: move the design there
      it.dx = (p.x - G.cx) / G.k; it.dy = (p.y - G.cy) / G.k; live();
      p = svgPoint(e);
    }
    drag = { mode: t.classList.contains('kls-handle') ? 'size' : 'move', x0: p.x, y0: p.y, dx0: it.dx || 0, dy0: it.dy || 0, w0: it.w, h0: it.h, G: G };
    renderStage(); // show the dashed area right away while moving or resizing
  });
  window.addEventListener('pointermove', function (e) {
    if (!drag) return;
    e.preventDefault();
    var p = svgPoint(e), it = item(S.side), G = drag.G, L = limits(S.side);
    if (drag.mode === 'move') { it.dx = drag.dx0 + (p.x - drag.x0) / G.k; it.dy = drag.dy0 + (p.y - drag.y0) / G.k; }
    else {
      var cx = G.cx + drag.dx0 * G.k, cy = G.cy + drag.dy0 * G.k;
      var d0 = Math.hypot(drag.x0 - cx, drag.y0 - cy) || 1, r = Math.hypot(p.x - cx, p.y - cy) / d0;
      if (it.type === 'text') it.h = clamp(drag.h0 * r, C.text.minLetter, Math.min(4, L.maxH));
      else { it.w = clamp(drag.w0 * r, 1.5, L.maxW); var sz = designSize(S.side, it); if (sz && sz.fit) it.w = Math.round(sz.w) / 10; }
    }
    live();
  }, { passive: false });
  function live() { if (frame) return; frame = requestAnimationFrame(function () { frame = 0; refreshLive(); }); }
  function endDrag() { if (!drag) return; drag = null; render(); hideSel(); }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  /* phone: two fingers resize the design (like zooming a photo) */
  function fingers(e) { var a = e.touches[0], b = e.touches[1]; return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1; }
  $('kls-canvas').addEventListener('touchstart', function (e) {
    if (e.touches.length !== 2 || !editingNow() || !filled(item(S.side))) return;
    var it = item(S.side); drag = null; dragged = true; showSel(); hintDone();
    pinch = { d0: fingers(e), w0: it.w, h0: it.h };
    renderStage();
  }, { passive: true });
  $('kls-canvas').addEventListener('touchmove', function (e) {
    if (!pinch || e.touches.length < 2) return;
    e.preventDefault();
    var it = item(S.side), L = limits(S.side), r = fingers(e) / pinch.d0;
    if (it.type === 'text') it.h = clamp(pinch.h0 * r, C.text.minLetter, Math.min(4, L.maxH));
    else { it.w = clamp(pinch.w0 * r, 1.5, L.maxW); var sz = designSize(S.side, it); if (sz && sz.fit) it.w = Math.round(sz.w) / 10; }
    live();
  }, { passive: false });
  $('kls-canvas').addEventListener('touchend', function (e) {
    if (!pinch || e.touches.length >= 2) return;
    pinch = null; render(); hideSel();
  }, { passive: true });

  /* swipe between sides on phones (not while moving a design) */
  var tx0 = null;
  $('kls-canvas').addEventListener('touchstart', function (e) { tx0 = e.touches[0].clientX; }, { passive: true });
  $('kls-canvas').addEventListener('touchend', function (e) {
    if (tx0 != null && !dragged) { var d = e.changedTouches[0].clientX - tx0; if (Math.abs(d) > 40) turn(d > 0 ? 1 : -1); }
    tx0 = null; dragged = false;
  }, { passive: true });

  /* ---------- embroidery book ---------- */
  function prep(list) {
    GALLERY = list.map(function (g) {
      var m = g.s.match(/viewBox="([^"]+)"/), vb = m ? m[1].trim().split(/[\s,]+/).map(Number) : [0, 0, 100, 100];
      var parts = g.n.split(/\s+-\s+/), heb = parts.find(function (x) { return /[֐-׿]/.test(x); });
      return { id: String(g.id), n: g.n, c: g.c, m: g.m, s: g.s, vb: vb, short: (heb || parts[0]).replace(/\s*\d+(\.\d+)?\s*cm$/i, '').trim() };
    });
    CATS = []; GALLERY.forEach(function (g) { if (CATS.indexOf(g.c) < 0) CATS.push(g.c); });
    SIDES.forEach(function (s) { var it = item(s); if (it && it.type === 'gallery' && it.id && !design(it.id)) delete S.items[s]; });
    render();
  }
  render();
  fetch(C.galleryUrl, { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(prep).catch(function () { var g = $('kls-grid'); if (g) g.innerHTML = '<div class="kls-loading">ספר הרקמות לא נטען. נסו לרענן.</div>'; });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(renderStage);
})();

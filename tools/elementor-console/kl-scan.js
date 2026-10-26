// klscan(): run on a frontend page. Lists leftovers of the old look outside the header and footer: frames of 2px or more,
// hard gold shadows, and the old colours (#A88A4E, #E6D6AE, #111111, #E2E2DF). Also reports which Elementor documents
// (templates) render the page and whether the page scrolls sideways.
window.klscan = function(){
  const OLD = ['rgb(168, 138, 78)','rgb(230, 214, 174)','rgb(17, 17, 17)','rgb(226, 226, 223)'];
  const out = { page: location.pathname, tpl: [...document.querySelectorAll('[data-elementor-type]')].map(e => e.getAttribute('data-elementor-type') + ':' + e.getAttribute('data-elementor-id')).join(' '), hits: [] };
  const els = [...document.querySelectorAll('body *')].filter(e => !e.closest('#wpadminbar, [data-elementor-type="header"], [data-elementor-type="footer"], script, style, .pojo-a11y-toolbar, #pojo-a11y-toolbar') && e.getClientRects().length);
  for (const e of els) { const cs = getComputedStyle(e); const p = [];
    for (const s of ['Top','Right','Bottom','Left']) { if (cs['border'+s+'Style'] !== 'none' && parseFloat(cs['border'+s+'Width']) >= 2 && !e.matches('.klm-c, .klp-color, .klp-color *')) p.push('b'+s[0]+'=' + cs['border'+s+'Width'] + ' ' + cs['border'+s+'Color']); }
    if (cs.boxShadow !== 'none' && /4px 4px 0px/.test(cs.boxShadow)) p.push('shadow=' + cs.boxShadow);
    for (const k of ['color','backgroundColor','borderTopColor']) if (OLD.includes(cs[k]) && (k !== 'borderTopColor' || cs.borderTopStyle !== 'none')) p.push(k + '=' + cs[k]);
    if (p.length) out.hits.push((e.tagName + '.' + [...e.classList].slice(0,2).join('.')).slice(0,50) + ' ' + (e.closest('[data-id]')?.getAttribute('data-id')||'') + ' | ' + p.join(' ; ') + ' | ' + (e.textContent||'').trim().replace(/\s+/g,' ').slice(0,30)); }
  out.n = out.hits.length; out.hits = out.hits.slice(0, 25); out.overflow = document.documentElement.scrollWidth > innerWidth; return out;
};

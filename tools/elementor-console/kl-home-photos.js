// KLHOMEPHOTOS({hero, custom, b2b, store}): puts the user's photos (media library attachment ids) into the image slots of the
// Simta home page (23950, built 26.10.2026). Each slot is an e-flexbox with a grey placeholder; the page CSS makes any img inside
// a slot fill it (object-fit: cover). Run in the editor of 23950. Needs KLLIB. Not run yet: the photos were not in the library.
window.KLHOMEPHOTOS = async function(ids){
  eval(localStorage.getItem('KLLIB')); await KL.ready(23950);
  const SLOT = { hero:'6c99924', custom:'edffefa', b2b:'146ff7c', store:'fa4e3a6' };
  const SIZE = { hero:'large', custom:'1536x1536', b2b:'1536x1536', store:'1536x1536' };
  const find = (c, id) => c.id === id ? c : (c.children || []).map(k => find(k, id)).find(Boolean);
  const out = [];
  for (const [k, att] of Object.entries(ids)) {
    const c = find(elementor.getPreviewContainer(), SLOT[k]); if (!c || !att) continue;
    for (const ch of [...c.children]) await $e.run('document/elements/delete', { container: ch });
    await $e.run('document/elements/create', { container: c, model: KL.I(att, {}, SIZE[k]), options: {} });
    // the slot loses its grey placeholder background and padding
    const st = JSON.parse(JSON.stringify(c.model.get('styles')));
    for (const s of Object.values(st)) for (const v of s.variants) if (v.meta.breakpoint === 'desktop' && !v.meta.state) { delete v.props.background; v.props.padding = KL.sz(0); }
    c.model.set('styles', st); out.push(k + '=' + att);
  }
  $e.internal('document/save/set-is-modified', { status: true });
  return { out, err: await KL.save() };
};

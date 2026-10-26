// KLHOMEPHOTOS({hero, custom, b2b, store}): puts the user's photos (media library attachment ids) into the image slots of the
// Simta home page (23950, built 26.10.2026). Each slot is an e-flexbox with a grey placeholder; the page CSS makes any img inside
// a slot fill it (object-fit: cover). Run in the editor of 23950. Needs KLLIB.
// Photos in use (26.10.2026): hero 24556, apparel 24567, custom 24550, b2b 24557. To swap one: KLHOMEPHOTOS({ hero: <id> }).
// The first save can report an error; publishing once more saves it.
window.KLHOMEPHOTOS = async function(ids){
  eval(localStorage.getItem('KLLIB')); await KL.ready(23950);
  // slots of the home page as rebuilt in the user's order (26.10 evening); the photos are already in them
  const SLOT = { hero:'d9529ba', apparel:'d0b568d', custom:'84d3905', b2b:'a9dd4ed' };
  const SIZE = { hero:'full', apparel:'1536x1536', custom:'1536x1536', b2b:'1536x1536' };
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

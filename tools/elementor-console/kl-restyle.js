// KLRESTYLE(id): converts an atomic (V4) page from "street sharp" to Simta (26.10.2026), run in the Elementor editor of that page.
// 2px frames -> 1px (black frames on containers turn beige), buttons get 4px corners and weight 700, hard-coded old colours -> variables,
// old 12px eyebrows -> gold bar + 13px eyebrow, and the same colour/line swaps inside the page Custom CSS. Needs KLLIB.
window.KLRESTYLE = async function(id){
  eval(localStorage.getItem('KLLIB')); const {V,sz,str,gc,col}=KL;
  await KL.ready(id);
  const all=[]; const walk=c=>{all.push(c);(c.children||[]).forEach(walk)}; walk(elementor.getPreviewContainer());
  const stat={borders:0,buttons:0,eyebrows:0,colors:0,css:0};
  const isBlack=v=>v && (v.value===V.black || (v.$$type==='color' && /^#1{3,6}$/i.test(v.value||'')));
  const darkBg=c=>{ for(let p=c.parent;p&&p.model;p=p.parent){ const st=Object.values(p.model.get('styles')||{})[0]; const pr=st?.variants?.find(v=>v.meta.breakpoint==='desktop'&&!v.meta.state)?.props||{}; const b=pr.background?.value?.color?.value; if(b===V.black) return true; if(b && b!==V.black) return false; } return false; };
  const eyebrowsToSwap=[];
  for(const c of all){
    const type=c.model.get('widgetType')||c.model.get('elType'); const styles=c.model.get('styles'); if(!styles||!Object.keys(styles).length) continue;
    const st=JSON.parse(JSON.stringify(styles)); let changed=false;
    for(const s of Object.values(st)) for(const v of s.variants){ const p=v.props;
      // 2px black frames: thin; on containers they also turn beige
      const bwv=p['border-width']; const isBtn=type==='e-button';
      const hasBlack=isBlack(p['border-color']);
      if(bwv){ if(bwv.$$type==='size' && bwv.value?.size===2){ bwv.value.size=1; changed=true; stat.borders++; }
        else if(bwv.$$type==='border-width-v2'){ for(const k of Object.keys(bwv.value||{})){ if(bwv.value[k]?.value?.size===2){ bwv.value[k].value.size=1; changed=true; stat.borders++; } } } }
      if(hasBlack && !isBtn && bwv){ p['border-color']=gc(V.line); changed=true; }
      if(isBtn){ if(p['border-radius']?.value?.size===0 || p['border-radius']===undefined && p.padding){ p['border-radius']=sz(4); changed=true; stat.buttons++; }
        if(p['font-weight']?.value==='900'){ p['font-weight']=str('700'); changed=true; } }
      // old hard-coded colors to variables
      for(const k of ['color','border-color']){ const cv=p[k]; if(cv?.$$type==='color'){ const h=(cv.value||'').toUpperCase(); if(h==='#111'||h==='#111111'){ p[k]=gc(V.black); changed=true; stat.colors++; } else if(h==='#A88A4E'||h==='#E6D6AE'){ p[k]=gc(V.gold); changed=true; stat.colors++; } else if(h==='#E2E2DF'){ p[k]=gc(V.line); changed=true; stat.colors++; } } }
      // old eyebrow (12px, wide spacing, grey) -> gold bar + 13px
      if(type==='e-paragraph' && v.meta.breakpoint==='desktop' && !v.meta.state && p['font-size']?.value?.size===12 && Math.abs((p['letter-spacing']?.value?.size||0)-0.16)<0.001){ eyebrowsToSwap.push(c); }
    }
    if(changed){ c.model.set('styles', st); }
  }
  for(const c of eyebrowsToSwap){ const parent=c.parent; const idx=parent.children.indexOf(c); const text=c.settings.get('paragraph')?.value||''; const dark=darkBg(c); await $e.run('document/elements/create',{container:parent, model:KL.eyebrow(text, dark?V.gold:V.black, V.gold), options:{at:idx}}); await $e.run('document/elements/delete',{container:c}); stat.eyebrows++; }
  // page custom CSS
  const page=elementor.settings.page.model; let css=page.get('custom_css')||''; const before=css;
  css=css.replace(/#A88A4E/gi,'#AE8E42').replace(/#E6D6AE/gi,'#AE8E42').replace(/#E2E2DF/gi,'#DDD3BD').replace(/#111111\b/g,'#171717').replace(/#111\b(?!\d)/g,'#171717').replace(/2px solid #171717/g,'1px solid #DDD3BD').replace(/2px solid var\(--kl-ink\)/g,'1px solid var(--kl-line)').replace(/box-shadow:\s*4px 4px 0 [^;}]+/g,'box-shadow:none');
  if(css!==before){ await KL.pageCss(css); stat.css=1; }
  try{ $e.internal('document/save/set-is-modified',{status:true}); }catch(e){}
  let err=await KL.save(); if (elementor.documents.getCurrent().editor.isChanged) err = await KL.save();
  return {id, ...stat, err};
};

// KLLIB: helpers for building Elementor V4 (atomic) pages from the editor console. Simta version (26.10.2026).
// Install once per browser: localStorage.setItem('KLLIB', <this file as text>), then in the editor: eval(localStorage.getItem('KLLIB'))
window.KL = (function(){
const uid = () => elementorCommon.helpers.getUniqueId();
const V = { black:'e-gv-da140d9', white:'e-gv-a3fac37', grey:'e-gv-1a1677e', soft:'e-gv-731b711', gold:'e-gv-8bf34aa', goldDeep:'e-gv-79a5fcf', line:'e-gv-510c1c9', red:'e-gv-d40f24c', cream:'e-gv-869eebe', font:'e-gv-c15a3c7' };
const sz = (n,u='px') => ({$$type:'size', value:{size:n, unit:u}});
const str = v => ({$$type:'string', value:v});
const gc = id => ({$$type:'global-color-variable', value:id});
const col = v => ({$$type:'color', value:v});
const dims = (t,e,b,s) => ({$$type:'dimensions', value:{'block-start':sz(t),'inline-end':sz(e),'block-end':sz(b),'inline-start':sz(s)}});
const bw = (t,e,b,s) => ({$$type:'border-width-v2', value:{'block-start':sz(t),'inline-end':sz(e),'block-end':sz(b),'inline-start':sz(s)}});
const gap = (c,r=c) => ({$$type:'layout-direction', value:{column:sz(c), row:sz(r)}});
const link = url => ({$$type:'link', value:{destination:{$$type:'url', value:url}, isTargetBlank:null}});
const img = (id, size='large') => ({$$type:'image', value:{src:{$$type:'image-src', value:{id:{$$type:'image-attachment-id', value:id}, url:null}}, size:str(size)}});
const font = {$$type:'global-font-variable', value:V.font};
const bg = id => ({$$type:'background', value:{color:gc(id)}});
function A(type, settings={}, st={}, children=[], label) {
  const id = uid(); const sid = 'e-'+id+'-'+uid().slice(0,7); const variants = [];
  for (const [bp, props] of Object.entries(st)) { const [b, s] = bp.split(':'); variants.push({meta:{breakpoint:b, state:s||null}, props, custom_css:null}); }
  const el = { id, elType: type, isInner:false, settings:{...settings}, styles:{}, elements: children, editor_settings: label?{title:label}:{} };
  if (variants.length) { el.styles[sid] = {id:sid, label:'local', type:'class', variants}; el.settings.classes = {$$type:'classes', value:[sid]}; }
  if (type !== 'e-flexbox' && type !== 'e-div-block') { el.widgetType = type; el.elType = 'widget'; }
  return el;
}
const W = (widgetType, settings={}, label) => ({ id: uid(), elType:'widget', widgetType, settings: {...settings, _title: label||''}, elements:[] });
const F = (st, kids, label, tag='div', extra={}) => A('e-flexbox', {tag:str(tag), ...extra}, st, kids, label);
const P = (html, st) => A('e-paragraph', {paragraph:{$$type:'escaped-html', value:html}, tag:str('p')}, st);
const H = (html, tag, st) => A('e-heading', {title:{$$type:'escaped-html', value:html}, tag:str(tag)}, st);
const I = (id, st, size) => A('e-image', {image:img(id, size)}, st);
const S = 'https://keterlion.com/staging';
const t = (c, s, w='400', extra={}) => ({ desktop:{ color:c, 'font-family':font, 'font-size':sz(s), 'font-weight':str(w), margin:sz(0), 'line-height':sz(1.65,'em'), ...extra } });
const h1 = (c=V.black) => ({ desktop:{ color:gc(c), 'font-family':font, 'font-weight':str('900'), 'font-size':sz(64), 'line-height':sz(1,'em'), 'letter-spacing':sz(-0.01,'em'), margin:sz(0) }, tablet:{ 'font-size':sz(52) }, mobile:{ 'font-size':sz(40) } });
const h2 = (c=V.black) => ({ desktop:{ color:gc(c), 'font-family':font, 'font-weight':str('900'), 'font-size':sz(48), 'line-height':sz(1.05,'em'), 'letter-spacing':sz(-0.01,'em'), margin:sz(0) }, mobile:{ 'font-size':sz(34) } });
const bar = (c=V.gold, w=32, h=4) => F({ desktop:{ width:sz(w), height:sz(h), 'min-height':sz(h), padding:sz(0), background:bg(c), 'flex-shrink':{$$type:'number', value:0} } }, [], 'פס זהב');
const eyebrow = (s, c=V.black, barC=V.gold) => F({ desktop:{ 'flex-direction':str('row'), 'align-items':str('center'), gap:gap(14), padding:sz(0) } }, [ bar(barC), P(s, t(gc(c), 13, '500', { 'letter-spacing':sz(0.24,'em'), 'line-height':sz(1.4,'em') })) ], 'כותרת עליונה');
const lead = (s, c=V.black) => P(s, { desktop:{ color:gc(c), 'font-family':font, 'font-size':sz(18), 'line-height':sz(1.65,'em'), margin:sz(0), 'max-width':sz(520) }, mobile:{ 'font-size':sz(16) } });
const btn = (text, url, kind='dark') => { const k = { dark:[V.black,V.white,V.black], out:[null,V.black,V.black], light:[V.white,V.black,V.white], lightOut:[null,V.white,V.white], gold:[V.gold,V.black,V.gold] }[kind];
  return A('e-button', {text:{$$type:'escaped-html', value:text}, link:link(url)}, { desktop:{ 'font-family':font, 'font-weight':str('700'), 'font-size':sz(16), padding:dims(16,28,16,28), 'border-style':str('solid'), 'border-width':sz(1), 'border-color':gc(k[2]), color:gc(k[1]), background: k[0]?bg(k[0]):{$$type:'background', value:{color:col('rgba(0,0,0,0)')}}, 'border-radius':sz(4), 'text-align':str('center') } }); };
const tlink = (text, url, c=V.black) => A('e-button', {text:{$$type:'escaped-html', value:text}, link:link(url)}, { desktop:{ 'font-family':font, 'font-weight':str('700'), 'font-size':sz(16), color:gc(c), padding:dims(0,0,3,0), 'border-style':str('solid'), 'border-width':bw(0,0,2,0), 'border-color':gc(V.gold), 'border-radius':sz(0), background:{$$type:'background', value:{color:col('rgba(0,0,0,0)')}} } });
const chip = (txt, url) => A('e-button', {text:{$$type:'escaped-html', value:txt}, link:link(url)}, { desktop:{ 'font-family':font, 'font-weight':str('500'), 'font-size':sz(14), color:gc(V.black), padding:dims(9,16,9,16), 'border-style':str('solid'), 'border-width':sz(1), 'border-color':gc(V.black), 'border-radius':sz(4), background:bg(V.white) } });
const row = (kids, extra={}) => F({ desktop:{ padding:sz(0), gap:gap(12), 'flex-wrap':str('wrap'), 'align-items':str('center'), ...extra } }, kids);
const inner = (kids, g=24) => F({ desktop:{ 'flex-direction':str('column'), width:sz(100,'%'), 'max-width':sz(1360), padding:sz(0), gap:gap(0,g) } }, kids);
const sec = (kids, label, o={}) => F({ desktop:{ 'flex-direction':str('column'), 'align-items':str('center'), padding:dims(o.top??72,40,o.bottom??80,40), ...(o.bg?{background:bg(o.bg)}:{}), ...(o.line?{'border-style':str('solid'), 'border-color':gc(V.line), 'border-width':bw(0,0,1,0)}:{}) }, tablet:{ padding:dims(Math.min(o.top??72,56),24,56,24) }, mobile:{ padding:dims(Math.min(o.top??72,40),16,44,16) } }, [inner(kids, o.gap)], label, 'section');
const grid = (cols, kids, mcols='1fr', g=12) => F({ desktop:{ display:str('grid'), 'grid-template-columns':str(cols), gap:gap(g), padding:sz(0) }, mobile:{ 'grid-template-columns':str(mcols) } }, kids);
const products = (extra={}, label='מוצרים') => W('woocommerce-products', { columns:4, columns_tablet:3, columns_mobile:2, rows:6, paginate:'yes', allow_order:'yes', show_result_count:'yes', query_post_type:'product', query_orderby:'popularity', query_order:'desc', ...extra }, label);
const HAT = S+'/product-category/%D7%A1%D7%95%D7%92-%D7%9B%D7%95%D7%91%D7%A2/';
async function ready(id){ for (let i=0;i<35 && !(window.elementor?.getPreviewContainer?.() && document.querySelector('#elementor-preview-iframe')?.contentDocument?.querySelector('.elementor-'+id));i++) await new Promise(r=>setTimeout(r,1000)); await new Promise(r=>setTimeout(r,1200)); try{$e.run('library/close')}catch(e){} }
async function backup(postId, title){ const data = JSON.stringify(elementor.elements.toJSON({remove:['default']})); return new Promise(res => elementorCommon.ajax.addRequest('save_template', { data: { source:'local', type:'page', post_id: postId, title, content: data }, success: d=>res(d?.template_id), error: e=>res('err') }, true)); }
async function replace(models){ const root = elementor.getPreviewContainer(); for (const c of [...root.children]) await $e.run('document/elements/delete', { container: c }); for (const m of models) await $e.run('document/elements/create', { container: root, model: m, options:{} }); }
function baseCss(id){ return '.elementor-'+id+' .elementor-widget{width:100%;max-width:none}\n.elementor-'+id+' .e-con > *{min-width:0}\n.elementor-'+id+' img{max-width:100%}\n.elementor-'+id+' h1, .elementor-'+id+' h2{overflow-wrap:anywhere}\n.elementor-'+id+' a.e-button-base{min-height:52px;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;flex:0 0 auto}\n.elementor-'+id+' p a{color:inherit;text-decoration:underline;text-decoration-color:#AE8E42;text-decoration-thickness:2px;text-underline-offset:4px}\n'; }
async function save(){ let err=null; try { await $e.run('document/save/publish'); } catch(e){ err=String(e).slice(0,120); } await new Promise(r=>setTimeout(r,2500)); return err; }
async function pageCss(css){ const page = elementor.settings.page.getEditedView().getContainer(); await $e.run('document/elements/settings', { container: page, settings: { custom_css: css, hide_title:'yes' } }); }
return {uid,V,sz,str,gc,col,dims,bw,gap,link,img,font,bg,A,W,F,P,H,I,S,t,h1,h2,bar,eyebrow,lead,btn,tlink,chip,row,inner,sec,grid,products,HAT,ready,backup,replace,baseCss,save,pageCss};
})();

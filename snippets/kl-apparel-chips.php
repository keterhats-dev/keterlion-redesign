<?php
// Code Snippets "KL apparel chips" (front-end). Approved by the user 26.11.2026 ("כן תשנה גם את זה").
// On the clothing category pages (ביגוד 768, חולצות 777, פוטרים 822, חולצות שרוול ארוך 823) the hat-type chips row
// (3736f5d in KL Archive 2026, 23976) shows clothing categories instead: כל הביגוד · חולצות · פוטרים · חולצות שרוול ארוך.
// Same look as the hat chips (the first chip is cloned); the current category is filled black.
// To undo: deactivate the snippet and purge the LiteSpeed cache.
add_action('wp_head', function () {
	if ( function_exists('is_product_category') && is_product_category( array(768, 777, 822, 823) ) ) {
		echo '<style id="kl-apparel-chips-css">.elementor-element-3736f5d{visibility:hidden}.elementor-element-3736f5d.kl-ready{visibility:visible}.elementor-element-3736f5d a.kl-cur{background:#171717!important;color:#fff!important;border-color:#171717!important}</style>';
	}
}, 99);
add_action('wp_footer', function () {
	if ( ! function_exists('is_product_category') || ! is_product_category( array(768, 777, 822, 823) ) ) return;
	$cur   = get_queried_object_id();
	$items = array( array(768, 'כל הביגוד'), array(777, 'חולצות'), array(822, 'פוטרים'), array(823, 'חולצות שרוול ארוך') );
	$out   = array();
	foreach ( $items as $it ) {
		$link = get_term_link( (int) $it[0], 'product_cat' );
		if ( is_wp_error( $link ) ) continue;
		$out[] = array( 't' => $it[1], 'u' => $link, 'c' => ( (int) $it[0] === (int) $cur ) );
	}
	?>
<script id="kl-apparel-chips-js">
(function(){
  var row=document.querySelector('.elementor-element-3736f5d'); if(!row) return;
  var tpl=row.querySelector('a'); var items=<?php echo wp_json_encode( $out ); ?>;
  if(tpl&&items.length){ row.innerHTML=''; items.forEach(function(it){ var a=tpl.cloneNode(false); a.textContent=it.t; a.href=it.u; if(it.c){a.className+=' kl-cur'; a.setAttribute('aria-current','page');} row.appendChild(a); }); }
  row.classList.add('kl-ready');
  var cur=row.querySelector('.kl-cur'); if(cur){ var d=cur.getBoundingClientRect(), r=row.getBoundingClientRect(); if(d.left<r.left) row.scrollLeft-=(r.left-d.left)+16; else if(d.right>r.right) row.scrollLeft+=(d.right-r.right)+16; }
})();
</script>
	<?php
}, 99);

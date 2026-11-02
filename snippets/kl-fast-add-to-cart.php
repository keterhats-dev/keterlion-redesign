<?php
/**
 * KL fast add to cart (Code Snippets on the live site, 2.11.2026)
 *
 * On product pages the add-to-cart button used to post the form and reload the whole page:
 * about 1.5 s on the server, then a full page load on the phone. Now the form is posted in the
 * background to ?wc-ajax=kl_add_to_cart, and the page stays where it is.
 *
 * The adding itself is still done by WooCommerce's own form handler (WC_Form_Handler on wp_loaded),
 * with every field of the form, so sizes chosen on the page ("any size" variations) work exactly as before.
 * This handler only returns the notices ("added to cart" or the error) and the cart fragments,
 * and the script opens the side cart through the usual added_to_cart event.
 *
 * Testing: while KL_FAST_ATC_EVERYONE is false, only admins get the script.
 */
if ( ! defined( 'KL_FAST_ATC_EVERYONE' ) ) {
	define( 'KL_FAST_ATC_EVERYONE', false );
}

add_action( 'wc_ajax_kl_add_to_cart', function () {
	$notices = wc_print_notices( true );
	ob_start();
	woocommerce_mini_cart();
	$mini = ob_get_clean();
	wp_send_json( array(
		'error'     => false !== strpos( $notices, 'woocommerce-error' ) || false !== strpos( $notices, 'is-error' ),
		'notices'   => $notices,
		'fragments' => apply_filters( 'woocommerce_add_to_cart_fragments', array(
			'div.widget_shopping_cart_content' => '<div class="widget_shopping_cart_content">' . $mini . '</div>',
		) ),
		'cart_hash' => WC()->cart ? WC()->cart->get_cart_hash() : '',
	) );
} );

add_action( 'wp_footer', function () {
	if ( ! function_exists( 'is_product' ) || ! is_product() ) {
		return;
	}
	if ( ! KL_FAST_ATC_EVERYONE && ! current_user_can( 'manage_options' ) ) {
		return;
	}
	?>
<script data-no-optimize="1" data-no-defer="1">
(function () {
  if (!window.fetch || !window.FormData) return;
  var endpoint = <?php echo wp_json_encode( WC_AJAX::get_endpoint( 'kl_add_to_cart' ) ); ?>;
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || !form.matches || !form.matches('form.cart')) return;
    // leave alone: file uploads and Zakeke (custom design has its own flow; its form carries a hidden "zdesign" field)
    if (form.querySelector('input[type="file"], [name="zdesign"], [name*="zakeke"], [class*="zakeke"]')) return;
    var btn = e.submitter || form.querySelector('.single_add_to_cart_button');
    if (!btn || btn.disabled || /\b(disabled|wc-variation-selection-needed|wc-variation-is-unavailable|loading)\b/.test(btn.className)) return;
    e.preventDefault();
    var fd = new FormData(form);
    if (btn.name && btn.value && !fd.has(btn.name)) fd.append(btn.name, btn.value);
    btn.classList.add('loading');
    btn.disabled = true;
    var $ = window.jQuery;
    fetch(endpoint, { method: 'POST', body: fd, credentials: 'same-origin' })
      .then(function (r) {
        // a redirect means WooCommerce already added and wants another page (e.g. the cart)
        if (r.redirected) { location.href = r.url; throw 'redirected'; }
        return r.json();
      })
      .then(function (d) {
        var wrap = document.querySelector('.woocommerce-notices-wrapper');
        if (wrap && d.notices) wrap.innerHTML = d.notices;
        if (d.error) return;
        if ($ && d.fragments) Object.keys(d.fragments).forEach(function (sel) { $(sel).replaceWith(d.fragments[sel]); });
        if ($) $(document.body).trigger('added_to_cart', [d.fragments, d.cart_hash, $(btn)]);
      })
      .catch(function (err) {
        // the server may already have added it, so never post again: show the real state instead
        if (err !== 'redirected') location.reload();
      })
      .then(function () {
        btn.classList.remove('loading');
        btn.disabled = false;
      });
  }, true);
})();
</script>
	<?php
}, 99 );

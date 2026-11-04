<?php
/**
 * KL custom design in the cart (Code Snippets on the live site, 4.11.2026)
 *
 * A hat designed in Zakeke used to show in the cart and the side cart with a sliding gallery of its sides
 * that spilled out of the item, pink arrows, and the colour with its internal number ("שחור 1").
 * Now every side shows as a small labelled photo in one row, the edit link reads "עריכת העיצוב ←",
 * and the colour shows without the number. That is only in the cart: orders keep the full name for the team.
 * To undo: switch this snippet off.
 */

add_filter( 'woocommerce_get_item_data', function ( $item_data, $cart_item ) {
	if ( empty( $cart_item['product_id'] ) || 22544 !== (int) $cart_item['product_id'] ) {
		return $item_data;
	}
	foreach ( $item_data as &$row ) {
		foreach ( array( 'value', 'display' ) as $k ) {
			if ( isset( $row[ $k ] ) && is_string( $row[ $k ] ) ) {
				$row[ $k ] = preg_replace( '/\s+\d+\s*$/u', '', $row[ $k ] );
			}
		}
	}
	return $item_data;
}, 20, 2 );

add_action( 'wp_head', function () {
	?>
<style id="kl-zakeke-cart">
html body .zakeke-cart-previews{width:auto !important;max-width:100% !important;margin:6px 0 8px !important}
html body .zakeke-cart-previews .glide__track{overflow:visible !important}
html body .zakeke-cart-previews .glide__slides{display:flex !important;flex-wrap:wrap !important;gap:8px !important;width:auto !important;transform:none !important;white-space:normal !important}
html body .zakeke-cart-previews .glide__slide{width:62px !important;margin:0 !important;flex:0 0 62px !important}
html body .zakeke-cart-previews .glide__slide img{width:62px !important;height:62px !important;object-fit:contain;background:#fff;border:1px solid #DDD3BD;display:block}
html body .zakeke-cart-previews .glide__slide::after{content:attr(data-label);display:block;font-size:11px;font-weight:400;color:#6B6B69;text-align:center;margin-top:2px}
html body .zakeke-cart-previews .glide__arrows,html body .zakeke-cart-previews .glide__arrow,html body .zakeke-cart-previews .glide__bullets{display:none !important}
html body .elementor-menu-cart__product .zakeke-cart-previews .glide__slides{gap:4px !important}
html body .elementor-menu-cart__product .zakeke-cart-previews .glide__slide{width:34px !important;flex:0 0 34px !important}
html body .elementor-menu-cart__product .zakeke-cart-previews .glide__slide img{width:34px !important;height:34px !important}
html body .elementor-menu-cart__product .zakeke-cart-previews .glide__slide::after{font-size:10px}
.product-name:has(.zakeke-cart-edit),.elementor-menu-cart__product-name:has(.zakeke-cart-edit){font-weight:700 !important;color:#171717 !important}
.product-name:has(.zakeke-cart-edit) dl,.elementor-menu-cart__product-name:has(.zakeke-cart-edit) dl{font-weight:400}
.zakeke-cart-edit{display:block;margin:4px 0 2px}
html body .zakeke-cart-edit a{font-size:0 !important;color:#171717 !important;text-decoration:none !important}
html body .zakeke-cart-edit a::after{content:"עריכת העיצוב ←";font-size:13px;font-weight:500;text-decoration:underline;text-decoration-color:#AE8E42;text-decoration-thickness:2px;text-underline-offset:4px}
</style>
	<?php
}, 99 );

<?php
/**
 * KL speed fixes 2 (Code Snippets on the live site, 4.11.2026). "Only run on site front-end".
 * Each part was switched on separately, after the user approved it ("yes", 4.11.2026).
 *
 * A. Product page: WooCommerce hides the whole product gallery (inline opacity:0) until its
 *    JavaScript runs. On a phone that JavaScript runs only after every deferred script, including
 *    the Google tags, so the main photo appeared after 16-19 seconds on a slow phone.
 *    Until the gallery script starts (the inline style still says "opacity: 0"), show only the first
 *    photo, and keep room for the row of small photos (4 per row, each 25% of the gallery width),
 *    so nothing jumps when the slider takes over. The ">" rules stop once the slider wraps the photos,
 *    and the row of small photos stays hidden until the slider is ready (it moved once on desktop).
 *    Live: snippet #29.
 *
 * B. Product cards: WooCommerce prints sizes="(max-width: 300px) 100vw, 300px", so a phone (a card is
 *    about half the screen wide) downloaded the 1024px photo. Now half the screen on phones, 300px on
 *    bigger screens; the card gallery copies it to its extra photos. /all-products/ on a slow phone:
 *    13.8-16.9MB -> 3.9MB.
 *
 * C. Phone: the black strip above the header ("משלוח חינם מעל ₪249 ...", container c08b6d2 in
 *    KL Header 2026) is one line in the fallback font and two lines in Heebo, so the whole page
 *    jumped down when Heebo arrived (CLS 0.38 on the home page). It now keeps the height of two lines
 *    (46px with its padding) on phones; the text stays centred. Home page on a phone: CLS 0.38 -> 0.
 *
 * Not done (4.11.2026): removing first.removeAttribute('loading') in the card gallery (header widget
 * e28350b). Tested live for a few minutes and reverted: lazy first photos inside the gallery track
 * showed late while scrolling. B gave most of the saving anyway.
 *
 * To undo one part: delete its block below. To undo all: switch the snippet off.
 */

if ( ! defined( 'ABSPATH' ) ) {
	return;
}

/* B. sizes for product card photos ----------------------------------------------------------------- */
add_filter( 'wp_get_attachment_image_attributes', function ( $attr, $attachment, $size ) {
	if ( $size === 'woocommerce_thumbnail' && ! empty( $attr['sizes'] ) ) {
		$attr['sizes'] = '(max-width: 767px) 50vw, 300px';
	}
	return $attr;
}, 20, 3 );

/* A. CSS ----------------------------------------------------------------------------------------- */
add_action( 'wp_head', function () {
	?>
<style id="kl-speed-2">
.woocommerce-product-gallery[style*="opacity: 0"]{opacity:1 !important}
.woocommerce-product-gallery[style*="opacity: 0"] > .woocommerce-product-gallery__wrapper > .woocommerce-product-gallery__image:not(:first-child){display:none}
.woocommerce-product-gallery[style*="opacity: 0"] > .woocommerce-product-gallery__wrapper:has(>.woocommerce-product-gallery__image:nth-child(2)){margin-bottom:25%}
.woocommerce-product-gallery[style*="opacity: 0"] > .woocommerce-product-gallery__wrapper:has(>.woocommerce-product-gallery__image:nth-child(5)){margin-bottom:50%}
.woocommerce-product-gallery[style*="opacity: 0"] > .woocommerce-product-gallery__wrapper:has(>.woocommerce-product-gallery__image:nth-child(9)){margin-bottom:75%}
.woocommerce-product-gallery[style*="opacity: 0"] .flex-control-thumbs{visibility:hidden}
@media (max-width:767px){.elementor-element-c08b6d2[data-id="c08b6d2"]{min-height:46px}}
</style>
	<?php
}, 99 );

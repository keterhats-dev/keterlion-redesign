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
 * Card gallery (not in this snippet; header widget e28350b, copy in snippets/kl-search-products.html):
 * first try, removing first.removeAttribute('loading'), was reverted after a few minutes (lazy first
 * photos inside the gallery track showed late while scrolling). What is live now (approved "yes, both"):
 * a card's gallery is built only when the card is within 600px of the screen (IntersectionObserver),
 * so far-away cards keep their normal lazy photo. /all-products/ on a phone: 11.5MB -> 5.8MB.
 *
 * To undo one part: delete its block below. To undo all: switch the snippet off.
 */

if ( ! defined( 'ABSPATH' ) ) {
	return;
}

/* E. Zakeke design tool: a loading message behind the Zakeke frame (approved "yes, 1 to 3", 9.11.2026).
 *    The frame is see-through until Zakeke draws, so the customer sees the message instead of a white
 *    page; Zakeke's own skeleton covers it when ready. */
add_action( 'wp_head', function () {
	?>
<style id="kl-zakeke-loading">
#zakeke-container{position:relative;background:#fff}
#zakeke-container::before{content:"טוען את כלי העיצוב";position:absolute;left:16px;right:16px;top:38%;text-align:center;font:500 20px/1.4 Heebo,Arial,sans-serif;color:#171717;z-index:0;animation:klzk 1.6s ease-in-out infinite}
#zakeke-container::after{content:"רגע אחד, זה יכול לקחת כמה שניות";position:absolute;left:16px;right:16px;top:calc(38% + 36px);text-align:center;font:400 15px/1.4 Heebo,Arial,sans-serif;color:#6B6B69;z-index:0}
#zakeke-container #zakeke-frame{position:relative;z-index:1;background:transparent}
@keyframes klzk{0%,100%{opacity:1}50%{opacity:.4}}
@media (prefers-reduced-motion:reduce){#zakeke-container::before{animation:none}}
</style>
	<?php
}, 99 );

/* D. Load the two Heebo files (Hebrew and Latin) early (approved "yes, both", 4.11.2026). After C and the
 *    LiteSpeed change the page shows sooner, and the home page heading sometimes jumped (CLS 0.198)
 *    when Heebo 900 arrived. With the preload: 0-0.0008 in 3 runs. Each file still downloads once. */
add_action( 'wp_head', function () {
	$up = wp_upload_dir();
	foreach ( array( 'heebo-255b36d2.woff2', 'heebo-01a8f305.woff2' ) as $f ) {
		if ( file_exists( $up['basedir'] . '/elementor/google-fonts/fonts/' . $f ) ) {
			echo '<link rel="preload" href="' . esc_url( $up['baseurl'] . '/elementor/google-fonts/fonts/' . $f ) . '" as="font" type="font/woff2" crossorigin>' . "\n";
		}
	}
}, 1 );

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

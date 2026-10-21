<?php
/**
 * Keterlion – speed fixes (stage 9, 21.10.2026)
 *
 * Installed as ONE snippet in the "Code Snippets" plugin ("Only run on site front-end").
 * Tested on staging first; copy the same code to the live site only after approval.
 *
 * 1. Elementor atomic images (e-image) print a srcset without "sizes", so phones download a large
 *    version of every image, even a 90px icon. Add sizes: "auto" for lazy images (the browser uses
 *    the real width), and a sensible default for the rest.
 * 2. The first image of the page content loads first (fetchpriority=high); the header logos lose it.
 * 3. Single product: the main image is never lazy, and the hover zoom is off (it preloaded the
 *    1800px original, about 1MB, on every product page). The click-to-enlarge lightbox stays.
 * 4. Zakeke product-page files (carousel and product script) only where a product can be customized.
 *    shop.js / shop.css stay everywhere, because they show the design preview in the side cart.
 *    (The two small glide CSS files still print; Zakeke adds them after this hook. Harmless.)
 *
 * Staging: installed as snippet #21. Snippet #20 is an older copy, inactive. Never turn both on
 * (same function name, fatal error).
 */

if ( ! defined( 'ABSPATH' ) ) {
	return;
}

/* 3. No hover zoom on product pages ---------------------------------------------------------------- */
add_filter( 'woocommerce_single_product_zoom_enabled', '__return_false' );

/* 1 + 2 + 3. Image attributes, done once on the final HTML ------------------------------------------- */
add_action( 'template_redirect', function () {
	if ( is_admin() || wp_doing_ajax() || is_feed() || isset( $_GET['elementor-preview'] ) ) {
		return;
	}
	ob_start( 'kl_speed_filter_html' );
}, 1 );

function kl_speed_filter_html( $html ) {
	if ( stripos( $html, '<html' ) === false ) {
		return $html;
	}

	// Where the page content starts (anything before it is the header) and where the footer starts.
	$main = strpos( $html, '<main' );
	if ( preg_match_all( '/data-elementor-type="([a-z0-9_-]+)"/', $html, $types, PREG_OFFSET_CAPTURE ) ) {
		foreach ( $types[1] as $type ) {
			if ( ! in_array( $type[0], array( 'header', 'footer', 'popup' ), true ) ) {
				$main = ( $main === false ) ? $type[1] : min( $main, $type[1] );
				break;
			}
		}
	}
	$footer = strpos( $html, 'data-elementor-type="footer"' );
	if ( $footer === false ) {
		$footer = PHP_INT_MAX;
	}

	$first_done = false;

	return preg_replace_callback( '/<img\b[^>]*>/i', function ( $m ) use ( $main, $footer, &$first_done ) {
		$tag    = $m[0][0];
		$offset = $m[0][1];
		$lazy   = stripos( $tag, 'loading="lazy"' ) !== false;

		// 1. sizes for atomic images.
		if ( strpos( $tag, 'e-image-base' ) !== false && stripos( $tag, 'srcset=' ) !== false && stripos( $tag, ' sizes=' ) === false ) {
			$sizes = $lazy ? 'auto, (max-width: 767px) 50vw, 400px' : '(max-width: 767px) 100vw, 50vw';
			$tag   = preg_replace( '/^<img\b/i', '<img sizes="' . $sizes . '"', $tag );
		}

		if ( $main === false ) {
			return $tag;
		}

		// 2. Header and footer images: no high priority.
		if ( $offset < $main || $offset > $footer ) {
			return str_ireplace( ' fetchpriority="high"', '', $tag );
		}

		// 2 + 3. First content image (or the product main image) loads first.
		$is_product_main = strpos( $tag, 'wp-post-image' ) !== false && function_exists( 'is_product' ) && is_product();
		if ( ! $first_done && ( ( ! $lazy && strpos( $tag, 'e-image-base' ) !== false ) || $is_product_main ) ) {
			$first_done = true;
			$tag        = str_ireplace( ' loading="lazy"', '', $tag );
			if ( stripos( $tag, 'fetchpriority=' ) === false ) {
				$tag = preg_replace( '/^<img\b/i', '<img fetchpriority="high"', $tag );
			}
		}

		return $tag;
	}, $html, -1, $count, PREG_OFFSET_CAPTURE );
}

/* 4. Zakeke product-page files only on product, cart, checkout and account pages -------------------- */
add_action( 'wp_enqueue_scripts', function () {
	if ( ! function_exists( 'is_product' ) ) {
		return;
	}
	if ( is_product() || is_cart() || is_checkout() || is_account_page() ) {
		return;
	}
	foreach ( array( 'zakeke-product-page', 'zakeke-glide' ) as $handle ) {
		wp_dequeue_script( $handle );
	}
	foreach ( array( 'zakeke-glide', 'zakeke-glide-theme' ) as $handle ) {
		wp_dequeue_style( $handle );
	}
}, 100 );

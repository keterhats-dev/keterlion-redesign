<?php
/**
 * The [kl_studio] shortcode: the tool's container, its configuration and its assets.
 */
defined( 'ABSPATH' ) || exit;

add_shortcode( 'kl_studio', 'kls_shortcode' );

/** Is the current page the studio page (shortcode in the content or in an Elementor widget)? */
function kls_is_studio_page() {
	global $post;
	if ( ! is_singular() || ! $post ) {
		return false;
	}
	return has_shortcode( (string) $post->post_content, 'kl_studio' ) || false !== strpos( (string) get_post_meta( $post->ID, '_elementor_data', true ), 'kl_studio' );
}

/** A body class on the studio page, so the theme's own page title can be hidden there (the tool has its own). */
add_filter( 'body_class', function ( $classes ) {
	if ( kls_is_studio_page() ) {
		$classes[] = 'kls-page';
	}
	return $classes;
} );

add_action( 'wp_enqueue_scripts', function () {
	if ( kls_is_studio_page() ) {
		kls_enqueue();
	}
} );

function kls_enqueue() {
	$families = array();
	foreach ( kls_fonts() as $f ) {
		if ( 0 !== strpos( $f['g'], 'Heebo' ) ) { // Heebo is loaded once below, with all weights
			$families[] = 'family=' . $f['g'];
		}
	}
	$families[] = 'family=Heebo:wght@400;500;600;700;800;900';
	$families[] = 'family=Suez+One';
	wp_enqueue_style( 'kls-fonts', 'https://fonts.googleapis.com/css2?' . implode( '&', array_unique( $families ) ) . '&display=swap', array(), null );
	wp_enqueue_style( 'kls-studio', KLS_URL . 'assets/studio.css', array(), KLS_VERSION );
	wp_enqueue_script( 'kls-studio', KLS_URL . 'assets/studio.js', array(), KLS_VERSION, true );
}

function kls_shortcode() {
	if ( ! function_exists( 'WC' ) ) {
		return '';
	}
	kls_enqueue();
	$json = wp_json_encode( kls_front_config(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP );
	return '<div id="kl-studio" class="kls"><noscript>כדי לעצב כובע צריך להפעיל JavaScript בדפדפן.</noscript></div>'
		. '<script type="application/json" id="kls-config">' . $json . '</script>';
}

/**
 * Take over from Zakeke: the base product page (where every "עיצוב אישי" link points) sends visitors to the studio page.
 * Off by default. Turning the setting off brings the product page with Zakeke straight back.
 */
add_action( 'template_redirect', function () {
	$s = kls_settings();
	if ( empty( $s['take_over'] ) || empty( $s['page_id'] ) || ! is_singular( 'product' ) ) {
		return;
	}
	if ( (int) get_queried_object_id() !== (int) $s['product_id'] || 'publish' !== get_post_status( (int) $s['page_id'] ) ) {
		return;
	}
	wp_safe_redirect( get_permalink( (int) $s['page_id'] ), 302 );
	exit;
}, 1 );

/** Keep the studio page out of page caches: the config carries live prices, stock and a nonce. */
add_action( 'template_redirect', function () {
	if ( kls_is_studio_page() ) {
		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true );
		}
		do_action( 'litespeed_control_set_nocache', 'kl-studio page' );
	}
} );

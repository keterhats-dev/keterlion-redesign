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

/** Keep the studio page out of page caches: the config carries live prices, stock and a nonce. */
add_action( 'template_redirect', function () {
	if ( kls_is_studio_page() ) {
		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true );
		}
		do_action( 'litespeed_control_set_nocache', 'kl-studio page' );
	}
} );

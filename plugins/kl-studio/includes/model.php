<?php
/**
 * The caps (cap-model.json + live WooCommerce variations) and the embroidery book (gallery.json).
 */
defined( 'ABSPATH' ) || exit;

function kls_read_json( $file ) {
	static $cache = array();
	if ( ! isset( $cache[ $file ] ) ) {
		$raw            = file_get_contents( KLS_DIR . 'assets/data/' . $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		$cache[ $file ] = $raw ? json_decode( $raw, true ) : array();
	}
	return $cache[ $file ];
}

/** Geometry of every cap colour, keyed by WooCommerce variation id. */
function kls_cap_model() {
	return kls_read_json( 'cap-model.json' );
}

/**
 * Variants the customer can pick: geometry from the model, price and stock from WooCommerce.
 * A variation that was deleted, unpublished or moved to another product is left out.
 */
function kls_variants() {
	static $out = null;
	if ( null !== $out ) {
		return $out;
	}
	$out   = array();
	$model = kls_cap_model();
	$pid   = (int) kls_settings()['product_id'];
	foreach ( (array) $model['variants'] as $v ) {
		$p = wc_get_product( (int) $v['id'] );
		if ( ! $p || ! $p->is_type( 'variation' ) || (int) $p->get_parent_id() !== $pid || 'publish' !== get_post_status( $p->get_parent_id() ) ) {
			continue;
		}
		$img = array();
		foreach ( array_keys( kls_sides() ) as $side ) {
			$img[ $side ] = KLS_URL . 'assets/caps/' . (int) $v['id'] . '-' . $side . '.jpg';
		}
		$out[ (int) $v['id'] ] = array(
			'id'    => (int) $v['id'],
			'shape' => $v['shape'],
			'slug'  => $v['slug'],
			'name'  => $v['name'],
			'hex'   => $v['hex'],
			'front' => array_map( 'floatval', $v['front'] ),
			'price' => (float) wc_get_price_to_display( $p ),
			'stock' => $p->is_in_stock() && $p->is_purchasable(),
			'img'   => $img,
		);
	}
	return $out;
}

/** Embroidery book: [ id => [n, c, m, s] ]. */
function kls_gallery() {
	static $idx = null;
	if ( null === $idx ) {
		$idx = array();
		foreach ( (array) kls_read_json( 'gallery.json' ) as $g ) {
			$idx[ (string) $g['id'] ] = $g;
		}
	}
	return $idx;
}

/** Short customer-facing name of a book design ("Faith - אמונה" → "אמונה"). */
function kls_design_name( $g ) {
	$parts = preg_split( '/\s+-\s+/u', $g['n'] );
	foreach ( $parts as $p ) {
		if ( preg_match( '/\p{Hebrew}/u', $p ) ) {
			return trim( $p );
		}
	}
	return trim( preg_replace( '/\s*\d+(\.\d+)?\s*cm$/i', '', $parts[0] ) );
}

/** Configuration handed to studio.js. */
function kls_front_config() {
	$s      = kls_settings();
	$model  = kls_cap_model();
	$shapes = array();
	foreach ( $model['shapes'] as $k => $sh ) {
		$shapes[ $k ] = $sh;
	}
	return array(
		'demo'       => false,
		'currency'   => html_entity_decode( get_woocommerce_currency_symbol() ),
		'imageSize'  => (int) $model['imageSize'],
		'viewBox'    => array( 32, 170, 960, 640 ),
		'sides'      => array_keys( kls_sides() ),
		'sideLabels' => kls_sides(),
		'shapes'     => $shapes,
		'variants'   => array_values( kls_variants() ),
		'threads'    => kls_threads(),
		'fonts'      => array_map( function ( $f ) { unset( $f['g'] ); return $f; }, kls_fonts() ),
		'prices'     => array(
			'type'   => array_map( 'floatval', $s['type_price'] ),
			'extra'  => (float) $s['extra'],
			'tiers'  => kls_tiers(),
			'maxQty' => (int) $s['max_qty'],
		),
		'text'       => array( 'max' => (int) $s['text_max'], 'minLetter' => (float) $s['min_letter'] ),
		'upload'     => array( 'maxMb' => (int) $s['upload_mb'] ),
		'logoRules'  => kls_logo_rules(),
		'facts'      => array(
			'delivery' => $s['delivery'],
			'list'     => array( 'סקיצה לאישור ב-WhatsApp לפני שרוקמים', $s['delivery'] . ' מההזמנה' ),
		),
		'b2bUrl'     => $s['b2b_url'],
		'showTitle'  => (bool) $s['show_title'],
		'galleryUrl' => KLS_URL . 'assets/data/gallery.json?v=' . KLS_VERSION,
		'ajax'       => array(
			'upload' => WC_AJAX::get_endpoint( 'kls_upload' ),
			'add'    => WC_AJAX::get_endpoint( 'kls_add_to_cart' ),
		),
		'nonce'      => wp_create_nonce( 'kls' ),
	);
}

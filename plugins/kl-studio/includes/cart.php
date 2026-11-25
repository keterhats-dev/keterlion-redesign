<?php
/**
 * Cart: the price of a designed cap, what the customer sees on each line, and the quantity limit.
 */
defined( 'ABSPATH' ) || exit;

/** Price every designed cap from its design and the line quantity (the server's calculation, not the browser's). */
add_action( 'woocommerce_before_calculate_totals', function ( $cart ) {
	if ( is_admin() && ! wp_doing_ajax() ) {
		return;
	}
	foreach ( $cart->get_cart() as $line ) {
		if ( empty( $line['kls']['design'] ) ) {
			continue;
		}
		$fresh = wc_get_product( $line['variation_id'] );
		if ( ! $fresh ) {
			continue;
		}
		$line['data']->set_price( kls_unit_price( $line['kls']['design'], $line['quantity'], (float) $fresh->get_price( 'edit' ) ) );
	}
}, 20 );

/** Lines under the product name: one per decorated side. */
add_filter( 'woocommerce_get_item_data', function ( $data, $line ) {
	if ( empty( $line['kls']['design'] ) ) {
		return $data;
	}
	$labels = kls_sides();
	foreach ( $line['kls']['design']['items'] as $side => $it ) {
		$data[] = array( 'key' => $labels[ $side ], 'value' => esc_html( kls_describe( $it ) ), 'display' => esc_html( kls_describe( $it ) ) );
	}
	return $data;
}, 10, 2 );

/** The cart thumbnail is the designed cap, not the blank one. */
add_filter( 'woocommerce_cart_item_thumbnail', function ( $thumb, $line ) {
	if ( empty( $line['kls']['previews'] ) ) {
		return $thumb;
	}
	$p   = $line['kls']['previews'];
	$url = $p['front'] ?? reset( $p );
	return '<img src="' . esc_url( $url ) . '" alt="הכובע שעיצבתם" width="300" height="200" style="object-fit:contain;background:#fff">';
}, 10, 2 );

/** Quantity limit for designed caps (above it: the B2B price list). */
add_filter( 'woocommerce_update_cart_validation', function ( $ok, $key, $values, $qty ) {
	$max = (int) kls_settings()['max_qty'];
	if ( ! empty( $values['kls'] ) && $qty > $max ) {
		wc_add_notice( sprintf( 'בעיצוב אישי אפשר להזמין עד %d כובעים בשורה. לכמות גדולה יותר יש מחירון לעסקים.', $max ), 'error' );
		return false;
	}
	return $ok;
}, 10, 4 );

/** The same limit in the block cart (Store API): the quantity picker stops at max_qty and a bigger update is refused. */
add_filter( 'woocommerce_store_api_product_quantity_maximum', function ( $max, $product, $cart_item = null ) {
	if ( is_array( $cart_item ) && ! empty( $cart_item['kls'] ) ) {
		return min( (int) $max, (int) kls_settings()['max_qty'] );
	}
	return $max;
}, 10, 3 );

/** Classic cart: the quantity field itself stops at max_qty. */
add_filter( 'woocommerce_cart_item_quantity', function ( $html, $key, $line ) {
	if ( empty( $line['kls'] ) ) {
		return $html;
	}
	return preg_replace( '/max="\d*"/', 'max="' . (int) kls_settings()['max_qty'] . '"', $html );
}, 10, 3 );

/** Safety net (any other way the quantity grows): trim a designed line back to max_qty before totals. */
add_action( 'woocommerce_before_calculate_totals', function ( $cart ) {
	static $busy = false;
	if ( $busy ) {
		return;
	}
	$max = (int) kls_settings()['max_qty'];
	foreach ( $cart->get_cart() as $key => $line ) {
		if ( ! empty( $line['kls'] ) && (int) $line['quantity'] > $max ) {
			$busy = true;
			$cart->set_quantity( $key, $max, false );
			$busy = false;
			wc_add_notice( sprintf( 'בעיצוב אישי אפשר להזמין עד %d כובעים בשורה. לכמות גדולה יותר יש מחירון לעסקים.', $max ), 'notice' );
		}
	}
}, 5 );

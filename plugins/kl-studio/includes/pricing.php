<?php
/**
 * Validating a design that comes from the browser, and the price of one cap.
 * The browser shows the same calculation (studio.js perCap), but only this one counts.
 */
defined( 'ABSPATH' ) || exit;

/**
 * Cleans a design posted by studio.js. Returns the clean design or WP_Error.
 * Clean design: [ 'variation' => int, 'items' => [ side => [...] ] ] with sizes clamped to the side's area.
 */
function kls_clean_design( $raw ) {
	if ( ! is_array( $raw ) ) {
		return new WP_Error( 'kls', 'העיצוב לא הגיע. רעננו את הדף ונסו שוב.' );
	}
	$variants = kls_variants();
	$vid      = isset( $raw['variation'] ) ? (int) $raw['variation'] : 0;
	if ( ! isset( $variants[ $vid ] ) ) {
		return new WP_Error( 'kls', 'הכובע שבחרתם כבר לא זמין. בחרו צבע אחר.' );
	}
	if ( ! $variants[ $vid ]['stock'] ) {
		return new WP_Error( 'kls', 'הצבע הזה אזל מהמלאי. בחרו צבע אחר.' );
	}
	$s       = kls_settings();
	$model   = kls_cap_model();
	$shape   = $model['shapes'][ $variants[ $vid ]['shape'] ];
	$gallery = kls_gallery();
	$items   = array();
	foreach ( kls_sides() as $side => $label ) {
		if ( empty( $raw['items'][ $side ] ) || ! is_array( $raw['items'][ $side ] ) ) {
			continue;
		}
		$it   = $raw['items'][ $side ];
		$maxW = (float) $shape['sides'][ $side ]['maxW'];
		$maxH = (float) $shape['sides'][ $side ]['maxH'];
		$type = isset( $it['type'] ) ? (string) $it['type'] : '';
		$thr  = isset( $it['thread'] ) ? (string) $it['thread'] : '';
		if ( 'gallery' === $type ) {
			$id = isset( $it['id'] ) ? (string) $it['id'] : '';
			if ( ! isset( $gallery[ $id ] ) ) {
				return new WP_Error( 'kls', 'אחד העיצובים מספר הרקמות כבר לא קיים. בחרו עיצוב אחר.' );
			}
			if ( $gallery[ $id ]['m'] && ! kls_find( kls_threads(), 'code', $thr ) ) {
				return new WP_Error( 'kls', 'צבע החוט לא תקין.' );
			}
			$items[ $side ] = array(
				'type'   => 'gallery',
				'id'     => $id,
				'thread' => $gallery[ $id ]['m'] ? $thr : '',
				'w'      => kls_clamp( $it['w'] ?? 0, 1.5, $maxW ),
			);
		} elseif ( 'text' === $type ) {
			$text = trim( sanitize_text_field( wp_unslash( (string) ( $it['text'] ?? '' ) ) ) );
			$len  = function_exists( 'mb_strlen' ) ? mb_strlen( $text ) : strlen( $text );
			if ( '' === $text ) {
				continue;
			}
			if ( $len > (int) $s['text_max'] ) {
				return new WP_Error( 'kls', sprintf( 'הטקסט ארוך מ-%d תווים.', (int) $s['text_max'] ) );
			}
			if ( ! kls_find( kls_fonts(), 'id', $it['font'] ?? '' ) || ! kls_find( kls_threads(), 'code', $thr ) ) {
				return new WP_Error( 'kls', 'הגופן או צבע החוט לא תקינים.' );
			}
			$items[ $side ] = array(
				'type'   => 'text',
				'text'   => $text,
				'font'   => (string) $it['font'],
				'thread' => $thr,
				'h'      => kls_clamp( $it['h'] ?? 0, (float) $s['min_letter'], min( 4, $maxH ) ),
			);
		} elseif ( 'logo' === $type ) {
			$token = isset( $it['token'] ) ? (string) $it['token'] : '';
			$file  = kls_upload_path( $token );
			if ( ! $file ) {
				return new WP_Error( 'kls', 'הלוגו שהעליתם לא נמצא. העלו אותו שוב.' );
			}
			if ( empty( $it['ok'] ) ) {
				return new WP_Error( 'kls', 'צריך לאשר את כללי הלוגו לפני ההוספה לסל.' );
			}
			$items[ $side ] = array(
				'type'  => 'logo',
				'token' => $token,
				'w'     => kls_clamp( $it['w'] ?? 0, 1.5, $maxW ),
			);
		}
	}
	if ( ! $items ) {
		return new WP_Error( 'kls', 'עוד לא בחרתם עיצוב לכובע.' );
	}
	return array( 'variation' => $vid, 'items' => $items );
}

function kls_clamp( $v, $min, $max ) {
	$v = is_numeric( $v ) ? (float) $v : $min;
	return round( max( $min, min( $max, $v ) ), 1 );
}

/** Price of one cap: the cap itself + decoration, by quantity. */
function kls_unit_price( $design, $qty, $base ) {
	$s     = kls_settings();
	$items = $design['items'];
	if ( ! $items ) {
		return (float) $base;
	}
	$qty = max( 1, (int) $qty );
	if ( 1 === $qty ) {
		$first = 0;
		foreach ( $items as $it ) {
			$first = max( $first, (float) $s['type_price'][ $it['type'] ] );
		}
	} else {
		$first = 0;
		foreach ( kls_tiers() as $t ) {
			if ( $qty >= $t['min'] && $qty <= $t['max'] ) {
				$first = $t['add'];
			}
		}
		$tiers = kls_tiers();
		$last  = end( $tiers );
		if ( $last && $qty > $last['max'] ) {
			$first = $last['add'];
		}
	}
	return (float) $base + $first + (float) $s['extra'] * ( count( $items ) - 1 );
}

/** One readable line per decorated side, for the cart, the order and the emails. */
function kls_describe( $side_item ) {
	$t = kls_find( kls_threads(), 'code', $side_item['thread'] ?? '' );
	switch ( $side_item['type'] ) {
		case 'gallery':
			$g = kls_gallery()[ $side_item['id'] ] ?? null;
			return 'ספר הרקמות: ' . ( $g ? kls_design_name( $g ) : $side_item['id'] ) . ( $t ? ', חוט ' . $t['name'] . ' ' . $t['code'] : ', בצבעים שלו' ) . ', רוחב ' . $side_item['w'] . ' ס״מ';
		case 'text':
			$f = kls_find( kls_fonts(), 'id', $side_item['font'] );
			return 'טקסט: "' . $side_item['text'] . '", גופן ' . ( $f ? $f['name'] : $side_item['font'] ) . ', חוט ' . ( $t ? $t['name'] . ' ' . $t['code'] : '' ) . ', אות ' . $side_item['h'] . ' ס״מ';
		case 'logo':
			return 'הלוגו של הלקוח, רוחב עד ' . $side_item['w'] . ' ס״מ (צריך סקיצה לאישור)';
	}
	return '';
}

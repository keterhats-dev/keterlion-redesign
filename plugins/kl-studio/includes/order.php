<?php
/**
 * Order: when the order is created, every designed cap gets a folder with what the embroidery needs
 * (an SVG per side at real size, the customer's logo, the previews), and the order line keeps the design.
 */
defined( 'ABSPATH' ) || exit;

add_action( 'woocommerce_checkout_create_order_line_item', function ( $item, $cart_key, $values ) {
	if ( empty( $values['kls']['design'] ) ) {
		return;
	}
	$design = $values['kls']['design'];
	$labels = kls_sides();
	foreach ( $design['items'] as $side => $it ) {
		$item->add_meta_data( $labels[ $side ], kls_describe( $it ) );
	}
	$files = kls_build_order_files( $design, $values['kls']['previews'] ?? array(), $values['kls']['key'] );
	$item->add_meta_data( '_kls_design', wp_json_encode( $design, JSON_UNESCAPED_UNICODE ) );
	$item->add_meta_data( '_kls_files', wp_json_encode( $files, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) );
}, 10, 3 );

/** Copies logos and previews out of the temporary folders and writes the production SVGs. Returns [ side => [svg, preview, logo] urls ]. */
function kls_build_order_files( $design, $previews, $key ) {
	$b   = kls_storage_dirs();
	$key = preg_replace( '/[^a-f0-9]/', '', (string) $key ) ?: kls_token();
	$dir = $b['dir'] . '/orders/' . gmdate( 'Y-m' ) . '-' . $key;
	wp_mkdir_p( $dir );
	$out   = array();
	$model = kls_cap_model();
	$v     = null;
	foreach ( $model['variants'] as $row ) {
		if ( (int) $row['id'] === (int) $design['variation'] ) {
			$v = $row;
		}
	}
	$shape = $model['shapes'][ $v ? $v['shape'] : 'dad' ];
	foreach ( $design['items'] as $side => $it ) {
		$row = array();
		if ( 'logo' === $it['type'] ) {
			$src = kls_upload_path( $it['token'] );
			if ( $src ) {
				$dst = $dir . '/' . $side . '-logo.' . pathinfo( $src, PATHINFO_EXTENSION );
				copy( $src, $dst );
				$row['logo'] = kls_path_to_url( $dst );
				$it['file']  = $dst;
			}
		}
		if ( ! empty( $previews[ $side ] ) ) {
			$src = str_replace( $b['url'], $b['dir'], $previews[ $side ] );
			if ( file_exists( $src ) ) {
				$dst = $dir . '/' . $side . '-preview.png';
				copy( $src, $dst );
				$row['preview'] = kls_path_to_url( $dst );
			}
		}
		$svg = kls_production_svg( $side, $it, $shape['sides'][ $side ] );
		if ( $svg ) {
			file_put_contents( $dir . '/' . $side . '.svg', $svg ); // phpcs:ignore
			$row['svg'] = kls_path_to_url( $dir . '/' . $side . '.svg' );
			$place      = kls_placement_svg( $side, $it, $shape['sides'][ $side ], $svg );
			if ( $place ) {
				file_put_contents( $dir . '/' . $side . '-placement.svg', $place ); // phpcs:ignore
				$row['placement'] = kls_path_to_url( $dir . '/' . $side . '-placement.svg' );
			}
		}
		$out[ $side ] = $row;
	}
	return $out;
}

/** One side at real size (mm). Text stays text: the digitiser sets it in the matching embroidery font. */
function kls_production_svg( $side, $it, $area ) {
	$maxW = (float) $area['maxW'] * 10;
	$maxH = (float) $area['maxH'] * 10;
	$t    = kls_find( kls_threads(), 'code', $it['thread'] ?? '' );
	$col  = $t ? $t['hex'] : '#000000';
	$head = '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<!-- KETERLION · ' . str_replace( '--', '- -', esc_html( kls_sides()[ $side ] . ' · ' . kls_describe( $it ) ) ) . ' -->' . "\n";
	if ( 'gallery' === $it['type'] ) {
		$g = kls_gallery()[ $it['id'] ] ?? null;
		if ( ! $g || ! preg_match( '/viewBox="([^"]+)"/', $g['s'], $m ) ) {
			return '';
		}
		$vb = array_map( 'floatval', preg_split( '/[\s,]+/', trim( $m[1] ) ) );
		$w  = min( (float) $it['w'] * 10, $maxW );
		$h  = $w * $vb[3] / $vb[2];
		if ( $h > $maxH ) {
			$h = $maxH;
			$w = $h * $vb[2] / $vb[3];
		}
		$inner = str_replace( 'currentColor', $col, $g['s'] );
		$inner = preg_replace( '/<svg\b/', '<svg x="0" y="0" width="' . round( $w, 2 ) . '" height="' . round( $h, 2 ) . '"', $inner, 1 );
		return $head . '<svg xmlns="http://www.w3.org/2000/svg" width="' . round( $w, 2 ) . 'mm" height="' . round( $h, 2 ) . 'mm" viewBox="0 0 ' . round( $w, 2 ) . ' ' . round( $h, 2 ) . '">' . $inner . '</svg>';
	}
	if ( 'text' === $it['type'] ) {
		$f  = kls_find( kls_fonts(), 'id', $it['font'] );
		$fs = (float) $it['h'] * 10 / 0.72;
		$h  = max( $fs * 1.3, 10 );
		return $head . '<svg xmlns="http://www.w3.org/2000/svg" width="' . $maxW . 'mm" height="' . round( $h, 2 ) . 'mm" viewBox="0 0 ' . $maxW . ' ' . round( $h, 2 ) . '">'
			. '<text x="' . ( $maxW / 2 ) . '" y="' . round( $h / 2, 2 ) . '" text-anchor="middle" dominant-baseline="central" direction="rtl" font-family="' . esc_attr( $f ? $f['css'] : 'Heebo' ) . '" font-weight="' . ( $f ? (int) $f['w'] : 900 ) . '" font-size="' . round( $fs, 2 ) . '" fill="' . esc_attr( $col ) . '">' . esc_html( $it['text'] ) . '</text></svg>';
	}
	if ( 'logo' === $it['type'] && ! empty( $it['file'] ) && file_exists( $it['file'] ) ) {
		$info = getimagesize( $it['file'] );
		$ar   = $info ? $info[0] / max( 1, $info[1] ) : 1;
		$w    = min( (float) $it['w'] * 10, $maxW );
		$h    = $w / $ar;
		if ( $h > $maxH ) {
			$h = $maxH;
			$w = $h * $ar;
		}
		$mime = $info ? $info['mime'] : 'image/png';
		$data = base64_encode( file_get_contents( $it['file'] ) ); // phpcs:ignore
		return $head . '<svg xmlns="http://www.w3.org/2000/svg" width="' . round( $w, 2 ) . 'mm" height="' . round( $h, 2 ) . 'mm" viewBox="0 0 ' . round( $w, 2 ) . ' ' . round( $h, 2 ) . '"><image href="data:' . $mime . ';base64,' . $data . '" x="0" y="0" width="' . round( $w, 2 ) . '" height="' . round( $h, 2 ) . '" preserveAspectRatio="xMidYMid meet"/></svg>';
	}
	return '';
}

/** The whole embroidery area at real size (mm), dashed, with the design where the customer put it. */
function kls_placement_svg( $side, $it, $area, $design_svg ) {
	$W = (float) $area['maxW'] * 10;
	$H = (float) $area['maxH'] * 10;
	if ( ! preg_match( '/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="([\d.]+)mm" height="([\d.]+)mm"/', $design_svg, $m ) ) {
		return '';
	}
	$w     = (float) $m[1];
	$h     = (float) $m[2];
	$x     = $W / 2 + (float) ( $it['dx'] ?? 0 ) * 10 - $w / 2;
	$y     = $H / 2 + (float) ( $it['dy'] ?? 0 ) * 10 - $h / 2;
	$inner = preg_replace( '/^.*?(<svg xmlns)/s', '$1', $design_svg );
	$inner = preg_replace( '/width="[\d.]+mm" height="[\d.]+mm"/', 'x="' . round( $x, 2 ) . '" y="' . round( $y, 2 ) . '" width="' . $w . '" height="' . $h . '"', $inner, 1 );
	return '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<!-- KETERLION · ' . str_replace( '--', '- -', esc_html( kls_sides()[ $side ] . ' · אזור הרקמה ' . $area['maxW'] . '×' . $area['maxH'] . ' ס״מ · ' . kls_position_text( $it ) ) ) . ' -->' . "\n"
		. '<svg xmlns="http://www.w3.org/2000/svg" width="' . $W . 'mm" height="' . $H . 'mm" viewBox="0 0 ' . $W . ' ' . $H . '">'
		. '<rect x="0.25" y="0.25" width="' . ( $W - 0.5 ) . '" height="' . ( $H - 0.5 ) . '" fill="none" stroke="#999" stroke-width="0.5" stroke-dasharray="2 2"/>'
		. '<path d="M' . ( $W / 2 ) . ',0 V' . $H . ' M0,' . ( $H / 2 ) . ' H' . $W . '" stroke="#ccc" stroke-width="0.3"/>'
		. $inner . '</svg>';
}

/** In the admin order screen: previews and files under each designed cap. */
add_action( 'woocommerce_after_order_itemmeta', function ( $item_id, $item ) {
	$files = json_decode( (string) $item->get_meta( '_kls_files' ), true );
	if ( ! $files ) {
		return;
	}
	$labels = kls_sides();
	echo '<div class="kls-admin-files" style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px">';
	foreach ( $files as $side => $f ) {
		echo '<div style="border:1px solid #ddd;padding:6px;width:180px;text-align:center;background:#fff">';
		echo '<strong>' . esc_html( $labels[ $side ] ?? $side ) . '</strong><br>';
		if ( ! empty( $f['preview'] ) ) {
			echo '<a href="' . esc_url( $f['preview'] ) . '" target="_blank"><img src="' . esc_url( $f['preview'] ) . '" style="width:100%;height:auto" alt=""></a><br>';
		}
		if ( ! empty( $f['svg'] ) ) {
			echo '<a href="' . esc_url( $f['svg'] ) . '" download>קובץ לרקמה (SVG)</a><br>';
		}
		if ( ! empty( $f['placement'] ) ) {
			echo '<a href="' . esc_url( $f['placement'] ) . '" download>מיקום באזור (SVG)</a><br>';
		}
		if ( ! empty( $f['logo'] ) ) {
			echo '<a href="' . esc_url( $f['logo'] ) . '" download>הלוגו המקורי</a>';
		}
		echo '</div>';
	}
	echo '</div>';
}, 10, 2 );

/** In the customer's emails and account: the designed cap's front preview instead of the blank cap. */
add_filter( 'woocommerce_order_item_thumbnail', function ( $img, $item ) {
	$files = json_decode( (string) $item->get_meta( '_kls_files' ), true );
	if ( ! $files ) {
		return $img;
	}
	$f = $files['front'] ?? reset( $files );
	return empty( $f['preview'] ) ? $img : '<img src="' . esc_url( $f['preview'] ) . '" width="120" alt="">';
}, 10, 2 );

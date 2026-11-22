<?php
/**
 * Settings: defaults, stored overrides (option kls_settings) and the fixed lists (threads, fonts, sides).
 */
defined( 'ABSPATH' ) || exit;

function kls_defaults() {
	return array(
		'product_id'  => 22544,           // "כובע מותאם אישית": the variations (shape × colour) are the caps we sell
		'type_price'  => array( 'gallery' => 50, 'text' => 79, 'logo' => 129 ), // one cap: added to the cap price, by the dearest decoration
		'extra'       => 35,              // every decorated side after the first, per cap
		'tiers'       => '2-5:50, 6-9:10, 10-23:0', // quantity: added to the cap price, includes one decoration of any type
		'max_qty'     => 23,
		'text_max'    => 18,
		'min_letter'  => 0.8,             // cm
		'upload_mb'   => 10,
		'b2b_url'     => '',
		'delivery'    => 'עד 7 ימים',
		'show_title'  => 1,
		'notify_email'=> '',
	);
}

function kls_settings() {
	static $s = null;
	if ( null === $s ) {
		$s = wp_parse_args( (array) get_option( 'kls_settings', array() ), kls_defaults() );
		$s['type_price'] = wp_parse_args( (array) $s['type_price'], kls_defaults()['type_price'] );
	}
	return $s;
}

/** "2-5:50, 6-9:10" → [ ['min'=>2,'max'=>5,'add'=>50], ... ] sorted by min. */
function kls_tiers() {
	$out = array();
	foreach ( explode( ',', (string) kls_settings()['tiers'] ) as $part ) {
		if ( preg_match( '/^\s*(\d+)\s*-\s*(\d+)\s*:\s*(-?\d+(?:\.\d+)?)\s*$/', $part, $m ) ) {
			$out[] = array( 'min' => (int) $m[1], 'max' => (int) $m[2], 'add' => (float) $m[3] );
		}
	}
	usort( $out, function ( $a, $b ) { return $a['min'] - $b['min']; } );
	return $out;
}

/** Sides, in the order the customer sees them. Keys match the image files and cap-model.json. */
function kls_sides() {
	return array( 'front' => 'חזית', 'right' => 'צד ימין', 'left' => 'צד שמאל', 'back' => 'מאחור' );
}

/** Thread colours: the 17 colours of the embroidery files (number = thread code in the file names). Hex is for the preview only. */
function kls_threads() {
	return array(
		array( 'code' => '2150', 'name' => 'שחור', 'hex' => '#141414' ),
		array( 'code' => '2149', 'name' => 'לבן', 'hex' => '#F6F6F2' ),
		array( 'code' => '2296', 'name' => 'כסף כהה', 'hex' => '#8E9196' ),
		array( 'code' => '2275', 'name' => 'בז׳', 'hex' => '#D9C49A' ),
		array( 'code' => '2290', 'name' => 'חום בהיר', 'hex' => '#A57A4E' ),
		array( 'code' => '2135', 'name' => 'חום', 'hex' => '#5A3A22' ),
		array( 'code' => '2050', 'name' => 'כתום', 'hex' => '#EE7A1E' ),
		array( 'code' => '2005', 'name' => 'צהוב ניאון', 'hex' => '#DDEB1C' ),
		array( 'code' => '2182', 'name' => 'אדום בהיר', 'hex' => '#D8343A' ),
		array( 'code' => '2166', 'name' => 'ורוד', 'hex' => '#EE86B2' ),
		array( 'code' => '2084', 'name' => 'סגול', 'hex' => '#6A3C99' ),
		array( 'code' => '2085', 'name' => 'שזיף', 'hex' => '#6E2A5A' ),
		array( 'code' => '2069', 'name' => 'כחול רויאל', 'hex' => '#1F4FB5' ),
		array( 'code' => '2066', 'name' => 'כחול רויאל בהיר', 'hex' => '#3E7BD8' ),
		array( 'code' => '2073', 'name' => 'נייבי', 'hex' => '#1E2848' ),
		array( 'code' => '2242', 'name' => 'ירוק', 'hex' => '#1E7A3C' ),
		array( 'code' => '2250', 'name' => 'ירוק עלה', 'hex' => '#6BAE3A' ),
	);
}

/** Fonts for text. css = the web font for the preview; the embroidery itself uses the matching font in the digitising software. */
function kls_fonts() {
	return array(
		array( 'id' => 'block', 'name' => 'בלוק', 'css' => "'Heebo',sans-serif", 'w' => 900, 'g' => 'Heebo:wght@900' ),
		array( 'id' => 'street', 'name' => 'רחוב', 'css' => "'Karantina',sans-serif", 'w' => 700, 'g' => 'Karantina:wght@700' ),
		array( 'id' => 'classic', 'name' => 'קלאסי', 'css' => "'Frank Ruhl Libre',serif", 'w' => 900, 'g' => 'Frank+Ruhl+Libre:wght@900' ),
		array( 'id' => 'round', 'name' => 'עגול', 'css' => "'Secular One',sans-serif", 'w' => 400, 'g' => 'Secular+One' ),
		array( 'id' => 'hand', 'name' => 'כתב יד', 'css' => "'Amatic SC',sans-serif", 'w' => 700, 'g' => 'Amatic+SC:wght@700' ),
	);
}

function kls_find( $list, $key, $value ) {
	foreach ( $list as $row ) {
		if ( (string) $row[ $key ] === (string) $value ) {
			return $row;
		}
	}
	return null;
}

/** Rules shown next to the logo upload (from the Zakeke upload notice of 16.11.2026). */
function kls_logo_rules() {
	return array(
		'אותיות בגובה 0.8 ס״מ לפחות',
		'עד 4 צבעים, בלי מעברי צבע, צללים או תמונות',
		'בחזית עד 14 ס״מ ברוחב ו-6 ס״מ בגובה',
		'אחרי ההזמנה בודקים כל לוגו. אם הוא לא מתאים לרקמה, נחזור אליכם ב-WhatsApp ונתאים אותו יחד. אם לא נמצא פתרון, תקבלו החזר כספי',
	);
}

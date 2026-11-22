<?php
/**
 * Settings screen: WooCommerce → סטודיו עיצוב אישי.
 */
defined( 'ABSPATH' ) || exit;

add_action( 'admin_menu', function () {
	add_submenu_page( 'woocommerce', 'סטודיו עיצוב אישי', 'סטודיו עיצוב אישי', 'manage_woocommerce', 'kl-studio', 'kls_settings_page' );
} );

add_action( 'admin_init', function () {
	register_setting( 'kls', 'kls_settings', array( 'sanitize_callback' => 'kls_sanitize_settings' ) );
} );

function kls_sanitize_settings( $in ) {
	$d   = kls_defaults();
	$out = array(
		'product_id'   => absint( $in['product_id'] ?? $d['product_id'] ),
		'type_price'   => array(),
		'extra'        => max( 0, (float) ( $in['extra'] ?? $d['extra'] ) ),
		'tiers'        => sanitize_text_field( $in['tiers'] ?? $d['tiers'] ),
		'max_qty'      => max( 1, absint( $in['max_qty'] ?? $d['max_qty'] ) ),
		'text_max'     => max( 1, min( 40, absint( $in['text_max'] ?? $d['text_max'] ) ) ),
		'min_letter'   => max( 0.3, (float) ( $in['min_letter'] ?? $d['min_letter'] ) ),
		'upload_mb'    => max( 1, min( 20, absint( $in['upload_mb'] ?? $d['upload_mb'] ) ) ),
		'b2b_url'      => esc_url_raw( $in['b2b_url'] ?? '' ),
		'delivery'     => sanitize_text_field( $in['delivery'] ?? $d['delivery'] ),
		'show_title'   => empty( $in['show_title'] ) ? 0 : 1,
		'notify_email' => sanitize_email( $in['notify_email'] ?? '' ),
	);
	foreach ( $d['type_price'] as $k => $v ) {
		$out['type_price'][ $k ] = max( 0, (float) ( $in['type_price'][ $k ] ?? $v ) );
	}
	return $out;
}

function kls_settings_page() {
	$s = kls_settings();
	$n = 'kls_settings';
	$row = function ( $label, $html, $help = '' ) {
		echo '<tr><th scope="row">' . esc_html( $label ) . '</th><td>' . $html . ( $help ? '<p class="description">' . esc_html( $help ) . '</p>' : '' ) . '</td></tr>'; // phpcs:ignore
	};
	$num = function ( $name, $value, $step = '1' ) use ( $n ) {
		return '<input type="number" step="' . esc_attr( $step ) . '" name="' . esc_attr( $n . $name ) . '" value="' . esc_attr( $value ) . '" class="small-text">';
	};
	$variants = kls_variants();
	echo '<div class="wrap" dir="rtl"><h1>סטודיו עיצוב אישי</h1>';
	echo '<p>מציבים את הכלי בעמוד עם הקוד הקצר <code>[kl_studio]</code>. מוצר הבסיס: ' . (int) $s['product_id'] . ', ' . count( $variants ) . ' צבעים זמינים.</p>';
	echo '<form method="post" action="options.php">';
	settings_fields( 'kls' );
	echo '<table class="form-table" role="presentation">';
	$row( 'מוצר הבסיס (מזהה)', $num( '[product_id]', $s['product_id'] ), 'המוצר שהווריאציות שלו (גזרה וצבע) הן הכובעים. המחיר והמלאי של כל כובע מגיעים ממנו.' );
	$row( 'כובע אחד: ספר הרקמות', $num( '[type_price][gallery]', $s['type_price']['gallery'] ) . ' ₪', 'נוסף למחיר הכובע. בכמה סוגים בכובע אחד נספר היקר מביניהם.' );
	$row( 'כובע אחד: טקסט', $num( '[type_price][text]', $s['type_price']['text'] ) . ' ₪' );
	$row( 'כובע אחד: לוגו של הלקוח', $num( '[type_price][logo]', $s['type_price']['logo'] ) . ' ₪' );
	$row( 'מדרגות כמות', '<input type="text" name="' . esc_attr( $n ) . '[tiers]" value="' . esc_attr( $s['tiers'] ) . '" class="regular-text" dir="ltr">', 'כמות:תוספת למחיר הכובע, כולל עיצוב אחד מכל סוג. למשל 2-5:50, 6-9:10, 10-23:0' );
	$row( 'כל מקום רקמה נוסף', $num( '[extra]', $s['extra'] ) . ' ₪ לכובע' );
	$row( 'כמות מקסימלית', $num( '[max_qty]', $s['max_qty'] ), 'מעליה מפנים למחירון לעסקים.' );
	$row( 'קישור לעסקים', '<input type="url" name="' . esc_attr( $n ) . '[b2b_url]" value="' . esc_attr( $s['b2b_url'] ) . '" class="regular-text" dir="ltr">' );
	$row( 'אורך טקסט מקסימלי', $num( '[text_max]', $s['text_max'] ) . ' תווים' );
	$row( 'גובה אות מינימלי', $num( '[min_letter]', $s['min_letter'], '0.1' ) . ' ס״מ' );
	$row( 'גודל קובץ לוגו', $num( '[upload_mb]', $s['upload_mb'] ) . ' MB' );
	$row( 'זמן אספקה', '<input type="text" name="' . esc_attr( $n ) . '[delivery]" value="' . esc_attr( $s['delivery'] ) . '" class="regular-text">', 'מופיע בכלי, למשל "עד 7 ימים".' );
	$row( 'כותרת בראש הכלי', '<label><input type="checkbox" name="' . esc_attr( $n ) . '[show_title]" value="1"' . checked( $s['show_title'], 1, false ) . '> להציג "עצבו כובע משלכם." ומדבקה</label>' );
	echo '</table>';
	submit_button( 'שמירה' );
	echo '</form></div>';
}

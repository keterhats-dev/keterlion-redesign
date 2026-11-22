<?php
/**
 * wc-ajax endpoints (they run with the WooCommerce session and cart loaded):
 *   ?wc-ajax=kls_upload       logo upload (PNG/JPG) → token
 *   ?wc-ajax=kls_add_to_cart  validated design → cart line
 */
defined( 'ABSPATH' ) || exit;

add_action( 'wc_ajax_kls_upload', 'kls_ajax_upload' );
add_action( 'wc_ajax_kls_add_to_cart', 'kls_ajax_add_to_cart' );

/**
 * The studio page can be served from a cache, so a guest's nonce may be old.
 * Logged-in users must send a valid nonce; guests must at least come from this site.
 */
function kls_check_request() {
	$nonce = isset( $_POST['nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['nonce'] ) ) : '';
	if ( wp_verify_nonce( $nonce, 'kls' ) ) {
		return true;
	}
	if ( is_user_logged_in() ) {
		return false;
	}
	$from = isset( $_SERVER['HTTP_ORIGIN'] ) ? wp_unslash( $_SERVER['HTTP_ORIGIN'] ) : ( isset( $_SERVER['HTTP_REFERER'] ) ? wp_unslash( $_SERVER['HTTP_REFERER'] ) : '' );
	return $from && wp_parse_url( $from, PHP_URL_HOST ) === wp_parse_url( home_url(), PHP_URL_HOST );
}

function kls_fail( $message, $code = 400 ) {
	wp_send_json_error( array( 'message' => $message ), $code );
}

function kls_ajax_upload() {
	if ( ! kls_check_request() ) {
		kls_fail( 'פג תוקף הדף. רעננו ונסו שוב.', 403 );
	}
	if ( empty( $_FILES['file'] ) || ! is_uploaded_file( $_FILES['file']['tmp_name'] ) ) { // phpcs:ignore
		kls_fail( 'הקובץ לא הגיע. נסו שוב.' );
	}
	$f   = $_FILES['file']; // phpcs:ignore
	$max = (int) kls_settings()['upload_mb'] * 1048576;
	if ( $f['error'] || $f['size'] > $max ) {
		kls_fail( sprintf( 'הקובץ גדול מ-%dMB.', (int) kls_settings()['upload_mb'] ) );
	}
	$info = @getimagesize( $f['tmp_name'] ); // phpcs:ignore
	$ext  = $info && IMAGETYPE_PNG === $info[2] ? 'png' : ( $info && IMAGETYPE_JPEG === $info[2] ? 'jpg' : '' );
	if ( ! $ext ) {
		kls_fail( 'אפשר להעלות רק PNG או JPG.' );
	}
	if ( $info[0] < 100 || $info[1] < 100 ) {
		kls_fail( 'התמונה קטנה מדי לרקמה. העלו קובץ של 100 פיקסלים לפחות בכל צד.' );
	}
	$b     = kls_storage_dirs();
	$token = kls_token();
	$dest  = $b['dir'] . '/tmp/' . $token . '.' . $ext;
	// Re-encode the image: drops anything hidden in the file and caps the size at 2000px.
	$editor = wp_get_image_editor( $f['tmp_name'] );
	if ( is_wp_error( $editor ) ) {
		if ( ! move_uploaded_file( $f['tmp_name'], $dest ) ) {
			kls_fail( 'לא הצלחנו לשמור את הקובץ.', 500 );
		}
	} else {
		$editor->resize( 2000, 2000, false );
		$saved = $editor->save( $dest, 'png' === $ext ? 'image/png' : 'image/jpeg' );
		if ( is_wp_error( $saved ) ) {
			kls_fail( 'לא הצלחנו לשמור את הקובץ.', 500 );
		}
	}
	wp_send_json_success( array( 'token' => $token, 'url' => kls_path_to_url( $dest ) ) );
}

function kls_ajax_add_to_cart() {
	if ( ! kls_check_request() ) {
		kls_fail( 'פג תוקף הדף. רעננו ונסו שוב.', 403 );
	}
	$raw    = isset( $_POST['design'] ) ? json_decode( wp_unslash( $_POST['design'] ), true ) : null; // phpcs:ignore
	$design = kls_clean_design( $raw );
	if ( is_wp_error( $design ) ) {
		kls_fail( $design->get_error_message() );
	}
	$s   = kls_settings();
	$qty = isset( $raw['qty'] ) ? (int) $raw['qty'] : 1;
	if ( $qty < 1 || $qty > (int) $s['max_qty'] ) {
		kls_fail( sprintf( 'אפשר להזמין כאן עד %d כובעים. לכמות גדולה יותר יש מחירון לעסקים.', (int) $s['max_qty'] ) );
	}
	$previews  = isset( $_POST['previews'] ) ? json_decode( wp_unslash( $_POST['previews'] ), true ) : array(); // phpcs:ignore
	$variation = wc_get_product( $design['variation'] );
	$attrs     = $variation->get_variation_attributes();
	$data      = array(
		'kls' => array(
			'design'   => $design,
			'previews' => array_map( 'kls_path_to_url', kls_save_previews( $previews, array_keys( $design['items'] ) ) ),
			'key'      => kls_token(), // every designed cap is its own cart line
		),
	);
	$key = WC()->cart->add_to_cart( $variation->get_parent_id(), $qty, $design['variation'], $attrs, $data );
	if ( ! $key ) {
		$notices = wc_get_notices( 'error' );
		wc_clear_notices();
		$msg = $notices ? wp_strip_all_tags( is_array( $notices[0] ) ? $notices[0]['notice'] : $notices[0] ) : 'לא הצלחנו להוסיף לסל. נסו שוב.';
		kls_fail( $msg );
	}
	WC()->cart->calculate_totals();
	$line = WC()->cart->get_cart_item( $key );
	wp_send_json_success( array(
		'cart_url' => wc_get_cart_url(),
		'price'    => $line ? (float) $line['data']->get_price() : 0,
		'count'    => WC()->cart->get_cart_contents_count(),
	) );
}

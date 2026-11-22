<?php
/**
 * Files: uploads/kl-studio/tmp (customer logos before the order), previews (PNG per side, for the cart),
 * orders/<key> (everything an order needs for production: logos, previews, SVG per side).
 */
defined( 'ABSPATH' ) || exit;

function kls_base_dir() {
	$u = wp_upload_dir( null, false );
	return array( 'dir' => trailingslashit( $u['basedir'] ) . 'kl-studio', 'url' => trailingslashit( $u['baseurl'] ) . 'kl-studio' );
}

function kls_storage_dirs() {
	$b = kls_base_dir();
	foreach ( array( '', '/tmp', '/previews', '/orders' ) as $sub ) {
		$d = $b['dir'] . $sub;
		if ( ! is_dir( $d ) ) {
			wp_mkdir_p( $d );
		}
		if ( ! file_exists( $d . '/index.php' ) ) {
			file_put_contents( $d . '/index.php', "<?php // Silence is golden.\n" ); // phpcs:ignore
		}
	}
	// No script runs from these folders, whatever its name.
	$ht = $b['dir'] . '/.htaccess';
	if ( ! file_exists( $ht ) ) {
		file_put_contents( $ht, "Options -Indexes\n<FilesMatch \"\\.(php|phtml|php\\d|phar|pl|py|cgi|sh|html?|js)$\">\n  Require all denied\n</FilesMatch>\n<IfModule mod_headers.c>\n  <FilesMatch \"\\.svg$\">\n    Header set Content-Security-Policy \"script-src 'none'\"\n  </FilesMatch>\n</IfModule>\n" ); // phpcs:ignore
	}
	return $b;
}

function kls_token() {
	return bin2hex( random_bytes( 16 ) );
}

/** Full path of an uploaded logo by its token, or '' when there is none. */
function kls_upload_path( $token ) {
	if ( ! preg_match( '/^[a-f0-9]{32}$/', (string) $token ) ) {
		return '';
	}
	$b = kls_base_dir();
	foreach ( array( 'png', 'jpg' ) as $ext ) {
		$f = $b['dir'] . '/tmp/' . $token . '.' . $ext;
		if ( file_exists( $f ) ) {
			return $f;
		}
	}
	return '';
}

function kls_path_to_url( $path ) {
	$b = kls_base_dir();
	return str_replace( $b['dir'], $b['url'], $path );
}

/** Saves the browser's PNG previews (data URLs). Returns [ side => file path ]. */
function kls_save_previews( $previews, $sides ) {
	$out = array();
	if ( ! is_array( $previews ) ) {
		return $out;
	}
	$b   = kls_storage_dirs();
	$key = kls_token();
	foreach ( $sides as $side ) {
		if ( empty( $previews[ $side ] ) || ! is_string( $previews[ $side ] ) ) {
			continue;
		}
		if ( ! preg_match( '#^data:image/png;base64,([A-Za-z0-9+/=]+)$#', $previews[ $side ], $m ) ) {
			continue;
		}
		$bin = base64_decode( $m[1], true );
		if ( ! $bin || strlen( $bin ) > 1500000 || 0 !== strpos( $bin, "\x89PNG" ) ) {
			continue;
		}
		$f = $b['dir'] . '/previews/' . $key . '-' . $side . '.png';
		if ( file_put_contents( $f, $bin ) ) { // phpcs:ignore
			$out[ $side ] = $f;
		}
	}
	return $out;
}

/** Daily: delete logos and previews nobody ordered (older than 7 days). Order folders are never touched. */
add_action( 'kls_cleanup', function () {
	$b     = kls_base_dir();
	$limit = time() - 7 * DAY_IN_SECONDS;
	foreach ( array( '/tmp', '/previews' ) as $sub ) {
		foreach ( array_merge( (array) glob( $b['dir'] . $sub . '/*.png' ), (array) glob( $b['dir'] . $sub . '/*.jpg' ) ) as $f ) {
			if ( $f && filemtime( $f ) < $limit ) {
				@unlink( $f ); // phpcs:ignore
			}
		}
	}
} );

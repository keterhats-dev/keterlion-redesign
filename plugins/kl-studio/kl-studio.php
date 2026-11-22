<?php
/**
 * Plugin Name:       KL Studio – עיצוב אישי לכובעים
 * Description:       כלי העיצוב האישי של כתרליון (תחליף ל-Zakeke): גזרה וצבע, ספר הרקמות, טקסט או לוגו בכל צד של הכובע, כמות, וסל של WooCommerce. מציבים בעמוד עם הקוד הקצר [kl_studio].
 * Version:           0.1.1
 * Author:            Keterlion
 * Requires at least: 6.2
 * Requires PHP:      7.4
 * Requires Plugins:  woocommerce
 * Text Domain:       kl-studio
 */

defined( 'ABSPATH' ) || exit;

define( 'KLS_VERSION', '0.1.1' );
define( 'KLS_FILE', __FILE__ );
define( 'KLS_DIR', plugin_dir_path( __FILE__ ) );
define( 'KLS_URL', plugin_dir_url( __FILE__ ) );

require_once KLS_DIR . 'includes/settings.php';
require_once KLS_DIR . 'includes/model.php';
require_once KLS_DIR . 'includes/pricing.php';
require_once KLS_DIR . 'includes/storage.php';
require_once KLS_DIR . 'includes/front.php';
require_once KLS_DIR . 'includes/ajax.php';
require_once KLS_DIR . 'includes/cart.php';
require_once KLS_DIR . 'includes/order.php';
require_once KLS_DIR . 'includes/admin.php';

register_activation_hook( __FILE__, 'kls_activate' );
function kls_activate() {
	kls_storage_dirs();
	if ( ! wp_next_scheduled( 'kls_cleanup' ) ) {
		wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', 'kls_cleanup' );
	}
}

register_deactivation_hook( __FILE__, function () {
	wp_clear_scheduled_hook( 'kls_cleanup' );
} );

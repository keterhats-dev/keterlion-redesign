<?php
/**
 * Keterlion – quick checkout fixes (stage 5a, 21.10.2026)
 *
 * Installed as ONE snippet in the "Code Snippets" plugin ("Run snippet everywhere").
 * Tested on staging first; copy the same code to the live site only after approval.
 *
 * 1. Taller Takbull card iframe on mobile, so the pay button is visible without scrolling inside the iframe.
 * 2. Bit (takbull_bit) listed first among payment methods.
 * 3. Local pickup: address fields hidden and not required.
 * 4. Shorter checkout: company field removed.
 * 5. "₪X more for free shipping" notice in cart, mini cart and checkout.
 */

if ( ! defined( 'ABSPATH' ) ) {
	return;
}

if ( ! defined( 'KL_FREE_SHIPPING_MIN' ) ) {
	define( 'KL_FREE_SHIPPING_MIN', 249 ); // Matches the site banner "משלוח חינם בהזמנה מעל ₪249".
}

/* 1. Takbull iframe height on mobile ---------------------------------------------------------- */
add_action( 'wp_head', function () {
	if ( ! function_exists( 'is_checkout' ) || ! is_checkout() ) {
		return;
	}
	echo '<style id="kl-takbull-iframe">@media (max-width:767px){iframe[src*="takbull"]{height:1100px!important;min-height:1100px!important}}</style>';
} );

/* 2. Bit first -------------------------------------------------------------------------------- */
add_filter( 'woocommerce_available_payment_gateways', function ( $gateways ) {
	if ( is_array( $gateways ) && isset( $gateways['takbull_bit'] ) ) {
		$gateways = array( 'takbull_bit' => $gateways['takbull_bit'] ) + $gateways;
	}
	return $gateways;
}, 20 );

/* 3 + 4. Checkout fields ---------------------------------------------------------------------- */
if ( ! function_exists( 'kl_local_pickup_chosen' ) ) {
	function kl_local_pickup_chosen() {
		if ( ! function_exists( 'WC' ) || ! WC()->session ) {
			return false;
		}
		foreach ( (array) WC()->session->get( 'chosen_shipping_methods', array() ) as $method ) {
			if ( 0 === strpos( (string) $method, 'local_pickup' ) ) {
				return true;
			}
		}
		return false;
	}
}

add_filter( 'woocommerce_billing_fields', function ( $fields ) {
	unset( $fields['billing_company'] );

	if ( isset( $fields['billing_address_2'] ) ) {
		$fields['billing_address_2']['placeholder'] = 'דירה / קומה (לא חובה)';
	}

	if ( kl_local_pickup_chosen() ) {
		foreach ( array( 'billing_address_1', 'billing_address_2', 'billing_city', 'billing_postcode', 'billing_state' ) as $key ) {
			if ( isset( $fields[ $key ] ) ) {
				$fields[ $key ]['required'] = false;
			}
		}
	}
	return $fields;
}, 20 );

// Safety net: the fields above are built before the session knows the chosen method, so drop
// "required" errors for address fields whenever the posted shipping method is local pickup.
add_action( 'woocommerce_after_checkout_validation', function ( $data, $errors ) {
	$pickup = false;
	foreach ( (array) ( isset( $data['shipping_method'] ) ? $data['shipping_method'] : array() ) as $method ) {
		if ( 0 === strpos( (string) $method, 'local_pickup' ) ) {
			$pickup = true;
		}
	}
	if ( ! $pickup ) {
		return;
	}
	foreach ( array( 'billing_address_1', 'billing_address_2', 'billing_city', 'billing_postcode', 'billing_state' ) as $key ) {
		$errors->remove( $key . '_required' );
	}
}, 20, 2 );

add_action( 'woocommerce_after_checkout_billing_form', function () {
	echo '<p id="kl-pickup-note" style="display:none;margin:8px 0 0;padding:10px 12px;background:#f4f4f2;color:#111;font-size:14px;line-height:1.5">'
		. 'בחרתם <strong>איסוף עצמי מהחנות</strong> (נחלת בנימין 13, תל אביב), ולכן אין צורך בכתובת. רוצים משלוח? בחרו שליח בסיכום ההזמנה למטה.'
		. '</p>';
} );

add_action( 'wp_footer', function () {
	if ( ! function_exists( 'is_checkout' ) || ! is_checkout() || is_order_received_page() ) {
		return;
	}
	?>
	<script id="kl-pickup-toggle">
	jQuery(function ($) {
		var rows = '#billing_address_1_field,#billing_address_2_field,#billing_city_field,#billing_postcode_field,#billing_state_field';
		function chosen() {
			var $c = $('input[name^="shipping_method"]:checked');
			if (!$c.length) { $c = $('input[name^="shipping_method"][type="hidden"]'); }
			return String($c.val() || '');
		}
		function toggle() {
			var pickup = chosen().indexOf('local_pickup') === 0;
			$(rows).toggle(!pickup);
			$('#kl-pickup-note').toggle(pickup);
		}
		$(document.body).on('updated_checkout', toggle);
		$(document).on('change', 'input[name^="shipping_method"]', toggle);
		toggle();
	});
	</script>
	<?php
} );

/* 5. Free shipping progress ------------------------------------------------------------------- */
if ( ! function_exists( 'kl_free_shipping_notice' ) ) {
	function kl_free_shipping_notice() {
		if ( ! function_exists( 'WC' ) || ! WC()->cart || WC()->cart->is_empty() ) {
			return;
		}
		$subtotal = (float) WC()->cart->get_displayed_subtotal();
		$left     = KL_FREE_SHIPPING_MIN - $subtotal;
		$percent  = max( 0, min( 100, round( $subtotal / KL_FREE_SHIPPING_MIN * 100 ) ) );

		if ( $left > 0 ) {
			$text = sprintf( 'עוד %s ויש לכם <strong>משלוח חינם</strong>', wc_price( $left ) );
		} else {
			$text = '<strong>יש לכם משלוח חינם</strong>';
		}

		echo '<div class="kl-free-ship" style="margin:0 0 16px;padding:12px 14px;border:1px solid #e2e2df;background:#fff;color:#111;font-size:14px;line-height:1.5">'
			. '<div>' . wp_kses_post( $text ) . '</div>'
			. '<div style="height:4px;background:#f4f4f2;margin-top:8px"><div style="height:4px;width:' . (int) $percent . '%;background:#a8894c"></div></div>'
			. '</div>';
	}
}
add_action( 'woocommerce_before_cart_table', 'kl_free_shipping_notice' );
add_action( 'woocommerce_widget_shopping_cart_before_buttons', 'kl_free_shipping_notice' );
add_action( 'woocommerce_checkout_before_order_review', 'kl_free_shipping_notice' );

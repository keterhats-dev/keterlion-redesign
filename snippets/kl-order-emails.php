<?php
/**
 * KL order emails (Code Snippets on the live site, 2.11.2026)
 *
 * The WooCommerce emails in the Simta look: logo on white, black headings, beige hairlines,
 * product photos in the order table, a short "what happens now" box in the customer order emails,
 * a WhatsApp button and a black footer. Logo, colours and footer text are set in
 * WooCommerce > Settings > Emails (see STATUS.md). To undo the look: switch this snippet off.
 */

add_filter( 'woocommerce_email_styles', function ( $css ) {
	return $css . '
#wrapper{background-color:#F4F4F2 !important}
#template_header_image{background:#ffffff;border-bottom:1px solid #DDD3BD;padding:26px 0 20px;margin:0 !important}
#template_header_image p{margin:0 !important}
#template_header_image img{width:220px !important;max-width:220px !important;height:auto !important}
#template_container{border:0 !important;border-radius:0 !important;box-shadow:none !important}
#template_header{background-color:#ffffff !important;border-radius:0 !important;color:#171717 !important}
#header_wrapper{padding:30px 40px 0 !important}
#template_header h1,#template_header h1 a{color:#171717 !important;font-family:Heebo,Arial,sans-serif !important;font-weight:900 !important;font-size:28px !important;line-height:1.2 !important;text-shadow:none !important}
#body_content_inner{font-family:Heebo,Arial,sans-serif !important;color:#171717 !important;font-size:15px !important}
#body_content table td{padding:24px 40px 32px}
h2{color:#171717 !important;font-family:Heebo,Arial,sans-serif !important;font-weight:500 !important;font-size:17px !important;border-bottom:1px solid #DDD3BD;padding-bottom:8px}
h3{color:#171717 !important;font-family:Heebo,Arial,sans-serif !important;font-weight:500 !important}
.td{border:0 !important;border-bottom:1px solid #DDD3BD !important;color:#171717 !important}
.order-totals-total .td{border-top:1px solid #171717 !important;font-weight:900 !important;font-size:17px !important}
.wt_pklist_email_btn{background:#ffffff !important;color:#171717 !important;border:1px solid #171717 !important;border-radius:4px !important;box-shadow:none !important;padding:10px 18px !important}
.address{border:0 !important;padding:0 !important;color:#6B6B69 !important}
a{color:#171717}
#template_footer{background:#171717 !important}
#template_footer td,#template_footer #credit,#template_footer #credit p{background:#171717 !important;color:#ffffff !important;font-family:Heebo,Arial,sans-serif !important;font-size:12px !important;line-height:1.8 !important}
#template_footer #credit{padding:26px 24px !important}
#template_footer a{color:#AE8E42 !important}
.kl-next{background:#F4F4F2;border-right:3px solid #AE8E42;padding:14px 18px;margin:24px 0;font-size:14px;color:#171717}
';
} );

// small product photos in the order table
add_filter( 'woocommerce_email_order_items_args', function ( $args ) {
	$args['show_image'] = true;
	$args['image_size'] = array( 48, 48 );
	return $args;
} );

// "Thank you, Dana! Your order is with us" in the processing email
add_filter( 'woocommerce_email_heading_customer_processing_order', function ( $heading, $order ) {
	$name = $order ? trim( $order->get_billing_first_name() ) : '';
	return $name ? 'תודה, ' . $name . '! ההזמנה אצלנו' : 'תודה! ההזמנה אצלנו';
}, 10, 2 );

function kl_order_has_custom( $order ) {
	foreach ( $order->get_items() as $item ) {
		if ( 22544 === (int) $item->get_product_id() ) {
			return true;
		}
		foreach ( $item->get_meta_data() as $meta ) {
			if ( false !== stripos( $meta->key, 'zakeke' ) ) {
				return true;
			}
		}
	}
	return false;
}

function kl_email_is_customer_order( $email, $sent_to_admin, $plain_text ) {
	return ! $sent_to_admin && ! $plain_text && $email && in_array( $email->id, array( 'customer_processing_order', 'customer_on_hold_order' ), true );
}

// "what happens now", after the order table
add_action( 'woocommerce_email_after_order_table', function ( $order, $sent_to_admin, $plain_text, $email = null ) {
	if ( ! kl_email_is_customer_order( $email, $sent_to_admin, $plain_text ) ) {
		return;
	}
	echo '<div class="kl-next"><b style="display:block;margin-bottom:4px">מה קורה עכשיו</b>מכינים ואורזים את ההזמנה. משלוח עד 5 ימי עסקים, ואם בחרת איסוף עצמי, נעדכן כשהיא מחכה לך בנחלת בנימין 13.' . ( kl_order_has_custom( $order ) ? '<br>בעיצוב אישי: התחלנו לעבוד על העיצוב שלך, ואם יהיה צורך ניצור איתך קשר ב-WhatsApp.' : '' ) . '</div>';
}, 20, 4 );

// WhatsApp button, after the addresses
add_action( 'woocommerce_email_customer_details', function ( $order, $sent_to_admin, $plain_text, $email = null ) {
	if ( ! kl_email_is_customer_order( $email, $sent_to_admin, $plain_text ) ) {
		return;
	}
	echo '<p style="text-align:center;margin:28px 0 8px"><a href="https://wa.me/97239385005" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:4px;font-family:Heebo,Arial,sans-serif">שאלה על ההזמנה? כתבו לנו ב-WhatsApp</a></p>';
}, 30, 4 );

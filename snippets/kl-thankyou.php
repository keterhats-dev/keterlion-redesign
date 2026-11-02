<?php
/**
 * KL thank-you page (Code Snippets on the live site, 2.11.2026)
 *
 * The page the customer lands on after paying (/checkout/order-received/...), in the Simta look:
 * "Thank you, Dana! Your order is with us." with the order number, date, total and payment in one row,
 * "what happens now" in three steps, a line for custom-design orders, two buttons
 * and the order details beside them (below them on the phone).
 * The custom-design check, kl_order_has_custom(), lives in snippet #25 (KL order emails).
 * To undo: switch this snippet off.
 */

add_filter( 'woocommerce_thankyou_order_received_text', function ( $text, $order ) {
	if ( ! $order ) {
		return $text;
	}
	$name  = trim( $order->get_billing_first_name() );
	$email = $order->get_billing_email();
	return '<span class="kl-ty-eyebrow">ההזמנה התקבלה</span>'
		. '<span class="kl-ty-title">' . ( $name ? 'תודה, ' . esc_html( $name ) . '! ' : 'תודה! ' ) . 'ההזמנה אצלנו<b>.</b></span>'
		. ( $email ? '<span class="kl-ty-lead">שלחנו אישור עם כל הפרטים ל-' . esc_html( $email ) . '</span>' : '' );
}, 10, 2 );

add_action( 'woocommerce_thankyou', function ( $order_id ) {
	$order = wc_get_order( $order_id );
	if ( ! $order || $order->has_status( 'failed' ) ) {
		return;
	}
	$custom = function_exists( 'kl_order_has_custom' ) && kl_order_has_custom( $order );
	?>
	<div class="kl-ty-next">
		<h2>מה קורה עכשיו</h2>
		<ol class="kl-ty-steps">
			<li><span class="n">01</span><div><b>מכינים את ההזמנה</b><span>ההזמנה עוברת אלינו להכנה ולאריזה</span></div></li>
			<li><span class="n">02</span><div><b>יוצאת אליך</b><span>משלוח עד 5 ימי עסקים</span></div></li>
			<li><span class="n">03</span><div><b>מגיעה הביתה</b><span>בחרת איסוף עצמי? נעדכן כשההזמנה מחכה לך בנחלת בנימין 13</span></div></li>
		</ol>
		<?php if ( $custom ) : ?>
			<div class="kl-ty-note"><b>בעיצוב אישי:</b> התחלנו לעבוד על העיצוב שלך, ואם יהיה צורך ניצור איתך קשר ב-WhatsApp.</div>
		<?php endif; ?>
		<div class="kl-ty-btns">
			<a class="kl-ty-btn primary" href="<?php echo esc_url( home_url( '/all-products/' ) ); ?>">להמשיך לקנות ←</a>
			<a class="kl-ty-btn secondary" href="https://wa.me/97239385005" target="_blank" rel="noopener">שאלה על ההזמנה? WhatsApp</a>
		</div>
	</div>
	<?php
}, 5 );

// small product photo beside each product in the order details (only on this page, not in emails)
add_filter( 'woocommerce_order_item_name', function ( $name, $item ) {
	if ( ! doing_action( 'woocommerce_thankyou' ) || ! is_callable( array( $item, 'get_product' ) ) ) {
		return $name;
	}
	$product = $item->get_product();
	return $product ? '<span class="kl-ty-thumb">' . $product->get_image( array( 64, 64 ) ) . '</span>' . $name : $name;
}, 10, 2 );

add_action( 'wp_head', function () {
	if ( ! function_exists( 'is_order_received_page' ) || ! is_order_received_page() ) {
		return;
	}
	?>
<style id="kl-thankyou">
body.woocommerce-order-received .elementor-element-f866ca4{display:none}
.woocommerce-order{display:grid;grid-template-columns:1fr 1fr;column-gap:48px;padding-top:32px;align-items:start;font-family:Heebo,sans-serif;color:#171717}
.woocommerce-order > p.woocommerce-thankyou-order-received,.woocommerce-order > ul.woocommerce-order-overview{grid-column:1 / -1}
.woocommerce-order > .kl-ty-next{grid-column:1;grid-row:span 2}
.woocommerce-order > section{grid-column:2}
html body .woocommerce-order p.woocommerce-thankyou-order-received{background:none;border:0;padding:0;margin:8px 0 0;font-size:inherit;color:#171717}
.kl-ty-eyebrow{display:flex;align-items:center;gap:10px;font-size:13px;letter-spacing:.12em;color:#6B6B69}
.kl-ty-eyebrow::before{content:"";width:28px;height:4px;background:#AE8E42}
.kl-ty-title{display:block;font-weight:900;font-size:44px;line-height:1.1;margin:12px 0 10px;color:#171717}
.kl-ty-title b{color:#AE8E42;font-weight:900}
.kl-ty-lead{display:block;color:#6B6B69;font-size:16px;margin:0 0 28px;font-weight:400}
html body .woocommerce-order ul.woocommerce-order-overview{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin:0 0 36px;padding:0;list-style:none;gap:0 !important;border-top:1px solid #DDD3BD;border-bottom:1px solid #DDD3BD}
html body .woocommerce-order ul.woocommerce-order-overview::before,html body .woocommerce-order ul.woocommerce-order-overview::after{display:none}
html body .woocommerce-order ul.woocommerce-order-overview li{float:none;margin:0 !important;padding:16px !important;border:0 !important;border-right:1px solid #DDD3BD !important;font-size:12px;letter-spacing:.06em;text-transform:none;color:#6B6B69;line-height:1.5}
html body .woocommerce-order ul.woocommerce-order-overview li:first-child{border-right:0 !important;padding-right:0 !important}
html body .woocommerce-order ul.woocommerce-order-overview li strong{display:block;margin-top:2px;font-size:20px;font-weight:900;letter-spacing:0;color:#171717}
.woocommerce-order h2{font-family:Heebo,sans-serif;font-weight:500;font-size:20px;margin:0 0 14px;color:#171717}
.kl-ty-steps{list-style:none;margin:0 0 28px;padding:0;border-top:1px solid #DDD3BD}
.kl-ty-steps li{display:flex;gap:16px;padding:14px 0;border-bottom:1px solid #DDD3BD;margin:0}
.kl-ty-steps .n{font-weight:900;font-size:14px;color:#AE8E42;min-width:24px}
.kl-ty-steps b{display:block;font-weight:500}
.kl-ty-steps span:not(.n){color:#6B6B69;font-size:14px}
.kl-ty-note{background:#F4F4F2;border-right:3px solid #AE8E42;padding:12px 16px;font-size:14px;margin-bottom:28px}
.kl-ty-btns{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:28px}
html body a.kl-ty-btn{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 26px;border-radius:4px;font-weight:700;font-size:16px;text-decoration:none}
html body a.kl-ty-btn.primary{background:#171717;color:#fff;border:1px solid #171717}
html body a.kl-ty-btn.secondary{background:#fff;color:#171717;border:1px solid #171717}
.woocommerce-order section.woocommerce-order-details{border:1px solid #DDD3BD;padding:20px 22px}
.woocommerce-order-details a{color:#171717 !important;text-decoration:none}
.woocommerce-order-details td.product-name{overflow:hidden}
.kl-ty-thumb{float:right;margin:0 0 4px 12px}
.kl-ty-thumb img{width:64px !important;height:64px !important;object-fit:contain;background:#fff;display:block}
html body .woocommerce-order table.shop_table{border:0;border-radius:0;margin:0}
html body .woocommerce-order table.shop_table th,html body .woocommerce-order table.shop_table td{border:0;border-bottom:1px solid #DDD3BD;padding:12px 0;background:none}
html body .woocommerce-order table.shop_table tfoot tr:last-child th,html body .woocommerce-order table.shop_table tfoot tr:last-child td{border-top:1px solid #171717;border-bottom:0;font-weight:900;font-size:18px}
@media (max-width:767px){
	.woocommerce-order{grid-template-columns:1fr}
	.woocommerce-order > .kl-ty-next,.woocommerce-order > section{grid-column:1;grid-row:auto}
	.kl-ty-title{font-size:32px}
	html body .woocommerce-order ul.woocommerce-order-overview{grid-template-columns:1fr 1fr}
	html body .woocommerce-order ul.woocommerce-order-overview li:nth-child(3){border-right:0 !important;padding-right:0 !important}
	html body .woocommerce-order ul.woocommerce-order-overview li:nth-child(n+3){border-top:1px solid #DDD3BD !important}
	html body a.kl-ty-btn{width:100%}
}
</style>
	<?php
}, 99 );

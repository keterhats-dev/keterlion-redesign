<?php
// Code Snippets #32 "KL sunglasses + accessories: no hat chips" (accessories added 24.11.2026), front-end, active. Live since 22.11.2026 (user: "בראש עמוד אפשר להוריד את הקטגוריות באמת").
// The hat-type chips row (3736f5d in KL Archive 2026, 23976) does not belong on the sunglasses category (820).
// To undo: deactivate snippet #32 and purge the LiteSpeed cache.
add_action('wp_head', function () {
	if ( function_exists('is_product_category') && is_product_category( array('sunglasses','accessories') ) ) {
		echo '<style id="kl-sun-no-chips">.elementor-element-3736f5d{display:none !important}</style>';
	}
}, 99);

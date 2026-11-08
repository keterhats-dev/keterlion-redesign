<?php
/**
 * KL: no club popup on the custom design pages (8.11.2026, approved: "כן, להסתיר").
 *
 * The Flashy club popup ("כיף שכיף! הירשמו למועדון...") opens about 3 seconds after a new visitor arrives
 * and lays a dark layer over the whole screen. While it is open, a tap on "התחילו לעצב" lands on the popup,
 * so customers think the custom design button does not work (complaint: "בכרום לא נפתח העיצוב אישי").
 * Hidden here only on the custom design page (22544, /product/customize/, also where Zakeke opens for hats)
 * and the custom shirt page (25259, /product/custom-shirt/, where Zakeke opens for shirts).
 * Everywhere else the popup shows as before. To undo: turn this snippet off.
 * Code Snippets: front-end only.
 */
add_action('wp_head', function () {
	if (!is_singular('product')) {
		return;
	}
	if (!in_array((int) get_queried_object_id(), [22544, 25259], true)) {
		return;
	}
	echo '<style id="kl-no-club-popup">flashy-popup{display:none!important}</style>' . "\n";
}, 99);

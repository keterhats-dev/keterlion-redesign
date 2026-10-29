<?php
// Code Snippet #22 "KL all products on one page" (staging, front-end, active). Created 29.10.2026.
// KL (29.10.2026, user request): category, shop and SALE pages show every product on one page, no pagination.
// The largest listing (all hats) has about 180 products; 400 leaves room. Images load lazily.
// The products widgets on /all-products/ (17534) and /sale/ (16600) and the archive template (23976) were also set
// to rows 100 with pagination off.
add_filter( 'loop_shop_per_page', function () {
	return 400;
}, 20 );

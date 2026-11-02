<?php
/**
 * KL product cards aligned (Code Snippets on the live site, 2.11.2026)
 *
 * In every grid of product cards (shop, categories, search, related, the home page), a long product name
 * wrapped to more lines and pushed its price and add-to-cart button below the ones next to it.
 * Each card is now a column that fills the row, and the price starts at the bottom of the card,
 * so prices and buttons sit on one line in every row. Nothing else in the card changes.
 *
 * To undo: switch this snippet off.
 */
add_action( 'wp_head', function () {
	?>
<style id="kl-card-align">
html body ul.products li.product{display:flex !important;flex-direction:column !important;align-items:stretch !important}
html body ul.products li.product > a.woocommerce-LoopProduct-link{display:flex !important;flex-direction:column !important;flex:1 1 auto !important;width:100%}
html body ul.products li.product .price{margin-top:auto !important}
</style>
	<?php
}, 99 );

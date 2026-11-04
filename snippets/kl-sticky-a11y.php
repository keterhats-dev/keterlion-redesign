<?php
/**
 * KL sticky header and a smaller accessibility button (Code Snippets on the live site, 4.11.2026)
 *
 * Sticky header: the header (with the black bar above it) is already position:sticky, but the
 * Additional CSS rule "html, body {overflow-x: hidden}" turned the page into its own scroll box,
 * so the header scrolled away. overflow-x:clip still hides sideways overflow without breaking sticky.
 * Accessibility button (One Click Accessibility): smaller, at the bottom left, so it no longer covers
 * buttons and text on the right; its menu now opens from the left.
 * To undo: switch this snippet off.
 */
add_action( 'wp_head', function () {
	?>
<style id="kl-sticky-a11y">
html,body{overflow-x:clip !important}
#pojo-a11y-toolbar.pojo-a11y-toolbar-right{right:auto !important;left:-180px !important}
#pojo-a11y-toolbar.pojo-a11y-toolbar-right.pojo-a11y-toolbar-open{left:0 !important}
#pojo-a11y-toolbar.pojo-a11y-toolbar-right .pojo-a11y-toolbar-toggle{left:auto !important;right:-40px !important;top:auto !important;bottom:12px !important}
#pojo-a11y-toolbar .pojo-a11y-toolbar-toggle a{width:40px !important;height:40px !important;padding:7px !important;box-sizing:border-box !important}
#pojo-a11y-toolbar .pojo-a11y-toolbar-toggle svg{width:26px !important;height:26px !important}
</style>
	<?php
}, 99 );

<?php
// Code Snippets #33 "KL winter picker: buttons, colour circles, gallery sync" (front-end). Approved by the user 26.11.2026 (mockups/winter-picker).
// Only on single product pages in: פוטרים (822), חולצות ארוכות (823), כובעי צמר (262).
// - every variation <select> becomes buttons (colour attribute "צבע" becomes circles); the select stays hidden and drives WooCommerce
// - choosing an option moves the gallery to that option's image (even before all attributes are chosen); all images stay in the gallery
// - colour-only products: swiping the gallery to another colour selects it
// - on 822/823 the custom-design box (dba6653) talks about clothes instead of hats
// To undo: deactivate the snippet and purge the LiteSpeed cache.
add_action('wp_footer', function () {
	if ( ! function_exists('is_product') || ! is_product() ) return;
	$pid = get_queried_object_id();
	if ( ! has_term( array(822, 823, 262), 'product_cat', $pid ) ) return;
	$apparel = has_term( array(822, 823), 'product_cat', $pid ) ? 'true' : 'false';
	?>
<style id="kl-vp-css">
.kl-vp-hide{position:absolute!important;opacity:0!important;pointer-events:none!important;width:1px!important;height:1px!important;overflow:hidden!important}
.kl-vp-row{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 6px}
.kl-vp-chip{min-width:52px;height:44px;padding:0 14px;border:1px solid #171717;background:#fff;color:#171717;border-radius:4px;font:500 15px Heebo,sans-serif;cursor:pointer;line-height:1}
.kl-vp-chip:hover{background:#F4F4F2}
.kl-vp-chip.on{background:#171717;color:#fff}
.kl-vp-chip.off{border-color:#DDD3BD;color:#bbb;text-decoration:line-through;cursor:not-allowed;background:#fff}
.kl-vp-sw{width:36px;height:36px;padding:0;border-radius:50%;border:1px solid #DDD3BD;cursor:pointer;position:relative;margin:5px}
.kl-vp-sw.on:after{content:"";position:absolute;inset:-6px;border:2px solid #171717;border-radius:50%}
.kl-vp-sw.off{opacity:.3;cursor:not-allowed}
.kl-vp-val{color:#6B6B69;font-weight:400;margin-inline-start:6px}
form.variations_form .reset_variations{display:none!important}
@media (max-width:480px){.kl-vp-row{gap:6px}.kl-vp-chip{min-width:0;padding:0 8px;flex:1 1 0}}
</style>
<script id="kl-vp-js">
(function($){
  if(!$) return;
  var HEX={'שחור':'#1A1A1A','אפור':'#6E6F70','בורדו':'#6B1F2E','חום קאמל':'#A8743F','ירוק זית':'#4A4D33','לבן':'#FFFFFF','בז\'':'#E8DCC8','חום':'#5A3A22','ירוק':'#1F5E45'};
  var APPAREL=<?php echo $apparel; ?>;
  $(function(){
    if(APPAREL){
      var p=document.querySelector('[data-id="dba6653"]');
      if(p) p.innerHTML='<b>רוצים פוטר או חולצה עם עיצוב משלכם?</b><br>גם פריט אחד, בלי מינימום';
    }
    var $form=$('form.variations_form').first(); if(!$form.length) return;
    // an older site-wide script (Code Snippets #18 'variation') copies the variation image into EVERY gallery slide; not on these pages
    $(document).off('found_variation','form.variations_form');
    var vars=$form.data('product_variations')||[];
    var $gal=$('.woocommerce-product-gallery').first();
    var syncing=false;

    function slides(){return $gal.find('.woocommerce-product-gallery__image');}
    function slideIndexFor(src){
      if(!src) return -1; var idx=-1, file=src.split('/').pop();
      slides().each(function(i){var im=$(this).find('img'); var u=im.attr('data-large_image')||$(this).find('a').attr('href')||'';
        if(u===src||u.split('/').pop()===file){idx=i;return false;}});
      return idx;
    }
    function goTo(i){
      if(i<0) return; var fs=$gal.data('flexslider');
      if(fs){ if(fs.currentSlide!==i){ fs.animating=false; fs.flexAnimate(i,true,true); } }
    }
    function chosen(){var o={}; $form.find('select[name^="attribute_"]').each(function(){o[this.name]=$(this).val()||'';}); return o;}
    function variationFor(c){
      for(var k=0;k<vars.length;k++){var v=vars[k],ok=true;
        for(var n in c){ if(!c[n]) continue; var a=v.attributes[n]; if(a!==''&&a!==c[n]){ok=false;break;} }
        if(ok&&v.image&&v.image.full_src) return v; }
      return null;
    }
    function moveGallery(){var v=variationFor(chosen()); if(v) goTo(slideIndexFor(v.image.full_src));}

    var $sels=$form.find('select[name^="attribute_"]');
    $sels.each(function(){
      var sel=this,$sel=$(sel);
      var label=$sel.closest('tr').find('th label, .label label').first();
      var isColour=/צבע/.test(label.text()||'')||/%d7%a6%d7%91%d7%a2/i.test(sel.name);
      var $row=$('<div class="kl-vp-row" role="radiogroup"></div>');
      var $val=$('<span class="kl-vp-val"></span>'); label.append($val);
      $sel.find('option').each(function(){ if(!this.value) return;
        var t=$(this).text(), $b;
        if(isColour&&HEX[t]) $b=$('<button type="button" class="kl-vp-sw"></button>').css('background',HEX[t]).attr({title:t,'aria-label':t});
        else $b=$('<button type="button" class="kl-vp-chip"></button>').text(t);
        $b.attr('data-v',this.value).on('click',function(){ if($(this).hasClass('off')) return; $sel.val(this.getAttribute('data-v')).trigger('change'); });
        $row.append($b);
      });
      $sel.addClass('kl-vp-hide').after($row);
      function render(){
        var cur=$sel.val(); $val.text(cur?$sel.find('option:selected').text():'');
        $row.children().each(function(){var v=this.getAttribute('data-v'), opt=$sel.find('option').filter(function(){return this.value===v;});
          $(this).toggleClass('on',v===cur).toggleClass('off',!opt.length||opt.prop('disabled')).attr('aria-pressed',v===cur);});
      }
      $sel.on('change',function(){render(); if(!syncing) setTimeout(moveGallery,180);});
      $form.on('woocommerce_update_variation_values',render);
      render();
    });

    // WooCommerce swaps the first gallery image for the variation image; on these pages it only slides to that image instead
    $.fn.wc_variations_image_update=function(v){ if(v&&v.image&&v.image.full_src){ var i=slideIndexFor(v.image.full_src); setTimeout(function(){goTo(i);},50); } return this; };
    $.fn.wc_variations_image_reset=function(){ return this; };

    // colour-only products: swiping the gallery selects the colour shown
    if($sels.length===1){
      var hook=function(){var fs=$gal.data('flexslider'); if(!fs){return setTimeout(hook,300);} var prev=fs.vars.after;
        fs.vars.after=function(s){ if(prev) prev(s);
          var im=slides().eq(s.currentSlide).find('img'), u=(im.attr('data-large_image')||'').split('/').pop(); if(!u) return;
          for(var k=0;k<vars.length;k++){var v=vars[k]; if(v.image&&v.image.full_src&&v.image.full_src.split('/').pop()===u){
            var n=Object.keys(v.attributes)[0], val=v.attributes[n]; var $s=$form.find('select[name="'+n+'"]');
            if(val&&$s.val()!==val){syncing=true;$s.val(val).trigger('change');syncing=false;} break;}}
        };};
      hook();
    }
  });
})(window.jQuery);
</script>
	<?php
}, 99);

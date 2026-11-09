# Builds the HTML blocks for the Flashy automations (abandoned cart + welcome series), "Simta" design.
# Output: out\*.html. Each file is pasted into one HTML block of a Flashy Drag & Drop template (RTL, 600px, Google font Heebo).
# Cart emails have two blocks (-top / -bottom) with Flashy's "Dynamic content" block (products in cart) between them.
# Run: powershell -File flashy\emails\build.ps1
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$out = Join-Path $root 'out'
New-Item -ItemType Directory -Force $out | Out-Null
$header = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'parts\header.html')
$footer = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'parts\footer.html')

function Utm([string]$path, [string]$campaign, [string]$content) {
  $sep = if ($path.Contains('?')) { '&amp;' } else { '?' }
  return "https://keterlion.com$path${sep}utm_source=flashy&amp;utm_medium=email&amp;utm_campaign=$campaign&amp;utm_content=$content"
}
function Sec([string]$inner, [int]$top = 0, [int]$bottom = 0) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="width:100%;border-collapse:collapse;"><tr><td style="padding:' + $top + 'px 24px ' + $bottom + 'px;font-family:Heebo,Arial,sans-serif;color:#171717;text-align:right;">' + $inner + '</td></tr></table>' + "`n"
}
function Eyebrow([string]$t) {
  return Sec ('<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="32" style="width:32px;height:4px;background:#AE8E42;font-size:0;line-height:0;">&nbsp;</td><td style="padding-right:10px;font-family:Heebo,Arial,sans-serif;font-size:13px;font-weight:500;letter-spacing:3px;color:#171717;">' + $t + '</td></tr></table>') 36 0
}
function H1([string]$t, [string]$end = '.') {
  return Sec ('<div style="font-family:Heebo,Arial,sans-serif;font-size:40px;line-height:1.05;font-weight:900;color:#171717;">' + $t + '<span style="color:#AE8E42;">' + $end + '</span></div>') 16 0
}
function P([string]$t, [int]$top = 16) {
  return Sec ('<div style="font-family:Heebo,Arial,sans-serif;font-size:16px;line-height:1.7;color:#171717;">' + $t + '</div>') $top 0
}
function Small([string]$t, [int]$top = 20) {
  return Sec ('<div style="font-family:Heebo,Arial,sans-serif;font-size:13px;line-height:1.6;color:#6B6B69;">' + $t + '</div>') $top 0
}
function Btn([string]$text, [string]$url, [int]$top = 24) {
  return Sec ('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#171717" style="background:#171717;border-radius:4px;"><a href="' + $url + '" style="display:block;padding:19px 16px;font-family:Heebo,Arial,sans-serif;font-size:17px;font-weight:700;line-height:1;color:#FFFFFF;text-decoration:none;border-radius:4px;">' + $text + '</a></td></tr></table>') $top 0
}
function BtnOutline([string]$text, [string]$url, [int]$top = 12) {
  return Sec ('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="border:1px solid #171717;border-radius:4px;background:#FFFFFF;"><a href="' + $url + '" style="display:block;padding:18px 16px;font-family:Heebo,Arial,sans-serif;font-size:17px;font-weight:700;line-height:1;color:#171717;text-decoration:none;border-radius:4px;">' + $text + '</a></td></tr></table>') $top 0
}
$arrow = '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="40" height="40" align="center" bgcolor="#171717" style="width:40px;height:40px;background:#171717;border-radius:4px;font-family:Arial,sans-serif;font-size:20px;line-height:40px;color:#FFFFFF;">&larr;</td></tr></table>'
function Rows($items, [int]$top = 24) {
  # $items: array of @(letter, title, description-or-empty, url)
  $h = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:1px solid #DDD3BD;">'
  foreach ($it in $items) {
    $desc = if ($it[2]) { '<div style="font-family:Heebo,Arial,sans-serif;font-size:14px;line-height:1.6;color:#6B6B69;padding-top:4px;">' + $it[2] + '</div>' } else { '' }
    $h += '<tr><td width="28" valign="top" style="width:28px;padding:20px 0 18px;border-bottom:1px solid #DDD3BD;font-family:Heebo,Arial,sans-serif;font-size:14px;color:#6B6B69;">' + $it[0] + '</td>'
    $h += '<td style="padding:16px 0;border-bottom:1px solid #DDD3BD;"><a href="' + $it[3] + '" style="text-decoration:none;color:#171717;"><div style="font-family:Heebo,Arial,sans-serif;font-size:24px;line-height:1.2;font-weight:500;color:#171717;">' + $it[1] + '</div>' + $desc + '</a></td>'
    $h += '<td width="52" align="left" style="width:52px;padding:16px 0;border-bottom:1px solid #DDD3BD;"><a href="' + $it[3] + '" style="text-decoration:none;">' + $arrow + '</a></td></tr>'
  }
  $h += '</table>'
  return Sec $h $top 0
}
function Coupon([int]$top = 24) {
  return Sec ('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#171717" style="background:#171717;"><tr><td align="center" style="padding:26px 20px;font-family:Heebo,Arial,sans-serif;"><div style="font-size:13px;font-weight:500;letter-spacing:3px;color:#AE8E42;">10% הנחה</div><table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:12px auto 0;"><tr><td style="border:1px solid #F4EEE1;border-radius:4px;padding:12px 24px;font-family:Heebo,Arial,sans-serif;font-size:30px;font-weight:900;letter-spacing:4px;color:#FFFFFF;" dir="ltr">A95KGG9T</td></tr></table><div style="font-size:13px;color:#BDB7AA;padding-top:12px;">מזינים את הקוד בסל, לפני התשלום</div></td></tr></table>') $top 0
}
function Img([string]$src, [int]$w, [int]$h, [string]$alt, [string]$url) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td style="padding:0;"><a href="' + $url + '"><img src="' + $src + '" width="' + $w + '" height="' + $h + '" alt="' + $alt + '" style="display:block;width:100%;max-width:' + $w + 'px;height:auto;border:0;"></a></td></tr></table>' + "`n"
}
function BlackBand([string]$title, [string]$end, [string]$text, [string]$linkText, [string]$url, [int]$top = 24) {
  return Sec ('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#171717" style="background:#171717;"><tr><td style="padding:26px 20px;font-family:Heebo,Arial,sans-serif;text-align:right;"><div style="font-size:30px;line-height:1.1;font-weight:900;color:#F4EEE1;">' + $title + '<span style="color:#AE8E42;">' + $end + '</span></div><div style="font-size:15px;line-height:1.7;color:#FFFFFF;padding-top:10px;">' + $text + '</div><div style="padding-top:12px;"><a href="' + $url + '" style="font-size:15px;font-weight:700;color:#F4EEE1;text-decoration:underline;">' + $linkText + '</a></div></td></tr></table>') $top 0
}
function Trust($rows, [int]$top = 24) {
  $h = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:1px solid #DDD3BD;">'
  foreach ($r in $rows) { $h += '<tr><td style="padding:14px 0;border-bottom:1px solid #DDD3BD;font-family:Heebo,Arial,sans-serif;font-size:15px;line-height:1.5;color:#171717;">' + $r + '</td></tr>' }
  $h += '</table>'
  return Sec $h $top 0
}
$end = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:40px;font-size:0;line-height:0;">&nbsp;</td></tr></table>' + "`n"
$wa = 'https://wa.me/97239385005'
function Head([string]$campaign, [string]$content) { return $header.Replace('%%UTM%%', "utm_source=flashy&amp;utm_medium=email&amp;utm_campaign=$campaign&amp;utm_content=$content") }
function Save([string]$name, [string]$html) { Set-Content -Encoding UTF8 -Path (Join-Path $out "$name.html") -Value $html; Write-Output "$name.html $($html.Length) chars" }

# ---------- Abandoned cart (no discount) ----------
$c = 'abandoned_cart'
$cartUrl1 = 'https://keterlion.com/cart/?flashy_cart=true&amp;email={{email}}&amp;utm_source=flashy&amp;utm_medium=email&amp;utm_campaign=abandoned_cart&amp;utm_content=email1'
$cartUrl2 = 'https://keterlion.com/cart/?flashy_cart=true&amp;email={{email}}&amp;utm_source=flashy&amp;utm_medium=email&amp;utm_campaign=abandoned_cart&amp;utm_content=email2'
$cartLabel = Sec '<div style="font-family:Heebo,Arial,sans-serif;font-size:13px;font-weight:500;letter-spacing:3px;color:#6B6B69;border-bottom:1px solid #DDD3BD;padding-bottom:10px;">בסל שלכם</div>' 28 0

Save 'cart1-top' ((Head $c 'email1') + (Eyebrow 'הסל שלכם') + (H1 'נשאר לכם משהו בסל') + (P 'ראינו שהתחלתם לבחור ולא סיימתם. שמרנו לכם את הסל, והוא מחכה בדיוק כמו שהשארתם אותו.') + $cartLabel)
Save 'cart1-bottom' ((Btn 'לחזור לסל' $cartUrl1 20) + (Trust @('<b>משלוח חינם</b> בהזמנה מעל ₪249', '<b>איסוף עצמי</b> מהחנות, נחלת בנימין 13', ('יש שאלה? <a href="' + $wa + '" style="color:#171717;text-decoration:underline;font-weight:700;">כתבו לנו בוואטסאפ</a>'))) + $end + $footer)

Save 'cart2-top' ((Head $c 'email2') + (Eyebrow 'עדיין בסל') + (H1 'עדיין חושבים על זה' '?') + (P 'מה שבחרתם עדיין בסל. אם משהו עוצר אתכם, מידה, צבע או משלוח, כתבו לנו ונעזור לבחור.') + $cartLabel)
Save 'cart2-bottom' ((Btn 'להשלים את ההזמנה' $cartUrl2 20) + (BtnOutline 'לשאול אותנו בוואטסאפ' $wa) + (Sec ('<div style="border-top:1px solid #DDD3BD;padding-top:24px;font-family:Heebo,Arial,sans-serif;font-size:30px;line-height:1.1;font-weight:900;color:#171717;" dir="ltr">It&#39;s All In Your Head<span style="color:#AE8E42;">.</span></div><div style="font-family:Heebo,Arial,sans-serif;font-size:15px;line-height:1.7;color:#6B6B69;padding-top:10px;">כובעים עם אמירה מתל אביב, מאז 2016. אפשר להזמין באתר ולאסוף מהחנות בנחלת בנימין 13.</div>') 32 0) + $end + $footer)

# ---------- Welcome series ----------
$w = 'welcome_series'
$hats = '/product-category/%d7%a1%d7%95%d7%92-%d7%9b%d7%95%d7%91%d7%a2/'
$excl = 'ההנחה לא חלה על כובע לירי, כובע grateful וכובע אליה.'

Save 'welcome1' ((Head $w 'email1') + (Img 'https://keterlion.com/wp-content/uploads/2025/12/WhatsApp-Image-2025-12-23-at-16.12.12-600x750.jpeg' 600 750 'כובע סגול של כתרליון על רקע גרפיטי' (Utm '/all-products/' $w 'email1')) + (Eyebrow 'ברוכים הבאים') + (H1 'כיף שהצטרפתם') + (P 'ברוכים הבאים למועדון <span dir="ltr" style="white-space:nowrap;">Hats &amp; friends</span> של כתרליון. כמו שהבטחנו, הנה הטבה לרכישה הראשונה באתר:') + (Coupon) + (Btn 'לבחור כובע' (Utm '/all-products/' $w 'email1')) + (Rows @(@('א׳', 'כובעים', '', (Utm $hats $w 'email1')), @('ב׳', 'עיצוב אישי', '', (Utm '/product/customize/' $w 'email1')), @('ג׳', 'חולצות', '', (Utm '/product-category/shirts/' $w 'email1')))) + (Small $excl) + $end + $footer)

Save 'welcome2' ((Head $w 'email2') + (Eyebrow 'מי אנחנו') + (H1 'הכל מתחיל בראש') + (P 'אנחנו כתרליון, מותג כובעים ישראלי מתל אביב. מאז 2016 אנחנו עושים כובעים עם אמירה. היום אנחנו שלושה דברים:') + (Rows @(@('א׳', 'חנות כובעים', 'מגוון רחב של כובעים מכל הסוגים, באיכות גבוהה ובעיצובים ייחודיים: דד קאפ, בייסבול, באקט, צמר ועוד.', (Utm '/all-products/' $w 'email2')), @('ב׳', 'עיצוב אישי', 'כובע או חולצה בעיצוב שלכם, איכותי ואופנתי. גם יחידה אחת.', (Utm '/product/customize/' $w 'email2')), @('ג׳', 'אופנת מעצבים ישראלית', 'ביגוד וכובעים עם מסרים ואווירה ישראליים, ודרופים שמתחלפים.', (Utm '/product-category/shirts/' $w 'email2')))) + (Sec (Img 'https://keterlion.com/wp-content/uploads/2026/10/m-shirts-rack-600x400.jpg' 552 368 'מתלה חולצות של כתרליון' (Utm '/product-category/shirts/' $w 'email2')) 24 0) + (Btn 'לחנות באתר' (Utm '/all-products/' $w 'email2')) + (BlackBand 'בואו למדוד' '.' 'החנות שלנו בנחלת בנימין 13, תל אביב. אפשר גם להזמין באתר ולאסוף משם.' 'איך מגיעים' 'https://www.google.com/maps/search/?api=1&amp;query=Nahalat+Binyamin+13+Tel+Aviv' 32) + (Sec '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #DDD3BD;"><tr><td style="padding:14px 16px;font-family:Heebo,Arial,sans-serif;font-size:14px;color:#171717;">ה-10% שלכם עדיין מחכים</td><td align="left" style="padding:14px 16px;font-family:Heebo,Arial,sans-serif;font-size:17px;font-weight:900;letter-spacing:2px;color:#171717;" dir="ltr">A95KGG9T</td></tr></table>' 20 0) + $end + $footer)

$sticker = Sec '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="104" height="104" align="center" valign="middle" bgcolor="#171717" style="width:104px;height:104px;border-radius:52px;background:#171717;font-family:''Suez One'',''Frank Ruhl Libre'',Georgia,serif;font-size:19px;line-height:1.1;color:#FFFFFF;">גם כובע<br>אחד</td></tr></table>' 24 0
Save 'welcome3' ((Head $w 'email3') + (Img 'https://keterlion.com/wp-content/uploads/2026/11/WhatsApp-Image-2025-12-16-at-16.34.37-1-600x900.jpeg' 600 900 'מכונת רקמה רוקמת כיתוב על כובע שחור' (Utm '/product/customize/' $w 'email3')) + $sticker + (Eyebrow 'עיצוב אישי') + (H1 'עצבו כובע משלכם') + (P 'שם, תאריך, משפט או ציור. בוחרים דגם וצבע, מוסיפים טקסט או תמונה, ורואים בדיוק איך זה ייראה לפני שמזמינים.') + (Trust @('<b>1 &middot; דגם</b>&nbsp;&nbsp; בוחרים כובע וצבע', '<b>2 &middot; עיצוב</b>&nbsp;&nbsp; טקסט, ציור או לוגו, עם תצוגה חיה', '<b>3 &middot; הזמנה</b>&nbsp;&nbsp; גם כובע אחד, בלי מינימום')) + (Btn 'להתחיל לעצב' (Utm '/product/customize/' $w 'email3')) + (Rows @(, @('חדש', 'וגם חולצה בעיצוב שלכם', '', (Utm '/product/custom-shirt/' $w 'email3'))) 24) + (BlackBand 'לעסק, לקבוצה או לאירוע' '?' 'כובעים וחולצות ממותגים, מ-24 יחידות.' 'להצעת מחיר לעסקים' (Utm '/b2b-2026/' $w 'email3')) + $end + $footer)

function Card([int]$id, [string]$img, [string]$name, [string]$price) {
  $u = Utm "/?p=$id" $w 'email4'
  return '<td width="50%" valign="top" style="width:50%;padding:0 6px 20px;"><a href="' + $u + '" style="text-decoration:none;color:#171717;"><img src="' + $img + '" width="270" height="270" alt="' + $name + '" style="display:block;width:100%;max-width:270px;height:auto;border:0;"><div style="font-family:Heebo,Arial,sans-serif;font-size:14px;line-height:1.3;font-weight:500;color:#171717;padding-top:8px;">' + $name + '</div><div style="font-family:Heebo,Arial,sans-serif;font-size:14px;font-weight:500;color:#171717;padding-top:4px;">' + $price + '</div></a></td>'
}
$up = 'https://keterlion.com/wp-content/uploads/2026/11/'
$grid = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>' + (Card 23763 ($up + 'kl-card-23763-600x600.jpg') 'חולצה, פרח שושן צחור' '₪150') + (Card 23760 ($up + 'kl-card-23760-600x600.jpg') 'חולצה, פרח ורד מכלוא' '₪150') + '</tr><tr>' + (Card 23521 ($up + 'kl-card-23521-600x600.jpg') 'כובע מודה אני, Dad Cap' '₪149') + (Card 23513 ($up + 'kl-card-23513-600x600.jpg') 'It&#39;s all in your head' '₪149') + '</tr></table>'
Save 'welcome4' ((Head $w 'email4') + (Eyebrow 'תזכורת קטנה') + (H1 'שכחתם את ה-10%' '?') + (P 'עוד לא השתמשתם בהטבה שקיבלתם כשהצטרפתם. הנה היא שוב:') + (Coupon) + (Sec '<div style="border-top:1px solid #DDD3BD;padding-top:22px;font-family:Heebo,Arial,sans-serif;font-size:26px;font-weight:900;color:#171717;">חדש על המדף<span style="color:#AE8E42;">.</span></div>' 28 16) + (Sec $grid 0 0) + (Btn 'לכל המוצרים' (Utm '/all-products/' $w 'email4') 4) + (Small $excl) + $end + $footer)

# ---------- Birthday (15%, personal code from Flashy static catalog 16401; the code block sits between -top and -bottom) ----------
$b = 'birthday'
$hero = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" bgcolor="#171717" style="width:100%;border-collapse:collapse;background:#171717;"><tr><td style="padding:40px 24px 36px;font-family:Heebo,Arial,sans-serif;text-align:right;"><div style="font-size:13px;font-weight:500;letter-spacing:3px;color:#AE8E42;">מתנת יום הולדת</div><div style="font-size:96px;line-height:1;font-weight:900;color:#FFFFFF;padding-top:10px;" dir="ltr" align="right">15%<span style="color:#AE8E42;">.</span></div><div style="font-size:17px;line-height:1.5;color:#F4EEE1;padding-top:10px;">על הקנייה הבאה שלכם באתר.</div></td></tr></table>' + "`n"
$codeLabel = Sec '<div style="font-family:Heebo,Arial,sans-serif;font-size:13px;font-weight:500;letter-spacing:3px;color:#6B6B69;border-bottom:1px solid #DDD3BD;padding-bottom:10px;">הקוד האישי שלכם</div>' 28 0
Save 'birthday-top' ((Head $b 'email1') + $hero + (Eyebrow 'יום הולדת') + (H1 'ראש חדש, כובע חדש') + (P 'יום ההולדת שלכם מתקרב, אז הבאנו מתנה קטנה: 15% הנחה על הקנייה הבאה באתר. כובע, חולצה או משהו בעיצוב שלכם.') + $codeLabel)
Save 'birthday-bottom' ((Small 'קוד אישי לשימוש אחד. מזינים אותו בסל, לפני התשלום.' 8) + (Btn 'לבחור מתנה לעצמי' (Utm '/all-products/' $b 'email1') 20) + (Rows @(, @('', 'או כובע עם השם שלכם', 'עיצוב אישי, גם כובע אחד', (Utm '/product/customize/' $b 'email1'))) 24) + (Small 'ההנחה לא חלה על פריטים במבצע, על כובע לירי, כובע grateful וכובע אליה, ולא מצטרפת להנחות אחרות.') + $end + $footer)
# ---------- Local previews (preview\*.html, 600px, a sample product where Flashy's dynamic cart block goes) ----------
$pv = Join-Path $root 'preview'
New-Item -ItemType Directory -Force $pv | Out-Null
$sample = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl"><tr><td style="padding:12px 24px;font-family:Heebo,Arial"><table width="100%"><tr><td width="104"><img src="https://keterlion.com/wp-content/uploads/2026/11/kl-card-23513-300x300.jpg" width="104" height="104" style="display:block"></td><td style="padding-right:14px;font-size:16px;font-weight:500">[בלוק תוכן דינאמי של Flashy: המוצרים בסל]<br>כובע It&#39;s all in your head ₪149</td></tr></table></td></tr></table>'
function Wrap([string]$body) { return '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;900&family=Suez+One&display=swap" rel="stylesheet"><style>body{margin:0;background:#eee}</style></head><body><div style="max-width:600px;margin:0 auto;background:#fff">' + $body + '</div></body></html>' }
foreach ($n in 1, 2) { Set-Content -Encoding UTF8 (Join-Path $pv "cart$n.html") (Wrap ((Get-Content -Raw -Encoding UTF8 (Join-Path $out "cart$n-top.html")) + $sample + (Get-Content -Raw -Encoding UTF8 (Join-Path $out "cart$n-bottom.html")))) }
Set-Content -Encoding UTF8 (Join-Path $pv 'birthday.html') (Wrap ((Get-Content -Raw -Encoding UTF8 (Join-Path $out 'birthday-top.html')) + '<table role="presentation" width="100%" dir="rtl"><tr><td align="center" style="padding:16px 24px;font-family:Heebo,Arial"><span style="display:inline-block;border:1px solid #171717;border-radius:4px;padding:12px 24px;font-size:28px;font-weight:900;letter-spacing:4px">[קוד אישי מ-Flashy]</span></td></tr></table>' + (Get-Content -Raw -Encoding UTF8 (Join-Path $out 'birthday-bottom.html'))))
foreach ($n in 1..4) { Set-Content -Encoding UTF8 (Join-Path $pv "welcome$n.html") (Wrap (Get-Content -Raw -Encoding UTF8 (Join-Path $out "welcome$n.html"))) }




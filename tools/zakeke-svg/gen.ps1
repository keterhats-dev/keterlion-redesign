# Builds compare.html (the three PNGs and the cap embedded as data URIs), runs it in headless Edge,
# saves the traced SVGs to out\ and a screenshot of the comparison. Local only; nothing is uploaded anywhere.
param([string]$shot)
$d = $PSScriptRoot
$uri = { param($f) 'data:image/png;base64,' + [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $d "src\$f"))) }
$designs = @"
[
 {"id":"lion","title":"אריה (KETERLION LION, 5.7 ס\"מ)","src":"$(& $uri 'lion.png')","mode":"single","fill":"#000000",
  "variants":[{"label":"לבן, על כובע שחור","cap":true,"map":{"#000000":"#ffffff"}},{"label":"חום-זהב","map":{"#000000":"#ca762b"}},{"label":"אדום","map":{"#000000":"#ff0000"}}]},
 {"id":"grateful","title":"grateful (מיינדסט)","src":"$(& $uri 'grateful.png')","mode":"single","fill":"#000000",
  "variants":[{"label":"לבן, על כובע שחור","cap":true,"map":{"#000000":"#ffffff"}},{"label":"כחול נייבי","map":{"#000000":"#000080"}},{"label":"ירוק כהה","map":{"#000000":"#006a4e"}}]},
 {"id":"kalaniyot","title":"כלניות (Local, 3 צבעים)","src":"$(& $uri 'kalaniyot.png')","mode":"multi","classes":["#ff0000","#3cb371","#000000"],
  "variants":[{"label":"על כובע שחור, מרכז צהוב","cap":true,"map":{"#000000":"#ffff00"}},{"label":"ורוד","map":{"#ff0000":"#ff69b4"}},{"label":"כתום וזית","map":{"#ff0000":"#ffa500","#3cb371":"#808000"}}]}
]
"@
$html = @"
<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>בדיקת SVG</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;900&display=swap" rel="stylesheet">
<style>
body{margin:0;background:#fff;color:#171717;font-family:Heebo,Arial,sans-serif;padding:28px 36px}
h1{font-weight:900;font-size:30px;margin:0 0 4px}h1::after{content:".";color:#AE8E42}
.sub{color:#6B6B69;margin:0 0 18px;font-size:15px}
section{border-top:1px solid #DDD3BD;padding:16px 0 6px}
h2{font-weight:500;font-size:19px;margin:0 0 10px}
.row{display:flex;gap:14px}
figure{margin:0;width:250px}
.tile{height:190px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.tile>img{max-width:82%;max-height:82%}
.tile.cap{background:#fff}.tile.cap .capimg{position:absolute;width:340px;height:340px;top:-60px;left:-45px;max-width:none;max-height:none}
.tile.cap .on{position:absolute;width:30%;max-height:28%;object-fit:contain;top:43%;left:50%;transform:translate(-50%,-50%)}
figcaption{font-size:13px;color:#6B6B69;margin-top:6px}
.row figure:first-child figcaption{color:#171717;font-weight:500}
.meta{font-size:12px;color:#6B6B69;margin:6px 0 0}
</style></head><body><div id="app">טוען…</div>
<script>window.KL_DESIGNS = $designs; window.KL_CAP = "$(& $uri 'cap.png')";</script>
<script src="https://cdn.jsdelivr.net/npm/imagetracerjs@1.2.6/imagetracer_v1.2.6.js"></script>
<script>$([IO.File]::ReadAllText((Join-Path $d 'page.js'), [Text.Encoding]::UTF8))</script>
</body></html>
"@
[IO.File]::WriteAllText((Join-Path $d 'compare.html'), $html, (New-Object Text.UTF8Encoding $false))
$check = @"
(async () => { for (let i = 0; i < 18 && !window.__done; i++) await new Promise(r => setTimeout(r, 500)); return JSON.stringify({done: !!window.__done, error: window.__error || null, result: window.__result || null}); })()
"@
$url = 'file:///' + ((Join-Path $d 'compare.html') -replace '\\', '/')
$lines = & (Join-Path $d 'cdp-test.ps1') -url $url -check $check -size '1420,1080' -shot $shot
$before = $lines | Where-Object { $_ -like 'BEFORE: *' } | Select-Object -First 1
$r = ($before.Substring(8) | ConvertFrom-Json).result.value | ConvertFrom-Json
"done=$($r.done) error=$($r.error)"
New-Item -ItemType Directory -Force (Join-Path $d 'out') | Out-Null
if ($r.result) { foreach ($p in $r.result.PSObject.Properties) { [IO.File]::WriteAllText((Join-Path $d "out\$($p.Name).svg"), $p.Value.svg, (New-Object Text.UTF8Encoding $false)); "$($p.Name): $($p.Value.w)x$($p.Value.h), $($p.Value.paths) paths, $([math]::Round($p.Value.bytes / 1024)) KB" } }
$lines | Where-Object { $_ -like 'SHOT*' -or $_ -like 'EXCEPTION*' -or $_ -like 'ERROR*' -or $_ -like 'LOG*' }

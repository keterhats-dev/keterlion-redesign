# Reads every product card on /all-products/ (saved as allp.html), downloads its first (300x300) image and measures it:
# is the background white, where does the product sit (bounding box of non-white pixels), how off-centre and how big.
param([string]$html = "allp.html")
$d = Split-Path -Parent $MyInvocation.MyCommand.Path
Add-Type -AssemblyName System.Drawing
$src = [IO.File]::ReadAllText((Join-Path $d $html), [Text.Encoding]::UTF8)
$items = @()
foreach ($m in [regex]::Matches($src, '<li class="[^"]*\bproduct\b[^"]*"[\s\S]*?</li>')) {
  $b = $m.Value
  $img = [regex]::Match($b, '<img[^>]*\ssrc="([^"]+)"').Groups[1].Value
  $name = [regex]::Match($b, 'woocommerce-loop-product__title">([^<]*)<').Groups[1].Value
  $link = [regex]::Match($b, 'href="(https://keterlion\.com/product/[^"]+)"').Groups[1].Value
  if ($img) { $items += [pscustomobject]@{ name = [Net.WebUtility]::HtmlDecode($name); img = $img; link = $link } }
}
$dir = Join-Path $d "thumbs"; New-Item -ItemType Directory -Force $dir | Out-Null
$out = @()
$i = 0
foreach ($it in $items) {
  $i++
  $f = Join-Path $dir ("t{0:D3}.img" -f $i)
  if (-not (Test-Path $f)) { & curl.exe -s -o $f $it.img }
  try { $bmp = [System.Drawing.Bitmap]::FromFile($f) } catch { continue }
  $w = $bmp.Width; $h = $bmp.Height
  $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $bytes = New-Object byte[] ($data.Stride * $h)
  [Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $stride = $data.Stride
  $bmp.UnlockBits($data); $bmp.Dispose()
  $minX = $w; $minY = $h; $maxX = -1; $maxY = -1
  for ($y = 0; $y -lt $h; $y += 2) {
    $row = $y * $stride
    for ($x = 0; $x -lt $w; $x += 2) {
      $p = $row + $x * 3
      if ($bytes[$p] -lt 240 -or $bytes[$p + 1] -lt 240 -or $bytes[$p + 2] -lt 240) {
        if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  $corner = 0
  $w3 = $w - 3; $h3 = $h - 3
  foreach ($c in @(@(2, 2), @($w3, 2), @(2, $h3), @($w3, $h3))) { $p = $c[1] * $stride + $c[0] * 3; if ($bytes[$p] -ge 240 -and $bytes[$p + 1] -ge 240 -and $bytes[$p + 2] -ge 240) { $corner++ } }
  if ($maxX -lt 0) { continue }
  $bw = $maxX - $minX; $bh = $maxY - $minY
  $cx = ($minX + $maxX) / 2 - $w / 2; $cy = ($minY + $maxY) / 2 - $h / 2
  $kind = if ($corner -lt 2) { 'photo-bg' } elseif ($bh -ge $h * 0.95 -or $bw -ge $w * 0.95) { 'edge-to-edge' } else { 'cutout' }
  $out += [pscustomobject]@{ n = $i; name = $it.name; kind = $kind; fill = [math]::Round([math]::Max($bw / $w, $bh / $h), 2); offX = [math]::Round($cx / $w, 2); offY = [math]::Round($cy / $h, 2); box = "$bw x $bh"; img = $it.img; link = $it.link }
}
$out | ConvertTo-Json -Depth 3 | Out-File (Join-Path $d "thumbscan.json") -Encoding utf8
"items $($items.Count), measured $($out.Count)"
$out | Group-Object kind | ForEach-Object { "{0}: {1}" -f $_.Name, $_.Count }
"cutouts by size (share of the frame):"
$out | Where-Object kind -eq 'cutout' | Group-Object { if ($_.fill -lt 0.6) { 'small <60%' } elseif ($_.fill -lt 0.8) { '60-80%' } else { 'large >80%' } } | ForEach-Object { "  {0}: {1}" -f $_.Name, $_.Count }
"off-centre cutouts (more than 6% of the frame): " + ($out | Where-Object { $_.kind -eq 'cutout' -and ([math]::Abs($_.offX) -gt 0.06 -or [math]::Abs($_.offY) -gt 0.06) }).Count

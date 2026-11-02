# Finds the new card images that carry a shadow under the product.
# A shadow = light, colourless grey pixels (not white) in the bottom part of the product's box.
# Writes shadows.json (row number, new id, share of shadow pixels in the bottom band) for every image.
$d = Split-Path -Parent $MyInvocation.MyCommand.Path
Add-Type -AssemblyName System.Drawing
$rows = (Get-Content (Join-Path $d "batch-map.json") -Raw -Encoding UTF8 | ConvertFrom-Json).rows
$items = @()
for ($i = 0; $i -lt $rows.Count; $i++) { if ($rows[$i][1] -gt 0) { $items += [pscustomobject]@{ n = $i + 1; newId = $rows[$i][1]; f = (Join-Path $d ("thumbs\new-{0}.jpg" -f $rows[$i][1])) } } }
$pilot = (Get-Content (Join-Path $d "..\pilot\pilot-map.json") -Raw | ConvertFrom-Json).items
foreach ($p in $pilot) { $items += [pscustomobject]@{ n = "p" + $p.n; newId = $p.new; f = (Join-Path $d ("..\pilot\new-{0}.jpg" -f $p.product)) } }
$out = foreach ($it in $items) {
  $b = [System.Drawing.Bitmap]::FromFile($it.f); $w = $b.Width; $h = $b.Height
  $data = $b.LockBits((New-Object System.Drawing.Rectangle 0,0,$w,$h), 'ReadOnly', [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $px = New-Object byte[] ($data.Stride * $h); [Runtime.InteropServices.Marshal]::Copy($data.Scan0, $px, 0, $px.Length); $st = $data.Stride; $b.UnlockBits($data); $b.Dispose()
  $minY = $h; $maxY = 0
  for ($y = 0; $y -lt $h; $y++) { $r = $y * $st; for ($x = 0; $x -lt $w; $x += 2) { $p = $r + $x * 3; if ([math]::Min([math]::Min($px[$p], $px[$p+1]), $px[$p+2]) -lt 245) { if ($y -lt $minY) { $minY = $y }; $maxY = $y; break } } }
  $band = [int](($maxY - $minY) * 0.18); $y0 = $maxY - $band
  $non = 0; $soft = 0
  for ($y = $y0; $y -le $maxY; $y++) { $r = $y * $st; for ($x = 0; $x -lt $w; $x++) { $p = $r + $x * 3; $lo = [math]::Min([math]::Min($px[$p], $px[$p+1]), $px[$p+2]); $hi = [math]::Max([math]::Max($px[$p], $px[$p+1]), $px[$p+2])
    if ($lo -lt 245) { $non++; if ($lo -ge 165 -and ($hi - $lo) -le 12) { $soft++ } } } }
  [pscustomobject]@{ n = $it.n; newId = $it.newId; soft = if ($non) { [math]::Round($soft / $non, 2) } else { 0 }; non = $non }
}
$out | ConvertTo-Json | Out-File (Join-Path $d "shadows.json") -Encoding utf8
"share of light grey in the bottom band:"
$out | Group-Object { [math]::Floor($_.soft * 10) / 10 } | Sort-Object { [double]$_.Name } | ForEach-Object { "  {0}: {1}" -f $_.Name, $_.Count }

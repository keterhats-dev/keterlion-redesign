# Builds two images from thumbscan.json:
# 1) sheet-photos.png: every product whose card image is a photo with a background or white bars baked in
# 2) sheet-before-after.png: 12 cutouts that are small or off-centre, before and after an automatic fix
#    (trim the white, centre, scale to 82% of the frame, white square)
$d = Split-Path -Parent $MyInvocation.MyCommand.Path
Add-Type -AssemblyName System.Drawing
$all = Get-Content (Join-Path $d "thumbscan.json") -Raw -Encoding UTF8 | ConvertFrom-Json
function Load($n) { [System.Drawing.Image]::FromFile((Join-Path $d ("thumbs\t{0:D3}.img" -f $n))) }
$bg = [System.Drawing.Color]::FromArgb(244, 244, 242); $line = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(221, 211, 189)), 1

# 1) photos
$photos = @($all | Where-Object { $_.kind -ne 'cutout' })
$cell = 120; $cols = 10; $rows = [math]::Ceiling($photos.Count / $cols)
$sheet = New-Object System.Drawing.Bitmap ($cols * $cell + 20), ($rows * $cell + 20)
$g = [System.Drawing.Graphics]::FromImage($sheet); $g.Clear($bg); $g.InterpolationMode = 'HighQualityBicubic'
for ($k = 0; $k -lt $photos.Count; $k++) {
  $x = 10 + ($cols - 1 - ($k % $cols)) * $cell; $y = 10 + [math]::Floor($k / $cols) * $cell
  $im = Load $photos[$k].n
  $g.FillRectangle([System.Drawing.Brushes]::White, $x + 5, $y + 5, $cell - 10, $cell - 10)
  $g.DrawImage($im, (New-Object System.Drawing.Rectangle ($x + 5), ($y + 5), ($cell - 10), ($cell - 10)))
  $g.DrawRectangle($line, $x + 5, $y + 5, $cell - 10, $cell - 10); $im.Dispose()
}
$sheet.Save((Join-Path $d "sheet-photos.png"), [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $sheet.Dispose()

# 2) before / after for small or off-centre cutouts
$pick = @($all | Where-Object { $_.kind -eq 'cutout' -and ($_.fill -lt 0.72 -or [math]::Abs($_.offX) -gt 0.06 -or [math]::Abs($_.offY) -gt 0.06) } | Select-Object -First 12)
$c2 = 200; $pad = 16
$sheet = New-Object System.Drawing.Bitmap (6 * ($c2 + $pad) + $pad), (4 * ($c2 + $pad) + $pad)
$g = [System.Drawing.Graphics]::FromImage($sheet); $g.Clear($bg); $g.InterpolationMode = 'HighQualityBicubic'
for ($k = 0; $k -lt $pick.Count; $k++) {
  $col = $k % 3; $row = [math]::Floor($k / 3)
  # right-to-left: before on the right of each pair, after on its left
  $xb = $pad + (5 - $col * 2) * ($c2 + $pad); $xa = $pad + (4 - $col * 2) * ($c2 + $pad); $y = $pad + $row * ($c2 + $pad)
  $im = Load $pick[$k].n
  $g.DrawImage($im, (New-Object System.Drawing.Rectangle $xb, $y, $c2, $c2)); $g.DrawRectangle($line, $xb, $y, $c2, $c2)
  # after: crop the non-white box, scale its longer side to 82% of the cell, centre it on white
  $b = $pick[$k].box -split ' x '; $bw = [int]$b[0]; $bh = [int]$b[1]
  $src = New-Object System.Drawing.Bitmap $im
  $minX = $src.Width; $minY = $src.Height; $maxX = 0; $maxY = 0
  for ($yy = 0; $yy -lt $src.Height; $yy += 2) { for ($xx = 0; $xx -lt $src.Width; $xx += 2) { $p = $src.GetPixel($xx, $yy); if ($p.R -lt 240 -or $p.G -lt 240 -or $p.B -lt 240) { if ($xx -lt $minX) { $minX = $xx }; if ($xx -gt $maxX) { $maxX = $xx }; if ($yy -lt $minY) { $minY = $yy }; if ($yy -gt $maxY) { $maxY = $yy } } } }
  $cw = $maxX - $minX + 2; $ch = $maxY - $minY + 2
  $scale = ($c2 * 0.82) / [math]::Max($cw, $ch)
  $tw = [int]($cw * $scale); $th = [int]($ch * $scale)
  $g.FillRectangle([System.Drawing.Brushes]::White, $xa, $y, $c2, $c2)
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle ($xa + [int](($c2 - $tw) / 2)), ($y + [int](($c2 - $th) / 2)), $tw, $th), (New-Object System.Drawing.Rectangle $minX, $minY, $cw, $ch), [System.Drawing.GraphicsUnit]::Pixel)
  $g.DrawRectangle($line, $xa, $y, $c2, $c2)
  $src.Dispose(); $im.Dispose()
}
$sheet.Save((Join-Path $d "sheet-before-after.png"), [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $sheet.Dispose()
"photos: $($photos.Count), before/after pairs: $($pick.Count)"

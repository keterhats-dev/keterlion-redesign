# Before / after sheet for the 12-product pilot, in the site's 4:5 card box.
# Each pair: before (the old card thumb, on white) on the right, after (the new uploaded image) on its left.
param([string]$thumbs = "")
$d = Split-Path -Parent $MyInvocation.MyCommand.Path
Add-Type -AssemblyName System.Drawing
$map = Get-Content (Join-Path $d "pilot-map.json") -Raw | ConvertFrom-Json
$cw = 200; $ch = 250; $pad = 12; $gap = 4
$cols = 3; $rows = [math]::Ceiling($map.items.Count / $cols)
$W = $pad + $cols * (2 * $cw + $gap + $pad); $H = $pad + $rows * ($ch + $pad)
$sheet = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($sheet); $g.Clear([System.Drawing.Color]::FromArgb(244, 244, 242)); $g.InterpolationMode = 'HighQualityBicubic'
$font = New-Object System.Drawing.Font 'Arial', 9
function Put($img, $x, $y) {
  $g.FillRectangle([System.Drawing.Brushes]::White, $x, $y, $cw, $ch)
  $s = [math]::Min($cw / $img.Width, $ch / $img.Height); $tw = [int]($img.Width * $s); $th = [int]($img.Height * $s)
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle ($x + [int](($cw - $tw) / 2)), ($y + [int](($ch - $th) / 2)), $tw, $th))
}
for ($k = 0; $k -lt $map.items.Count; $k++) {
  $it = $map.items[$k]; $col = $k % $cols; $row = [math]::Floor($k / $cols)
  $xr = $W - $pad - $col * (2 * $cw + $gap + $pad) - $cw; $xl = $xr - $gap - $cw; $y = $pad + $row * ($ch + $pad)
  $old = [System.Drawing.Image]::FromFile((Join-Path $thumbs ("t{0:D3}.img" -f $it.n)))
  $new = [System.Drawing.Image]::FromFile((Join-Path $d ("new-{0}.jpg" -f $it.product)))
  Put $old $xr $y; Put $new $xl $y
  $g.DrawString(("{0}" -f $it.n), $font, [System.Drawing.Brushes]::Gray, ($xr + $cw - 24), ($y + 4))
  $old.Dispose(); $new.Dispose()
}
$sheet.Save((Join-Path $d "pilot-before-after.png"), [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $sheet.Dispose()
"saved"

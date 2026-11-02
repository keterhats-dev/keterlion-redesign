# Crops a screenshot to a width and cuts the empty white space under the page. Prints the page height that is left.
param($in, $out, [int]$width = 0)
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile($in)
$W = if ($width -gt 0) { [Math]::Min($width, $img.Width) } else { $img.Width }
function RowBlank([int]$y) {
  for ($x = [int]($W * 0.02); $x -lt $W - 80; $x += 6) { $c = $img.GetPixel($x, $y); if ($c.R -lt 250 -or $c.G -lt 250 -or $c.B -lt 250) { return $false } }
  return $true
}
$y = $img.Height - 1
while ($y -gt 0 -and (RowBlank $y)) { $y -= 12 }
$y = [Math]::Min($img.Height - 1, $y + 12)
while ($y -gt 0 -and (RowBlank $y)) { $y-- }
$H = $y + 1
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($img, (New-Object System.Drawing.Rectangle 0,0,$W,$H), (New-Object System.Drawing.Rectangle 0,0,$W,$H), [System.Drawing.GraphicsUnit]::Pixel)
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose(); $img.Dispose()
"$out $W x $H"


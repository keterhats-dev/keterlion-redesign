# Before and after side by side, with a label and the page length above each. Desktop is scaled to half.
param($before, $after, $out, [double]$scale = 1.0)
Add-Type -AssemblyName System.Drawing
$a = [System.Drawing.Image]::FromFile($before); $b = [System.Drawing.Image]::FromFile($after)
$w = [int]($a.Width * $scale); $ha = [int]($a.Height * $scale); $hb = [int]($b.Height * $scale)
$m = 40; $gap = 60; $top = 90
$sheetW = $m + $w + $gap + $w + $m; $sheetH = $top + [Math]::Max($ha, $hb) + $m
$bmp = New-Object System.Drawing.Bitmap $sheetW, $sheetH
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(244,244,242))
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$fmt = New-Object System.Drawing.StringFormat ([System.Drawing.StringFormatFlags]::DirectionRightToLeft)
$big = New-Object System.Drawing.Font 'Arial', 22, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$small = New-Object System.Drawing.Font 'Arial', 16, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$ink = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(23,23,23))
$grey = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(107,107,105))
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(221,211,189)), 1
# after on the right (Hebrew reading order), before on the left
$xr = $m + $w + $gap; $xl = $m
$g.DrawString('אחרי', $big, $ink, (New-Object System.Drawing.RectangleF $xr, 24, $w, 30), $fmt)
$g.DrawString(('אורך: ' + $b.Height.ToString('N0') + ' פיקסלים'), $small, $grey, (New-Object System.Drawing.RectangleF $xr, 54, $w, 24), $fmt)
$g.DrawString('לפני (היום)', $big, $ink, (New-Object System.Drawing.RectangleF $xl, 24, $w, 30), $fmt)
$g.DrawString(('אורך: ' + $a.Height.ToString('N0') + ' פיקסלים'), $small, $grey, (New-Object System.Drawing.RectangleF $xl, 54, $w, 24), $fmt)
$g.DrawImage($b, (New-Object System.Drawing.Rectangle $xr, $top, $w, $hb)); $g.DrawRectangle($pen, $xr - 1, $top - 1, $w + 1, $hb + 1)
$g.DrawImage($a, (New-Object System.Drawing.Rectangle $xl, $top, $w, $ha)); $g.DrawRectangle($pen, $xl - 1, $top - 1, $w + 1, $ha + 1)
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $a.Dispose(); $b.Dispose()
"saved $out ($sheetW x $sheetH)"

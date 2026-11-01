# Puts each page's desktop screenshot (top part) and phone screenshot (390 wide) side by side on a light grey sheet.
param([int]$dh = 1300, [int]$ph = 1500)
Add-Type -AssemblyName System.Drawing
$d = Split-Path -Parent $MyInvocation.MyCommand.Path
foreach ($k in 'b2b','story','store','soldiers','gift') {
  $desk = [System.Drawing.Image]::FromFile((Join-Path $d "desk-$k.png"))
  $ph0 = [System.Drawing.Image]::FromFile((Join-Path $d "ph-$k.png"))
  $m = 40; $W = $m + 1440 + $m + 390 + $m; $H = $m + [Math]::Max($dh, $ph) + $m
  $bmp = New-Object System.Drawing.Bitmap $W, $H
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(244,244,242))
  $g.DrawImage($desk, (New-Object System.Drawing.Rectangle $m,$m,1440,$dh), (New-Object System.Drawing.Rectangle 0,0,1440,$dh), [System.Drawing.GraphicsUnit]::Pixel)
  $px = $m + 1440 + $m
  $g.DrawImage($ph0, (New-Object System.Drawing.Rectangle $px,$m,390,$ph), (New-Object System.Drawing.Rectangle 0,0,390,$ph), [System.Drawing.GraphicsUnit]::Pixel)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(221,211,189)), 1
  $g.DrawRectangle($pen, $m-1, $m-1, 1441, $dh+1); $g.DrawRectangle($pen, $px-1, $m-1, 391, $ph+1)
  $out = Join-Path $d "mock-photo-$k.png"
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $desk.Dispose(); $ph0.Dispose()
  "saved $out"
}

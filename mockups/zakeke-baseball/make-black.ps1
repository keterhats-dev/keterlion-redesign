# Turns the navy baseball cap photo into a black one, in the same style as the other baseball photos.
# Only the cap changes (bluish or dark pixels); the white background and the soft grey shadow stay as they are.
param([string]$in = "c4.png", [string]$out = "baseball-black.png")
$d = Split-Path -Parent $MyInvocation.MyCommand.Path
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Bitmap]::FromFile((Join-Path $d $in))
$w = $src.Width; $h = $src.Height
$bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::White); $g.DrawImage($src, 0, 0, $w, $h); $g.Dispose(); $src.Dispose()
$rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
$data = $bmp.LockBits($rect, 'ReadWrite', [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$px = New-Object byte[] ($data.Stride * $h); [Runtime.InteropServices.Marshal]::Copy($data.Scan0, $px, 0, $px.Length)
for ($i = 0; $i -lt $px.Length; $i += 4) {
  $b = $px[$i]; $gr = $px[$i + 1]; $r = $px[$i + 2]
  $mx = [math]::Max([math]::Max($r, $gr), $b); $mn = [math]::Min([math]::Min($r, $gr), $b)
  $sat = if ($mx -gt 0) { ($mx - $mn) / $mx } else { 0 }
  $lum = 0.299 * $r + 0.587 * $gr + 0.114 * $b
  $wt = 0
  if ($b -ge $r -and $b -ge ($gr - 4)) { $wt = [math]::Min(1, [math]::Max(0, ($sat - 0.10) / 0.14)) }
  if ($lum -lt 95) { $wt = 1 }
  if ($wt -le 0) { continue }
  $v = 18 + $lum * 0.42
  $px[$i] = [byte]($b + ($v - $b) * $wt); $px[$i + 1] = [byte]($gr + ($v - $gr) * $wt); $px[$i + 2] = [byte]($r + ($v - $r) * $wt)
}
[Runtime.InteropServices.Marshal]::Copy($px, 0, $data.Scan0, $px.Length); $bmp.UnlockBits($data)
$bmp.Save((Join-Path $d $out), [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
"saved $out"

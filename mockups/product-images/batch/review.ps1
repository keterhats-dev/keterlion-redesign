# Review sheets for the full run: every new card image, numbered (row in batch-map.json), 10 per row, 100 per sheet.
$d = Split-Path -Parent $MyInvocation.MyCommand.Path
Add-Type -AssemblyName System.Drawing
$rows = (Get-Content (Join-Path $d "batch-map.json") -Raw -Encoding UTF8 | ConvertFrom-Json).rows
$dir = Join-Path $d "thumbs"; New-Item -ItemType Directory -Force $dir | Out-Null
$ok = @()
for ($i = 0; $i -lt $rows.Count; $i++) { if ($rows[$i][1] -gt 0) { $ok += [pscustomobject]@{ n = $i + 1; newId = $rows[$i][1]; product = $rows[$i][2][0] } } }
foreach ($m in $ok) {
  $f = Join-Path $dir ("new-{0}.jpg" -f $m.newId)
  if (-not (Test-Path $f)) { & curl.exe -s -o $f ("https://keterlion.com/wp-content/uploads/2026/11/kl-card-{0}-300x300.jpg" -f $m.product) }
}
$cell = 124; $per = 100; $cols = 10
$font = New-Object System.Drawing.Font 'Arial', 10, ([System.Drawing.FontStyle]::Bold)
for ($s = 0; $s * $per -lt $ok.Count; $s++) {
  $chunk = @($ok | Select-Object -Skip ($s * $per) -First $per)
  $nr = [math]::Ceiling($chunk.Count / $cols)
  $sheet = New-Object System.Drawing.Bitmap ($cols * $cell + 4), ($nr * $cell + 4)
  $g = [System.Drawing.Graphics]::FromImage($sheet); $g.Clear([System.Drawing.Color]::FromArgb(221, 211, 189)); $g.InterpolationMode = 'HighQualityBicubic'
  for ($k = 0; $k -lt $chunk.Count; $k++) {
    $x = 4 + ($k % $cols) * $cell; $y = 4 + [math]::Floor($k / $cols) * $cell
    $f = Join-Path $dir ("new-{0}.jpg" -f $chunk[$k].newId)
    try { $im = [System.Drawing.Image]::FromFile($f); $g.DrawImage($im, (New-Object System.Drawing.Rectangle $x, $y, ($cell - 4), ($cell - 4))); $im.Dispose() } catch { $g.FillRectangle([System.Drawing.Brushes]::Red, $x, $y, ($cell - 4), ($cell - 4)) }
    $g.FillRectangle([System.Drawing.Brushes]::Black, $x, $y, 34, 18)
    $g.DrawString(("{0}" -f $chunk[$k].n), $font, [System.Drawing.Brushes]::White, ($x + 2), ($y + 1))
  }
  $sheet.Save((Join-Path $d ("review-{0}.png" -f ($s + 1))), [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $sheet.Dispose()
}
"new images: $($ok.Count), sheets: $([math]::Ceiling($ok.Count / $per))"

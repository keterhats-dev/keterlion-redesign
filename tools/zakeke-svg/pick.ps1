# Reads out\all\gallery.json (the gallery list saved from the Zakeke admin page), picks one PNG per design
# (black 2150 first, then any black, then the darkest thread), downloads it to src\all\<categoryId>.png
# and writes out\all\designs.json. Local only; nothing is uploaded anywhere.
param([int[]]$skipCats = @(230584))
$d = $PSScriptRoot
$g = Get-Content -Raw -Encoding UTF8 (Join-Path $d 'out\all\gallery.json') | ConvertFrom-Json
$cat = @{}; $g.cats | ForEach-Object { $cat[[int]$_.id] = $_ }
New-Item -ItemType Directory -Force (Join-Path $d 'src\all') | Out-Null
# darkest first, so a design without black still gets a dark, high-contrast preview
$order = '2150', 'Black', '2073', 'Navy', '2296', 'Dark Silver', '2135', 'Brown', '2084', 'Purple'
$designs = foreach ($grp in ($g.images | Where-Object { $skipCats -notcontains $_.cat } | Group-Object cat)) {
  $c = $cat[[int]$grp.Name]; $m = $cat[[int]$c.parent]; $imgs = @($grp.Group)
  $pick = $null
  foreach ($k in $order) { $pick = $imgs | Where-Object { $_.name -match [regex]::Escape($k) } | Select-Object -First 1; if ($pick) { break } }
  if (-not $pick) { $pick = $imgs[0] }
  # most common size among the design's images (some names have typos such as 635x42)
  $sz = $imgs | Where-Object { $_.h -and $_.w } | Group-Object { "$($_.h)x$($_.w)" } | Sort-Object Count -Descending | Select-Object -First 1
  $h = $null; $w = $null; if ($sz) { $h, $w = $sz.Name -split 'x' | ForEach-Object { [int]$_ } }
  $multi = ($imgs.Count -eq 1 -and -not $h)
  $file = Join-Path $d "src\all\$($c.id).png"
  if (-not (Test-Path $file)) { Invoke-WebRequest -UseBasicParsing -Uri $pick.prev -OutFile $file }
  [pscustomobject]@{ cat = [int]$c.id; macro = $m.name; macroId = [int]$m.id; sub = $c.name; n = $imgs.Count; pick = $pick.name; pickId = $pick.id
    h = $h; w = $w; sizes = (($imgs | ForEach-Object { "$($_.h)x$($_.w)" } | Sort-Object -Unique) -join ','); mode = $(if ($multi) { 'multi' } else { 'single' })
    price = (($imgs.price | Sort-Object -Unique) -join ','); ids = @($imgs.id) }
}
$json = $designs | Sort-Object macro, sub | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText((Join-Path $d 'out\all\designs.json'), $json, (New-Object Text.UTF8Encoding $false))
"designs: $(@($designs).Count), multi: $(@($designs | Where-Object mode -eq 'multi').Count), files: $((Get-ChildItem (Join-Path $d 'src\all') -Filter *.png).Count)"
$designs | Where-Object { $_.pick -notmatch '2150' } | ForEach-Object { "no 2150: $($_.sub) -> $($_.pick) [$($_.mode)]" }

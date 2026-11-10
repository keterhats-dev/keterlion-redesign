# Builds the Drive backup: every uploaded SVG renamed "<collection> - <design>.svg" plus list.csv
# (name, collection, size, colours, Zakeke ids), zipped into out\all\keterlion-zakeke-svg-<date>.zip. Local only.
$d = $PSScriptRoot
$up = Get-Content -Raw -Encoding UTF8 (Join-Path $d 'out\all\uploaded.json') | ConvertFrom-Json
$meta = Get-Content -Raw -Encoding UTF8 (Join-Path $d 'out\all\svgmeta.json') | ConvertFrom-Json
$des = Get-Content -Raw -Encoding UTF8 (Join-Path $d 'out\all\designs.json') | ConvertFrom-Json
$m = @{}; $meta | ForEach-Object { $m[[int]$_.cat] = $_ }
$o = @{}; $des | ForEach-Object { $o[[int]$_.cat] = $_ }
$dir = Join-Path $d 'out\all\backup'; Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue; New-Item -ItemType Directory -Force $dir | Out-Null
$order = 'KETERLION LION', 'מיינדסט', 'Journy', 'כתר עליון', 'Others', 'Local', 'שורשים', 'tatoos'
$rows = foreach ($u in ($up | Sort-Object { $order.IndexOf($_.macro) }, name)) {
  $safe = (($u.macro + ' - ' + $u.name) -replace '[\\/:*?"<>|]', '').Trim().TrimEnd('.')
  Copy-Item (Join-Path $d "out\all\svg\$($u.oldCat).svg") (Join-Path $dir "$safe.svg")
  [pscustomobject]@{
    'שם' = $u.name; 'קולקציה' = $u.macro; 'גובה מ"מ' = $u.h; 'רוחב מ"מ' = $u.w
    'צבעים' = ($m[[int]$u.oldCat].fills -join ' '); 'סוג' = $(if ($u.mode -eq 'multi') { 'רב-צבעי' } else { 'צבע אחד' })
    'מספר תמונה ב-Zakeke' = $u.newId; 'קטגוריה חדשה' = $u.newCat; 'קולקציה חדשה' = $u.newMacro
    'קטגוריה ישנה' = $u.oldCat; 'תמונות ישנות' = $o[[int]$u.oldCat].n; 'ה-PNG שממנו נוצר' = $o[[int]$u.oldCat].pick; 'קובץ' = "$safe.svg"
  }
}
$csv = Join-Path $dir 'list.csv'
$rows | ConvertTo-Csv -NoTypeInformation | Out-File -Encoding utf8 $csv   # PowerShell 5.1 utf8 = with BOM, so Excel reads the Hebrew
$zip = Join-Path $d "out\all\keterlion-zakeke-svg-$(Get-Date -Format yyyy-MM-dd).zip"
Remove-Item $zip -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $dir '*') -DestinationPath $zip
"rows: $(@($rows).Count), files: $((Get-ChildItem $dir -Filter *.svg).Count), zip: $zip ($([math]::Round((Get-Item $zip).Length / 1KB)) KB)"

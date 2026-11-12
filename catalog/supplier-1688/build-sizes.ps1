# Turns size-notes.txt (hand-read from the supplier's size-chart images) into size-charts.json
# Usage: powershell -File build-sizes.ps1
$ErrorActionPreference = 'Stop'
$here  = Split-Path -Parent $MyInvocation.MyCommand.Path
$lines = Get-Content (Join-Path $here 'size-notes.txt') -Encoding utf8
$order = 'S','M','L','XL','2XL','3XL'

function Parse-Rows([string]$s){
  $o = [ordered]@{}
  foreach($m in [regex]::Matches($s, '(S|M|L|XL|2XL|3XL):([0-9./\-]+)')){ $o[$m.Groups[1].Value] = $m.Groups[2].Value }
  return $o
}

# shared tables from the header comments
$shared = @{}
foreach($l in $lines){ if($l -match '^#\s+([A-Z0-9]+)\s+(?:\([^)]*\)\s+)?(S:.*)$'){ $shared[$matches[1]] = Parse-Rows $matches[2] } }

function Resolve-Part([string]$part){
  $part = $part.Trim()
  $range = $null
  if($part -match '\((S|M)-(2XL|3XL)( only)?\)'){ $range = $order[$order.IndexOf($matches[1])..$order.IndexOf($matches[2])] }
  $over = @{}
  if($part -match ' but (.*)$'){ $over = Parse-Rows $matches[1] }
  if($part -match '^([A-Z]{2,3}[0-9]?)\b' -and $shared.ContainsKey($matches[1])){ $rows = [ordered]@{} + $shared[$matches[1]] }
  else { $rows = Parse-Rows $part }
  foreach($k in $over.Keys){ $rows[$k] = $over[$k] }
  if($range){ foreach($k in @($rows.Keys)){ if($range -notcontains $k){ $rows.Remove($k) } } }
  return $rows
}

$out = [ordered]@{
  note = "Read by hand from the supplier's size-chart images on 1688 (尺码表). cm and kg. Supplier: hand measurement, 1-3 cm tolerance. 'chest_flat' = width across the chest (garment laid flat), otherwise chest = around."
  products = @()
}
foreach($l in $lines){
  if($l -notmatch '^P(\d+) (\d+) (.+?) \| (.+?) \| (.+?) \| (.+)$'){ continue }
  $id=$matches[2]; $model=$matches[3]; $type=$matches[4]; $meas=$matches[5]; $hw=$matches[6]
  $isPants = $type -match 'shorts|sweatpants'
  $flat = ($meas -match 'chest flat|^(HD|ZH|BX)\b') -or ($type -match 'chest flat')
  $m = Resolve-Part $meas; $h = Resolve-Part $hw
  $rows = @()
  foreach($s in $order){
    if(-not $m.Contains($s)){ continue }
    $v = $m[$s] -split '/'
    $r = [ordered]@{ size = $s }
    if($isPants){
      if($type -match 'sweatpants'){ $r.length=[double]$v[0]; $r.hip=[double]$v[1]; $r.waist=[double]$v[2]; $r.leg_opening=[double]$v[3] }
      else { $r.length=[double]$v[0]; $r.waist=[double]$v[1]; $r.hip=[double]$v[2]; $r.leg_opening=[double]$v[3] }
    } else {
      $r.length=[double]$v[0]; if($flat){ $r.chest_flat=[double]$v[1] } else { $r.chest=[double]$v[1] }; $r.shoulder=[double]$v[2]
      if($v[3] -and $v[3] -ne '-'){ $r.sleeve=[double]$v[3] }
    }
    if($h.Contains($s)){ $hv = $h[$s] -split '/'; $r.height=$hv[0]; $r.weight=$hv[1] }
    $rows += $r
  }
  $out.products += [ordered]@{ offer=$id; model=$model; type=$type; rows=$rows }
}
$json = $out | ConvertTo-Json -Depth 6
[IO.File]::WriteAllText((Join-Path $here 'size-charts.json'), $json, (New-Object Text.UTF8Encoding $false))
"products: $($out.products.Count)"

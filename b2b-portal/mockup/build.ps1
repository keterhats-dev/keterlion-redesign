# Builds the portal mockup: template + embedded images + wordmark -> one HTML file.
# Usage: powershell -File build.ps1 -TeeDir <folder with AK07 colour jpgs> -Out <out.html>
param([Parameter(Mandatory)][string]$TeeDir, [Parameter(Mandatory)][string]$Out)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $here '..\..')
$html = [IO.File]::ReadAllText((Join-Path $here 'portal-template.html'))

function DataUri([string]$path){ $b=[IO.File]::ReadAllBytes($path); $t= if($path -match '\.png$'){'image/png'}else{'image/jpeg'}; "data:$t;base64," + [Convert]::ToBase64String($b) }

# supplier colour photos: keep only the band between the supplier logo (top ~11.5%) and the caption (from ~76%)
function CropTee([string]$src){
  $im=[System.Drawing.Image]::FromFile($src); $w=$im.Width; $y0=[int]($im.Height*0.115); $h=[int]($im.Height*0.645)
  $bmp=New-Object System.Drawing.Bitmap $w,$w; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::White)
  $g.InterpolationMode='HighQualityBicubic'
  $dst=[System.Drawing.Rectangle]::new(0,[int](($w-$h)/2),$w,$h); $srcR=[System.Drawing.Rectangle]::new(0,$y0,$w,$h)
  $g.DrawImage($im,$dst,$srcR,[System.Drawing.GraphicsUnit]::Pixel)
  $tmp=[IO.Path]::GetTempFileName()+'.jpg'; $bmp.Save($tmp,[System.Drawing.Imaging.ImageFormat]::Jpeg); $g.Dispose();$bmp.Dispose();$im.Dispose(); return $tmp
}
$map = @{
  'custom'='assets\custom.jpg'; 'p-camel-beige'='assets\p-camel-beige.jpg'; 'p-fish'='assets\p-fish.jpg'; 'p3'='assets\p3.jpg'; 'p4'='assets\p4.jpg'; 'p1'='assets\p1.jpg'; 'p-mice'='assets\p-mice.jpg'
}
foreach($k in $map.Keys){ $html = $html.Replace("/*IMG:$k*/", (DataUri (Join-Path $root $map[$k]))) }
$tees = @{ 'tee-black'='O1CN010oWPac1u5dt1YpjOw'; 'tee-white'='O1CN012vkK221u5dt8hS5vy'; 'tee-sand'='O1CN01zTm3Tm1u5dt6eepLA' }
foreach($k in $tees.Keys){ $html = $html.Replace("/*IMG:$k*/", (DataUri (CropTee (Join-Path $TeeDir ($tees[$k]+'.jpg'))))) }
$svg = [IO.File]::ReadAllText((Join-Path $root 'assets\brand\keterlion-wordmark-black.svg'))
$wm = [regex]::Match($svg,' d="([^"]+)"').Groups[1].Value
$html = $html.Replace('/*WMPATH*/',$wm)
if($html -match '/\*(IMG:|WMPATH)'){ throw "unreplaced placeholder" }
[IO.File]::WriteAllText($Out,$html,(New-Object Text.UTF8Encoding $false))
"built $Out ($([math]::Round((Get-Item $Out).Length/1KB)) KB)"

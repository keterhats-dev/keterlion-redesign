# Washed shirts for Zakeke (5.11.2026). The supplier sent the washed colours only as two small WhatsApp collages
# (src\wash-collage-1.jpg and -2.jpg, about 380px per shirt). The shape, folds and seams come from the sharp brown
# studio photo, and the colour and the wash come from the collage (see ShirtTool.Wash).
$d = Split-Path -Parent $MyInvocation.MyCommand.Path
Add-Type -Path "$d\ShirtTool.cs" -ReferencedAssemblies System.Drawing
New-Item -ItemType Directory -Force "$d\out-wash" | Out-Null
$b1 = ([ShirtTool]::Components("$d\src\wash-collage-1.jpg")).Split(';')
$b2 = ([ShirtTool]::Components("$d\src\wash-collage-2.jpg")).Split(';')
# name, collage, index of the front in that collage (the back is the next one)
$jobs = @(@('blue', 1, 0), @('olive', 1, 2), @('purple', 1, 4), @('charcoal', 1, 6), @('orange', 2, 0), @('mocha', 2, 2), @('cream', 2, 4))
$seed = 11
foreach ($j in $jobs) {
  $boxes = if ($j[1] -eq 1) { $b1 } else { $b2 }
  foreach ($side in @(@('front', 0), @('back', 1))) {
    $bx = $boxes[$j[2] + $side[1]].Split(',') | ForEach-Object { [int]$_ }
    [ShirtTool]::Wash("$d\src\brown-$($side[0]).jpg", "$d\src\wash-collage-$($j[1]).jpg", $bx[0], $bx[1], $bx[2], $bx[3], "$d\out-wash\wash-$($j[0])-$($side[0]).jpg", $seed, 0.9) | Out-Null
    $seed++
  }
}
$names = @{ blue = 'כחול ווש'; olive = 'זית ווש'; purple = 'סגול ווש'; charcoal = 'שחור ווש'; orange = 'כתום ווש'; mocha = 'מוקה ווש'; cream = 'שמנת ווש' }
$paths = @(); $labels = @()
foreach ($j in $jobs) {
  foreach ($p in @(@('front', 'חזית'), @('back', 'גב'))) { $paths += "$d\out-wash\wash-$($j[0])-$($p[0]).jpg"; $labels += "$($names[$j[0]]) · $($p[1])" }
}
$paths += "$d\src\wash-collage-1.jpg"; $labels += 'המקור: WhatsApp 1'
$paths += "$d\src\wash-collage-2.jpg"; $labels += 'המקור: WhatsApp 2'
[ShirtTool]::Sheet($paths, $labels, "$d\all-wash.jpg", 300, 4)
"done"

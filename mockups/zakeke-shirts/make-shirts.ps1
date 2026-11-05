# Custom-shirt photos for Zakeke (5.11.2026).
# Sources: the supplier photos in src\ (front and back, all 1500x1500, the shirt in the exact same spot in every photo).
# Makes: black (from the brown) and white (from the lavender), front and back, and sleeve close-ups for every colour.
# Right sleeve = the wearer's right = the left side of the front photo.
$d = Split-Path -Parent $MyInvocation.MyCommand.Path
Add-Type -Path "$d\ShirtTool.cs" -ReferencedAssemblies System.Drawing
New-Item -ItemType Directory -Force "$d\out" | Out-Null

[ShirtTool]::Recolor("$d\src\brown-front.jpg", "$d\out\black-front.jpg", 'black', 28, 1.0)
[ShirtTool]::Recolor("$d\src\brown-back.jpg", "$d\out\black-back.jpg", 'black', 28, 1.0)
[ShirtTool]::Recolor("$d\src\lavender-front.jpg", "$d\out\white-front.jpg", 'white', 240, 1.0)
[ShirtTool]::Recolor("$d\src\lavender-back.jpg", "$d\out\white-back.jpg", 'white', 240, 1.0)

$colors = 'black', 'white', 'brown', 'sage', 'skyblue', 'lavender'
foreach ($c in $colors) {
  $dir = if (Test-Path "$d\out\$c-front.jpg") { "$d\out" } else { "$d\src" }
  if ($dir -eq "$d\src") { Copy-Item "$d\src\$c-front.jpg" "$d\out\$c-front.jpg"; Copy-Item "$d\src\$c-back.jpg" "$d\out\$c-back.jpg" }
  [ShirtTool]::Crop("$d\out\$c-front.jpg", "$d\out\$c-sleeve-right.jpg", 250, 550, 540, 1000, $false)
  [ShirtTool]::Crop("$d\out\$c-front.jpg", "$d\out\$c-sleeve-left.jpg", 1250, 550, 540, 1000, $false)
}

$names = @{ black = 'שחור'; white = 'לבן'; brown = 'חום'; sage = 'ירוק מרווה'; skyblue = 'תכלת'; lavender = 'סגול בהיר' }
$paths = @(); $labels = @()
foreach ($c in $colors) {
  foreach ($p in @(@('front', 'חזית'), @('back', 'גב'), @('sleeve-right', 'שרוול ימין'), @('sleeve-left', 'שרוול שמאל'))) {
    $paths += "$d\out\$c-$($p[0]).jpg"; $labels += "$($names[$c]) · $($p[1])"
  }
}
[ShirtTool]::Sheet($paths, $labels, "$d\all-shirts.jpg", 300, 4)
"done"

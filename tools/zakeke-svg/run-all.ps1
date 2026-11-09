# Runs all.html (served by serve2.ps1 on port 8767, rooted at this folder) in headless Edge and waits for it.
# -only multi | <categoryId> limits the run; without it every design is traced and out\all\review.html is written.
param([string]$only = '', [int]$wait = 40, [string]$size = '1420,1300', [string]$shot = '')
$d = $PSScriptRoot
$url = 'http://127.0.0.1:8767/all.html' + $(if ($only) { "?only=$only" } else { '' })
$check = "JSON.stringify({done: !!window.__done, error: window.__error || null, result: window.__result || null})"
$lines = & (Join-Path $d 'cdp-test.ps1') -url $url -check $check -click '1' -waitAfterClick $wait -size $size -shot $shot
$after = $lines | Where-Object { $_ -like 'AFTER: *' } | Select-Object -First 1
($after.Substring(7) | ConvertFrom-Json).result.value
$lines | Where-Object { $_ -like 'SHOT*' -or $_ -like 'EXCEPTION*' -or $_ -like 'ERROR*' -or $_ -like 'LOG*' }

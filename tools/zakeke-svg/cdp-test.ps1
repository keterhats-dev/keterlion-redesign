# Opens a page in a clean headless Edge (no login, Chrome user agent), collects console errors,
# runs a check script, optionally clicks, and reports what happened. Read-only apart from the click it is told to make.
param([string]$url, [string]$check, [string]$click = '', [int]$waitAfterClick = 12, [string]$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', [string]$size = '1400,950', [string]$mobile = '', [string]$shot = '', [string]$extra = '', [string]$preload = '')
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$prof = Join-Path $env:TEMP ("kl-cdp-" + [guid]::NewGuid())
$port = 9333 + (Get-Random -Maximum 200)
$p = Start-Process $edge -ArgumentList "--headless=new", "--disable-gpu", "--remote-debugging-port=$port", "--user-data-dir=$prof", "--user-agent=`"$ua`"", "--window-size=$size", $(if ($extra) { $extra } else { '--no-first-run' }), "about:blank" -PassThru
Start-Sleep -Seconds 3
$tabs = Invoke-RestMethod "http://127.0.0.1:$port/json"
$ws = ($tabs | Where-Object { $_.type -eq 'page' } | Select-Object -First 1).webSocketDebuggerUrl
$c = New-Object System.Net.WebSockets.ClientWebSocket
$c.Options.KeepAliveInterval = [TimeSpan]::FromSeconds(20)
$c.ConnectAsync([Uri]$ws, [Threading.CancellationToken]::None).Wait()
$script:id = 0
$script:log = New-Object System.Collections.ArrayList
function Send($method, $params) {
  $script:id++
  $msg = @{ id = $script:id; method = $method; params = $params } | ConvertTo-Json -Depth 10 -Compress
  $b = [Text.Encoding]::UTF8.GetBytes($msg)
  $c.SendAsync([ArraySegment[byte]]$b, 'Text', $true, [Threading.CancellationToken]::None).Wait()
  return $script:id
}
function Pump($seconds, $wantId = -1) {
  $deadline = (Get-Date).AddSeconds($seconds); $result = $null
  while ((Get-Date) -lt $deadline) {
    # one receive may stay pending between calls; never start a second one while it is open
    if (-not $script:pending) { $script:buf = New-Object byte[] 1048576; $script:pending = $c.ReceiveAsync([ArraySegment[byte]]$script:buf, [Threading.CancellationToken]::None) }
    $left = [int](($deadline - (Get-Date)).TotalMilliseconds); if ($left -lt 1) { return $result }
    if (-not $script:pending.Wait($left)) { return $result }
    if (-not $script:ms) { $script:ms = New-Object IO.MemoryStream }
    $script:ms.Write($script:buf, 0, $script:pending.Result.Count)
    $done = $script:pending.Result.EndOfMessage; $script:pending = $null
    if (-not $done) { continue }
    $j = [Text.Encoding]::UTF8.GetString($script:ms.ToArray()) | ConvertFrom-Json; $script:ms = $null
    if ($j.method -eq 'Runtime.exceptionThrown') { [void]$script:log.Add('EXCEPTION: ' + $j.params.exceptionDetails.exception.description) }
    elseif ($j.method -eq 'Runtime.consoleAPICalled' -and $j.params.type -in 'error', 'warning') { [void]$script:log.Add($j.params.type.ToUpper() + ': ' + (($j.params.args | ForEach-Object { if ($_.value) { $_.value } else { $_.description } }) -join ' ')) }
    elseif ($j.method -eq 'Log.entryAdded' -and $j.params.entry.level -eq 'error') { [void]$script:log.Add('LOG: ' + $j.params.entry.text + ' ' + $j.params.entry.url) }
    elseif ($j.method -eq 'Page.frameNavigated' -and -not $j.params.frame.parentId) { [void]$script:log.Add('NAVIGATED: ' + $j.params.frame.url) }
    if ($wantId -ge 0 -and $j.id -eq $wantId) { return $j }
  }
  return $result
}
[void](Send 'Page.enable' @{}); [void](Send 'Runtime.enable' @{}); [void](Send 'Log.enable' @{})
if ($mobile) { [void](Send 'Emulation.setDeviceMetricsOverride' @{ width = 390; height = 844; deviceScaleFactor = 3; mobile = $true }); [void](Send 'Emulation.setTouchEmulationEnabled' @{ enabled = $true }) }
else { $wh = $size -split ','; [void](Send 'Emulation.setDeviceMetricsOverride' @{ width = [int]$wh[0]; height = [int]$wh[1]; deviceScaleFactor = 1; mobile = $false }) }
if ($preload) { [void](Pump 5 (Send 'Page.addScriptToEvaluateOnNewDocument' @{ source = $preload })) }
[void](Send 'Page.navigate' @{ url = $url })
[void](Pump 18)
$r = Pump 10 (Send 'Runtime.evaluate' @{ expression = $check; returnByValue = $true; awaitPromise = $true })
"BEFORE: " + ($r.result | ConvertTo-Json -Depth 6 -Compress)
if ($click -like 'TAP*') {
  # real taps, like a finger, in order (steps joined by '||'): 'TAP:<css selector>' or 'TAPJS:<js that returns JSON [x,y,label]>'
  foreach ($step in ($click -split '\|\|')) {
    if ($step -like 'WAIT:*') { [void](Pump ([int]$step.Substring(5))); continue }
    if ($step -like 'TAPJS:*') { $expr = $step.Substring(6) }
    else {
      $sel = $step.Substring(4)
      [void](Pump 5 (Send 'Runtime.evaluate' @{ expression = "(() => { const e = document.querySelector('$sel'); e.scrollIntoView({block: 'center'}); return 1; })()"; returnByValue = $true }))
      Start-Sleep -Milliseconds 800
      $expr = "(() => { const e = document.querySelector('$sel'); const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const top = document.elementFromPoint(x, y); return JSON.stringify([x, y, top === e || e.contains(top) ? 'button' : (top ? top.tagName : 'none')]); })()"
    }
    $pos = Pump 10 (Send 'Runtime.evaluate' @{ expression = $expr; returnByValue = $true })
    $xy = $pos.result.result.value | ConvertFrom-Json
    "TAP AT: " + ($xy -join ', ')
    if ($mobile) {
      [void](Pump 3 (Send 'Input.dispatchTouchEvent' @{ type = 'touchStart'; touchPoints = @(@{ x = $xy[0]; y = $xy[1] }) }))
      [void](Pump 3 (Send 'Input.dispatchTouchEvent' @{ type = 'touchEnd'; touchPoints = @() }))
    } else {
      [void](Pump 3 (Send 'Input.dispatchMouseEvent' @{ type = 'mousePressed'; x = $xy[0]; y = $xy[1]; button = 'left'; clickCount = 1 }))
      [void](Pump 3 (Send 'Input.dispatchMouseEvent' @{ type = 'mouseReleased'; x = $xy[0]; y = $xy[1]; button = 'left'; clickCount = 1 }))
    }
    [void](Pump 2)
  }
  [void](Pump $waitAfterClick)
  $r3 = Pump 10 (Send 'Runtime.evaluate' @{ expression = $check; returnByValue = $true; awaitPromise = $true })
  "AFTER: " + ($r3.result | ConvertTo-Json -Depth 6 -Compress)
  $click = ''
}
if ($click) {
  $r2 = Pump 10 (Send 'Runtime.evaluate' @{ expression = $click; returnByValue = $true; awaitPromise = $true })
  "CLICK: " + ($r2.result | ConvertTo-Json -Depth 6 -Compress)
  [void](Pump $waitAfterClick)
  $r3 = Pump 10 (Send 'Runtime.evaluate' @{ expression = $check; returnByValue = $true; awaitPromise = $true })
  "AFTER: " + ($r3.result | ConvertTo-Json -Depth 6 -Compress)
}
if ($shot) {
  $s = Pump 15 (Send 'Page.captureScreenshot' @{ format = 'png' })
  if ($s.result.data) { [IO.File]::WriteAllBytes($shot, [Convert]::FromBase64String($s.result.data)); "SHOT: $shot" }
}
"--- console / navigation ---"
$script:log | Select-Object -First 40
$c.Dispose(); Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
Get-Process msedge -ErrorAction SilentlyContinue | Where-Object { $_.StartTime -ge $p.StartTime } | Stop-Process -Force -ErrorAction SilentlyContinue
Remove-Item $prof -Recurse -Force -ErrorAction SilentlyContinue

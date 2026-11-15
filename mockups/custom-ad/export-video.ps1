# Renders video.html to an MP4 (H.264, 1080x1920, 30fps) with headless Chrome + WebCodecs.
# Usage: powershell -File export-video.ps1   ->  writes custom-design-video.mp4 next to this script
$ErrorActionPreference='Stop'
$dir=$PSScriptRoot; $chrome='C:\Program Files\Google\Chrome\Application\chrome.exe'
$prof=Join-Path $env:TEMP 'kl-vid-cdp'; $port=9333
$url='file:///'+$dir.Replace([char]92,[char]47)+'/video.html?export=1'
$proc=Start-Process $chrome -PassThru -ArgumentList @('--headless=new','--disable-gpu','--allow-file-access-from-files',"--user-data-dir=$prof","--remote-debugging-port=$port",'--window-size=1080,1920',$url)
try{
  $ws=$null; for($i=0;$i -lt 40 -and -not $ws;$i++){ Start-Sleep -Milliseconds 500; try{ $ws=[string](@(Invoke-RestMethod "http://127.0.0.1:$port/json") | %{ $_ } | ?{ $_.type -eq 'page' } | select -First 1).webSocketDebuggerUrl }catch{} }
  $sock=New-Object System.Net.WebSockets.ClientWebSocket; $sock.Options.SetBuffer(64KB,64KB)
  $sock.ConnectAsync([uri]$ws,[Threading.CancellationToken]::None).Wait()
  $script:id=0
  function Eval($expr){
    $script:id++; $msg=@{id=$script:id;method='Runtime.evaluate';params=@{expression=$expr;awaitPromise=$true;returnByValue=$true}} | ConvertTo-Json -Compress
    $b=[Text.Encoding]::UTF8.GetBytes($msg); $sock.SendAsync([ArraySegment[byte]]$b,'Text',$true,[Threading.CancellationToken]::None).Wait()
    while($true){
      $ms=New-Object IO.MemoryStream; $buf=New-Object byte[] (1MB)
      do{ $r=$sock.ReceiveAsync([ArraySegment[byte]]$buf,[Threading.CancellationToken]::None).Result; $ms.Write($buf,0,$r.Count) }while(-not $r.EndOfMessage)
      $txt=[Text.Encoding]::UTF8.GetString($ms.ToArray())
      if($txt -match ('^\{"id":'+$script:id+',')){ return $txt }
    }
  }
  for($i=0;$i -lt 60;$i++){ if((Eval 'window.__ready===true') -match '"value":true'){break}; Start-Sleep -Milliseconds 500 }
  Write-Host 'encoding...'
  Write-Host (Eval 'exportMp4().then(n=>n+" bytes, "+window.__codec+(window.__err?" ERR "+window.__err:""))')
  $res=Eval 'window.__mp4'
  $b64=[regex]::Match($res,'"value":"([^"]+)"').Groups[1].Value
  [IO.File]::WriteAllBytes((Join-Path $dir 'custom-design-video.mp4'),[Convert]::FromBase64String($b64))
  Write-Host 'saved custom-design-video.mp4'
} finally { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }

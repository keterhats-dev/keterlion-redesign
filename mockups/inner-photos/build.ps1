# Fetches the 5 inner pages from staging, adds the proposed photo (inject.html), and takes desktop + phone screenshots.
$d = Split-Path -Parent $MyInvocation.MyCommand.Path
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$prof = Join-Path $d "chrome-prof"
$inject = [IO.File]::ReadAllText((Join-Path $d "inject.html"), [Text.Encoding]::UTF8)
$pages = [ordered]@{
  'b2b'      = 'https://keterlion.com/staging/b2b-2026/'
  'story'    = 'https://keterlion.com/staging/our-story/'
  'store'    = 'https://keterlion.com/staging/%d7%a1%d7%a0%d7%99%d7%a4%d7%99%d7%9d/'
  'soldiers' = 'https://keterlion.com/staging/donate-hats-to-israeli-solders/'
  'gift'     = 'https://keterlion.com/staging/gift-card/'
}
foreach ($k in $pages.Keys) {
  $raw = Join-Path $d "raw-$k.html"
  & curl.exe -s -L -o $raw ($pages[$k] + '?nc=mock1')
  $html = [IO.File]::ReadAllText($raw, [Text.Encoding]::UTF8)
  $html = $html -replace '(?i)<head([^>]*)>', ('<head$1><base href="' + $pages[$k] + '">')
  $i = $html.LastIndexOf('</body>')
  $html = $html.Substring(0, $i) + $inject + $html.Substring($i)
  $mock = Join-Path $d "mock-$k.html"
  [IO.File]::WriteAllText($mock, $html, (New-Object Text.UTF8Encoding $false))
  $phone = Join-Path $d "phone-$k.html"
  $src = ([Uri]$mock).AbsoluteUri
  [IO.File]::WriteAllText($phone, "<!doctype html><html><body style='margin:0;background:#fff'><iframe src='$src' style='border:0;width:390px;height:2400px;display:block'></iframe></body></html>", (New-Object Text.UTF8Encoding $false))
  Start-Process $chrome -ArgumentList @('--headless=new','--disable-gpu','--hide-scrollbars','--no-first-run','--allow-file-access-from-files',"--user-data-dir=$prof",'--window-size=1440,1700','--virtual-time-budget=15000',"--screenshot=$(Join-Path $d "desk-$k.png")",([Uri]$mock).AbsoluteUri) -Wait
  Start-Process $chrome -ArgumentList @('--headless=new','--disable-gpu','--hide-scrollbars','--no-first-run','--allow-file-access-from-files',"--user-data-dir=$prof",'--window-size=500,2400','--virtual-time-budget=15000',"--screenshot=$(Join-Path $d "ph-$k.png")",([Uri]$phone).AbsoluteUri) -Wait
  "done $k"
}

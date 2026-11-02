# Home page mockup: fetches the staging home page, makes a "before" copy (site font only) and an "after" copy (inject.html),
# takes full-length screenshots on desktop (1440) and phone (390, inside an iframe), trims the white space under the page.
$d = Split-Path -Parent $MyInvocation.MyCommand.Path
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$prof = Join-Path $d "chrome-prof"
$url = 'https://keterlion.com/staging/'
$utf8 = New-Object Text.UTF8Encoding $false
$inject = [IO.File]::ReadAllText((Join-Path $d "inject.html"), [Text.Encoding]::UTF8)
$font = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=block">'
$raw = Join-Path $d "raw-home.html"
& curl.exe -s -L -o $raw ($url + '?nc=mockhome2')
$html = [IO.File]::ReadAllText($raw, [Text.Encoding]::UTF8)
$html = $html.Replace('loading="lazy"', 'loading="eager"')
$html = $html -replace '(?i)<head([^>]*)>', ('<head$1><base href="' + $url + '">')
$i = $html.LastIndexOf('</body>')
[IO.File]::WriteAllText((Join-Path $d "before.html"), $html.Substring(0, $i) + $font + $html.Substring($i), $utf8)
[IO.File]::WriteAllText((Join-Path $d "after.html"), $html.Substring(0, $i) + $inject + $html.Substring($i), $utf8)
foreach ($v in 'before','after') {
  $page = ([Uri](Join-Path $d "$v.html")).AbsoluteUri
  $phone = Join-Path $d "phone-$v.html"
  [IO.File]::WriteAllText($phone, "<!doctype html><html><body style='margin:0;background:#fff'><iframe src='$page' style='border:0;width:390px;height:7900px;display:block'></iframe></body></html>", $utf8)
  Start-Process $chrome -ArgumentList @('--headless=new','--disable-gpu','--hide-scrollbars','--no-first-run','--allow-file-access-from-files',"--user-data-dir=$prof",'--window-size=1440,7200','--virtual-time-budget=20000',"--screenshot=$(Join-Path $d "desk-$v.png")",$page) -Wait
  Start-Process $chrome -ArgumentList @('--headless=new','--disable-gpu','--hide-scrollbars','--no-first-run','--allow-file-access-from-files',"--user-data-dir=$prof",'--window-size=500,7900','--virtual-time-budget=20000',"--screenshot=$(Join-Path $d "ph-$v.png")",([Uri]$phone).AbsoluteUri) -Wait
  "done $v"
}

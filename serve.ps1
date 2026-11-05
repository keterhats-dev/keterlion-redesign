$root = $PSScriptRoot
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add('http://localhost:5502/')
$l.Start()
Write-Host 'Serving on http://localhost:5502/'
while ($l.IsListening) {
  $ctx = $l.GetContext()
  # 5.11.2026: the live site (only) may read files from here, so prepared photos can be uploaded to it from the browser
  if ($ctx.Request.Headers['Origin'] -eq 'https://keterlion.com') {
    $ctx.Response.AddHeader('Access-Control-Allow-Origin', 'https://keterlion.com')
    $ctx.Response.AddHeader('Access-Control-Allow-Private-Network', 'true')
    if ($ctx.Request.HttpMethod -eq 'OPTIONS') { $ctx.Response.AddHeader('Access-Control-Allow-Methods', 'GET'); $ctx.Response.StatusCode = 204; $ctx.Response.Close(); continue }
  }
  $p = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
  if ($p -eq '') { $p = 'keterlion-home-mockup.html' }
  $f = Join-Path $root $p
  if (Test-Path $f -PathType Leaf) {
    $b = [IO.File]::ReadAllBytes($f)
    if ($f -like '*.html') { $ctx.Response.ContentType = 'text/html; charset=utf-8' }
    $ctx.Response.ContentLength64 = $b.Length
    $ctx.Response.OutputStream.Write($b, 0, $b.Length)
  } else { $ctx.Response.StatusCode = 404 }
  $ctx.Response.Close()
}

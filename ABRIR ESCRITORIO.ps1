# Atalho da área de trabalho: se o escritório não estiver no ar, liga o
# supervisor (solto, sem janela, para o Ctrl+C de nenhum terminal derrubar)
# e abre o escritório no navegador.
$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = 'http://localhost:4321'

function NoAr {
  try { (Invoke-WebRequest "$url/" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch { $false }
}

if (-not (NoAr)) {
  $cmd = 'cmd /c "' + (Join-Path $pasta 'INICIAR ESCRITORIO.cmd') + '"'
  ([wmiclass]'Win32_Process').Create($cmd, $pasta) | Out-Null
  for ($i = 0; $i -lt 40 -and -not (NoAr); $i++) { Start-Sleep -Milliseconds 750 }
}

Start-Process $url

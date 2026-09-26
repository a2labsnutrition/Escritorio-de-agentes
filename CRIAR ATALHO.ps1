# Cria "Escritório de Agentes" na área de trabalho. Dois cliques no atalho:
# se o escritório estiver desligado ele liga (sem janela) e abre no navegador.
# Rode uma vez:  botão direito neste arquivo > Executar com o PowerShell
$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
$desk  = [Environment]::GetFolderPath('Desktop')
$lnk = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $desk 'Escritório de Agentes.lnk'))
$lnk.TargetPath = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"
$lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$pasta\ABRIR ESCRITORIO.ps1`""
$lnk.WorkingDirectory = $pasta
$lnk.WindowStyle = 7
$lnk.IconLocation = "$env:WINDIR\System32\imageres.dll,109"
$lnk.Description = 'Abre o escritório de agentes (liga se estiver desligado)'
$lnk.Save()
Write-Host "Atalho criado na área de trabalho."

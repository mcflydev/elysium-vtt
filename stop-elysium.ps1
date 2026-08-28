$ErrorActionPreference = "SilentlyContinue"
$Root = $PSScriptRoot
$PidFile = Join-Path $Root "data\elysium.pid"
$PortFile = Join-Path $Root "data\elysium.port"

function Show-ElysiumMessage([string]$Message, [string]$Title = "Elysium") {
    try {
        Add-Type -AssemblyName PresentationFramework -ErrorAction Stop
        [System.Windows.MessageBox]::Show($Message, $Title) | Out-Null
    }
    catch {}
}

$Stopped = $false
if (Test-Path $PidFile) {
    $ServerPid = [int](Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ($ServerPid -gt 0) {
        $Process = Get-Process -Id $ServerPid -ErrorAction SilentlyContinue
        if ($null -ne $Process) {
            Stop-Process -Id $ServerPid -Force -ErrorAction SilentlyContinue
            $Stopped = $true
        }
    }
}

Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
Remove-Item $PortFile -Force -ErrorAction SilentlyContinue

if ($Stopped) {
    Show-ElysiumMessage "Servidor encerrado com sucesso." "Elysium"
} else {
    Show-ElysiumMessage "Nenhum servidor iniciado pelo Elysium.exe foi encontrado." "Elysium"
}

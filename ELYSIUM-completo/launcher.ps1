$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$RuntimeDir = Join-Path $Root "runtime"
$NodeExe = Join-Path $RuntimeDir "node.exe"
$DataDir = Join-Path $Root "data"
$PidFile = Join-Path $DataDir "elysium.pid"
$PortFile = Join-Path $DataDir "elysium.port"
$LogFile = Join-Path $DataDir "launcher.log"
$NodeVersion = "24.19.0"
$NodeZipUrl = "https://nodejs.org/download/release/v24.19.0/node-v24.19.0-win-x64.zip"

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

function Write-LauncherLog([string]$Message) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogFile -Value "[$timestamp] $Message"
}

function Show-ElysiumMessage([string]$Message, [string]$Title = "Elysium") {
    try {
        Add-Type -AssemblyName PresentationFramework -ErrorAction Stop
        [System.Windows.MessageBox]::Show($Message, $Title) | Out-Null
    }
    catch {
        # Em ambientes sem interface gráfica, apenas registra no log.
        Write-LauncherLog "$Title - $Message"
    }
}

function Test-ElysiumServer([int]$Port) {
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/system/network" -TimeoutSec 1
        return $response.app -eq "elysium"
    }
    catch {
        return $false
    }
}

function Test-PortBusy([int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        $connected = $async.AsyncWaitHandle.WaitOne(180)
        if ($connected) {
            $client.EndConnect($async)
            return $true
        }
        return $false
    }
    catch {
        return $false
    }
    finally {
        $client.Close()
    }
}

try {
    Write-LauncherLog "Inicializando Elysium."

    # Se já estiver rodando, apenas abre o navegador.
    foreach ($existingPort in 3000..3010) {
        if (Test-ElysiumServer $existingPort) {
            Write-LauncherLog "Servidor já ativo na porta $existingPort."
            Start-Process "http://127.0.0.1:$existingPort"
            exit 0
        }
    }

    # Primeira execução: baixa apenas o node.exe oficial e guarda localmente.
    if (-not (Test-Path $NodeExe)) {
        Show-ElysiumMessage "Esta é a primeira execução do Elysium.`n`nO aplicativo vai preparar automaticamente o runtime local do servidor usando o Node.js LTS oficial. Isso acontece somente uma vez e requer conexão com a internet." "Preparando o Elysium"

        $TempRoot = Join-Path $env:TEMP "elysium-runtime-$([guid]::NewGuid().ToString('N'))"
        $ZipPath = Join-Path $TempRoot "node.zip"
        New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

        Write-LauncherLog "Baixando Node.js $NodeVersion."
        Invoke-WebRequest -Uri $NodeZipUrl -OutFile $ZipPath -UseBasicParsing

        Write-LauncherLog "Extraindo runtime."
        Expand-Archive -Path $ZipPath -DestinationPath $TempRoot -Force

        $DownloadedNode = Join-Path $TempRoot "node-v$NodeVersion-win-x64\node.exe"
        if (-not (Test-Path $DownloadedNode)) {
            throw "O runtime foi baixado, mas node.exe não foi encontrado."
        }

        Copy-Item -Path $DownloadedNode -Destination $NodeExe -Force
        Remove-Item -Path $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
        Write-LauncherLog "Runtime instalado em runtime\\node.exe."
    }

    # Escolhe a primeira porta disponível entre 3000 e 3010.
    $Port = $null
    foreach ($candidate in 3000..3010) {
        if (-not (Test-PortBusy $candidate)) {
            $Port = $candidate
            break
        }
    }

    if ($null -eq $Port) {
        throw "Não há nenhuma porta livre entre 3000 e 3010."
    }

    $PreviousPort = $env:PORT
    $PreviousHost = $env:HOST
    $env:PORT = "$Port"
    $env:HOST = "0.0.0.0"

    Write-LauncherLog "Iniciando servidor na porta $Port."
    $Process = Start-Process -FilePath $NodeExe `
        -ArgumentList "server/server.js" `
        -WorkingDirectory $Root `
        -WindowStyle Hidden `
        -PassThru

    if ($null -eq $PreviousPort) { Remove-Item Env:PORT -ErrorAction SilentlyContinue } else { $env:PORT = $PreviousPort }
    if ($null -eq $PreviousHost) { Remove-Item Env:HOST -ErrorAction SilentlyContinue } else { $env:HOST = $PreviousHost }

    Set-Content -Path $PidFile -Value $Process.Id
    Set-Content -Path $PortFile -Value $Port

    $Ready = $false
    foreach ($attempt in 1..40) {
        Start-Sleep -Milliseconds 250
        if (Test-ElysiumServer $Port) {
            $Ready = $true
            break
        }
        if ($Process.HasExited) {
            break
        }
    }

    if (-not $Ready) {
        if (-not $Process.HasExited) {
            Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
        }
        throw "O servidor não respondeu na porta $Port. Consulte data\\launcher.log."
    }

    Write-LauncherLog "Servidor pronto. Abrindo navegador."
    Start-Process "http://127.0.0.1:$Port"
}
catch {
    Write-LauncherLog "ERRO: $($_.Exception.Message)"
    Show-ElysiumMessage "Não foi possível iniciar o Elysium.`n`n$($_.Exception.Message)`n`nConsulte data\\launcher.log para detalhes." "Erro ao iniciar"
    exit 1
}

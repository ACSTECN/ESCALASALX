# Instala a Ponte do MiPonto neste PC.
# - copia o executavel para %LOCALAPPDATA%\MiPontoBridge
# - cria/valida o .env com o usuario e senha do MiPonto
# - cria atalho na Area de Trabalho e inicia junto com o Windows

$ErrorActionPreference = "Stop"

$origem = $PSScriptRoot
$exeOrigem = Join-Path $origem "miponto-bridge.exe"
$destino = Join-Path $env:LOCALAPPDATA "MiPontoBridge"
$exeDestino = Join-Path $destino "miponto-bridge.exe"
$envDestino = Join-Path $destino ".env"
$envPacote = Join-Path $origem ".env"

Write-Host "== Instalador da Ponte do MiPonto ==" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $exeOrigem)) {
    Write-Host "ERRO: o arquivo miponto-bridge.exe precisa estar na mesma pasta deste instalador." -ForegroundColor Red
    exit 1
}

# Encerra uma instancia em execucao para conseguir atualizar o executavel.
Get-Process miponto-bridge -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 800

if (-not (Test-Path $destino)) {
    New-Item -ItemType Directory -Path $destino -Force | Out-Null
}

# O .env existente e sempre preservado; so cria quando nao houver.
if (Test-Path $envDestino) {
    Write-Host "Configuracao existente mantida." -ForegroundColor Yellow
} elseif (Test-Path $envPacote) {
    Copy-Item $envPacote $envDestino -Force
    Write-Host "Configuracao copiada do pacote." -ForegroundColor Yellow
} else {
    $usuario = Read-Host "Usuario do MiPonto"
    $senha = Read-Host "Senha do MiPonto"
    if ([string]::IsNullOrWhiteSpace($usuario) -or [string]::IsNullOrWhiteSpace($senha)) {
        Write-Host "ERRO: usuario e senha sao obrigatorios." -ForegroundColor Red
        exit 1
    }
    $conteudo = "MIPONTO_URL=https://ponto.meponto.com/login`r`nMIPONTO_USER=$usuario`r`nMIPONTO_PASSWORD=$senha`r`nEDGE_DRIVER_PATH=`r`nMIPONTO_HEADLESS=false`r`nMIPONTO_TIMEOUT=30`r`nMIPONTO_CONFIRM_SUBMIT=true`r`n"
    [System.IO.File]::WriteAllText($envDestino, $conteudo, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Configuracao criada." -ForegroundColor Green
}

Copy-Item $exeOrigem $exeDestino -Force

# Atalho na Area de Trabalho + inicio automatico com o Windows.
$atalho = Join-Path ([Environment]::GetFolderPath("Desktop")) "Ponte MiPonto.lnk"
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($atalho)
$link.TargetPath = $exeDestino
$link.WorkingDirectory = $destino
$link.IconLocation = $exeDestino
$link.Description = "Ponte local do MiPonto"
$link.Save()
Copy-Item $atalho (Join-Path ([Environment]::GetFolderPath("Startup")) "Ponte MiPonto.lnk") -Force

Start-Process -FilePath $exeDestino -WorkingDirectory $destino

Write-Host ""
Write-Host "Instalado em: $destino" -ForegroundColor Green
Write-Host "Atalho criado na Area de Trabalho e a ponte passa a iniciar com o Windows." -ForegroundColor Green
Write-Host "Deixe a janela da ponte aberta enquanto estiver despachando." -ForegroundColor Green

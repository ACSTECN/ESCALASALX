# Instala a Ponte do MiPonto (versao Python) neste PC.
# - garante um Python 3.9+ (baixa o instalador oficial do python.org se faltar)
# - cria um ambiente virtual e instala as dependencias
# - copia o codigo da ponte para %LOCALAPPDATA%\MiPontoBridge
# - cria/valida o .env com o usuario e senha do MiPonto
# - cria atalho na Area de Trabalho e passa a iniciar junto com o Windows
# Rodar de novo atualiza o codigo, sem apagar o .env existente.

$ErrorActionPreference = "Stop"

$origem = $PSScriptRoot
$destino = Join-Path $env:LOCALAPPDATA "MiPontoBridge"
$appDestino = Join-Path $destino "app"
$venvDir = Join-Path $destino ".venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"
$startScript = Join-Path $destino "start-bridge.py"
$envDestino = Join-Path $destino ".env"
$envPacote = Join-Path $origem ".env"
$requirements = Join-Path $origem "requirements.txt"

Write-Host "== Instalador da Ponte do MiPonto ==" -ForegroundColor Cyan
Write-Host ""

foreach ($obrigatorio in @("app\server.py", "start-bridge.py", "requirements.txt")) {
    if (-not (Test-Path (Join-Path $origem $obrigatorio))) {
        Write-Host "ERRO: '$obrigatorio' nao encontrado. Descompacte o pacote completo." -ForegroundColor Red
        exit 1
    }
}

function Test-Python {
    param([hashtable]$Candidato)

    $argumentos = $Candidato.Args + @("-c", "import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)")
    try {
        & $Candidato.Exe @argumentos 2>$null | Out-Null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

function Find-Python {
    # Procura um Python 3.9+ ja instalado neste PC.
    $candidatos = New-Object System.Collections.ArrayList

    $py = Get-Command "py" -ErrorAction SilentlyContinue
    if ($py) { [void]$candidatos.Add(@{ Exe = $py.Source; Args = @("-3") }) }

    foreach ($nome in @("python", "python3")) {
        $encontrado = Get-Command $nome -ErrorAction SilentlyContinue
        if ($encontrado -and $encontrado.Source -notlike "*\WindowsApps\*") {
            [void]$candidatos.Add(@{ Exe = $encontrado.Source; Args = @() })
        }
    }

    $padroes = @(
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Python3*\python.exe"),
        "C:\Program Files\Python3*\python.exe",
        "C:\Python3*\python.exe"
    )
    foreach ($padrao in $padroes) {
        Get-Item $padrao -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending |
            ForEach-Object { [void]$candidatos.Add(@{ Exe = $_.FullName; Args = @() }) }
    }

    foreach ($candidato in $candidatos) {
        if (Test-Python -Candidato $candidato) { return $candidato }
    }
    return $null
}

$python = Find-Python

if (-not $python) {
    Write-Host "Python nao encontrado. Baixando o instalador oficial do python.org..." -ForegroundColor Yellow

    $versao = "3.12.8"
    $instalador = Join-Path $env:TEMP "python-$versao-amd64.exe"

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri "https://www.python.org/ftp/python/$versao/python-$versao-amd64.exe" -OutFile $instalador -UseBasicParsing

    Write-Host "Instalando o Python (pode levar alguns minutos)..." -ForegroundColor Yellow
    Start-Process -FilePath $instalador -ArgumentList @(
        "/quiet", "InstallAllUsers=0", "PrependPath=1", "Include_launcher=1", "Include_pip=1"
    ) -Wait

    # O PATH deste processo continua desatualizado depois da instalacao; recarrega do registro.
    $env:Path = ([Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User"))

    $python = Find-Python
    if (-not $python) {
        Write-Host "ERRO: nao consegui instalar o Python automaticamente." -ForegroundColor Red
        Write-Host "Instale manualmente em https://www.python.org/downloads/ e rode o INSTALAR.cmd de novo." -ForegroundColor Yellow
        exit 1
    }
}

# Encerra uma ponte em execucao para conseguir atualizar o codigo.
Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($destino, [System.StringComparison]::OrdinalIgnoreCase) } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 500

New-Item -ItemType Directory -Path $appDestino -Force | Out-Null
Copy-Item (Join-Path $origem "app\*") $appDestino -Recurse -Force
Copy-Item (Join-Path $origem "start-bridge.py") $startScript -Force

if (-not (Test-Path $venvPython)) {
    Write-Host "Criando o ambiente virtual..."
    $argumentos = $python.Args + @("-m", "venv", $venvDir)
    & $python.Exe @argumentos
    if (-not (Test-Path $venvPython)) {
        Write-Host "ERRO: falha ao criar o ambiente virtual." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Instalando as dependencias (pode demorar um pouco)..." -ForegroundColor Yellow
& $venvPython -m pip install --upgrade pip
$argumentos = @("-m", "pip", "install", "-r", $requirements)
& $venvPython @argumentos
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: falha ao instalar as dependencias. Verifique a internet e tente de novo." -ForegroundColor Red
    exit 1
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

# Atalho na Area de Trabalho + inicio automatico com o Windows.
$atalho = Join-Path ([Environment]::GetFolderPath("Desktop")) "Ponte MiPonto.lnk"
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($atalho)
$link.TargetPath = $venvPython
$link.Arguments = "`"$startScript`""
$link.WorkingDirectory = $destino
$link.IconLocation = "$venvPython,0"
$link.Description = "Ponte local do MiPonto"
$link.Save()
Copy-Item $atalho (Join-Path ([Environment]::GetFolderPath("Startup")) "Ponte MiPonto.lnk") -Force

Start-Process -FilePath $venvPython -ArgumentList "`"$startScript`"" -WorkingDirectory $destino

Write-Host ""
Write-Host "Instalado em: $destino" -ForegroundColor Green
Write-Host "Atalho criado na Area de Trabalho e a ponte passa a iniciar com o Windows." -ForegroundColor Green
Write-Host "Deixe a janela da ponte aberta enquanto estiver despachando." -ForegroundColor Green

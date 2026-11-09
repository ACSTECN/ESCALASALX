# Monta o pacote da Ponte do MiPonto (versao Python), pronto para copiar para outros PCs.
# Resultado: automation\miponto\dist\MiPontoBridge\
# No PC de destino: dar 2 cliques em INSTALAR.cmd
# Uso: clique com o botao direito > "Executar com PowerShell".

$ErrorActionPreference = "Stop"
$raiz = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $raiz

$pacote = "automation\miponto\dist\MiPontoBridge"
$app = Join-Path $pacote "app"

Remove-Item "automation\miponto\dist" -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $app -Force | Out-Null

foreach ($arquivo in @("__init__.py", "server.py", "miponto_bot.py", "models.py")) {
    Copy-Item (Join-Path "automation\miponto" $arquivo) $app -Force
}

Copy-Item automation\miponto\instalador\INSTALAR.cmd $pacote -Force
Copy-Item automation\miponto\instalador\instalar.ps1 $pacote -Force
Copy-Item automation\miponto\instalador\start-bridge.py $pacote -Force
Copy-Item automation\miponto\requirements.txt $pacote -Force
Copy-Item automation\miponto\.env.example (Join-Path $pacote ".env.example") -Force

Write-Host ""
Write-Host "Pacote pronto: $pacote" -ForegroundColor Green
Write-Host "No PC de destino: dar 2 cliques em INSTALAR.cmd" -ForegroundColor Green
Write-Host "Dica: coloque um .env preenchido no pacote para ninguem precisar digitar a senha." -ForegroundColor Yellow

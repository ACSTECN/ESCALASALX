# Gera o pacote portatil da ponte do MiPonto, pronto para copiar para outros PCs.
# Resultado: automation\miponto\dist\MiPontoBridge\
# Basta zipar essa pasta e enviar; no PC de destino e so dar 2 cliques em INSTALAR.cmd
# Uso: clique com o botao direito > "Executar com PowerShell".

$ErrorActionPreference = "Stop"
$raiz = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $raiz

$pacote = "automation\miponto\dist\MiPontoBridge"

Remove-Item "automation\miponto\dist" -Recurse -Force -ErrorAction SilentlyContinue

python -m pip install --upgrade pyinstaller

python -m PyInstaller --noconfirm --clean --onefile --name miponto-bridge `
  --paths . `
  --collect-all uvicorn `
  --collect-all selenium `
  --collect-all pydantic `
  --collect-all pydantic_settings `
  --hidden-import uvicorn.logging `
  --hidden-import uvicorn.loops.auto `
  --hidden-import uvicorn.protocols.http.auto `
  --hidden-import uvicorn.protocols.websockets.auto `
  --hidden-import uvicorn.lifespan.on `
  --distpath $pacote `
  --workpath automation\miponto\build `
  --specpath automation\miponto `
  automation\miponto\launcher.py

Copy-Item automation\miponto\instalador\INSTALAR.cmd $pacote -Force
Copy-Item automation\miponto\instalador\instalar.ps1 $pacote -Force
Copy-Item automation\miponto\.env.example (Join-Path $pacote ".env.example") -Force

Remove-Item automation\miponto\build -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Pacote pronto: $pacote"
Write-Host "No PC de destino: dar 2 cliques em INSTALAR.cmd"

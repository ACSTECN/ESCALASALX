# Gera o executavel portatil da ponte do MiPonto.
# Resultado: automation\miponto\dist\miponto-bridge.exe
# Uso: clique com o botao direito > "Executar com PowerShell".

$ErrorActionPreference = "Stop"
$raiz = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $raiz

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
  --distpath automation\miponto\dist `
  --workpath automation\miponto\build `
  --specpath automation\miponto `
  automation\miponto\launcher.py

Write-Host ""
Write-Host "Pronto: automation\miponto\dist\miponto-bridge.exe"

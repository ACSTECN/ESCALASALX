"""Inicia a ponte local do MiPonto na versao Python.

E executado pelo atalho "Ponte MiPonto" e pelo inicio automatico do Windows:

    %LOCALAPPDATA%\\MiPontoBridge\\.venv\\Scripts\\python.exe start-bridge.py
"""
from __future__ import annotations

import uvicorn

from app.server import app

HOST = "127.0.0.1"
PORT = 8765


def main() -> None:
    print(f"Ponte do MiPonto ativa em http://{HOST}:{PORT} (feche esta janela para encerrar)")
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")


if __name__ == "__main__":
    main()

"""Ponto de entrada do executavel da ponte do MiPonto.

Uso em desenvolvimento:
    python -m automation.miponto.launcher
"""
from __future__ import annotations

import sys
from pathlib import Path

if not getattr(sys, "frozen", False):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import uvicorn

from automation.miponto.server import app

HOST = "127.0.0.1"
PORT = 8765


def main() -> None:
    print(f"Ponte do MiPonto ativa em http://{HOST}:{PORT} (feche esta janela para encerrar)")
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")


if __name__ == "__main__":
    main()

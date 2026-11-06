from __future__ import annotations

import threading
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings, SettingsConfigDict

from .miponto_bot import MiPontoBot, MiPontoSettings
from .models import DispatchPayload, DispatchResponse


BASE_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    miponto_url: str = "https://ponto.meponto.com/login"
    miponto_user: str
    miponto_password: str
    edge_driver_path: str
    miponto_headless: bool = False
    miponto_timeout: int = 30
    miponto_confirm_submit: bool = False


settings = Settings()

app = FastAPI(title="MiPonto Bridge", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


_bot: MiPontoBot | None = None
_lock = threading.Lock()


def _bot_settings() -> MiPontoSettings:
    return MiPontoSettings(
        url=settings.miponto_url,
        user=settings.miponto_user,
        password=settings.miponto_password,
        driver_path=settings.edge_driver_path,
        headless=settings.miponto_headless,
        timeout=settings.miponto_timeout,
        confirm_submit=settings.miponto_confirm_submit,
    )


def _get_bot() -> MiPontoBot:
    """Reaproveita a sessao do navegador entre despachos; recria se cair."""
    global _bot
    if _bot is None:
        _bot = MiPontoBot(_bot_settings()).open()
        return _bot
    try:
        _ = _bot.browser.current_url
        return _bot
    except Exception:
        _bot.close()
        _bot = MiPontoBot(_bot_settings()).open()
        return _bot


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/miponto/dispatch", response_model=DispatchResponse)
def dispatch(payload: DispatchPayload) -> DispatchResponse:
    if not payload.motoristas:
        raise HTTPException(status_code=400, detail="Nao ha motoristas ativos para enviar.")

    with _lock:
        try:
            return _get_bot().run_dispatch(payload)
        except Exception as exc:
            # Sessao pode ter ficado invalida; derruba para recriar no proximo envio.
            global _bot
            if _bot is not None:
                _bot.close()
                _bot = None
            raise HTTPException(status_code=500, detail=str(exc)) from exc

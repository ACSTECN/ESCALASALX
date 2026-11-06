# MiPonto Bridge

Servico local para o frontend chamar um Selenium do Edge e registrar a escala do turno no MiPonto.

## O que ele faz

- recebe uma coleta/turno do calendario
- abre o MiPonto
- faz login
- entra em Central de Despacho
- procura o card do dia + horario
- pesquisa cada motorista por CPF ou nome
- marca a pessoa na lista lateral
- opcionalmente clica no botao final de envio

## Arquivos

- `server.py`: API local em FastAPI
- `miponto_bot.py`: automacao Selenium
- `models.py`: contrato de entrada e saida
- `.env.example`: configuracao local

## Preparar

1. Criar e ativar um ambiente virtual Python.
2. Instalar dependencias:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r automation\miponto\requirements.txt
```

3. Copiar `automation\miponto\.env.example` para `automation\miponto\.env`
4. Preencher usuario, senha e caminho do `msedgedriver.exe`

## Rodar o servico

```powershell
.venv\Scripts\Activate.ps1
uvicorn automation.miponto.server:app --host 127.0.0.1 --port 8765 --reload
```

## Integracao com o frontend

O frontend usa `VITE_MIPONTO_BRIDGE_URL`, com padrao:

```text
http://127.0.0.1:8765
```

No drawer de cada turno existe o botao **Enviar escala ao MiPonto**.

## Importante

- `MIPONTO_CONFIRM_SUBMIT=false`: seleciona as pessoas, mas nao clica no envio final
- `MIPONTO_CONFIRM_SUBMIT=true`: tenta clicar no botao final do MiPonto

Comece com `false` ate fechar os seletores reais da tela.

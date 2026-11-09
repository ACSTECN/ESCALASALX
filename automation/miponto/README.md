# MiPonto Bridge

Servico local para o frontend chamar um Selenium do Edge e registrar a escala do turno no MiPonto.

## O que ele faz

- recebe uma coleta/turno do calendario
- abre o MiPonto e faz login
- entra em Central de Despacho
- procura o card do dia + horario (inicio e fim) + estacao
- pesquisa cada motorista por CPF ou nome
- marca a pessoa na lista lateral
- clica no botao final de envio quando `MIPONTO_CONFIRM_SUBMIT=true`

## Arquivos

- `launcher.py`: ponto de entrada do executavel
- `server.py`: API local em FastAPI
- `miponto_bot.py`: automacao Selenium
- `models.py`: contrato de entrada e saida
- `build_exe.ps1`: gera o `miponto-bridge.exe`
- `.env.example`: configuracao local

## Configuracao (.env)

Copie `automation\miponto\.env.example` para `.env` e preencha usuario e senha:

```text
MIPONTO_URL=https://ponto.meponto.com/login
MIPONTO_USER=
MIPONTO_PASSWORD=
EDGE_DRIVER_PATH=
MIPONTO_HEADLESS=false
MIPONTO_TIMEOUT=30
MIPONTO_CONFIRM_SUBMIT=true
```

- `EDGE_DRIVER_PATH`: deixe **vazio** para o Selenium Manager resolver e baixar o driver do Edge automaticamente (precisa de internet no primeiro uso). Se informar um caminho, ele e usado.
- `MIPONTO_CONFIRM_SUBMIT=true`: seleciona as pessoas **e** clica no envio final. Use `false` para testar sem efetivar.

## Opcao A - executavel (recomendado para varios PCs)

Cada PC que for disparar o envio precisa rodar a ponte. Com o executavel nao e preciso instalar Python.

1. Gerar o executavel (apenas uma vez):

```powershell
powershell -ExecutionPolicy Bypass -File automation\miponto\build_exe.ps1
```

O arquivo sai em `automation\miponto\dist\miponto-bridge.exe`.

2. Em cada PC, coloque **na mesma pasta**:

```text
miponto-bridge.exe
.env
```

3. De duplo clique no `miponto-bridge.exe`. Deve aparecer:

```text
Ponte do MiPonto ativa em http://127.0.0.1:8765
```

4. Mantenha essa janela aberta enquanto estiver usando o sistema.

Requisitos do PC: Microsoft Edge instalado e internet (o driver e baixado sozinho no primeiro uso).

## Opcao B - rodar com Python

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r automation\miponto\requirements.txt
uvicorn automation.miponto.server:app --host 127.0.0.1 --port 8765 --reload
```

## Integracao com o frontend

O frontend usa `VITE_MIPONTO_BRIDGE_URL`, com padrao:

```text
http://127.0.0.1:8765
```

Como `127.0.0.1` e o proprio PC, cada maquina que for enviar precisa da sua ponte rodando. No drawer de cada turno existe o botao **Enviar escala ao MiPonto**.

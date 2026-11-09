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

- `server.py`: API local em FastAPI
- `miponto_bot.py`: automacao Selenium
- `models.py`: contrato de entrada e saida
- `build_package.ps1`: monta o pacote de instalacao
- `instalador/INSTALAR.cmd` e `instalador/instalar.ps1`: instalam a ponte no PC de destino
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

## Instalacao nos PCs que vao enviar

Cada PC que for disparar o envio precisa da ponte rodando. Nao precisa de administrador e nao precisa instalar Python na mao: o instalador resolve.

1. Gerar o pacote (apenas uma vez):

```powershell
powershell -ExecutionPolicy Bypass -File automation\miponto\build_package.ps1
```

O pacote sai em `automation\miponto\dist\MiPontoBridge\`:

```text
INSTALAR.cmd
instalar.ps1
start-bridge.py
requirements.txt
.env.example
app\  (server.py, miponto_bot.py, models.py)
```

2. No PC de destino: copiar (ou zipar e enviar) a pasta e dar **2 cliques em `INSTALAR.cmd`**.

O instalador faz tudo:

- garante um Python 3.9+ (baixa o instalador oficial do python.org se faltar)
- cria o ambiente virtual e instala as dependencias
- copia o codigo para `%LOCALAPPDATA%\MiPontoBridge`
- cria o `.env` (usa o do pacote, se existir; senao pergunta usuario e senha do MiPonto)
- cria o atalho **Ponte MiPonto** na Area de Trabalho e registra o inicio automatico com o Windows
- sobe a ponte e mostra `Ponte do MiPonto ativa em http://127.0.0.1:8765`

Rodar o `INSTALAR.cmd` novamente serve para atualizar: o `.env` existente **nunca** e sobrescrito.

Dica: se colocar um `.env` ja preenchido dentro do pacote, ninguem precisa digitar usuario e senha.

Requisitos do PC: Microsoft Edge instalado e internet (o driver do Edge e baixado sozinho no primeiro uso).

> Nao usar `.exe` empacotado: o **Controle de aplicativo inteligente** do Windows 11 bloqueia
> executaveis nao assinados, sem opcao de "executar assim mesmo".

## Rodar em desenvolvimento

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

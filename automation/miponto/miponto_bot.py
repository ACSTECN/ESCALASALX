from __future__ import annotations

import random
import re
import time
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional, Tuple

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.edge.options import Options
from selenium.webdriver.edge.service import Service
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from .models import DispatchPayload, DispatchResponse, DispatchResultado


@dataclass
class MiPontoSettings:
    url: str
    user: str
    password: str
    driver_path: str = ""
    headless: bool = False
    timeout: int = 30
    confirm_submit: bool = False


def pausa(minimo: float = 0.8, maximo: float = 1.6) -> None:
    time.sleep(random.uniform(minimo, maximo))


def normalizar(texto: Optional[str]) -> str:
    texto = unicodedata.normalize("NFKD", texto or "")
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", texto.upper()).strip()


class MiPontoBot:
    """Porta fiel do script de despacho do MePonto, generalizado para N condutores."""

    def __init__(self, settings: MiPontoSettings) -> None:
        self.settings = settings
        self.driver: Optional[webdriver.Edge] = None
        self.wait: Optional[WebDriverWait] = None
        self.logado = False

    # ------------------------------------------------------------------
    # Ciclo de vida / sessao
    # ------------------------------------------------------------------
    def __enter__(self) -> "MiPontoBot":
        self.open()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        # O navegador e mantido aberto de proposito (detach): o operador
        # acompanha a tela do MePonto. Use close() para encerrar.
        pass

    def open(self) -> "MiPontoBot":
        if self.driver is not None:
            return self
        options = Options()
        options.add_argument("--start-maximized")
        options.add_experimental_option("detach", True)
        if self.settings.headless:
            options.add_argument("--headless=new")
            options.add_argument("--disable-gpu")
        # Sem caminho informado, o Selenium Manager resolve/baixa o driver compativel sozinho.
        servico = Service(self.settings.driver_path) if self.settings.driver_path else None
        self.driver = webdriver.Edge(service=servico, options=options)
        self.wait = WebDriverWait(self.driver, self.settings.timeout)
        return self

    def close(self) -> None:
        if self.driver is not None:
            try:
                self.driver.quit()
            except Exception:
                pass
        self.driver = None
        self.wait = None
        self.logado = False

    @property
    def browser(self) -> webdriver.Edge:
        if self.driver is None:
            raise RuntimeError("Navegador nao iniciado.")
        return self.driver

    @property
    def web_wait(self) -> WebDriverWait:
        if self.wait is None:
            raise RuntimeError("Wait nao iniciado.")
        return self.wait

    # ------------------------------------------------------------------
    # Utilitarios de interacao
    # ------------------------------------------------------------------
    def digitar(self, elemento: WebElement, texto: str) -> None:
        elemento.click()
        elemento.clear()
        pausa(0.4, 0.7)
        for caractere in str(texto):
            elemento.send_keys(caractere)
            time.sleep(random.uniform(0.10, 0.22))
        pausa(1.0, 1.5)

    def buscar_campo(self) -> WebElement:
        return self.web_wait.until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, 'input[placeholder*="Buscar nome"]')
            )
        )

    def texto_elemento(self, elemento: WebElement) -> str:
        return normalizar(elemento.get_attribute("textContent") or "")

    # ------------------------------------------------------------------
    # Fluxo
    # ------------------------------------------------------------------
    def login(self) -> None:
        if self.logado:
            return

        self.browser.get(self.settings.url)

        usuario = self.web_wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, 'input[autocomplete="username"]'))
        )
        self.digitar(usuario, self.settings.user)
        pausa()

        senha = self.web_wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, 'input[type="password"]'))
        )
        self.digitar(senha, self.settings.password)
        pausa()

        entrar = self.web_wait.until(
            EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Entrar']"))
        )
        entrar.click()

        self.web_wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'a[href="/dispatch/station"]'))
        )
        self.logado = True

    def abrir_central(self) -> None:
        # Ja pode estar na central apos um despacho anterior.
        if "/dispatch/station" in self.browser.current_url:
            return

        central = self.web_wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, 'a[href="/dispatch/station"]'))
        )
        central.click()
        self.web_wait.until(EC.url_contains("/dispatch/station"))

    def selecionar_turno(
        self,
        data_coleta: str,
        horario_inicio: str,
        horario_fim: Optional[str],
        estacao: str,
    ) -> None:
        data = datetime.strptime(data_coleta, "%Y-%m-%d")
        data_tela = data.strftime("%m-%d")
        horario_inicio = self.normalizar_horario(horario_inicio)
        horario_fim = self.normalizar_horario(horario_fim) if horario_fim else None

        dia = self.web_wait.until(
            EC.presence_of_element_located(
                (By.XPATH, f"//*[contains(text(), '{data_tela}')]")
            )
        )

        # O MiPonto nem sempre exibe o termino que calculamos (inicio + 4h).
        # Por isso localizamos pelo horario de inicio e so depois conferimos o termino.
        # Segue a hierarquia já validada no script funcional do usuário:
        # localizar a data, subir até o bloco que contém o botão do intervalo.
        seletor_botao = f".//button[contains(., '{horario_inicio}')]"
        seletor_container = f"./ancestor::div[{seletor_botao}][1]"

        try:
            container = dia.find_element(By.XPATH, seletor_container)
            botoes = container.find_elements(By.XPATH, seletor_botao)
        except Exception as exc:
            raise RuntimeError(
                f"Turno nao localizado para {data_tela} "
                f"({horario_inicio}-{horario_fim or '?'})."
            ) from exc

        botoes = [b for b in botoes if b.is_displayed()]

        do_inicio = [b for b in botoes if self.horarios_do_botao(b)[:1] == [horario_inicio]]
        candidatos = do_inicio
        if horario_fim:
            exatos = [
                b for b in do_inicio
                if self.horarios_do_botao(b)[:2] == [horario_inicio, horario_fim]
            ]
            candidatos = exatos or do_inicio

        do_hub = [b for b in candidatos if normalizar(estacao) in self.texto_elemento(b)]
        if do_hub:
            candidatos = do_hub

        if len(candidatos) != 1:
            encontrados = [self.texto_elemento(b) for b in botoes]
            raise RuntimeError(
                f"Turno nao encontrado de forma unica "
                f"({data_tela} | {horario_inicio}-{horario_fim or '?'} | {estacao}): "
                f"{len(candidatos)} candidato(s). Botoes do dia: {encontrados}."
            )

        botao = candidatos[0]
        self.browser.execute_script("arguments[0].scrollIntoView({block:'center'});", botao)
        pausa()
        botao.click()

        self.buscar_campo()

    @staticmethod
    def horarios_do_botao(botao: WebElement) -> List[str]:
        # Extrai os horarios na ordem em que aparecem no card (ex.: 18:00, 22:00).
        texto = botao.get_attribute("textContent") or ""
        return [f"{int(hora):02d}:{minuto}" for hora, minuto in re.findall(r"(\d{1,2}):(\d{2})", texto)]

    @staticmethod
    def normalizar_horario(horario: str) -> str:
        # Supabase TIME pode chegar como HH:MM:SS; a tela do MiPonto mostra HH:MM.
        try:
            return datetime.strptime(horario[:5], "%H:%M").strftime("%H:%M")
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Horario invalido recebido para o turno: {horario!r}") from exc

    def pesquisar_condutor(self, valor: str) -> WebElement:
        campo = self.buscar_campo()
        self.digitar(campo, valor)
        pausa(1.2, 1.8)
        return campo

    def encontrar_checkbox(
        self,
        nome: str,
        busca_por_nome: bool = False,
    ) -> Optional[WebElement]:
        campo = self.buscar_campo()
        area = campo.rect

        checkboxes = self.browser.find_elements(By.CSS_SELECTOR, 'input[type="checkbox"]')
        candidatos: List[WebElement] = []

        for checkbox in checkboxes:
            if not checkbox.is_displayed():
                continue

            posicao = checkbox.rect
            if not (area["x"] - 40 <= posicao["x"] <= area["x"] + area["width"] + 80):
                continue
            if posicao["y"] <= area["y"]:
                continue

            try:
                linha = checkbox.find_element(By.XPATH, "./ancestor::label[1]")
            except Exception:
                try:
                    linha = checkbox.find_element(By.XPATH, "./parent::div")
                except Exception:
                    continue

            texto = self.texto_elemento(linha)
            nome_acessivel = normalizar(checkbox.get_attribute("aria-label") or "")
            contexto = f"{texto} {nome_acessivel}"

            # NUNCA selecionar todos / elegiveis
            if "SELECIONAR TODOS" in contexto:
                continue
            if "ELEGIVEIS" in contexto:
                continue

            if busca_por_nome:
                partes = normalizar(nome).split()
                chave = " ".join(partes[:2])
                if chave not in contexto:
                    continue

            candidatos.append(checkbox)

        if len(candidatos) != 1:
            return None
        return candidatos[0]

    def clicar_checkbox(self, checkbox: WebElement) -> str:
        nome_acessivel = normalizar(checkbox.get_attribute("aria-label") or "")
        try:
            linha = checkbox.find_element(By.XPATH, "./ancestor::label[1]")
        except Exception:
            linha = checkbox.find_element(By.XPATH, "./parent::div")

        contexto = f"{self.texto_elemento(linha)} {nome_acessivel}"
        if "SELECIONAR TODOS" in contexto or "ELEGIVEIS" in contexto:
            raise RuntimeError("Checkbox geral bloqueado.")

        if checkbox.is_selected():
            return "JA_MARCADO"

        self.browser.execute_script("arguments[0].scrollIntoView({block:'center'});", checkbox)
        pausa(0.8, 1.3)

        try:
            checkbox.click()
        except Exception:
            identificador = checkbox.get_attribute("id")
            if not identificador:
                return "FALHA"
            labels = self.browser.find_elements(By.CSS_SELECTOR, f'label[for="{identificador}"]')
            if not labels:
                return "FALHA"
            labels[0].click()

        pausa(0.8, 1.3)
        return "MARCADO" if checkbox.is_selected() else "FALHA"

    def marcar_condutor(self, nome: str, cpf: Optional[str]) -> Tuple[str, str]:
        if cpf:
            self.pesquisar_condutor(cpf)
            checkbox = self.encontrar_checkbox(nome, busca_por_nome=False)
            if checkbox is None:
                self.pesquisar_condutor(nome)
                checkbox = self.encontrar_checkbox(nome, busca_por_nome=True)
        else:
            self.pesquisar_condutor(nome)
            checkbox = self.encontrar_checkbox(nome, busca_por_nome=True)

        if checkbox is None:
            return "NAO_ENCONTRADO", "Nao encontrado ou ambiguo na lista do MePonto."

        pausa(0.6, 1.0)
        resultado = self.clicar_checkbox(checkbox)

        if resultado == "MARCADO":
            return "MARCADO", "Condutor selecionado."
        if resultado == "JA_MARCADO":
            return "JA_MARCADO", "Condutor ja estava selecionado."
        return "FALHA", "Falha ao marcar o checkbox."

    def enviar(self, quantidade: int) -> bool:
        botoes = self.browser.find_elements(
            By.CSS_SELECTOR, "button.mt-3.inline-flex.h-11.w-full"
        )
        botoes = [b for b in botoes if b.is_displayed()]

        if len(botoes) != 1:
            raise RuntimeError(
                f"Encontrados {len(botoes)} botoes de envio. Envio cancelado."
            )

        botao_enviar = botoes[0]
        texto_botao = botao_enviar.text.strip()
        texto_normalizado = normalizar(texto_botao)

        # O site exibe o botao em chines: "N 名骑手".
        quantidade_correta = (
            f"{quantidade} 名骑手" in texto_botao
            or f"{quantidade}名骑手" in texto_botao
            or bool(re.search(rf"\b{quantidade}\s+(?:CONDUTOR|ENTREGADOR)", texto_normalizado))
        )

        if not quantidade_correta:
            raise RuntimeError(
                f"O botao nao confirma {quantidade} condutor(es): '{texto_botao}'. Envio cancelado."
            )

        if not botao_enviar.is_enabled():
            raise RuntimeError("Botao Enviar desabilitado.")

        self.browser.execute_script("arguments[0].scrollIntoView({block:'center'});", botao_enviar)
        pausa(1.5, 2.5)
        botao_enviar.click()
        pausa(2.0, 3.0)
        return True

    # ------------------------------------------------------------------
    # Orquestracao
    # ------------------------------------------------------------------
    def run_dispatch(self, payload: DispatchPayload) -> DispatchResponse:
        self.login()
        self.abrir_central()
        self.selecionar_turno(
            payload.data_coleta,
            payload.horario,
            payload.horario_fim,
            payload.hub_nome,
        )

        resultados: List[DispatchResultado] = []
        selecionados = 0

        for motorista in payload.motoristas:
            try:
                status, detalhe = self.marcar_condutor(motorista.nome, motorista.cpf)
                if status in ("MARCADO", "JA_MARCADO"):
                    selecionados += 1
                    resultados.append(
                        DispatchResultado(
                            nome=motorista.nome,
                            cpf=motorista.cpf,
                            status="selecionado",
                            detalhe=detalhe,
                        )
                    )
                else:
                    resultados.append(
                        DispatchResultado(
                            nome=motorista.nome,
                            cpf=motorista.cpf,
                            status="ignorado",
                            detalhe=detalhe,
                        )
                    )
            except Exception as exc:
                resultados.append(
                    DispatchResultado(
                        nome=motorista.nome,
                        cpf=motorista.cpf,
                        status="erro",
                        detalhe=str(exc),
                    )
                )

        # Limpar o campo de busca sem desmarcar os condutores.
        try:
            self.buscar_campo().clear()
            pausa(1.0, 1.5)
        except Exception:
            pass

        submit_realizado = False
        if selecionados > 0 and self.settings.confirm_submit:
            submit_realizado = self.enviar(selecionados)

        mensagem = f"{selecionados} condutor(es) selecionado(s) no MePonto."
        if selecionados == 0:
            mensagem = "Nenhum condutor foi selecionado no MePonto."
        if not self.settings.confirm_submit:
            mensagem += " Envio final desligado no servico local (modo teste)."

        return DispatchResponse(
            ok=True,
            message=mensagem,
            processed=len(payload.motoristas),
            selected=selecionados,
            submit_performed=submit_realizado,
            resultados=resultados,
        )

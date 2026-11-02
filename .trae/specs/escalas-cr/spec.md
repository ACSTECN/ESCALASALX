# Sistema de Escalas e Agendamento de Coletas por HUB - Product Requirements Document

## Overview
- **Summary**: Plataforma web SaaS para gestão operacional de coletas logísticas por HUB, com calendário semanal, metas de condutores, agendamentos e dashboards executivos.
- **Purpose**: Acompanhar a programação de coletas por data/horário/HUB e identificar rapidamente quais HUBs precisam de mais condutores, evitando gargalos operacionais.
- **Target Users**: Administradores, Supervisores, Operadores e Visualizadores de operações logísticas (coletas de encomendas por HUB).

## Goals
- Calendário semanal visual com cartões de coleta mostrando meta, agendados, vagas e ocupação.
- Cadastro flexível de Cidades, HUBs, Condutores e Metas de coleta sem alterar código-fonte.
- Agendamento de condutores em coletas com controle de vagas, duplicidade e conflitos de horário.
- Dashboards e tela "Escala de Amanhã" para visão executiva.
- Autenticação por perfis com permissões e auditoria de alterações.
- Persistência em Supabase (PostgreSQL) com RLS; dados demo iniciais claramente marcados.

## Non-Goals
- Integração com sistemas externos de transporte/ERP nesta fase.
- App mobile nativo (apenas responsividade web).
- Cálculo de rotas ou geolocalização em tempo real de condutores.
- Módulo financeiro/pagamento.

## Background & Context
- Operação trabalha com coletas programadas por data, horário e HUB (não turnos fixos).
- HUBs iniciais: HGRU, HCPO, HQSC, HLAP, HJLG, HPOA, HCGB, HRAO, HBHZ.
- Cidades iniciais: São Paulo, Campinas, Porto Alegre, Belo Horizonte.
- Usuário executa queries SQL no Supabase manualmente; o projeto deve fornecer os scripts.
- Iniciar com dados demonstrativos claramente identificados como DEMO.

## Functional Requirements

- **FR-1 Autenticação**: Login/logout via Supabase Auth com perfis (admin, supervisor, operador, visualizador). Proteção de rotas por perfil.
- **FR-2 Layout**: Menu lateral desktop, topbar com usuário/período, navegação entre módulos.
- **FR-3 Cidades**: CRUD de cidades (nome, estado, ativo).
- **FR-4 HUBs**: CRUD de HUBs (sigla, nome, cidade vinculada, ativo). HUB pertence a uma cidade.
- **FR-5 Calendário semanal**: View segunda-dom, navegação entre semanas, botão "hoje", filtros cidade/HUB/status, destaque do dia atual.
- **FR-6 Cartão de coleta**: Exibe HUB, data, horário, agendados/meta, vagas, % ocupação, barra de progresso colorida.
- **FR-7 Cores de ocupação**: Verde (meta atingida), Amarelo (próximo), Vermelho (abaixo), Azul (em andamento), Cinza (finalizada). Limites configuráveis.
- **FR-8 Gestão de Metas**: Criar/editar meta por cidade+HUB+data+horário; múltiplas coletas por dia; replicar para outros dias; recorrência por dia da semana; aplicar em lote por HUBs; histórico de alterações.
- **FR-9 Condutores**: CRUD (id, nome, telefone, cidade, HUB principal, status, obs).
- **FR-10 Agendamentos**: Agendar condutor em coleta; status (Agendado, Confirmado, Compareceu, Ausente, Cancelado, Concluído); registrar usuário/data inclusão.
- **FR-11 Regras de agendamento**: Sem duplicidade de condutor na mesma coleta; sem conflito no mesmo horário (intervalo configurável); cancelado não ocupa vaga; última vaga com controle de concorrência.
- **FR-12 Escala de Amanhã**: KPIs (coletas, agendados, vagas previstas, restantes, % ocupação, HUBs abaixo da meta), lista nominal por HUB, filtros, export CSV/Excel.
- **FR-13 Dashboard**: KPIs (meta, agendados, confirmados, vagas, % preenchimento, abaixo da meta, comparecimentos, ausências) + gráficos por cidade/HUB/dia da semana. Filtros Hoje/Amanhã/Semana/Período.
- **FR-14 Auditoria**: Tabela histórico_alteracoes registrando entidade, ação, antes/depois, usuário e data.
- **FR-15 Detalhe de coleta**: Painel lateral/modal ao clicar na coleta com condutores agendados e ações.
- **FR-16 Mobile**: Visualização por dia com cartões empilhados e navegação entre datas (não 7 colunas).
- **FR-17 Funcionalidades extras**: busca de condutor, seleção múltipla, agendamento em lote, replicação semanal, alertas de meta não atingida, exportação, confirmação em ações destrutivas, atualização em tempo real.

## Non-Functional Requirements
- **NFR-1**: React + TypeScript + Vite + Tailwind CSS.
- **NFR-2**: Supabase (PostgreSQL + Auth + Realtime).
- **NFR-3**: RLS em todas as tabelas com política por perfil e escopo.
- **NFR-4**: Dados demo identificados com flag `is_demo`.
- **NFR-5**: Código modular, componentes reutilizáveis, pronto para deploy (Vercel).
- **NFR-6**: UI moderna SaaS, cards arredondados, barras de progresso, ícones discretos, animações leves.
- **NFR-7**: Scripts SQL versionados em `supabase/migrations/` para o usuário executar.

## Constraints
- **Technical**: Node 20+, React 18, TypeScript estrito.
- **Business**: Dados demo não devem ser confundidos com reais.
- **Dependencies**: Supabase (usuário cria via queries fornecidas).

## Assumptions
- Usuário executará scripts SQL no Supabase SQL Editor.
- Vercel para hospedagem.
- Conexão Supabase via variáveis de ambiente (.env).

## Acceptance Criteria

### AC-1: Autenticação e perfis
- **Type**: `rule`
- **Given**: Usuário acessa o sistema
- **When**: Insere credenciais válidas
- **Then**: É autenticado e suas rotas são filtradas por perfil (admin vê tudo; visualizador só consulta)
- **Pass Condition**: Login funciona e rotas protegidas bloqueiam perfis não autorizados
- **Evidence**: Tela de login funcional + redirect por perfil

### AC-2: Calendário semanal funcional
- **Type**: `rule`
- **Given**: Semana com coletas cadastradas
- **When**: Usuário navega pelo calendário
- **Then**: Visualiza 7 dias (seg-dom) com cartões de coleta, navega entre semanas e volta para hoje
- **Pass Condition**: Calendário renderiza dias e cartões; navegação e filtros funcionam
- **Evidence**: Calendário carrega dados demo e cartões aparecem

### AC-3: Cartão de coleta com ocupação
- **Type**: `rule`
- **Given**: Uma coleta com meta e agendamentos
- **When**: Cartão é exibido
- **Then**: Mostra HUB, horário, agendados/meta, vagas, % e barra colorida conforme ocupação
- **Pass Condition**: Campos e cores corretos conforme thresholds
- **Evidence**: Cartão demo com barra verde/amarelo/vermelho

### AC-4: CRUD de Cidades e HUBs
- **Type**: `rule`
- **Given**: Usuário admin
- **When**: Cadastra/edita/ativa cidade e HUB
- **Then**: Alterações persistem e refletem nos filtros do calendário
- **Pass Condition**: CRUD completo com persistência
- **Evidence**: Telas de cadastro funcionando

### AC-5: Gestão de Metas
- **Type**: `rule`
- **Given**: Admin seleciona cidade/HUB/data/horário/meta
- **When**: Cria ou edita meta
- **Then**: Coleta é criada/atualizada no calendário; suporta múltiplas por dia e replicação
- **Pass Condition**: Metas aparecem no calendário corretamente
- **Evidence**: Criação de meta aparece no calendário

### AC-6: Cadastro de Condutores
- **Type**: `rule`
- **Given**: Admin/operador
- **When**: Cadastra condutor
- **Then**: Condutor persiste e fica disponível para agendamento
- **Pass Condition**: CRUD de condutores funcional
- **Evidence**: Lista de condutores demo

### AC-7: Agendamento com regras
- **Type**: `rule`
- **Given**: Coleta com vagas disponíveis
- **When**: Agenda um condutor
- **Then**: Vaga é ocupada; não permite duplicidade nem conflito de horário
- **Pass Condition**: Agendamentos respeitam todas as regras
- **Evidence**: Tentativa de agendar condutor duplicado é bloqueada

### AC-8: Escala de Amanhã
- **Type**: `rule`
- **Given**: Coletas para o dia seguinte
- **When**: Abre a tela
- **Then**: Mostra KPIs, HUBs abaixo da meta e lista nominal; exporta CSV
- **Pass Condition**: KPIs calculados corretamente e exportação funciona
- **Evidence**: Tela com KPIs demo

### AC-9: Dashboard com gráficos
- **Type**: `rubric`
- **Dimension**: Clareza e completude dos indicadores
- **Scale**: 1-5
- **Anchors**: 1 = só números sem gráficos; 3 = KPIs + 1 gráfico; 5 = todos KPIs + gráficos cidade/HUB/dia da semana
- **Pass Threshold**: >= 4
- **Evidence**: Dashboard com KPIs e gráficos

### AC-10: Auditoria e histórico
- **Type**: `rule`
- **Given**: Alteração em entidade crítica
- **When**: Usuário edita meta/agendamento
- **Then**: Registro é criado em histórico_alteracoes com usuário e data
- **Pass Condition**: Histórico visível e completo
- **Evidence**: Tela de histórico mostra alterações demo

### AC-11: Dados demo claramente identificados
- **Type**: `rule`
- **Given**: Sistema inicializado
- **When**: Visualiza qualquer dado
- **Then**: Dados demo estão marcados (badge/flag) e não confundem com reais
- **Pass Condition**: Badge "DEMO" visível onde há dados fictícios
- **Evidence**: Badge DEMO nos cartões

### AC-12: Responsividade mobile
- **Type**: `rubric`
- **Dimension**: Experiência mobile
- **Scale**: 1-5
- **Anchors**: 1 = 7 colunas comprimidas; 3 = rolagem horizontal; 5 = view por dia com cartões empilhados
- **Pass Threshold**: >= 4
- **Evidence**: Layout mobile por dia

### AC-13: Scripts SQL fornecidos
- **Type**: `rule`
- **Given**: Usuário precisa configurar Supabase
- **When**: Abre a pasta supabase/migrations
- **Then**: Encontra scripts SQL prontos para executar (schema, RLS, seed demo)
- **Pass Condition**: Scripts completos e executáveis
- **Evidence**: Arquivos .sql com CREATE TABLE, RLS, seed

## Open Questions
- [ ] Intervalo operacional padrão para conflito de horário (assumir 60 min).
- [ ] Thresholds padrão de cores (assumir: <70% vermelho, 70-99% amarelo, >=100% verde).

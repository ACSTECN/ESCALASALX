# Sistema de Escalas e Agendamento de Coletas por HUB - Implementation Plan

## Fase 1: Fundação do Projeto

### Task 1: Scaffold do projeto (Vite + React + TS + Tailwind)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Criar projeto Vite React TypeScript
  - Configurar Tailwind CSS, PostCSS, Autoprefixer
  - Configurar ESLint, tsconfig paths (@/)
  - Criar estrutura de pastas: src/{components,pages,lib,hooks,types,store,styles}
- **Acceptance Criteria Addressed**: NFR-1, NFR-5
- **Test Requirements**:
  - `rule` TR-1.1: `npm run build` executa sem erros
  - `rule` TR-1.2: Tailwind aplica classes em componente de teste
- **Notes**: Instalar: react-router-dom, @supabase/supabase-js, zustand, date-fns, recharts, lucide-react, xlsx

### Task 2: Camada Supabase + tipos TypeScript
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - Criar `src/lib/supabase.ts` (cliente Supabase com env vars)
  - Criar `src/types/database.ts` com todas as entidades
  - Criar `src/lib/db/` com funções CRUD (cidades, hubs, coletas, metas, condutores, agendamentos, historico)
  - Criar `src/store/` com Zustand para auth, filtros, UI
- **Acceptance Criteria Addressed**: NFR-2
- **Test Requirements**:
  - `rule` TR-2.1: Tipos TypeScript compilam sem erros
  - `rule` TR-2.2: Cliente Supabase exporta funções com tipagem

### Task 3: Scripts SQL do Supabase (schema, RLS, seed)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - `supabase/migrations/0001_schema.sql`: tabelas usuarios, cidades, hubs, condutores, coletas, metas_coletas, agendamentos, historico_alteracoes + PKs, FKs, índices, constraints
  - `supabase/migrations/0002_rls.sql`: RLS + políticas por perfil
  - `supabase/migrations/0003_seed.sql`: cidades, hubs, condutores demo, metas, agendamentos (flag is_demo)
  - `supabase/migrations/0004_functions.sql`: trigger updated_at, função de contagem de vagas, recorrência
- **Acceptance Criteria Addressed**: NFR-3, NFR-7, FR-14
- **Test Requirements**:
  - `rule` TR-3.1: Scripts SQL sintaticamente válidos (todas tabelas com RLS)
  - `rule` TR-3.2: Seed cria 4 cidades + 9 HUBs + condutores + coletas demo

## Fase 2: Autenticação e Layout

### Task 4: Autenticação + contexto de perfil
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - Página de login (email/senha) com Supabase Auth
  - Hook useAuth, proteção de rotas (RequireAuth, RequireRole)
  - Páginas de perfil do usuário
  - Redirecionamento por perfil após login
- **Acceptance Criteria Addressed**: AC-1, FR-1
- **Test Requirements**:
  - `rule` TR-4.1: Login com credenciais válidas autentica
  - `rule` TR-4.2: Rota protegida redireciona sem sessão

### Task 5: Layout principal (sidebar + topbar + outlet)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4
- **Description**:
  - Sidebar com navegação (Calendário, Metas, Condutores, Escala Amanhã, Dashboard, Auditoria, Configurações)
  - Topbar com saudação dinâmica, data/hora, usuário/perfil, logout
  - Layout responsivo (sidebar colapsa no mobile)
  - Rotas configuradas
- **Acceptance Criteria Addressed**: FR-2, NFR-6
- **Test Requirements**:
  - `rule` TR-5.1: Navegação entre páginas funciona
  - `rubric` TR-5.2: Aparência SaaS moderna; scale 1-5; anchors 1=crú/3=aceitável/5=polido; threshold >=4

## Fase 3: Núcleo Operacional (Prioridade Máxima)

### Task 6: Cadastro de Cidades e HUBs
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2, Task 5
- **Description**:
  - Páginas Cidades e HUBs com tabelas e modais de CRUD
  - Ativar/desativar toggle
  - HUB vinculado à cidade via select
- **Acceptance Criteria Addressed**: AC-4, FR-3, FR-4
- **Test Requirements**:
  - `rule` TR-6.1: Criar cidade e HUB persiste no banco
  - `rule` TR-6.2: HUBs filtrados por cidade aparecem corretamente

### Task 7: Gestão de Metas
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 6
- **Description**:
  - Página Gestão de Metas: formulário (cidade, HUB, data, horário, meta)
  - Lista de metas com editar/excluir
  - Replicar para outros dias
  - Recorrência por dia da semana
  - Aplicar em lote por HUBs
  - Histórico de alterações da meta
- **Acceptance Criteria Addressed**: AC-5, FR-8
- **Test Requirements**:
  - `rule` TR-7.1: Criar meta aparece no calendário
  - `rule` TR-7.2: Múltiplas coletas no mesmo dia funcionam

### Task 8: Calendário semanal + cartões de coleta
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 7
- **Description**:
  - Componente WeeklyCalendar (seg-dom) com navegação entre semanas e "hoje"
  - Filtros: cidade, HUB, status
  - Cartão de coleta: HUB, horário, agendados/meta, vagas, %, barra de progresso colorida
  - Cores configuráveis (thresholds em settings)
  - Destaque dia atual
  - Contagem de agendados calculada dos registros reais
- **Acceptance Criteria Addressed**: AC-2, AC-3, FR-5, FR-6, FR-7
- **Test Requirements**:
  - `rule` TR-8.1: Calendário mostra 7 dias com cartões
  - `rule` TR-8.2: Cor do cartão muda conforme % de ocupação

### Task 9: Painel de detalhe da coleta
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 8
- **Description**:
  - Drawer/modal ao clicar na coleta
  - Lista de condutores agendados com status
  - Ações: agendar condutor, alterar status, cancelar agendamento
- **Acceptance Criteria Addressed**: FR-15
- **Test Requirements**:
  - `rule` TR-9.1: Clicar no cartão abre painel com detalhes
  - `rule` TR-9.2: Agendar via painel atualiza contagem

## Fase 4: Condutores e Agendamentos

### Task 10: Cadastro de Condutores
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 5
- **Description**:
  - CRUD condutores (id, nome, telefone, cidade, HUB principal, status, obs)
  - Busca por nome/ID
  - Lista paginada
- **Acceptance Criteria Addressed**: AC-6, FR-9
- **Test Requirements**:
  - `rule` TR-10.1: CRUD condutor funciona
  - `rule` TR-10.2: Busca filtra por nome/ID

### Task 11: Agendamentos com regras de negócio
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 9, Task 10
- **Description**:
  - Agendar condutor em coleta (sem duplicidade, sem conflito horário)
  - Status: Agendado, Confirmado, Compareceu, Ausente, Cancelado, Concluído
  - Cancelado não ocupa vaga
  - Controle de concorrência (transação SQL + CHECK)
  - Auditoria automática em histórico
- **Acceptance Criteria Addressed**: AC-7, FR-10, FR-11, FR-14
- **Test Requirements**:
  - `rule` TR-11.1: Agendar condutor 2x na mesma coleta é bloqueado
  - `rule` TR-11.2: Cancelar agendamento libera vaga
  - `rule` TR-11.3: Cancelar gera registro de auditoria

## Fase 5: Visão Executiva

### Task 12: Escala de Amanhã
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 11
- **Description**:
  - KPIs: coletas, agendados, vagas previstas, restantes, % ocupação, HUBs abaixo da meta
  - Lista nominal por HUB (clique para expandir)
  - Filtros: cidade, HUB, horário, status
  - Exportar CSV/Excel
- **Acceptance Criteria Addressed**: AC-8, FR-12, FR-17
- **Test Requirements**:
  - `rule` TR-12.1: KPIs calculados corretamente
  - `rule` TR-12.2: Exportar CSV gera arquivo com dados

### Task 13: Dashboard operacional
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 11
- **Description**:
  - KPIs: meta total, agendados, confirmados, vagas, % preenchimento, abaixo da meta, comparecimentos, ausências
  - Gráficos: por cidade (barras), por HUB (barras), por dia da semana (linha)
  - Filtro de período: Hoje, Amanhã, Semana, Personalizado
- **Acceptance Criteria Addressed**: AC-9, FR-7
- **Test Requirements**:
  - `rule` TR-13.1: KPIs exibem valores do período selecionado
  - `rubric` TR-13.2: Qualidade visual dos gráficos; scale 1-5; threshold >=4

## Fase 6: Acabamento e Segurança

### Task 14: Auditoria e histórico
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 11
- **Description**:
  - Página de Histórico de Alterações com filtros
  - Registro automático em todas as ações críticas
- **Acceptance Criteria Addressed**: AC-10, FR-14
- **Test Requirements**:
  - `rule` TR-14.1: Cada alteração gera registro com usuário/data

### Task 15: Identificação de dados DEMO e real-time
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 8
- **Description**:
  - Badge "DEMO" em dados com is_demo=true
  - Supabase Realtime para atualização automática do calendário
  - Confirmação antes de ações destrutivas
- **Acceptance Criteria Addressed**: AC-11, FR-17
- **Test Requirements**:
  - `rule` TR-15.1: Badge DEMO visível em dados fictícios
  - `rule` TR-15.2: Ação destrutiva pede confirmação

### Task 16: Responsividade mobile
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 8
- **Description**:
  - View mobile por dia (não 7 colunas)
  - Cartões empilhados com navegação entre datas
  - Sidebar vira drawer no mobile
- **Acceptance Criteria Addressed**: AC-12, FR-16
- **Test Requirements**:
  - `rubric` TR-16.1: UX mobile; scale 1-5; threshold >=4

### Task 17: Build final e README de configuração
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Todas
- **Description**:
  - `npm run build` sem erros
  - .env.example com variáveis Supabase
  - README com passo a passo (executar SQL, configurar env, rodar)
- **Acceptance Criteria Addressed**: NFR-5, NFR-7, AC-13
- **Test Requirements**:
  - `rule` TR-17.1: Build de produção executa com sucesso
  - `rule` TR-17.2: .env.example contém SUPABASE_URL e SUPABASE_ANON_KEY

# Escalas CR — Sistema de Escalas e Agendamento de Coletas por HUB

Plataforma SaaS de gestão operacional para programação de coletas logísticas por HUB, com calendário semanal, metas de condutores, agendamentos e dashboards executivos.

## Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Estilo**: Tailwind CSS
- **Banco / Auth / Realtime**: Supabase (PostgreSQL + Auth + Realtime)
- **Estado**: Zustand
- **Gráficos**: Recharts
- **Datas**: date-fns
- **Ícones**: Lucide React

## Funcionalidades

- 🔐 Autenticação por perfis (Admin, Supervisor, Operador, Visualizador) com RLS
- 📅 Calendário semanal (seg-dom) com cartões de coleta coloridos por ocupação
- 🎯 Gestão de metas por HUB, dia da semana e horário (com replicação e recorrência)
- 👥 Cadastro de condutores com busca
- 📋 Agendamento com controle de vagas, duplicidade e conflito de horário
- ☀️ Tela "Escala de Amanhã" com KPIs e exportação CSV
- 📊 Dashboard com KPIs e gráficos por cidade, HUB e dia da semana
- 📜 Histórico de auditoria de todas as alterações
- 📱 Layout responsivo (mobile: visualização por dia)
- ⚡ Atualização em tempo real via Supabase Realtime
- 🧪 Dados DEMO claramente identificados

## Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar o Supabase

Crie um projeto no [Supabase](https://supabase.com) e execute os scripts SQL abaixo **na ordem** no SQL Editor (painel SQL do Supabase):

| Ordem | Arquivo | Descrição |
|-------|---------|-----------|
| 1 | `supabase/migrations/0001_schema.sql` | Cria tabelas, índices e constraints |
| 2 | `supabase/migrations/0002_rls.sql` | Habilita RLS e políticas por perfil |
| 3 | `supabase/migrations/0004_functions.sql` | Triggers e funções (updated_at, vagas, conflito, recorrência) |
| 4 | `supabase/migrations/0003_seed.sql` | Dados DEMO (cidades, HUBs, condutores, metas, coletas, agendamentos) |

> **Importante**: Execute o `0004_functions.sql` **antes** do `0003_seed.sql` pois o seed usa a função `gerar_coletas_recorrentes`.

### 3. Configurar variáveis de ambiente

Copie o arquivo de exemplo e preencha com suas credenciais do Supabase (Project Settings → API):

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

### 4. Criar usuário administrador

1. Acesse o sistema e clique em **"Criar nova conta"** na tela de login.
2. Confirme o email (ou desative a confirmação em Supabase → Authentication → Providers).
3. No SQL Editor do Supabase, eleve o perfil para admin:

```sql
update public.usuarios set perfil = 'admin' where email = 'seu@email.com';
```

### 5. Executar

```bash
npm run dev
```

Acesse `http://localhost:5173`.

### 6. Build de produção

```bash
npm run build
npm run preview
```

## Perfis e permissões

| Perfil | Permissões |
|--------|-----------|
| **Admin** | Tudo: cidades, HUBs, usuários, metas, agendamentos, configurações |
| **Supervisor** | Gerencia escalas, metas e agendamentos dos HUBs autorizados |
| **Operador** | Consulta escalas e realiza agendamentos |
| **Visualizador** | Apenas consulta |

## Estrutura do projeto

```
src/
├── components/       # Componentes reutilizáveis
│   ├── calendar/     # Calendário, cartões, drawer de detalhe
│   ├── layout/       # Sidebar, Topbar, Layout, ProtectedRoute
│   └── ui/           # Modal, Badge, ConfirmDialog, etc.
├── hooks/            # useAuth, useMediaQuery
├── lib/
│   ├── db.ts         # Funções de acesso ao banco (CRUD)
│   └── supabase.ts   # Cliente Supabase
├── pages/            # Páginas da aplicação
├── store/            # Zustand (auth, ui)
├── types/            # Tipos TypeScript
└── utils/            # Helpers (datas, cores, CSV)
supabase/migrations/  # Scripts SQL
```

## Deploy

O projeto está preparado para deploy na **Vercel**:
1. Conecte o repositório GitHub
2. Configure as variáveis de ambiente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
3. Build command: `npm run build`
4. Output directory: `dist`

## Dados DEMO

Todos os dados iniciais são fictícios e marcados com a flag `is_demo = true`. A interface exibe um badge **DEMO** nesses registros para evitar confusão com dados reais. Para limpar os dados demo, execute:

```sql
delete from public.agendamentos where is_demo = true;
delete from public.coletas where is_demo = true;
delete from public.condutores where is_demo = true;
delete from public.hubs where is_demo = true;
delete from public.cidades where is_demo = true;
```

-- ============================================================
-- 0003_seed.sql - Dados Demonstrativos (DEMO)
-- Execute após 0004_functions.sql (ordem: 0001, 0002, 0004, 0003)
-- Todos os dados são fictícios e marcados com is_demo = true
-- ============================================================

-- Limpar dados demo antigos (evitar duplicidade em re-execução)
delete from public.agendamentos where is_demo = true;
delete from public.coletas where is_demo = true;
delete from public.metas_coletas where id in (
  select id from public.metas_coletas where hub_id in (select id from public.hubs where is_demo = true)
);
delete from public.usuario_hubs where hub_id in (select id from public.hubs where is_demo = true);
delete from public.condutores where is_demo = true;
delete from public.hubs where is_demo = true;
delete from public.cidades where is_demo = true;

-- ============================================================
-- CIDADES
-- ============================================================
insert into public.cidades (nome, estado, is_demo) values
  ('São Paulo', 'SP', true),
  ('Campinas', 'SP', true),
  ('Porto Alegre', 'RS', true),
  ('Belo Horizonte', 'MG', true);

-- ============================================================
-- HUBS
-- ============================================================
insert into public.hubs (sigla, nome, cidade_id, is_demo)
select h.sigla, h.nome, c.id, true
from (values
  ('HGRU', 'HUB Guarulhos', 'São Paulo'),
  ('HQSC', 'HUB São Carlos', 'São Paulo'),
  ('HCPO', 'HUB Campinas', 'Campinas'),
  ('HPOA', 'HUB Porto Alegre', 'Porto Alegre'),
  ('HLAP', 'HUB Lajeado', 'Porto Alegre'),
  ('HJLG', 'HUB Jaguarão', 'Porto Alegre'),
  ('HBHZ', 'HUB Belo Horizonte', 'Belo Horizonte'),
  ('HCGB', 'HUB Contagem', 'Belo Horizonte'),
  ('HRAO', 'HUB Ribeirão das Neves', 'Belo Horizonte')
) as h(sigla, nome, cidade_nome)
join public.cidades c on c.nome = h.cidade_nome and c.is_demo = true;

-- ============================================================
-- CONDUTORES DEMO
-- ============================================================
insert into public.condutores (nome_completo, telefone, cidade_id, hub_id, status, is_demo)
select
  nomes.nome,
  '(11) 9' || lpad((random()*90000000+10000000)::bigint::text, 8, '0'),
  c.id,
  h.id,
  'ativo',
  true
from (values
  ('Carlos Eduardo Silva'), ('Marcos Vinícius Santos'), ('João Paulo Oliveira'),
  ('Rafael Souza Lima'), ('Lucas Almeida Costa'), ('Pedro Henrique Ferreira'),
  ('Gabriel Pereira Rocha'), ('Felipe Augusto Barbosa'), ('Ricardo Martins Gomes'),
  ('Bruno Cesar Ribeiro'), ('Diego Fernandes Cardoso'), ('Thiago Andre Nunes'),
  ('Matheus Henrique Dias'), ('Leonardo Souza Araujo'), ('André Luiz Moreira'),
  ('Eduardo Henrique Paz'), ('Gustavo Henrique Farias'), ('Rodrigo Augusto Teixeira'),
  ('Fernando Cesar Nogueira'), ('Wesley Silva Castro'), ('Leandro Souza Batista'),
  ('Robson Ferreira Macedo'), ('Alex Sandro Lima'), ('Mauricio Gonçalves Prado')
) as nomes(nome)
cross join lateral (select id from public.cidades where is_demo = true order by random() limit 1) c
cross join lateral (select id from public.hubs where is_demo = true order by random() limit 1) h;

-- ============================================================
-- METAS RECORRENTES (por dia da semana e horário)
-- dia_semana: 0=domingo, 1=segunda, 2=terça, 3=quarta, 4=quinta, 5=sexta, 6=sábado
-- ============================================================
insert into public.metas_coletas (hub_id, dia_semana, horario, meta, ativo)
select h.id, m.dia, m.horario::time, m.meta, true
from public.hubs h
join (values
  ('HGRU', 1, '14:00', 28),
  ('HGRU', 3, '14:00', 28),
  ('HGRU', 5, '15:30', 32),
  ('HCPO', 2, '09:00', 18),
  ('HCPO', 4, '09:00', 20),
  ('HQSC', 1, '10:00', 15),
  ('HQSC', 3, '10:00', 15),
  ('HPOA', 1, '13:00', 24),
  ('HPOA', 4, '13:00', 26),
  ('HLAP', 2, '11:00', 12),
  ('HJLG', 5, '14:30', 14),
  ('HBHZ', 3, '09:00', 20),
  ('HBHZ', 4, '16:00', 22),
  ('HCGB', 1, '08:30', 16),
  ('HRAO', 5, '13:30', 18)
) as m(sigla, dia, horario, meta)
on h.sigla = m.sigla and h.is_demo = true;

-- ============================================================
-- GERAR COLETAS PARA AS PRÓXIMAS 2 SEMANAS
-- ============================================================
select public.gerar_coletas_recorrentes(null, current_date - interval '3 days', current_date + interval '14 days');

-- Marcar as coletas geradas como demo (as metas recorrentes não têm is_demo; ajustamos aqui)
update public.coletas set is_demo = true
where hub_id in (select id from public.hubs where is_demo = true);

-- ============================================================
-- AGENDAMENTOS DEMO (ocupar parcialmente as coletas)
-- ============================================================
do $$
declare
  v_coleta record;
  v_condutor record;
  v_agendar integer;
  v_i integer;
begin
  for v_coleta in
    select id, meta from public.coletas
    where is_demo = true and data_coleta >= current_date - interval '3 days'
    order by random()
    limit 30
  loop
    -- Agendar entre 40% e 95% da meta
    v_agendar := greatest(1, round(v_coleta.meta * (0.4 + random() * 0.55))::integer);
    for v_i in 1..v_agendar loop
      select id into v_condutor
      from public.condutores
      where is_demo = true
        and id not in (
          select condutor_id from public.agendamentos
          where coleta_id = v_coleta.id
        )
      order by random() limit 1;

      if v_condutor.id is not null then
        -- Ignorar conflitos/duplicidade no seed (captura exceção por linha)
        begin
          insert into public.agendamentos (coleta_id, condutor_id, status, is_demo)
          values (v_coleta.id, v_condutor.id,
            case when random() < 0.6 then 'confirmado' else 'agendado' end,
            true
          );
        exception when others then
          null;
        end;
      end if;
    end loop;
  end loop;
end $$;

-- ============================================================
-- CONFIGURAÇÕES PADRÃO (thresholds de cor)
-- ============================================================
insert into public.configuracoes (chave, valor, descricao) values
  ('thresholds_ocupacao',
   '{"vermelho": 70, "amarelo": 100, "verde": 100}',
   'Limites de cor dos cartões: <vermelho%% vermelho, entre vermelho e amarelo = amarelo, >=amarelo = verde'),
  ('intervalo_conflito_minutos', '60', 'Intervalo em minutos para considerar conflito de horário')
on conflict (chave) do nothing;

-- ============================================================
-- USUÁRIO ADMIN DEMO (opcional - crie via tela de cadastro)
-- Para criar um admin manualmente, execute substituindo o UUID:
-- update public.usuarios set perfil = 'admin' where email = 'seu@email.com';
-- ============================================================

-- Finalização
select 'Seed DEMO concluído com sucesso!' as resultado;

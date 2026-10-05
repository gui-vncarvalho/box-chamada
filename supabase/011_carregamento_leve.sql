-- =====================================================================
-- Migração 011 — Carregamento mais leve
-- Rode uma vez no Supabase > SQL Editor, depois da 010.
-- Nada é alterado ou apagado: só uma "versão" que aumenta a cada mudança
-- e um box_carregar que traz menos coisa.
-- =====================================================================
begin;

-- ---------- versão dos dados ----------
-- Qualquer mudança nas tabelas avança a sequência. O site pergunta só esse
-- número a cada poucos segundos e só recarrega tudo quando ele muda.
create sequence if not exists box_versao_seq;

create or replace function box_marcar_mudanca() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform nextval('box_versao_seq');
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['diretores', 'jovens', 'eventos', 'atribuicoes', 'presencas', 'justificativas', 'vinculos'] loop
    execute format('drop trigger if exists box_versao on %I', t);
    execute format('create trigger box_versao after insert or update or delete on %I
                    for each statement execute function box_marcar_mudanca()', t);
  end loop;
end $$;

create or replace function box_versao(p_codigo text) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform box_ok(p_codigo);
  return (select last_value from box_versao_seq);
end $$;

-- ---------- carregar só o necessário ----------
-- Presenças e justificativas: dos eventos abertos e dos 10 últimos cultos
-- (o bastante pra frequência e "quem sumiu"). Os mais antigos vêm sob
-- demanda por box_presencas_evento. Histórico: só dos eventos abertos.
create or replace function box_carregar(p_codigo text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  janela uuid[];
begin
  perform box_ok(p_codigo);
  select array_agg(id) into janela from (
    select id from eventos where not arquivado
    union
    (select id from eventos
      where presenca_encerrada_em is not null or data < (now() at time zone 'America/Sao_Paulo')::date
      order by data desc nulls last limit 10)
  ) x;
  return jsonb_build_object(
    'versao',         (select last_value from box_versao_seq),
    'janela',         to_jsonb(coalesce(janela, '{}')),
    'diretores',      coalesce((select jsonb_agg(to_jsonb(d) order by d.nome) from diretores d), '[]'::jsonb),
    'jovens',         coalesce((select jsonb_agg(to_jsonb(j) order by j.nome) from jovens j), '[]'::jsonb),
    'eventos',        coalesce((select jsonb_agg(to_jsonb(e) order by e.data desc nulls last, e.criado_em desc) from eventos e), '[]'::jsonb),
    'atribuicoes',    coalesce((select jsonb_agg(to_jsonb(a)) from atribuicoes a
                                join eventos e on e.id = a.evento_id where not e.arquivado), '[]'::jsonb),
    'presencas',      coalesce((select jsonb_agg(to_jsonb(p)) from presencas p where p.evento_id = any (janela)), '[]'::jsonb),
    'justificativas', coalesce((select jsonb_agg(to_jsonb(j)) from justificativas j where j.evento_id = any (janela)), '[]'::jsonb),
    'vinculos',       coalesce((select jsonb_agg(to_jsonb(v)) from vinculos v), '[]'::jsonb),
    'historico',      coalesce((select jsonb_agg(to_jsonb(h) order by h.em desc)
                                from (select h.* from historico h join eventos e on e.id = h.evento_id
                                       where not e.arquivado order by h.em desc limit 300) h), '[]'::jsonb)
  );
end $$;

-- Presenças e justificativas de um culto fora da janela (abrir resumo antigo).
create or replace function box_presencas_evento(p_codigo text, p_evento uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform box_ok(p_codigo);
  return jsonb_build_object(
    'presencas',      coalesce((select jsonb_agg(to_jsonb(p)) from presencas p where p.evento_id = p_evento), '[]'::jsonb),
    'justificativas', coalesce((select jsonb_agg(to_jsonb(j)) from justificativas j where j.evento_id = p_evento), '[]'::jsonb)
  );
end $$;

grant execute on function box_versao(text), box_presencas_evento(text, uuid) to anon;

commit;

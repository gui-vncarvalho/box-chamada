-- =====================================================================
-- Migração 006 — Presença por culto (Sprint/Box), diretoria na presença,
-- encerrar a lista e justificativa de ausência.
-- Rode uma vez no Supabase > SQL Editor, depois da 005.
-- Compatível com o site anterior: a presença de antes vira culto "geral".
-- =====================================================================

-- Tudo numa transação: se algum passo falhar, nada é aplicado pela metade.
-- O aviso de "operação destrutiva" do Supabase aparece por causa dos
-- "drop constraint/function": eles trocam a chave da tabela de presença e a
-- função antiga pela nova. Nenhuma presença ou outro dado é apagado.
begin;

-- ---------- presença: culto + diretoria ----------
alter table presencas drop constraint if exists presencas_pkey;
alter table presencas add column if not exists id uuid not null default gen_random_uuid();
alter table presencas add primary key (id);
alter table presencas alter column jovem_id drop not null;
alter table presencas add column if not exists diretor_id uuid references diretores (id) on delete cascade;
alter table presencas add column if not exists culto text not null default 'geral'
  check (culto in ('geral', 'sprint', 'box'));
alter table presencas drop constraint if exists presencas_uma_pessoa;
alter table presencas add constraint presencas_uma_pessoa check ((jovem_id is null) <> (diretor_id is null));
create unique index if not exists presencas_unica
  on presencas (evento_id, culto, coalesce(jovem_id, diretor_id));

-- ---------- lista encerrada + resumo do culto ----------
alter table eventos add column if not exists presenca_encerrada_em timestamptz;
alter table eventos add column if not exists presenca_encerrada_por text;
alter table eventos add column if not exists presenca_resumo jsonb;

-- ---------- justificativa de ausência ----------
create table if not exists justificativas (
  evento_id uuid not null references eventos (id) on delete cascade,
  jovem_id uuid not null references jovens (id) on delete cascade,
  motivo text not null check (motivo in ('trabalho', 'estudo', 'viagem', 'saude', 'familia', 'outro')),
  texto text,
  por text,
  em timestamptz not null default now(),
  primary key (evento_id, jovem_id)
);
alter table justificativas enable row level security;
revoke all on justificativas from anon, authenticated;

-- ---------- funções ----------
-- p_jovem aceita o id de um jovem OU de alguém da diretoria (o nome ficou
-- assim pra continuar compatível com o site anterior).
drop function if exists box_presenca(text, uuid, uuid, boolean, text);
create or replace function box_presenca(p_codigo text, p_evento uuid, p_jovem uuid, p_presente boolean, p_quem text,
                                        p_culto text default 'geral')
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_diretor boolean := exists (select 1 from diretores where id = p_jovem);
  v_nome text := coalesce((select nome from jovens where id = p_jovem), (select nome from diretores where id = p_jovem));
begin
  perform box_ok(p_codigo);
  if v_nome is null then
    raise exception 'pessoa_invalida';
  end if;
  if exists (select 1 from eventos where id = p_evento and presenca_encerrada_em is not null) then
    raise exception 'lista_encerrada';
  end if;
  if p_presente then
    insert into presencas (evento_id, jovem_id, diretor_id, culto, marcado_por)
    values (p_evento, case when v_diretor then null else p_jovem end, case when v_diretor then p_jovem end,
            coalesce(p_culto, 'geral'), p_quem)
    on conflict do nothing;
  else
    delete from presencas
     where evento_id = p_evento and culto = coalesce(p_culto, 'geral')
       and coalesce(jovem_id, diretor_id) = p_jovem;
  end if;
  if not found then
    return; -- já estava assim (ex.: duas pessoas marcando ao mesmo tempo)
  end if;
  insert into historico (evento_id, quem, jovem, status)
  values (p_evento, p_quem, v_nome, case when p_presente then 'presente' else 'ausente' end);
end $$;

-- Encerra (com o resumo calculado no site) ou reabre a lista.
create or replace function box_encerrar_presenca(p_codigo text, p_evento uuid, p_encerrar boolean, p_quem text,
                                                 p_resumo jsonb default null)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform box_ok(p_codigo);
  update eventos
     set presenca_encerrada_em = case when p_encerrar then now() end,
         presenca_encerrada_por = case when p_encerrar then p_quem end,
         presenca_resumo = case when p_encerrar then p_resumo else presenca_resumo end
   where id = p_evento;
end $$;

-- Grava ou apaga (p_motivo nulo) a justificativa de ausência.
create or replace function box_justificar(p_codigo text, p_evento uuid, p_jovem uuid, p_motivo text, p_texto text, p_quem text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform box_ok(p_codigo);
  if p_motivo is null then
    delete from justificativas where evento_id = p_evento and jovem_id = p_jovem;
    return;
  end if;
  insert into justificativas (evento_id, jovem_id, motivo, texto, por)
  values (p_evento, p_jovem, p_motivo, nullif(trim(p_texto), ''), p_quem)
  on conflict (evento_id, jovem_id) do update
     set motivo = excluded.motivo, texto = excluded.texto, por = excluded.por, em = now();
end $$;

-- box_carregar passa a devolver as justificativas.
create or replace function box_carregar(p_codigo text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform box_ok(p_codigo);
  return jsonb_build_object(
    'diretores',      coalesce((select jsonb_agg(to_jsonb(d) order by d.nome) from diretores d), '[]'::jsonb),
    'jovens',         coalesce((select jsonb_agg(to_jsonb(j) order by j.nome) from jovens j), '[]'::jsonb),
    'eventos',        coalesce((select jsonb_agg(to_jsonb(e) order by e.data desc nulls last, e.criado_em desc) from eventos e), '[]'::jsonb),
    'atribuicoes',    coalesce((select jsonb_agg(to_jsonb(a)) from atribuicoes a
                                join eventos e on e.id = a.evento_id where not e.arquivado), '[]'::jsonb),
    'presencas',      coalesce((select jsonb_agg(to_jsonb(p)) from presencas p), '[]'::jsonb),
    'justificativas', coalesce((select jsonb_agg(to_jsonb(j)) from justificativas j), '[]'::jsonb),
    'vinculos',       coalesce((select jsonb_agg(to_jsonb(v)) from vinculos v), '[]'::jsonb),
    'historico',      coalesce((select jsonb_agg(to_jsonb(h) order by h.em desc)
                                from (select * from historico order by em desc limit 300) h), '[]'::jsonb)
  );
end $$;

grant execute on function box_presenca(text, uuid, uuid, boolean, text, text) to anon;
grant execute on function box_encerrar_presenca(text, uuid, boolean, text, jsonb) to anon;
grant execute on function box_justificar(text, uuid, uuid, text, text, text) to anon;

commit;

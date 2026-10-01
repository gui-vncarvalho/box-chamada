-- =====================================================================
-- Migração 002 — Presença nos eventos
-- Rode uma vez no Supabase > SQL Editor (em quem já rodou o schema.sql).
-- =====================================================================

create table if not exists presencas (
  evento_id uuid not null references eventos (id) on delete cascade,
  jovem_id uuid not null references jovens (id) on delete cascade,
  marcado_por text,
  em timestamptz not null default now(),
  primary key (evento_id, jovem_id)
);

alter table presencas enable row level security;
revoke all on presencas from anon, authenticated;

-- Marca/desmarca presença e registra no histórico.
create or replace function box_presenca(p_codigo text, p_evento uuid, p_jovem uuid, p_presente boolean, p_quem text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform box_ok(p_codigo);
  if p_presente then
    insert into presencas (evento_id, jovem_id, marcado_por)
    values (p_evento, p_jovem, p_quem)
    on conflict do nothing;
  else
    delete from presencas where evento_id = p_evento and jovem_id = p_jovem;
  end if;
  if not found then
    return; -- já estava assim (ex.: duas pessoas marcando ao mesmo tempo)
  end if;
  insert into historico (evento_id, quem, jovem, status)
  values (p_evento, p_quem, (select nome from jovens where id = p_jovem),
          case when p_presente then 'presente' else 'ausente' end);
end $$;

-- box_carregar passa a devolver as presenças também.
create or replace function box_carregar(p_codigo text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform box_ok(p_codigo);
  return jsonb_build_object(
    'diretores',   coalesce((select jsonb_agg(to_jsonb(d) order by d.nome) from diretores d), '[]'::jsonb),
    'jovens',      coalesce((select jsonb_agg(to_jsonb(j) order by j.nome) from jovens j), '[]'::jsonb),
    'eventos',     coalesce((select jsonb_agg(to_jsonb(e) order by e.data desc nulls last, e.criado_em desc) from eventos e), '[]'::jsonb),
    'atribuicoes', coalesce((select jsonb_agg(to_jsonb(a)) from atribuicoes a
                             join eventos e on e.id = a.evento_id where not e.arquivado), '[]'::jsonb),
    'presencas',   coalesce((select jsonb_agg(to_jsonb(p)) from presencas p), '[]'::jsonb),
    'historico',   coalesce((select jsonb_agg(to_jsonb(h) order by h.em desc)
                             from (select * from historico order by em desc limit 300) h), '[]'::jsonb)
  );
end $$;

grant execute on function box_presenca(text, uuid, uuid, boolean, text) to anon;

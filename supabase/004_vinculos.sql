-- =====================================================================
-- Migração 004 — Relacionamento e vínculos (parentesco, casal, amizade)
-- Rode uma vez no Supabase > SQL Editor, depois da 003.
-- =====================================================================

-- Status de relacionamento (opcional) de jovens e diretoria
alter table jovens add column if not exists estado_civil text
  check (estado_civil in ('solteiro', 'namorando', 'noivo', 'casado'));
alter table diretores add column if not exists estado_civil text
  check (estado_civil in ('solteiro', 'namorando', 'noivo', 'casado'));

-- Vínculo entre duas pessoas (jovem ou diretoria; os ids não se repetem
-- entre as tabelas). Tipos simétricos: conjuge, noivo, namoro, irmao,
-- primo, amigo. Direcionais (a → b): pai (a é pai/mãe de b), tio (a é
-- tio/tia de b), convidou (a convidou b).
create table if not exists vinculos (
  id uuid primary key default gen_random_uuid(),
  a_id uuid not null,
  b_id uuid not null,
  tipo text not null check (tipo in ('conjuge', 'noivo', 'namoro', 'irmao', 'primo', 'pai', 'tio', 'amigo', 'convidou')),
  criado_em timestamptz not null default now(),
  check (a_id <> b_id),
  unique (a_id, b_id, tipo)
);
alter table vinculos enable row level security;
revoke all on vinculos from anon, authenticated;

-- Cria ou remove um vínculo. Vínculo de casal também atualiza o
-- relacionamento das duas pessoas.
create or replace function box_vinculo(p_codigo text, p_a uuid, p_b uuid, p_tipo text, p_remover boolean default false)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_status text := case p_tipo when 'conjuge' then 'casado' when 'noivo' then 'noivo' when 'namoro' then 'namorando' end;
begin
  perform box_ok(p_codigo);
  if p_remover then
    delete from vinculos
     where tipo = p_tipo and ((a_id = p_a and b_id = p_b) or (a_id = p_b and b_id = p_a));
    return;
  end if;
  if not exists (select 1 from jovens where id = p_a union all select 1 from diretores where id = p_a)
     or not exists (select 1 from jovens where id = p_b union all select 1 from diretores where id = p_b) then
    raise exception 'pessoa_invalida';
  end if;
  -- simétricos não duplicam no sentido inverso
  if p_tipo not in ('pai', 'tio', 'convidou')
     and exists (select 1 from vinculos where tipo = p_tipo and a_id = p_b and b_id = p_a) then
    return;
  end if;
  insert into vinculos (a_id, b_id, tipo) values (p_a, p_b, p_tipo) on conflict do nothing;
  if v_status is not null then
    update jovens set estado_civil = v_status where id in (p_a, p_b);
    update diretores set estado_civil = v_status where id in (p_a, p_b);
  end if;
end $$;

-- Excluir pessoa também apaga os vínculos dela.
create or replace function box_excluir(p_codigo text, p_tabela text, p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform box_ok(p_codigo);
  if p_tabela = 'jovens' then delete from jovens where id = p_id;
  elsif p_tabela = 'diretores' then delete from diretores where id = p_id;
  elsif p_tabela = 'eventos' then delete from eventos where id = p_id;
  else raise exception 'tabela_invalida';
  end if;
  if p_tabela in ('jovens', 'diretores') then
    delete from vinculos where a_id = p_id or b_id = p_id;
  end if;
end $$;

-- box_salvar passa a gravar o relacionamento.
create or replace function box_salvar(p_codigo text, p_tabela text, p_dados jsonb) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  r jsonb;
  n int := 0;
begin
  perform box_ok(p_codigo);
  for r in select * from jsonb_array_elements(
    case when jsonb_typeof(p_dados) = 'array' then p_dados else jsonb_build_array(p_dados) end
  ) loop
    if p_tabela = 'jovens' then
      insert into jovens as t (id, nome, genero, telefone, nascimento, obs, ativo, estado_civil)
      values (coalesce(nullif(r->>'id', '')::uuid, gen_random_uuid()),
              trim(r->>'nome'), r->>'genero', nullif(trim(r->>'telefone'), ''),
              nullif(r->>'nascimento', '')::date, nullif(trim(r->>'obs'), ''),
              coalesce((r->>'ativo')::boolean, true), nullif(r->>'estado_civil', ''))
      on conflict (id) do update set
        nome = excluded.nome, genero = excluded.genero, telefone = excluded.telefone,
        nascimento = excluded.nascimento, obs = excluded.obs, ativo = excluded.ativo,
        estado_civil = excluded.estado_civil;
    elsif p_tabela = 'diretores' then
      insert into diretores as t (id, nome, equipe, telefone, nascimento, ativo, estado_civil)
      values (coalesce(nullif(r->>'id', '')::uuid, gen_random_uuid()),
              trim(r->>'nome'), r->>'equipe', nullif(trim(r->>'telefone'), ''),
              nullif(r->>'nascimento', '')::date,
              coalesce((r->>'ativo')::boolean, true), nullif(r->>'estado_civil', ''))
      on conflict (id) do update set
        nome = excluded.nome, equipe = excluded.equipe, telefone = excluded.telefone,
        nascimento = excluded.nascimento, ativo = excluded.ativo, estado_civil = excluded.estado_civil;
    elsif p_tabela = 'eventos' then
      insert into eventos as t (id, nome, data, hora, publico, chamadas_por_jovem, mensagem, arquivado)
      values (coalesce(nullif(r->>'id', '')::uuid, gen_random_uuid()),
              trim(r->>'nome'), nullif(r->>'data', '')::date, nullif(trim(r->>'hora'), ''),
              coalesce(r->>'publico', 'box'), coalesce((r->>'chamadas_por_jovem')::int, 2),
              nullif(r->>'mensagem', ''), coalesce((r->>'arquivado')::boolean, false))
      on conflict (id) do update set
        nome = excluded.nome, data = excluded.data, hora = excluded.hora, publico = excluded.publico,
        chamadas_por_jovem = excluded.chamadas_por_jovem, mensagem = excluded.mensagem,
        arquivado = excluded.arquivado;
    else
      raise exception 'tabela_invalida';
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- box_carregar passa a devolver os vínculos.
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
    'vinculos',    coalesce((select jsonb_agg(to_jsonb(v)) from vinculos v), '[]'::jsonb),
    'historico',   coalesce((select jsonb_agg(to_jsonb(h) order by h.em desc)
                             from (select * from historico order by em desc limit 300) h), '[]'::jsonb)
  );
end $$;

grant execute on function box_vinculo(text, uuid, uuid, text, boolean) to anon;

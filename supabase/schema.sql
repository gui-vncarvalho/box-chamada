-- =====================================================================
-- Central de Chamada BOX — esquema do banco (Supabase / Postgres)
--
-- Como usar: Supabase > SQL Editor > New query > cole este arquivo > Run.
-- Depois rode as migrações numeradas (002_presenca.sql, ...), o seed
-- (opcional) e defina o código de acesso (final deste arquivo).
--
-- Segurança: as tabelas ficam com RLS ligado e SEM policies, ou seja,
-- ninguém lê nem escreve nelas direto pela API pública. Todo acesso
-- passa pelas funções box_* abaixo, que exigem o código da diretoria.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists config (
  id int primary key default 1 check (id = 1),
  codigo_hash text not null
);

create table if not exists diretores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  equipe text not null check (equipe in ('F', 'M')),
  telefone text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists jovens (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  genero text not null check (genero in ('F', 'M')),
  telefone text,
  nascimento date,
  obs text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists eventos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  data date,
  hora text,
  publico text not null default 'box' check (publico in ('box', 'sprint', 'todos')),
  chamadas_por_jovem int not null default 2 check (chamadas_por_jovem between 1 and 5),
  mensagem text,
  arquivado boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists atribuicoes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos (id) on delete cascade,
  jovem_id uuid not null references jovens (id) on delete cascade,
  diretor_id uuid not null references diretores (id) on delete cascade,
  status text not null default 'pendente'
    check (status in ('pendente', 'chamado', 'confirmado', 'nao_vai')),
  nota text,
  atualizado_por text,
  atualizado_em timestamptz,
  unique (evento_id, jovem_id, diretor_id)
);

create table if not exists historico (
  id bigint generated always as identity primary key,
  evento_id uuid references eventos (id) on delete cascade,
  quem text,
  jovem text,
  diretor text,
  status text,
  em timestamptz not null default now()
);

alter table config      enable row level security;
alter table diretores   enable row level security;
alter table jovens      enable row level security;
alter table eventos     enable row level security;
alter table atribuicoes enable row level security;
alter table historico   enable row level security;

revoke all on config, diretores, jovens, eventos, atribuicoes, historico from anon, authenticated;

-- ---------------------------------------------------------------------
-- Verificação do código
-- ---------------------------------------------------------------------
create or replace function box_ok(p_codigo text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_codigo is null or not exists (
    select 1 from config where codigo_hash = crypt(p_codigo, codigo_hash)
  ) then
    perform pg_sleep(1); -- deixa tentativa de adivinhar o código lenta
    raise exception 'codigo_invalido' using errcode = '28000';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Leitura de tudo (os volumes de um ministério são pequenos)
-- ---------------------------------------------------------------------
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
    'historico',   coalesce((select jsonb_agg(to_jsonb(h) order by h.em desc)
                             from (select * from historico order by em desc limit 300) h), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------------
-- Marcar status / nota de uma chamada
-- ---------------------------------------------------------------------
create or replace function box_status(p_codigo text, p_id uuid, p_status text, p_quem text, p_nota text default null)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v atribuicoes;
begin
  perform box_ok(p_codigo);
  update atribuicoes
     set status = coalesce(p_status, status),
         nota = case when p_nota is null then nota else nullif(p_nota, '') end,
         atualizado_por = p_quem,
         atualizado_em = now()
   where id = p_id
  returning * into v;
  if not found then
    raise exception 'nao_encontrado';
  end if;
  if p_status is not null then
    insert into historico (evento_id, quem, jovem, diretor, status)
    values (v.evento_id, p_quem,
            (select nome from jovens where id = v.jovem_id),
            (select nome from diretores where id = v.diretor_id),
            p_status);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Criar/editar jovens, diretores e eventos (aceita um objeto ou array)
-- ---------------------------------------------------------------------
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
      insert into jovens as t (id, nome, genero, telefone, nascimento, obs, ativo)
      values (coalesce(nullif(r->>'id', '')::uuid, gen_random_uuid()),
              trim(r->>'nome'), r->>'genero', nullif(trim(r->>'telefone'), ''),
              nullif(r->>'nascimento', '')::date, nullif(trim(r->>'obs'), ''),
              coalesce((r->>'ativo')::boolean, true))
      on conflict (id) do update set
        nome = excluded.nome, genero = excluded.genero, telefone = excluded.telefone,
        nascimento = excluded.nascimento, obs = excluded.obs, ativo = excluded.ativo;
    elsif p_tabela = 'diretores' then
      insert into diretores as t (id, nome, equipe, telefone, ativo)
      values (coalesce(nullif(r->>'id', '')::uuid, gen_random_uuid()),
              trim(r->>'nome'), r->>'equipe', nullif(trim(r->>'telefone'), ''),
              coalesce((r->>'ativo')::boolean, true))
      on conflict (id) do update set
        nome = excluded.nome, equipe = excluded.equipe, telefone = excluded.telefone, ativo = excluded.ativo;
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

create or replace function box_excluir(p_codigo text, p_tabela text, p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform box_ok(p_codigo);
  if p_tabela = 'jovens' then delete from jovens where id = p_id;
  elsif p_tabela = 'diretores' then delete from diretores where id = p_id;
  elsif p_tabela = 'eventos' then delete from eventos where id = p_id;
  else raise exception 'tabela_invalida';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Define quem chama quem num evento. Pares que já existiam mantêm o
-- status; pares que saíram da lista são removidos.
-- p_pares = [{"jovem_id": "...", "diretor_id": "..."}, ...]
-- ---------------------------------------------------------------------
create or replace function box_atribuir(p_codigo text, p_evento uuid, p_pares jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform box_ok(p_codigo);
  delete from atribuicoes a
   where a.evento_id = p_evento
     and not exists (
       select 1 from jsonb_array_elements(p_pares) x
        where (x->>'jovem_id')::uuid = a.jovem_id and (x->>'diretor_id')::uuid = a.diretor_id);
  insert into atribuicoes (evento_id, jovem_id, diretor_id)
  select p_evento, (x->>'jovem_id')::uuid, (x->>'diretor_id')::uuid
    from jsonb_array_elements(p_pares) x
  on conflict (evento_id, jovem_id, diretor_id) do nothing;
end $$;

create or replace function box_zerar(p_codigo text, p_evento uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform box_ok(p_codigo);
  update atribuicoes set status = 'pendente', nota = null, atualizado_por = null, atualizado_em = null
   where evento_id = p_evento;
  delete from historico where evento_id = p_evento;
end $$;

-- Só as funções de uso do site ficam expostas para a chave pública.
revoke execute on function box_ok(text) from public, anon, authenticated;
grant execute on function
  box_carregar(text),
  box_status(text, uuid, text, text, text),
  box_salvar(text, text, jsonb),
  box_excluir(text, text, uuid),
  box_atribuir(text, uuid, jsonb),
  box_zerar(text, uuid)
to anon;

-- =====================================================================
-- CÓDIGO DE ACESSO DA DIRETORIA
-- Troque o texto abaixo por um código só de vocês (use algo com umas
-- 3–4 palavras, ex.: 'box-fogo-alto-2026') e rode só esta linha.
-- Para trocar depois, rode de novo com o código novo.
-- =====================================================================
-- insert into config (id, codigo_hash) values (1, crypt('TROQUE-ESTE-CODIGO', gen_salt('bf')))
--   on conflict (id) do update set codigo_hash = excluded.codigo_hash;

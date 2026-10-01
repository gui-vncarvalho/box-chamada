-- =====================================================================
-- Migração 003 — Data de nascimento da diretoria (pros aniversariantes)
-- Rode uma vez no Supabase > SQL Editor, depois da 002.
-- A diretoria continua fora das listas de chamada; a data só serve pros
-- aniversariantes.
-- =====================================================================

alter table diretores add column if not exists nascimento date;

-- box_salvar passa a gravar o nascimento da diretoria também.
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
      insert into diretores as t (id, nome, equipe, telefone, nascimento, ativo)
      values (coalesce(nullif(r->>'id', '')::uuid, gen_random_uuid()),
              trim(r->>'nome'), r->>'equipe', nullif(trim(r->>'telefone'), ''),
              nullif(r->>'nascimento', '')::date,
              coalesce((r->>'ativo')::boolean, true))
      on conflict (id) do update set
        nome = excluded.nome, equipe = excluded.equipe, telefone = excluded.telefone,
        nascimento = excluded.nascimento, ativo = excluded.ativo;
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

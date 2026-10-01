-- =====================================================================
-- Migração 005 — Horário por faixa (Box / Sprint) no evento
-- Rode uma vez no Supabase > SQL Editor, depois da 004.
-- Opcionais: quando preenchidos, a mensagem do WhatsApp de cada jovem usa
-- o horário da faixa dele; senão, vale o horário geral (eventos.hora).
-- =====================================================================

alter table eventos add column if not exists hora_box text;
alter table eventos add column if not exists hora_sprint text;

-- box_salvar passa a gravar os horários por faixa.
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
      insert into eventos as t (id, nome, data, hora, hora_box, hora_sprint, publico, chamadas_por_jovem, mensagem, arquivado)
      values (coalesce(nullif(r->>'id', '')::uuid, gen_random_uuid()),
              trim(r->>'nome'), nullif(r->>'data', '')::date, nullif(trim(r->>'hora'), ''),
              nullif(trim(r->>'hora_box'), ''), nullif(trim(r->>'hora_sprint'), ''),
              coalesce(r->>'publico', 'box'), coalesce((r->>'chamadas_por_jovem')::int, 2),
              nullif(r->>'mensagem', ''), coalesce((r->>'arquivado')::boolean, false))
      on conflict (id) do update set
        nome = excluded.nome, data = excluded.data, hora = excluded.hora,
        hora_box = excluded.hora_box, hora_sprint = excluded.hora_sprint, publico = excluded.publico,
        chamadas_por_jovem = excluded.chamadas_por_jovem, mensagem = excluded.mensagem,
        arquivado = excluded.arquivado;
    else
      raise exception 'tabela_invalida';
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

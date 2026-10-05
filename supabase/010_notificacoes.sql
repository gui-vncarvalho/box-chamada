-- =====================================================================
-- Migração 010 — Notificações (Web Push)
-- Rode uma vez no Supabase > SQL Editor, depois da 009.
-- Depois rode também o supabase/010_config.local.sql (não vai pro Git:
-- tem o segredo que liga o banco à função de envio).
--
-- Como funciona:
--   * cada aparelho que ativa as notificações fica em push_inscricoes;
--   * todo dia às 9h (12h UTC) o pg_cron chama box_push_disparar('diario');
--   * box_push_disparar faz um POST (pg_net) na Edge Function "notificar";
--   * a função pede a lista pronta em box_push_mensagens e envia cada uma.
-- Nada existente é alterado ou apagado.
-- =====================================================================
begin;

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------- aparelhos inscritos ----------
create table if not exists push_inscricoes (
  endpoint text primary key,
  diretor_id uuid not null references diretores (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  tipos text[] not null default array['lembretes', 'aniversarios'],
  criado_em timestamptz not null default now(),
  ultimo_envio timestamptz
);
alter table push_inscricoes enable row level security;
revoke all on push_inscricoes from anon, authenticated;

-- ---------- onde está a função e o segredo pra chamá-la ----------
create table if not exists push_config (
  id int primary key default 1 check (id = 1),
  url text not null,
  segredo text not null
);
alter table push_config enable row level security;
revoke all on push_config from anon, authenticated;

-- ---------- usadas pelo site (com o código da diretoria) ----------
create or replace function box_push_inscrever(p_codigo text, p_diretor uuid, p_endpoint text, p_p256dh text, p_auth text,
                                              p_tipos text[])
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform box_ok(p_codigo);
  insert into push_inscricoes (endpoint, diretor_id, p256dh, auth, tipos)
  values (p_endpoint, p_diretor, p_p256dh, p_auth, coalesce(p_tipos, array['lembretes', 'aniversarios']))
  on conflict (endpoint) do update
     set diretor_id = excluded.diretor_id, p256dh = excluded.p256dh, auth = excluded.auth, tipos = excluded.tipos;
end $$;

create or replace function box_push_remover(p_codigo text, p_endpoint text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform box_ok(p_codigo);
  delete from push_inscricoes where endpoint = p_endpoint;
end $$;

-- ---------- chama a Edge Function ----------
create or replace function box_push_disparar(p_corpo jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  c push_config;
begin
  select * into c from push_config where id = 1;
  if c is null then
    raise notice 'push_config vazio: rode o 010_config.local.sql';
    return;
  end if;
  perform net.http_post(
    url := c.url,
    body := p_corpo,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-box-segredo', c.segredo)
  );
end $$;

create or replace function box_push_testar(p_codigo text, p_endpoint text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform box_ok(p_codigo);
  perform box_push_disparar(jsonb_build_object('tipo', 'teste', 'endpoint', p_endpoint));
end $$;

-- O site chama depois de distribuir: avisa quem recebeu gente pra chamar.
create or replace function box_push_distribuicao(p_codigo text, p_evento uuid, p_diretores uuid[]) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform box_ok(p_codigo);
  if coalesce(array_length(p_diretores, 1), 0) = 0 then
    return;
  end if;
  perform box_push_disparar(jsonb_build_object('tipo', 'distribuicao', 'evento', p_evento, 'diretores', to_jsonb(p_diretores)));
end $$;

-- ---------- monta as mensagens (usada só pela Edge Function) ----------
-- Devolve [{endpoint, p256dh, auth, titulo, corpo, url, tag}, ...]
create or replace function box_push_mensagens(p_tipo text, p_dados jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r jsonb := '[]'::jsonb;
begin
  if p_tipo = 'teste' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'endpoint', i.endpoint, 'p256dh', i.p256dh, 'auth', i.auth,
             'titulo', 'Notificações ativadas 🔔', 'corpo', 'Tudo certo! É assim que os avisos do Chamada BOX vão chegar.',
             'url', './', 'tag', 'teste')), '[]'::jsonb)
      into r from push_inscricoes i where i.endpoint = p_dados->>'endpoint';

  elsif p_tipo = 'distribuicao' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'endpoint', i.endpoint, 'p256dh', i.p256dh, 'auth', i.auth,
             'titulo', e.nome || ': sua lista chegou 📋',
             'corpo', 'Você tem ' || x.n || case when x.n = 1 then ' pessoa' else ' pessoas' end || ' pra chamar'
                      || coalesce(' até ' || to_char(e.data, 'DD/MM'), '') || '. Bora?',
             'url', './?tab=minha', 'tag', 'distribuicao-' || e.id)), '[]'::jsonb)
      into r
      from eventos e
      join lateral (select a.diretor_id, count(*) as n from atribuicoes a
                     where a.evento_id = e.id and a.status = 'pendente'
                       and a.diretor_id in (select (jsonb_array_elements_text(p_dados->'diretores'))::uuid)
                     group by a.diretor_id) x on true
      join push_inscricoes i on i.diretor_id = x.diretor_id and 'lembretes' = any (i.tipos)
     where e.id = (p_dados->>'evento')::uuid;

  elsif p_tipo = 'diario' then
    -- lembretes: eventos abertos daqui a 3 dias, amanhã ou hoje, pra quem ainda tem pendências
    select coalesce(jsonb_agg(jsonb_build_object(
             'endpoint', i.endpoint, 'p256dh', i.p256dh, 'auth', i.auth,
             'titulo', case e.data - hoje when 0 then 'É hoje: ' || e.nome || '! 🔥'
                                          when 1 then 'Amanhã tem ' || e.nome
                                          else 'Faltam ' || (e.data - hoje) || ' dias pro ' || e.nome end,
             'corpo', case e.data - hoje when 0 then 'Ainda dá tempo: '
                                         else '' end
                      || 'você ainda tem ' || x.n || case when x.n = 1 then ' pessoa' else ' pessoas' end || ' pra chamar.',
             'url', './?tab=minha', 'tag', 'lembrete-' || e.id)), '[]'::jsonb)
      into r
      from eventos e
      join lateral (select a.diretor_id, count(*) as n from atribuicoes a
                     where a.evento_id = e.id and a.status = 'pendente' group by a.diretor_id) x on true
      join push_inscricoes i on i.diretor_id = x.diretor_id and 'lembretes' = any (i.tipos)
     where not e.arquivado and e.data - hoje in (0, 1, 3);

    -- aniversários do dia (29/02 comemora em 28/02 nos anos não bissextos)
    r := r || coalesce((
      with aniversariantes as (
        select coalesce(nullif(trim(p.apelido), ''), p.nome) as nome
          from (select apelido, nome, nascimento from jovens where ativo
                union all select apelido, nome, nascimento from diretores where ativo) p
         where p.nascimento is not null
           and (to_char(p.nascimento, 'MM-DD') = to_char(hoje, 'MM-DD')
                or (to_char(p.nascimento, 'MM-DD') = '02-29' and to_char(hoje, 'MM-DD') = '02-28'
                    and extract(day from (date_trunc('year', hoje) + interval '2 months' - interval '1 day')) = 28))
      ), lista as (select string_agg(nome, ', ' order by nome) as nomes, count(*) as n from aniversariantes)
      select jsonb_agg(jsonb_build_object(
               'endpoint', i.endpoint, 'p256dh', i.p256dh, 'auth', i.auth,
               'titulo', '🎂 Hoje tem aniversário!',
               'corpo', case when l.n = 1 then 'Hoje é aniversário de ' || l.nomes || '. Manda os parabéns!'
                             else 'Hoje fazem aniversário: ' || l.nomes || '. Manda os parabéns!' end,
               'url', './?aniversarios', 'tag', 'aniversario-' || hoje))
        from push_inscricoes i, lista l
       where l.n > 0 and 'aniversarios' = any (i.tipos)), '[]'::jsonb);
  end if;
  return r;
end $$;

-- A função de envio apaga inscrições que o navegador invalidou.
create or replace function box_push_limpar(p_endpoints text[]) returns void
language sql security definer set search_path = public, extensions as $$
  delete from push_inscricoes where endpoint = any (p_endpoints);
$$;

revoke execute on function box_push_disparar(jsonb), box_push_mensagens(text, jsonb), box_push_limpar(text[])
  from public, anon, authenticated;
grant execute on function box_push_mensagens(text, jsonb), box_push_limpar(text[]) to service_role;
grant execute on function
  box_push_inscrever(text, uuid, text, text, text, text[]),
  box_push_remover(text, text),
  box_push_testar(text, text),
  box_push_distribuicao(text, uuid, uuid[])
to anon;

-- ---------- agendamento diário: 9h em Brasília = 12h UTC ----------
select cron.unschedule('box-notificacoes-diarias') where exists (select 1 from cron.job where jobname = 'box-notificacoes-diarias');
select cron.schedule('box-notificacoes-diarias', '0 12 * * *', $$select box_push_disparar('{"tipo": "diario"}'::jsonb)$$);

commit;

-- =====================================================================
-- Migração 009 — Exportar todos os dados (backup)
-- Rode uma vez no Supabase > SQL Editor, depois da 008.
-- Só cria uma função de leitura: nada é alterado ou apagado.
-- =====================================================================

-- Diferente do box_carregar, traz tudo: chamadas de eventos arquivados e o
-- histórico completo. Usada pelo botão "Backup dos dados" do site.
create or replace function box_exportar(p_codigo text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform box_ok(p_codigo);
  return jsonb_build_object(
    'exportado_em',   now(),
    'diretores',      coalesce((select jsonb_agg(to_jsonb(d) order by d.nome) from diretores d), '[]'::jsonb),
    'jovens',         coalesce((select jsonb_agg(to_jsonb(j) order by j.nome) from jovens j), '[]'::jsonb),
    'eventos',        coalesce((select jsonb_agg(to_jsonb(e) order by e.data) from eventos e), '[]'::jsonb),
    'atribuicoes',    coalesce((select jsonb_agg(to_jsonb(a)) from atribuicoes a), '[]'::jsonb),
    'presencas',      coalesce((select jsonb_agg(to_jsonb(p) order by p.em) from presencas p), '[]'::jsonb),
    'justificativas', coalesce((select jsonb_agg(to_jsonb(j) order by j.em) from justificativas j), '[]'::jsonb),
    'vinculos',       coalesce((select jsonb_agg(to_jsonb(v)) from vinculos v), '[]'::jsonb),
    'historico',      coalesce((select jsonb_agg(to_jsonb(h) order by h.em) from historico h), '[]'::jsonb)
  );
end $$;

grant execute on function box_exportar(text) to anon;

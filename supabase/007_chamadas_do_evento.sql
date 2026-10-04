-- =====================================================================
-- Migração 007 — Chamadas de um evento encerrado (pro resumo do culto)
-- Rode uma vez no Supabase > SQL Editor, depois da 006.
-- Só cria uma função de leitura: nada é alterado ou apagado.
-- =====================================================================

-- O box_carregar só traz as chamadas dos eventos abertos. Esta função
-- traz as de um evento específico (inclusive arquivado), sob demanda,
-- pra mostrar no resumo quem chamou quem.
create or replace function box_chamadas_evento(p_codigo text, p_evento uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform box_ok(p_codigo);
  return coalesce((select jsonb_agg(to_jsonb(a)) from atribuicoes a where a.evento_id = p_evento), '[]'::jsonb);
end $$;

grant execute on function box_chamadas_evento(text, uuid) to anon;

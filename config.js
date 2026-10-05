// Preencha com os dados do projeto no Supabase (Project Settings > API).
// A chave aqui é a "publishable"/"anon" — ela é pública por natureza; quem
// protege os dados é o código de acesso da diretoria.
// Com os campos vazios o site roda em MODO DEMONSTRAÇÃO (dados fictícios,
// salvos só no navegador).
window.BOX_CONFIG = {
  supabaseUrl: "https://iimlzzczkxdofrkeknto.supabase.co",
  supabaseKey: "sb_publishable_tvBzRcdbPUdycqHHqQ9P2g_7dXp5q5K",
  // Chave pública das notificações (VAPID). A privada fica só nos segredos do Supabase.
  vapidPublica: "BH5pISbryvJcoyzMSn2I9ReQskTdFjuF09Hf4kC5pT1UzJkA_Rz5PpVUC0p4PDeblT01eCoNX2YynZ9pC-GKQfY",
};

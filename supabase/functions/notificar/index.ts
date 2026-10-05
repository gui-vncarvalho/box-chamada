// Edge Function "notificar": entrega as notificações do Chamada BOX.
//
// Quem chama: o banco (pg_net), via box_push_disparar — no agendamento
// diário, no teste e depois de uma distribuição. Toda a regra de quem recebe
// o quê fica no banco (box_push_mensagens); aqui só se envia.
//
// Segredos (supabase secrets set ...):
//   BOX_SEGREDO        mesmo valor de push_config.segredo
//   VAPID_PUBLICA      chave pública (a mesma do config.js do site)
//   VAPID_PRIVADA      chave privada (nunca vai pro Git)
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm prontos nas Edge Functions.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SITE = 'https://gui-vncarvalho.github.io/box-chamada/';

webpush.setVapidDetails(SITE, Deno.env.get('VAPID_PUBLICA')!, Deno.env.get('VAPID_PRIVADA')!);

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

type Mensagem = { endpoint: string; p256dh: string; auth: string; titulo: string; corpo: string; url: string; tag: string };

Deno.serve(async req => {
  if (req.method !== 'POST' || req.headers.get('x-box-segredo') !== Deno.env.get('BOX_SEGREDO')) {
    return new Response('não autorizado', { status: 401 });
  }
  const { tipo, ...dados } = await req.json().catch(() => ({}));
  const { data, error } = await db.rpc('box_push_mensagens', { p_tipo: tipo, p_dados: dados });
  if (error) return new Response(`erro ao montar mensagens: ${error.message}`, { status: 500 });

  const mensagens = (data ?? []) as Mensagem[];
  const invalidas: string[] = [];
  let enviadas = 0;
  await Promise.all(mensagens.map(async m => {
    try {
      await webpush.sendNotification(
        { endpoint: m.endpoint, keys: { p256dh: m.p256dh, auth: m.auth } },
        JSON.stringify({ titulo: m.titulo, corpo: m.corpo, url: m.url, tag: m.tag }),
        { TTL: 12 * 3600, urgency: 'normal' },
      );
      enviadas++;
    } catch (e) {
      // 404/410: o navegador cancelou a inscrição (app desinstalado, permissão revogada…)
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) invalidas.push(m.endpoint);
      else console.error('falha no envio', status, (e as Error).message);
    }
  }));
  if (invalidas.length) await db.rpc('box_push_limpar', { p_endpoints: invalidas });

  return Response.json({ tipo, total: mensagens.length, enviadas, removidas: invalidas.length });
});

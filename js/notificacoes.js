// Notificações (Web Push): pedir permissão, inscrever o aparelho e o painel de controle.
// O envio é feito pelo servidor (Edge Function "notificar"); aqui é só o lado do aparelho.
import { falha, rpc } from './api.js';
import { diretor } from './dados.js';
import { confirmar } from './dialogos.js';
import { CFG, DEMO, LS, S } from './estado.js';
import { ICON } from './icones.js';
import { ehIOS, comoApp } from './pwa.js';
import { esc, nomeCurto, toast } from './util.js';

export const TIPOS_PUSH = [
  ['lembretes', 'Lembretes de chamada', 'Quando sua lista chega, 3 dias antes, 1 dia antes e no dia do evento, se ainda tiver gente pra chamar'],
  ['aniversarios', 'Aniversários', 'Às 9h, quem faz aniversário no dia'],
];

const tiposSalvos = () => { try { return JSON.parse(LS.get('push-tipos')) || TIPOS_PUSH.map(t => t[0]); } catch { return TIPOS_PUSH.map(t => t[0]); } };

// Estado do aparelho fica em S.push, atualizado por atualizarPush(): { situacao, inscricao }
// situacao: 'carregando' | 'sem-suporte' | 'instalar-ios' | 'bloqueada' | 'desligada' | 'ligada'

const suporta = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function atualizarPush() {
  if (ehIOS() && !comoApp()) S.push = { situacao: 'instalar-ios', inscricao: null };
  else if (!suporta() || !CFG.vapidPublica) S.push = { situacao: 'sem-suporte', inscricao: null };
  else if (Notification.permission === 'denied') S.push = { situacao: 'bloqueada', inscricao: null };
  else {
    const reg = await navigator.serviceWorker.ready;
    const inscricao = await reg.pushManager.getSubscription();
    S.push = { situacao: inscricao ? 'ligada' : 'desligada', inscricao };
  }
  return S.push;
}

function chaveVapid(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const bruto = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bruto, c => c.charCodeAt(0));
}

async function salvarNoServidor(inscricao, tipos = tiposSalvos()) {
  const j = inscricao.toJSON();
  await rpc('box_push_inscrever', {
    p_diretor: S.me, p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_tipos: tipos,
  });
}

// Tem que ser chamada a partir de um toque (o iPhone exige).
export async function ativarPush() {
  if (!diretor(S.me)) return toast('Escolha quem é você (no topo) antes de ativar.', true);
  try {
    const permissao = await Notification.requestPermission();
    if (permissao !== 'granted') {
      await atualizarPush();
      return toast(permissao === 'denied' ? 'Notificações bloqueadas. Dá pra liberar nas configurações do navegador.' : 'Tudo bem, dá pra ativar depois.');
    }
    const reg = await navigator.serviceWorker.ready;
    const inscricao = (await reg.pushManager.getSubscription())
      || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveVapid(CFG.vapidPublica) });
    await salvarNoServidor(inscricao);
    await atualizarPush();
    toast('Notificações ativadas neste aparelho 🔔');
  } catch (e) {
    console.error(e);
    falha(e);
  }
}

export async function desativarPush() {
  const ok = await confirmar({ titulo: 'Desativar notificações?', ok: 'Desativar', texto: 'Este aparelho para de receber os avisos. Dá pra ativar de novo quando quiser.' });
  if (!ok) return;
  try {
    const inscricao = S.push.inscricao;
    if (inscricao) {
      await rpc('box_push_remover', { p_endpoint: inscricao.endpoint }).catch(() => {});
      await inscricao.unsubscribe();
    }
    await atualizarPush();
    toast('Notificações desativadas');
  } catch (e) { falha(e); }
}

export async function alternarTipoPush(tipo) {
  const atuais = new Set(tiposSalvos());
  atuais.has(tipo) ? atuais.delete(tipo) : atuais.add(tipo);
  LS.set('push-tipos', JSON.stringify([...atuais]));
  if (S.push.inscricao) {
    try { await salvarNoServidor(S.push.inscricao, [...atuais]); } catch (e) { falha(e); }
  }
}

export async function testarPush() {
  if (!S.push.inscricao) return;
  try {
    await rpc('box_push_testar', { p_endpoint: S.push.inscricao.endpoint });
    toast('Enviado! A notificação chega em alguns segundos.');
  } catch (e) { falha(e); }
}

// Quem trocou de pessoa no aparelho continua recebendo, agora pela nova pessoa.
export async function trocouDePessoa() {
  if (S.push.inscricao && diretor(S.me)) await salvarNoServidor(S.push.inscricao).catch(() => {});
}

// Depois de distribuir: avisa quem recebeu gente nova pra chamar.
export function avisarDistribuicao(eventoId, diretores) {
  if (DEMO || !diretores.length) return;
  rpc('box_push_distribuicao', { p_evento: eventoId, p_diretores: [...new Set(diretores)] }).catch(() => {});
}

/* ---------- telas ---------- */
// Convite discreto na Minha lista (some ao ativar ou dispensar).
export function conviteNotificacoes() {
  if (S.push.situacao !== 'desligada' || LS.get('push-dispensado') || !diretor(S.me)) return '';
  return `
    <div class="instalar convite-push">
      <span class="push-ic">${ICON.sino}</span>
      <div class="instalar-txt">
        <strong>Quer um lembrete das suas chamadas?</strong>
        <small>Avisamos quando sua lista chegar e perto do evento, se ainda tiver gente pra chamar.</small>
      </div>
      <button class="btn primary small" data-act="push-ativar">Ativar</button>
      <button class="x" data-act="push-dispensar" aria-label="Agora não">${ICON.xis}</button>
    </div>`;
}

export function cartaoNotificacoes() {
  const sit = S.push.situacao;
  const eu = diretor(S.me);
  let corpo;
  if (sit === 'carregando') corpo = '<small>Verificando…</small>';
  else if (sit === 'instalar-ios') corpo = `<small>No iPhone, as notificações só funcionam com o app instalado: no Safari, toque em ${ICON.compartilhar} <b>Compartilhar</b> › <b>Adicionar à Tela de Início</b> e abra pelo ícone.</small>`;
  else if (sit === 'sem-suporte') corpo = '<small>Este navegador não suporta notificações. No Android use o Chrome; no iPhone, o app instalado.</small>';
  else if (sit === 'bloqueada') corpo = '<small>As notificações estão <b>bloqueadas</b> pra este site. Libere nas configurações do navegador (ícone do cadeado › Notificações) e volte aqui.</small>';
  else if (!eu) corpo = '<small>Escolha quem é você (no topo) pra ativar as notificações.</small>';
  else if (sit === 'desligada') {
    corpo = `
      <small>Receba neste aparelho os lembretes das suas chamadas e os aniversários do dia. Você escolhe o que quer e desativa quando quiser.</small>
      <div class="row-btns"><button class="btn primary" data-act="push-ativar">${ICON.sino}Ativar notificações</button></div>`;
  } else {
    const tipos = new Set(tiposSalvos());
    corpo = `
      <small>Ativadas neste aparelho para <b>${esc(nomeCurto(eu))}</b>.</small>
      <div class="push-tipos">${TIPOS_PUSH.map(([id, l, d]) => `
        <label class="switch-row">
          <span class="switch-txt"><strong>${l}</strong><small>${d}</small></span>
          <input type="checkbox" class="switch" role="switch" data-push-tipo="${id}" ${tipos.has(id) ? 'checked' : ''}>
        </label>`).join('')}</div>
      <div class="row-btns">
        <button class="btn" data-act="push-testar">Enviar um teste</button>
        <button class="btn danger" data-act="push-desativar">Desativar</button>
      </div>`;
  }
  return `
    <section class="push-cartao ${sit === 'ligada' ? 'ligada' : ''}">
      <div class="push-head"><span class="push-ic">${ICON.sino}</span><strong>Notificações</strong>
        ${sit === 'ligada' ? '<span class="pill st-confirmado">Ativadas</span>' : ''}</div>
      ${corpo}
    </section>`;
}

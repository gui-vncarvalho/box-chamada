// Fila offline das marcações de presença: sem internet, a marcação vale na hora
// na tela, fica guardada no aparelho e sobe sozinha quando a conexão volta.
import { rpc } from './api.js';
import { LS, S } from './estado.js';
import { ICON } from './icones.js';
import { plural } from './util.js';
import { toast } from './toast.js';

const CHAVE = 'fila-presenca';

export function fila() {
  try { return JSON.parse(LS.get(CHAVE) || '[]'); } catch { return []; }
}
const gravar = l => LS.set(CHAVE, l.length ? JSON.stringify(l) : null);

// Quem foi enviado depois de voltar a conexão (mostra "Enviado" por alguns segundos).
export const enviados = new Set();

const mesma = (a, b) => a.evento === b.evento && a.pessoa === b.pessoa && a.culto === b.culto;

// Falta de internet (e não erro do servidor, como lista encerrada).
export const erroDeRede = e => !navigator.onLine || e instanceof TypeError;

export function enfileirar(item) {
  const l = fila();
  const i = l.findIndex(x => mesma(x, item));
  // marcar e desmarcar sem internet se anulam: nada a enviar
  if (i >= 0 && l[i].presente !== item.presente) l.splice(i, 1);
  else if (i >= 0) l[i] = item;
  else l.push(item);
  gravar(l);
  atualizarFaixa();
}

// Marcação que subiu direto (com internet) substitui a que estava esperando.
export function tirarDaFila(item) {
  const l = fila();
  const resto = l.filter(x => !mesma(x, item));
  if (resto.length !== l.length) { gravar(resto); atualizarFaixa(); }
}

export const naFila = (pessoa, culto) => fila().some(x => x.evento === S.eventoId && x.pessoa === pessoa && x.culto === culto);

// Reaplica a fila sobre os dados que vieram do servidor (o carregamento não conhece o que está guardado aqui).
export function aplicarFila(data) {
  for (const x of fila()) {
    const ehDele = p => p.evento_id === x.evento && (p.jovem_id || p.diretor_id) === x.pessoa && (p.culto || 'geral') === x.culto;
    data.presencas = data.presencas.filter(p => !ehDele(p));
    if (x.presente) {
      data.presencas.push({
        id: 'fila-' + x.pessoa + x.culto, evento_id: x.evento, culto: x.culto, marcado_por: x.quem, em: x.em,
        jovem_id: x.tipo === 'jovem' ? x.pessoa : null, diretor_id: x.tipo === 'diretor' ? x.pessoa : null,
      });
    }
  }
}

let enviando = false;
export async function enviarFila(aoTerminar) {
  if (enviando || !navigator.onLine || !S.codigo) return;
  let l = fila();
  if (!l.length) return atualizarFaixa();
  enviando = true;
  atualizarFaixa();
  let ok = 0;
  let perdidas = 0;
  for (const x of [...l]) {
    try {
      await rpc('box_presenca', { p_evento: x.evento, p_jovem: x.pessoa, p_presente: x.presente, p_quem: x.quem, p_culto: x.culto });
      ok++;
      enviados.add(x.pessoa);
    } catch (e) {
      if (erroDeRede(e)) break; // caiu de novo: o resto espera a próxima
      perdidas++; // ex.: a lista foi encerrada enquanto estava sem internet
    }
    l = fila().filter(y => !mesma(y, x));
    gravar(l);
  }
  enviando = false;
  atualizarFaixa();
  if (ok) toast('Conexão de volta', { texto: `${plural(ok, 'marcação enviada', 'marcações enviadas')}` });
  if (perdidas) toast(`${plural(perdidas, 'marcação não entrou', 'marcações não entraram')}`, { tipo: 'erro', texto: 'A lista foi encerrada enquanto você estava sem internet.' });
  if (ok || perdidas) {
    await aoTerminar?.();
    setTimeout(() => { enviados.clear(); aoTerminar?.(); }, 8000);
  }
}

// Faixa fixa no topo: "Sem conexão · N marcações aguardando envio".
export function atualizarFaixa() {
  let el = document.getElementById('offline');
  const n = fila().length;
  const off = !navigator.onLine;
  document.body.classList.toggle('com-faixa', off || !!n);
  if (!off && !n) { el?.remove(); return; }
  if (!el) {
    el = Object.assign(document.createElement('div'), { id: 'offline', className: 'faixa-offline' });
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.prepend(el);
  }
  const txt = off
    ? `<strong>Sem conexão</strong>${n ? ` · ${plural(n, 'marcação aguardando envio', 'marcações aguardando envio')}` : ' · as marcações de presença ficam guardadas'}`
    : `<strong>Enviando</strong> · ${plural(n, 'marcação', 'marcações')}…`;
  el.innerHTML = `${ICON.semWifi}<span>${txt}</span>`;
}

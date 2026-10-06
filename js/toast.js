// Avisos (toasts): sucesso, informação, aviso e erro, empilhados (máx. 3),
// com barra de tempo, ação opcional ("Desfazer", "Tentar") e pausa no toque/hover.
//
//   toast('Lista copiada')                                  → sucesso
//   toast('Não deu pra salvar', true)                       → erro (compatível com o jeito antigo)
//   toast('Arthur: Confirmou', { texto: 'Marcado na sua lista', acao: { rotulo: 'Desfazer', fn } })
//   toast('Sem conexão', { tipo: 'aviso', id: 'offline', persistente: true })
import { ICON } from './icones.js';
import { esc } from './util.js';

const MAX = 3;
const DURACAO = 5000;
const ICONES = { sucesso: 'check', info: 'info', aviso: 'alerta', erro: 'xis' };

// referência fixa: se o modal que hospeda os avisos for redesenhado, a pilha volta pro lugar
let caixa = null;
function pilha() {
  if (!caixa) {
    caixa = document.getElementById('toasts') || Object.assign(document.createElement('div'), { id: 'toasts' });
    caixa.setAttribute('aria-live', 'polite');
  }
  if (!caixa.isConnected) document.body.append(caixa);
  return caixa;
}

// Com um modal aberto o resto da página fica inerte (e atrás do fundo escuro):
// os avisos passam a morar dentro do modal do topo e voltam pro body quando ele fecha.
function hospedar() {
  if (!caixa) return;
  const topo = [...document.querySelectorAll('dialog[open]:not(.fechando)')].pop();
  const casa = topo || document.body;
  if (caixa.parentElement !== casa) casa.append(caixa);
  caixa.classList.toggle('em-dlg', !!topo);
}
new MutationObserver(hospedar).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'class'] });

export function fecharToast(no) {
  if (!no || no.classList.contains('saindo')) return;
  clearTimeout(no._timer);
  no.classList.add('saindo');
  setTimeout(() => no.remove(), 220);
}

// Remove um aviso persistente pelo id (ex.: o de "sem conexão" quando a internet volta).
export function fecharToastId(id) {
  pilha().querySelectorAll(`[data-toast-id="${id}"]:not(.saindo)`).forEach(fecharToast);
}

export function toast(titulo, opcoes = {}) {
  const o = opcoes === true ? { tipo: 'erro' } : opcoes || {};
  const tipo = o.tipo || 'sucesso';
  pilha();
  hospedar();
  if (o.id) fecharToastId(o.id);
  const no = document.createElement('div');
  no.className = `toast t-${tipo}`;
  no.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  if (o.id) no.dataset.toastId = o.id;
  const duracao = o.persistente ? 0 : o.duracao || (tipo === 'erro' ? 6000 : DURACAO);
  no.innerHTML = `
    <span class="toast-ic" aria-hidden="true">${ICON[ICONES[tipo]] || ''}</span>
    <span class="toast-txt"><strong>${esc(titulo)}</strong>${o.texto ? `<small>${esc(o.texto)}</small>` : ''}</span>
    ${o.acao ? `<button class="toast-acao">${esc(o.acao.rotulo)}</button>` : ''}
    ${duracao ? `<span class="toast-tempo" style="animation-duration:${duracao}ms"></span>` : ''}`;
  if (o.acao) {
    no.querySelector('.toast-acao').onclick = e => { e.stopPropagation(); fecharToast(no); o.acao.fn(); };
  }
  no.onclick = () => fecharToast(no); // tocar no aviso fecha
  caixa.append(no);
  // máximo de 3 na tela: sai o mais antigo
  const todos = [...caixa.querySelectorAll('.toast:not(.saindo)')];
  todos.slice(0, Math.max(0, todos.length - MAX)).forEach(fecharToast);

  if (duracao) {
    let restante = duracao;
    let inicio = Date.now();
    const agendar = () => { inicio = Date.now(); no._timer = setTimeout(() => fecharToast(no), restante); };
    const pausar = () => { clearTimeout(no._timer); restante -= Date.now() - inicio; no.classList.add('pausado'); };
    const voltar = () => { no.classList.remove('pausado'); agendar(); };
    no.addEventListener('mouseenter', pausar);
    no.addEventListener('mouseleave', voltar);
    no.addEventListener('touchstart', pausar, { passive: true });
    no.addEventListener('touchend', voltar);
    agendar();
  }
  return no;
}

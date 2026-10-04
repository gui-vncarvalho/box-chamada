// Ponto de entrada: liga os eventos e carrega os dados.
import { aoClicar, aoDigitar, aoEnviar, sair } from './acoes.js';
import { proximoAniver } from './aniversarios.js';
import { carregar } from './api.js';
import { buscaInteligente } from './busca.js';
import { evento } from './dados.js';
import { dlg, fecharDlg } from './dialogos.js';
import { DEMO, LS, POLL_MS, S } from './estado.js';
import { iniciarPWA } from './pwa.js';
import { render } from './render.js';
import { presenca } from './telas/presenca.js';
import { contagem, digitos, faixa, horaPara, idade, mensagem, semAcento } from './util.js';
import { textoVinculo, vinculosDe } from './vinculos.js';

/* Atualização automática: busca o que os outros marcaram. */
export async function poll() {
  if (!S.codigo || !S.data || document.hidden || dlg().open) return;
  const ativo = document.activeElement;
  if (ativo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ativo.tagName)) return;
  try {
    await carregar();
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  } catch (e) {
    if (e.codigoInvalido) sair('O código de acesso mudou. Entre de novo.');
  }
}

document.addEventListener('click', aoClicar);
document.addEventListener('input', aoDigitar);
document.addEventListener('submit', aoEnviar);
iniciarPWA();

dlg().addEventListener('close', () => { S.dlg = null; });

dlg().addEventListener('click', e => { if (e.target === dlg()) fecharDlg(); });

dlg().addEventListener('cancel', e => { e.preventDefault(); fecharDlg(); });

setInterval(poll, POLL_MS);

document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });

// Gancho pros testes automatizados (só no modo demonstração).
if (DEMO) {
  window.__box = {
    S, render, carregar, faixa, idade, mensagem, evento, proximoAniver, digitos,
    vinculosDe, textoVinculo, semAcento, presenca, contagem, horaPara, buscaInteligente,
  };
}

const LOADER_MIN_MS = 1200;

(async function iniciar() {
  if (S.codigo) {
    try { await carregar(); }
    catch (e) {
      if (e.codigoInvalido) { S.codigo = null; LS.set('codigo', null); S.erroLogin = 'O código de acesso mudou. Entre de novo.'; }
      else S.erroLogin = 'Não consegui conectar. Confira a internet e recarregue.';
      S.data = null;
    }
  }
  render();
  // a tela de carregamento só existe na entrada: fica no mínimo LOADER_MIN_MS
  // (pra dar pra ver), depois some com um fade por cima da primeira tela já pronta
  const ld = document.getElementById('carregando');
  if (ld) {
    setTimeout(() => {
      ld.classList.add('saindo');
      setTimeout(() => ld.remove(), 500);
    }, Math.max(0, LOADER_MIN_MS - performance.now()));
  }
})();

// Aba Histórico.
import { diretor, evento, jovem } from '../dados.js';
import { S } from '../estado.js';
import { ICON } from '../icones.js';
import { $, esc, plural, tempoAtras } from '../util.js';
import { viewPresencasHist } from '../frequencia.js';

export const HIST_ICON = { chamado: 'tel', confirmado: 'check', nao_vai: 'xis', pendente: 'desfazer', presente: 'entrada', ausente: 'desfazer' };

export function fraseHist(x) {
  const quem = `<strong>${esc(x.quem)}</strong>`;
  const jov = `<strong>${esc(x.jovem)}</strong>`;
  const outro = x.diretor && x.diretor !== x.quem ? x.diretor : null;
  if (x.status === 'presente') return [`${jov} chegou`, `presença marcada por ${esc(x.quem)}`];
  if (x.status === 'ausente') return [`${quem} desmarcou a presença de ${jov}`, ''];
  if (x.status === 'chamado') {
    return [`${quem} chamou ${jov}`, outro ? `pela lista de ${esc(outro)}` : ''];
  }
  if (x.status === 'confirmado' || x.status === 'nao_vai') {
    return [`${jov} ${x.status === 'confirmado' ? 'confirmou presença' : 'não vai'}`,
      `marcado por ${esc(x.quem)}${outro ? ` · lista de ${esc(outro)}` : ''}`];
  }
  return [`${quem} desfez a marcação de ${jov}`, outro ? `da lista de ${esc(outro)}` : ''];
}

export function diaHist(iso) {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(Date.now() - 86400000);
  const mesmo = (a, b) => a.toDateString() === b.toDateString();
  if (mesmo(d, hoje)) return 'Hoje';
  if (mesmo(d, ontem)) return 'Ontem';
  const t = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function modos() {
  const m = S.histModo === 'presencas' ? 'presencas' : 'marcacoes';
  return `
    <div class="hist-modos" role="tablist" aria-label="Histórico">
      <button role="tab" data-act="hist-modo" data-id="marcacoes" aria-selected="${m === 'marcacoes'}">Marcações</button>
      <button role="tab" data-act="hist-modo" data-id="presencas" aria-selected="${m === 'presencas'}">Presenças</button>
    </div>`;
}

export function viewHistorico() {
  // sem evento aberto, só faz sentido o histórico de presenças
  if (!evento()) return viewPresencasHist();
  return modos() + (S.histModo === 'presencas' ? viewPresencasHist() : viewMarcacoes());
}

function viewMarcacoes() {
  const eu = diretor(S.me);
  let h = S.data.historico.filter(x => x.evento_id === S.eventoId);
  // cliques repetidos viram uma entrada só
  h = h.filter((x, i) => {
    const ant = h[i - 1];
    return !ant || ant.quem !== x.quem || ant.jovem !== x.jovem || ant.diretor !== x.diretor || ant.status !== x.status;
  });
  const total = h.length;
  if (eu && S.histFiltro === 'meus') h = h.filter(x => x.quem === eu.nome || x.diretor === eu.nome);

  const topo = `
    <div class="hist-top">
      <span class="dim small">${plural(total, 'marcação', 'marcações')} neste evento</span>
      ${eu ? `<div class="seg-mini" role="group" aria-label="Filtrar histórico">
        <button data-act="hist-filtro" data-id="todos" aria-pressed="${S.histFiltro !== 'meus'}">Todos</button>
        <button data-act="hist-filtro" data-id="meus" aria-pressed="${S.histFiltro === 'meus'}">Meus</button>
      </div>` : ''}
    </div>`;
  if (!h.length) {
    return topo + `<div class="vazio"><p>${total ? 'Nenhuma marcação sua ou da sua lista ainda.' : 'Nenhuma marcação ainda. O histórico aparece aqui assim que a equipe começar.'}</p></div>`;
  }

  const dias = [];
  for (const x of h.slice(0, 200)) {
    const d = diaHist(x.em);
    if (!dias.length || dias[dias.length - 1][0] !== d) dias.push([d, []]);
    dias[dias.length - 1][1].push(x);
  }
  return topo + dias.map(([dia, itens]) => `
    <section class="grupo">
      <h4 class="grupo-titulo">${dia} <span>${itens.length}</span></h4>
      <ol class="timeline">${itens.map(x => {
        const [frase, sub] = fraseHist(x);
        const j = S.data.jovens.find(y => y.nome === x.jovem);
        const hora = new Date(x.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const recente = Date.now() - new Date(x.em) < 3600000;
        return `<li class="tl st-${x.status}">
          <span class="tl-ic" aria-hidden="true">${ICON[HIST_ICON[x.status]] || ''}</span>
          <${j ? `button data-act="jovem" data-id="${j.id}"` : 'div'} class="tl-corpo">
            <span class="tl-txt"><span>${frase}</span>${sub ? `<small>${sub}</small>` : ''}</span>
            <time datetime="${esc(x.em)}" title="${esc(new Date(x.em).toLocaleString('pt-BR'))}">${recente ? tempoAtras(x.em) : hora}</time>
          </${j ? 'button' : 'div'}>
        </li>`;
      }).join('')}</ol>
    </section>`).join('');
}

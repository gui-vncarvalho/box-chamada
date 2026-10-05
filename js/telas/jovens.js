// Aba Jovens.
import { badgeAniver } from '../aniversarios.js';
import { buscaInteligente } from '../busca.js';
import { diretor, evento, jovem, porJovem, statusJovem } from '../dados.js';
import { S, STATUS_BY_ID } from '../estado.js';
import { ICON } from '../icones.js';
import { presenca } from './presenca.js';
import { $, byNome, elegivel, esc, faixa, faixaBadge, iniciais, nomeCurto, subNome, semAcento } from '../util.js';

export const PAG_JOVENS = 20;

export function linhasJovens() {
  const pj = porJovem();
  return [...pj.keys()]
    .map(id => ({ j: jovem(id), l: pj.get(id) }))
    .filter(r => r.j)
    .map(r => ({ ...r, s: statusJovem(r.l) }))
    .filter(r => S.faixaJ === 'todas' || faixa(r.j) === S.faixaJ);
}

export const passaFiltro = (r, f) => f === 'todos' || r.s === f || (f === 'aberto' && (r.s === 'pendente' || r.s === 'chamado'));

export function cardJovem({ j, l, s }) {
  return `
    <button class="jcard st-${s}" data-act="jovem" data-id="${j.id}">
      <span class="avatar" aria-hidden="true">${esc(iniciais(j.nome))}</span>
      <span class="jcard-txt">
        <span class="jcard-nome"><strong>${esc(nomeCurto(j))}</strong>${faixa(j) ? faixaBadge(j) : ''}${presenca(j.id) ? '<span class="veio">Veio</span>' : ''}${badgeAniver(j)}</span>${subNome(j)}
        <span class="jcard-resp">${l.length ? l.map(a => `<span class="st-${a.status}"><span class="dot"></span>${esc(nomeCurto(diretor(a.diretor_id)))}${a.status === 'pendente' ? '' : ' · ' + STATUS_BY_ID[a.status].label}</span>`).join('') : '<span class="dim">Sem responsável</span>'}</span>
      </span>
      <span class="pill st-${s}">${s === 'pendente' ? 'Ninguém chamou' : STATUS_BY_ID[s].label}</span>
    </button>`;
}

export function htmlListaJovens() {
  const q = semAcento(S.busca);
  const busca = buscaInteligente(S.busca);
  const rows = linhasJovens()
    .filter(r => passaFiltro(r, S.filtro) && busca(r.j))
    .sort((a, b) => byNome(a.j, b.j));
  if (!rows.length) {
    return `<div class="vazio"><p>${q ? `Ninguém encontrado com “${esc(S.busca.trim())}”.` : 'Ninguém nesse filtro.'}</p></div>`;
  }
  const visiveis = rows.slice(0, S.limJ);
  const faltam = rows.length - visiveis.length;
  return `
    <div class="jgrid">${visiveis.map(cardJovem).join('')}</div>
    <div class="jrodape">
      ${faltam ? `<div id="jmais" class="jmais"><span class="spinner" aria-hidden="true"></span>Carregando mais…</div>` : ''}
      <span class="dim small">Mostrando ${visiveis.length} de ${rows.length}</span>
    </div>`;
}

export function viewJovens() {
  const ev = evento();
  const rows = linhasJovens();
  const filtros = [['todos', 'Todos'], ['aberto', 'Sem resposta'], ['confirmado', 'Confirmados'], ['nao_vai', 'Não vão']];
  const pjTodos = porJovem();
  const semResp = S.data.jovens.filter(j => elegivel(j, ev) && !pjTodos.has(j.id)).sort(byNome);
  const faixas = [['todas', 'Todas'], ['box', 'Box'], ['sprint', 'Sprint']];

  return `
    <div class="jtoolbar">
      <label class="busca">${ICON.lupa}
        <input type="search" id="busca" placeholder="Nome, 18, box, casado, outubro…" value="${esc(S.busca)}" aria-label="Buscar jovem" autocomplete="off">
      </label>
      <div class="jfiltros">
        <div class="chips" role="group" aria-label="Filtrar por status">${filtros.map(([id, l]) => `
          <button class="chip" data-act="filtro" data-id="${id}" aria-pressed="${S.filtro === id}">${l}<span class="c">${rows.filter(r => passaFiltro(r, id)).length}</span></button>`).join('')}
        </div>
        ${ev.publico === 'todos' ? `<div class="seg-mini" role="group" aria-label="Filtrar por faixa">${faixas.map(([id, l]) => `
          <button data-act="faixa-j" data-id="${id}" aria-pressed="${S.faixaJ === id}">${l}</button>`).join('')}</div>` : ''}
      </div>
    </div>
    <div id="jlista">${htmlListaJovens()}</div>
    ${semResp.length ? `
      <section class="grupo">
        <h4 class="grupo-titulo">Sem responsável <span>${semResp.length}</span></h4>
        <p class="dim small" style="margin:-4px 0 10px">Toque pra escolher quem chama, ou use "Distribuir quem falta" em Gerenciar.</p>
        <div class="jgrid">${semResp.map(j => cardJovem({ j, l: [], s: 'pendente' }).replace('Ninguém chamou', 'Definir')).join('')}</div>
      </section>` : ''}`;
}

export let obsJovens;

export function ligarScrollInfinito() {
  obsJovens?.disconnect();
  const el = $('#jmais');
  if (!el) return;
  obsJovens = new IntersectionObserver(entradas => {
    if (entradas.some(e => e.isIntersecting)) {
      S.limJ += PAG_JOVENS;
      atualizarListaJovens();
    }
  }, { rootMargin: '400px 0px' });
  obsJovens.observe(el);
}

export function atualizarListaJovens() {
  const c = $('#jlista');
  if (!c) return;
  c.innerHTML = htmlListaJovens();
  ligarScrollInfinito();
}

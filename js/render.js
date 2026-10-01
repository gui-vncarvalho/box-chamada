// Esqueleto da tela: topo, card do evento e abas.
import { renderAniver } from './aniversarios.js';
import { atribs, diretor, evento, eventosAtivos, jovem, porJovem, statusJovem } from './dados.js';
import { demo } from './demo.js';
import { abrirDlg, dlg } from './dialogos.js';
import { distribuir } from './distribuir.js';
import { DEMO, S } from './estado.js';
import { ICON } from './icones.js';
import { renderGate, renderQuem } from './telas/entrada.js';
import { viewEquipe } from './telas/equipe.js';
import { viewGerenciar } from './telas/gerenciar.js';
import { viewHistorico } from './telas/historico.js';
import { ligarScrollInfinito, viewJovens } from './telas/jovens.js';
import { viewMinha } from './telas/minha.js';
import { presenca, presencaLiberada, viewPresenca } from './telas/presenca.js';
import { $, celular, contagem, dataEvento, esc, horaGeral, plural, PUBLICO_LABEL, quandoEvento } from './util.js';
import { pessoa } from './vinculos.js';

export function render() {
  if (!S.codigo || !S.data) return renderGate();
  if (!S.me) return renderQuem();

  const ev = evento();
  const evs = eventosAtivos();
  const eu = diretor(S.me);
  const minhasPend = ev ? atribs().filter(a => a.diretor_id === S.me && a.status === 'pendente').length : 0;
  const tabs = [
    ['minha', 'Minha', minhasPend],
    ...(presencaLiberada(ev) ? [['presenca', 'Presença']] : []),
    ['equipe', 'Equipe'],
    ['jovens', 'Jovens'],
    ['historico', 'Histórico'],
    ['gerenciar', 'Gerenciar'],
  ].filter(([id]) => id !== 'minha' || eu);
  if (!tabs.find(t => t[0] === S.tab)) S.tab = tabs[0][0];

  $('#app').innerHTML = `
    ${DEMO ? '<div class="demo-banner">Modo demonstração: dados fictícios salvos só neste navegador.</div>' : ''}
    <header class="topo">
      <div class="marca">
        <div>
          <div class="marca-nome">Chamada</div>
          <div class="marca-sub">Diretoria · Juventude Box</div>
        </div>
      </div>
      <button class="me-chip" data-act="trocar-eu" title="Trocar pessoa">${ICON.user}<span>${esc(eu ? eu.nome : 'Visitante')}</span></button>
    </header>
    ${renderHero(ev, evs)}
    ${renderAniver()}
    <nav class="tabs" role="tablist">
      ${tabs.map(([id, label, n]) => `
        <button class="tab" role="tab" data-act="tab" data-id="${id}" aria-selected="${S.tab === id}">
          <span class="tab-ic">${TAB_ICON[id]}</span>
          <span class="tab-lbl">${label}</span>${n ? `<span class="n" aria-label="${n} pendentes">${n}</span>` : ''}
        </button>`).join('')}
    </nav>
    <main id="view">${renderView()}</main>`;
  ligarScrollInfinito();
}

export const TAB_ICON = {
  get minha() { return ICON.lista; },
  get presenca() { return ICON.entrada; },
  get equipe() { return ICON.grupo; },
  get jovens() { return ICON.jovens; },
  get historico() { return ICON.relogio; },
  get gerenciar() { return ICON.engrenagem; },
};

// Leva a tela pro começo do conteúdo da aba (sem esconder atrás das abas fixas no desktop).
export function rolarParaConteudo({ sempre = false, suave = false } = {}) {
  const view = $('#view');
  if (!view) return;
  const folga = celular() ? 12 : $('.tabs').offsetHeight + 20;
  const alvo = view.getBoundingClientRect().top + window.scrollY - folga;
  if (sempre || window.scrollY > alvo) window.scrollTo({ top: alvo, behavior: suave ? 'smooth' : 'auto' });
}

export function renderView() {
  if (S.tab === 'gerenciar') return viewGerenciar();
  if (!evento()) {
    return `<div class="vazio"><p>Nenhum evento aberto ainda.</p>
      <button class="btn primary" data-act="novo-evento">Criar evento</button></div>`;
  }
  if (S.tab === 'minha') return viewMinha();
  if (S.tab === 'equipe') return viewEquipe();
  if (S.tab === 'jovens') return viewJovens();
  if (S.tab === 'historico') return viewHistorico();
  if (S.tab === 'presenca') return viewPresenca();
  return '';
}

export function chipsEvento(ev) {
  const data = dataEvento(ev);
  return [
    data && [ICON.cal, data.charAt(0).toUpperCase() + data.slice(1)],
    horaGeral(ev) && [ICON.relogio, horaGeral(ev)],
    [ICON.grupo, PUBLICO_LABEL[ev.publico]],
    [ICON.tel, plural(ev.chamadas_por_jovem, 'chamada', 'chamadas') + ' por jovem'],
  ].filter(Boolean).map(([ic, t]) => `<li>${ic}<span>${esc(t)}</span></li>`).join('');
}

export function renderHero(ev, evs) {
  if (!ev) {
    return `<section class="hero hero-vazio">
      <div><div class="eyebrow">Evento</div><h2 class="ev-nome">Nenhum evento aberto</h2>
      <p class="dim">Crie o próximo culto pra distribuir as chamadas.</p></div>
      <div><button class="btn primary" data-act="novo-evento">+ Criar evento</button></div>
    </section>`;
  }
  const cd = contagem(ev);
  const lista = atribs();
  const feitas = lista.filter(a => a.status !== 'pendente').length;
  const pct = lista.length ? Math.round((feitas / lista.length) * 100) : 0;
  const pj = porJovem(lista);
  const cont = { confirmado: 0, nao_vai: 0, aberto: 0 };
  for (const l of pj.values()) {
    const st = statusJovem(l);
    if (st === 'confirmado' || st === 'nao_vai') cont[st]++;
    else cont.aberto++;
  }
  const tile = (st, filtro, n, label) => `
    <button class="tile st-${st}" data-act="ver-filtro" data-id="${filtro}" title="Ver na aba Jovens">
      <strong>${n}</strong><span><span class="dot"></span>${label}</span>
    </button>`;
  return `
    <section class="hero" aria-label="Evento selecionado">
      <div class="hero-ev">
        <div class="hero-label">
          <span class="eyebrow">Evento</span>
          ${cd ? `<span class="countdown cd-${cd[1]}">${cd[0]}</span>` : ''}
          ${evs.length > 1 ? `<button class="btn small trocar" data-act="trocar-evento">${ICON.trocar}Trocar evento</button>` : ''}
        </div>
        <h2 class="ev-nome">${esc(ev.nome)}</h2>
        <ul class="ev-chips">${chipsEvento(ev)}</ul>
        ${cd && cd[1] === 'hoje' && S.tab !== 'presenca' ? `<button class="btn presenca-cta" data-act="tab" data-id="presenca">${ICON.entrada}Marcar presença</button>` : ''}
      </div>
      <div class="hero-prog">
        <div class="eyebrow">Progresso das chamadas</div>
        <div class="prog-num">
          <strong>${feitas}</strong><span>de ${lista.length} feitas</span>
          <em>${pct}%</em>
        </div>
        <div class="pista" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Chamadas feitas">
          <div class="pista-fill" style="width:${pct}%"></div>
          <span class="bandeira">${ICON.bandeira}</span>
        </div>
        <div class="tiles">
          ${tile('confirmado', 'confirmado', cont.confirmado, cont.confirmado === 1 ? 'Confirmado' : 'Confirmados')}
          ${tile('nao_vai', 'nao_vai', cont.nao_vai, cont.nao_vai === 1 ? 'Não vai' : 'Não vão')}
          ${tile('pendente', 'aberto', cont.aberto, 'Sem resposta')}
        </div>
      </div>
    </section>`;
}

export function dlgEventos() {
  const evs = eventosAtivos().slice().sort((a, b) => (a.data || '9').localeCompare(b.data || '9'));
  abrirDlg(`
    <div class="dlg-head"><h2>Escolher evento</h2><button class="x" data-act="fechar" aria-label="Fechar">×</button></div>
    <div class="ev-opcoes">${evs.map(e => {
      const cd = contagem(e);
      const atual = e.id === S.eventoId;
      return `<button class="ev-opcao ${atual ? 'atual' : ''}" data-act="escolher-evento" data-id="${e.id}" aria-current="${atual}">
        <span class="ev-opcao-txt"><strong>${esc(e.nome)}</strong><small>${esc(quandoEvento(e) || 'sem data')} · ${PUBLICO_LABEL[e.publico]}</small></span>
        ${cd ? `<span class="countdown cd-${cd[1]}">${cd[0]}</span>` : ''}
        <span class="ev-check">${atual ? ICON.check : ''}</span>
      </button>`;
    }).join('')}</div>
    <div class="dlg-foot"><button class="btn small ghost" data-act="novo-evento">+ Novo evento</button><button class="btn small" data-act="fechar">Fechar</button></div>`);
}

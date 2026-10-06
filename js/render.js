// Esqueleto da tela: topo, card do evento e abas.
import { renderAniver } from './aniversarios.js';
import { cultosPassados, encerrada, resumoDe } from './frequencia.js';
import { atribs, diretor, evento, eventosAtivos, jovem } from './dados.js';
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
import { $, contagem, dataEvento, esc, horaGeral, iniciais, nomeCurto, plural, PUBLICO_LABEL, quandoEvento } from './util.js';
import { pessoa } from './vinculos.js';

export function render() {
  if (!S.codigo || !S.data) return renderGate();
  if (!S.me) return renderQuem();
  $('#app').className = 'wrap';

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

  const botaoAba = ([id, label, n], lateral) => `
    <button class="${lateral ? 'lat-item' : 'tab'}" ${lateral ? '' : 'role="tab"'} data-act="tab" data-id="${id}"
      ${lateral ? `aria-current="${S.tab === id ? 'page' : 'false'}"` : `aria-selected="${S.tab === id}"`}>
      <span class="tab-ic">${TAB_ICON[id]}</span>
      <span class="tab-lbl">${label}</span>${n ? `<span class="n" aria-label="${n} pendentes">${n}</span>` : ''}
    </button>`;
  const avatarEu = `<span class="eu-av" aria-hidden="true">${esc(iniciais(eu ? nomeCurto(eu) : 'V').slice(0, 1))}</span>`;

  $('#app').innerHTML = `
    <div class="casca">
      <aside class="lateral" aria-label="Navegação">
        <div class="lat-marca"><div class="marca-nome">Chamada</div><div class="marca-sub">Diretoria · Juventude Box</div></div>
        <nav class="lat-nav">${tabs.map(t => botaoAba(t, true)).join('')}</nav>
        <button class="lat-eu" data-act="trocar-eu" title="Trocar pessoa">${avatarEu}
          <span><strong>${esc(eu ? nomeCurto(eu) : 'Visitante')}</strong><small>${eu ? (eu.equipe === 'F' ? 'Equipe feminina' : 'Equipe masculina') : 'Só visualizando'}</small></span>
        </button>
      </aside>
      <div class="conteudo">
        ${DEMO ? '<div class="demo-banner">Modo demonstração: dados fictícios salvos só neste navegador.</div>' : ''}
        <header class="topo">
          <div class="marca">
            <div>
              <div class="marca-nome">Chamada</div>
              <div class="marca-sub">Diretoria · Juventude Box</div>
            </div>
          </div>
          <button class="me-chip" data-act="trocar-eu" title="Trocar pessoa">${avatarEu}<span>${esc(eu ? nomeCurto(eu) : 'Visitante')}</span></button>
        </header>
        ${renderHero(ev, evs)}
        ${renderAniver()}
        <nav class="tabs" role="tablist">${tabs.map(t => botaoAba(t, false)).join('')}</nav>
        <main id="view">${renderView()}</main>
      </div>
    </div>`;
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
  const folga = 16;
  const alvo = view.getBoundingClientRect().top + window.scrollY - folga;
  if (sempre || window.scrollY > alvo) window.scrollTo({ top: alvo, behavior: suave ? 'smooth' : 'auto' });
}

export function renderView() {
  if (S.tab === 'gerenciar') return viewGerenciar();
  if (S.tab === 'historico') return viewHistorico();
  if (!evento()) {
    return `<div class="vazio sem-evento">
      <p><strong>Nenhum evento aberto.</strong><br>Crie o próximo culto pra distribuir as chamadas.
        Os cultos que já passaram, com presença e chamadas, ficam no Histórico.</p>
      <div class="row-btns">
        <button class="btn" data-act="tab" data-id="historico">${ICON.relogio}Ver histórico</button>
        <button class="btn primary" data-act="novo-evento">${ICON.mais1}Criar evento</button>
      </div></div>`;
  }
  if (S.tab === 'minha') return viewMinha();
  if (S.tab === 'equipe') return viewEquipe();
  if (S.tab === 'jovens') return viewJovens();
  if (S.tab === 'presenca') return viewPresenca();
  return '';
}

// Sem evento aberto: convida pro próximo e mostra o último culto (ou como funciona).
function heroSemEvento() {
  const ultimo = cultosPassados().find(encerrada);
  let lado;
  if (ultimo) {
    const r = resumoDe(ultimo);
    const data = dataEvento(ultimo, { weekday: 'long', day: '2-digit', month: '2-digit' });
    lado = `
      <div class="eyebrow">Último culto</div>
      <div class="ultimo-culto">
        <strong>${esc(ultimo.nome)}</strong>
        <small>${esc(data.charAt(0).toUpperCase() + data.slice(1))}</small>
      </div>
      <div class="tiles">
        <div class="tile st-confirmado"><strong>${r.jovens}</strong><span>jovens</span></div>
        <div class="tile st-diretoria"><strong>${r.diretoria}</strong><span>diretoria</span></div>
        <div class="tile st-pendente"><strong>${r.confirmados_vieram}<small>/${r.confirmados}</small></strong><span>confirmados</span></div>
      </div>
      <button class="btn small ultimo-ver" data-act="resumo-culto" data-id="${ultimo.id}">Ver resumo ${ICON.chevron}</button>`;
  } else {
    lado = `
      <div class="eyebrow">Como funciona</div>
      <ol class="passos">
        <li><b>1</b>Crie o evento com data, horário e quem chamar.</li>
        <li><b>2</b>A distribuição de quem chama quem sai na hora.</li>
        <li><b>3</b>Cada um chama a sua lista e marca no site.</li>
      </ol>`;
  }
  return `
    <section class="hero hero-vazio" aria-label="Sem evento marcado">
      <div class="hero-ev">
        <div class="hero-label"><span class="eyebrow">Próxima largada</span></div>
        <h2 class="ev-nome">Sem evento marcado</h2>
        <p class="hero-vazio-txt">Crie o próximo culto e a distribuição das chamadas sai na hora.</p>
        <div class="hero-acao"><button class="btn hero-cta" data-act="novo-evento">${ICON.mais1}Criar evento</button></div>
      </div>
      <div class="hero-prog">${lado}</div>
    </section>`;
}

// Rótulo do selo do card: "Faltam 5 dias", "É amanhã", "É hoje!", "Já aconteceu".
function seloEvento(cd) {
  if (!cd) return null;
  const m = cd[0].match(/^Em (\d+) dias$/);
  return m ? `Faltam ${m[1]} dias` : cd[0] === 'Amanhã' ? 'É amanhã' : cd[0];
}

export function renderHero(ev, evs) {
  if (!ev) return heroSemEvento();
  const cd = contagem(ev);
  const lista = atribs();
  const feitas = lista.filter(a => a.status !== 'pendente').length;
  const minhas = lista.filter(a => a.diretor_id === S.me);
  const minhasFeitas = minhas.filter(a => a.status !== 'pendente').length;
  // a pista mostra o meu andamento; quem não tem lista vê o da equipe
  const [prog, total] = minhas.length ? [minhasFeitas, minhas.length] : [feitas, lista.length];
  const frac = total ? prog / total : 0;
  const pct = Math.round(frac * 100);
  const faltam = minhas.length ? minhas.length - minhasFeitas : lista.length - feitas;
  const meta = [dataEvento(ev, { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', ''), horaGeral(ev), PUBLICO_LABEL[ev.publico],
    plural(ev.chamadas_por_jovem, 'chamada', 'chamadas') + ' por jovem'].filter(Boolean).join(' · ');
  const selo = seloEvento(cd);
  return `
    <section class="hero hero-largada" aria-label="Evento selecionado">
      <div class="faixas" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="hero-corpo">
        <div class="hero-label">
          ${selo ? `<span class="selo-ev cd-${cd[1]}"><span class="dot"></span>${esc(selo)}</span>` : ''}
          ${evs.length > 1 ? `<button class="btn small trocar" data-act="trocar-evento">${ICON.trocar}Trocar evento</button>` : ''}
        </div>
        <h2 class="ev-nome">${esc(ev.nome)}</h2>
        <div class="ev-meta">${esc(meta.charAt(0).toUpperCase() + meta.slice(1))}</div>
        <div class="pista" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"
          aria-label="${minhas.length ? 'Suas chamadas feitas' : 'Chamadas feitas pela equipe'}: ${prog} de ${total}">
          <div class="pista-trilho"></div>
          <div class="pista-fill" style="--f:${frac}"></div>
          <span class="pista-capacete" style="--f:${frac}">${ICON.capacete}</span>
          <span class="pista-bandeira"></span>
        </div>
        <div class="hero-chips">
          ${minhas.length ? `<button class="hchip hchip-voce" data-act="tab" data-id="minha">Você <b>${minhasFeitas}/${minhas.length}</b></button>` : ''}
          <button class="hchip hchip-equipe" data-act="tab" data-id="equipe">Equipe <b>${feitas}/${lista.length}</b></button>
          <button class="hchip hchip-faltam" data-act="${minhas.length ? 'ver-pendentes' : 'ver-filtro'}" data-id="aberto">Faltam <b>${faltam}</b></button>
        </div>
        ${cd && cd[1] === 'passado' ? `<div class="hero-acao">
          <button class="btn hero-cta" data-act="encerrar-evento">${ICON.check}Encerrar evento</button>
          <small>Finaliza a chamada e guarda o resumo no histórico.</small></div>` : ''}
        ${cd && cd[1] === 'hoje' && S.tab !== 'presenca' ? `<button class="btn presenca-cta" data-act="tab" data-id="presenca">${ICON.entrada}Marcar presença</button>` : ''}
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

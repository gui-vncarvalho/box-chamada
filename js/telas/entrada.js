// Tela de entrada: código de acesso e "quem é você".
import { atribs } from '../dados.js';
import { DEMO, LS, S } from '../estado.js';
import { ICON } from '../icones.js';
import { $, esc, iniciais, nomeCurto, plural } from '../util.js';

const xadrez = lado => `<span class="xadrez ${lado}" aria-hidden="true"></span>`;

// semáforo de largada: n luzes acesas (vermelhas ou verdes) de um total
export const semaforo = (total, acesas, cor) => `
  <span class="semaforo" aria-hidden="true">${Array.from({ length: total }, (_, i) =>
    `<i class="${i < acesas ? cor : ''}"></i>`).join('')}</span>`;

const RECURSOS = [
  ['lista', 'Quem chama quem', 'Distribuição automática das chamadas'],
  ['entrada', 'Presença na porta', 'Marque com um toque no dia do culto'],
  ['relogio', 'Histórico', 'Cultos passados e quem sumiu'],
];

export function renderGate() {
  $('#app').className = 'entrada';
  $('#app').innerHTML = `
    <section class="gate-marca">
      ${xadrez('topo')}
      <span class="gate-faixas" aria-hidden="true"><i></i><i></i><i></i></span>
      <img class="gate-ic" src="icons/icon.svg" alt="" width="120" height="120">
      <h1 class="gate-nome">Chamada</h1>
      <p class="gate-sub">Diretoria · Juventude Box</p>
      <ul class="gate-recursos">${RECURSOS.map(([ic, t, d]) => `
        <li><span>${ICON[ic]}</span><span><strong>${t}</strong><small>${d}</small></span></li>`).join('')}
      </ul>
    </section>
    <section class="gate-form">
      <div class="gate-caixa">
        <ol class="etapas"><li class="ativa"><b>1</b>Código</li><li><b>2</b>Quem é você</li></ol>
        <div>
          <div class="gate-titulo"><h2>Bora <span>entrar?</span></h2>${semaforo(5, 3, 'vermelha')}</div>
          <p class="gate-txt">Central da diretoria do Box pra chamar a galera pros cultos e eventos.</p>
        </div>
        ${DEMO ? '<div class="demo-banner">Modo demonstração: qualquer código entra e os dados são fictícios.</div>' : ''}
        <form id="form-login">
          <label class="field" for="codigo">Código de acesso da diretoria</label>
          <div class="campo-codigo">
            ${ICON.chave}
            <input id="codigo" name="codigo" type="password" autocomplete="current-password" required autofocus
              placeholder="O código que a liderança passou">
            <button type="button" class="ver-codigo" data-act="ver-codigo" aria-label="Mostrar código" aria-pressed="false">${ICON.olho}</button>
          </div>
          <small class="gate-ajuda">Não tem o código? Peça pra liderança do Box.</small>
          <div class="erro" role="alert">${esc(S.erroLogin)}</div>
          <button class="btn primary btn-entrar" type="submit">Entrar${ICON.seta}</button>
        </form>
        <p class="gate-nota">${ICON.cadeado}Fica salvo neste aparelho. Só a diretoria acessa.</p>
      </div>
      ${xadrez('base')}
    </section>`;
}

// luzes do semáforo acendem em verde conforme o código é digitado
export function semaforoCodigo(valor) {
  const luzes = document.querySelectorAll('.gate-titulo .semaforo i');
  const verdes = Math.min(luzes.length - 1, valor.length);
  luzes.forEach((l, i) => { l.className = i < verdes ? 'verde' : !valor && i < 3 ? 'vermelha' : ''; });
}

export function renderQuem() {
  const ds = S.data.diretores.filter(d => d.ativo);
  const ultimo = ds.some(d => d.id === LS.get('ultimo-me')) ? LS.get('ultimo-me') : null;
  if (S.quemSel === undefined) S.quemSel = ultimo;
  const pend = id => atribs().filter(a => a.diretor_id === id && a.status === 'pendente').length;
  const cartao = d => {
    const n = pend(d.id);
    const sub = [d.id === ultimo ? 'Último acesso' : '', n ? plural(n, 'pendente', 'pendentes') : ''].filter(Boolean).join(' · ');
    return `
      <button class="quem-card ${d.id === ultimo ? 'lembrado' : ''}" data-act="quem-sel" data-id="${d.id}" aria-pressed="${S.quemSel === d.id}">
        <span class="avatar" aria-hidden="true">${esc(iniciais(d.nome))}</span>
        <span class="quem-txt"><strong>${esc(nomeCurto(d))}</strong>${sub ? `<small>${sub}</small>` : ''}</span>
        <span class="quem-check" aria-hidden="true">${ICON.check}</span>
      </button>`;
  };
  const grupo = (eq, t) => {
    const lista = ds.filter(d => d.equipe === eq);
    return lista.length ? `
      <div class="quem-grupo"><h3>${t}</h3><div class="pick-grid">${lista.map(cartao).join('')}</div></div>` : '';
  };
  const sel = ds.find(d => d.id === S.quemSel);
  $('#app').className = 'entrada quem';
  $('#app').innerHTML = `
    <div class="quem-corpo">
      <div class="quem-topo"><img src="icons/icon.svg" alt="" width="40" height="40"><span class="marca-nome">Chamada</span>${semaforo(3, 2, 'verde')}</div>
      <div>
        <h1 class="quem-titulo">Quem é <span>você?</span></h1>
        <p class="gate-txt">Assim o app mostra a sua lista e registra quem marcou cada chamada. Fica salvo neste aparelho.</p>
      </div>
      ${ds.length ? '' : '<p class="aviso">Ninguém da diretoria cadastrado ainda. Entre como visitante e cadastre em Gerenciar.</p>'}
      ${grupo('F', 'Equipe feminina')}
      ${grupo('M', 'Equipe masculina')}
      <button class="btn quem-visitante" data-act="sou" data-id="visitante">Não estou na lista · só visualizar</button>
    </div>
    ${sel ? `<div class="quem-barra"><button class="btn primary btn-entrar" data-act="sou" data-id="${sel.id}">Continuar como ${esc(nomeCurto(sel))}${ICON.seta}</button></div>` : ''}`;
}

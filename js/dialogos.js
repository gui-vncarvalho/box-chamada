// Modais: abrir/fechar com animação, confirmação, texto e detalhes do jovem.
import { atribs, diretor, evento, jovem, statusJovem } from './dados.js';
import { S } from './estado.js';
import { ICON } from './icones.js';
import { segStatus } from './telas/minha.js';
import { $, byNome, digitos, esc, faixa, faixaBadge, fmtTel, idade, iniciais, linkWhats, telIntl, tempoAtras } from './util.js';
import { chipsVinculos, ESTADO_LABEL, pessoa } from './vinculos.js';
import { htmlFrequencia } from './frequencia.js';
import { botaoJustificar } from './justificativas.js';

export const dlg = () => $('#dlg');

export const telaDeToque = () => matchMedia('(pointer: coarse)').matches;
export const semAnimacao = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function abrirDlg(html, estado, d = dlg()) {
  const novoTipo = (estado || { tipo: 'html' }).tipo;
  const trocou = d === dlg() && S.dlg && S.dlg.tipo !== novoTipo;
  if (d === dlg()) S.dlg = estado || { tipo: 'html' };
  d.classList.remove('fechando');
  if (d === dlg()) d.classList.toggle('dlg-largo', !!estado?.largo);
  const rolagem = !trocou && d.open ? d.scrollTop : 0;
  d.innerHTML = `<div class="dlg-body ${trocou ? 'troca' : ''}" tabindex="-1">${html}</div>`;
  if (!d.open) d.showModal();
  d.scrollTop = rolagem;
  // Foco no primeiro campo marcado (ou no corpo), nunca no botão de fechar.
  // Em tela de toque, focar um campo abre o teclado e esconde o modal: lá o foco
  // vai pro corpo e a pessoa toca no campo quando quiser.
  let alvo = d.querySelector('[autofocus]');
  if (alvo && telaDeToque() && alvo.matches('input:not([type=radio]):not([type=checkbox]), textarea, select')) alvo = null;
  (alvo || d.querySelector('.dlg-body')).focus({ preventScroll: true });
}

export function fecharDlg(d = dlg()) {
  if (!d.open) return Promise.resolve();
  if (d._fechando) return d._fechando;
  d._fechando = new Promise(res => {
    const fim = () => {
      if (!d.classList.contains('fechando')) return;
      d.classList.remove('fechando');
      d.close();
      d._fechando = null;
      res();
    };
    d.classList.add('fechando');
    if (semAnimacao()) return fim();
    d.addEventListener('animationend', fim, { once: true });
    setTimeout(fim, 320);
  });
  return d._fechando;
}

/* Confirmação e texto no lugar do confirm()/prompt() do navegador */
export function confirmar({ titulo, texto = '', ok = 'Confirmar', perigo = false }) {
  const d = $('#dlg2');
  return new Promise(res => {
    abrirDlg(`
      <div class="confirma">
        <span class="confirma-ic ${perigo ? 'perigo' : ''}">${perigo ? ICON.alerta : ICON.info}</span>
        <h2>${titulo}</h2>
        ${texto ? `<p>${texto}</p>` : ''}
      </div>
      <div class="dlg-foot fim">
        <button class="btn ghost" data-r="0">Cancelar</button>
        <button class="btn ${perigo ? 'danger-solid' : 'primary'}" data-r="1" autofocus>${ok}</button>
      </div>`, null, d);
    const responder = v => { d.onclick = d.oncancel = null; fecharDlg(d).then(() => res(v)); };
    d.onclick = e => {
      const b = e.target.closest('[data-r]');
      if (b) responder(b.dataset.r === '1');
      else if (e.target === d) responder(false);
    };
    d.oncancel = e => { e.preventDefault(); responder(false); };
  });
}

export function pedirTexto({ titulo, sub = '', valor = '', placeholder = '' }) {
  const d = $('#dlg2');
  return new Promise(res => {
    abrirDlg(`
      <form class="form-texto">
        <div class="dlg-head"><div><h2>${titulo}</h2>${sub ? `<p class="dlg-sub">${sub}</p>` : ''}</div></div>
        <textarea name="t" rows="3" placeholder="${esc(placeholder)}" autofocus>${esc(valor)}</textarea>
        <div class="dlg-foot fim">
          ${valor ? '<button type="button" class="btn danger" data-r="apagar" style="margin-right:auto">Apagar</button>' : ''}
          <button type="button" class="btn ghost" data-r="0">Cancelar</button>
          <button class="btn primary">Salvar</button>
        </div>
      </form>`, null, d);
    const form = d.querySelector('form');
    const ta = form.t;
    ta.setSelectionRange(ta.value.length, ta.value.length);
    const responder = v => { d.onclick = d.oncancel = null; fecharDlg(d).then(() => res(v)); };
    form.onsubmit = e => { e.preventDefault(); responder(ta.value.trim()); };
    ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); responder(ta.value.trim()); } };
    d.onclick = e => {
      const b = e.target.closest('[data-r]');
      if (b) responder(b.dataset.r === 'apagar' ? '' : null);
      else if (e.target === d) responder(null);
    };
    d.oncancel = e => { e.preventDefault(); responder(null); };
  });
}

export function renderDlgJovem(jid) {
  const j = jovem(jid);
  const ev = evento();
  if (!j || !ev) return fecharDlg();
  const lista = atribs().filter(a => a.jovem_id === jid)
    .sort((a, b) => byNome(diretor(a.diretor_id), diretor(b.diretor_id)));
  const minha = lista.find(a => a.diretor_id === S.me);
  const atuais = new Set(lista.map(a => a.diretor_id));
  const dirs = S.data.diretores.filter(d => d.ativo || atuais.has(d.id))
    .sort((a, b) => (a.equipe === j.genero ? 0 : 1) - (b.equipe === j.genero ? 0 : 1) || byNome(a, b));
  const s = statusJovem(lista);

  abrirDlg(`
    <div class="dlg-head">
      <div class="dlg-pessoa st-${s}">
        <span class="avatar" aria-hidden="true">${esc(iniciais(j.nome))}</span>
        <div><h2>${esc(j.nome)}</h2>
          <div class="pcard-meta">${[faixa(j) ? faixaBadge(j) : '<span>idade não informada</span>', digitos(j.telefone) ? `<span>${esc(fmtTel(j.telefone))}</span>` : '<span>sem telefone</span>'].join('<span class="sep" aria-hidden="true">·</span>')}</div>
        </div>
      </div>
      <button class="x" data-act="fechar" aria-label="Fechar">${ICON.xis}</button>
    </div>
    ${j.obs ? `<p class="pcard-obs">${esc(j.obs)}</p>` : ''}
    <div class="vinc-det">
      <div class="vinc-secao-head"><span class="eyebrow">Família e vínculos${j.estado_civil ? ` · ${ESTADO_LABEL[j.estado_civil][j.genero]}` : ''}</span>
        <button class="link-btn" data-act="vinc-novo" data-id="${j.id}">+ Vínculo</button></div>
      ${chipsVinculos(j.id, true)}
    </div>
    <div class="vinc-det">
      <div class="vinc-secao-head"><span class="eyebrow">Presença</span>
        ${s === 'nao_vai' ? `<span class="small">Motivo de não ir: ${botaoJustificar(ev.id, j.id)}</span>` : ''}</div>
      ${htmlFrequencia(j.id)}
    </div>
    ${digitos(j.telefone) ? `<div class="acoes">
      <a class="btn wa" href="${esc(linkWhats(ev, j))}" target="_blank" rel="noopener" data-act="contato" ${minha ? `data-id="${minha.id}"` : ''}>${ICON.wa}WhatsApp</a>
      <a class="btn" href="tel:+${telIntl(j.telefone)}" data-act="contato" ${minha ? `data-id="${minha.id}"` : ''}>${ICON.tel}Ligar</a>
    </div>` : `<button class="btn tracejado" data-act="editar-jovem" data-id="${j.id}">+ Adicionar telefone</button>`}
    <h4 class="grupo-titulo">Chamadas · ${esc(ev.nome)}</h4>
    ${lista.length ? lista.map(a => `
      <div class="resp">
        <div class="resp-head"><strong>${esc(diretor(a.diretor_id)?.nome)}${a.diretor_id === S.me ? ' <span class="voce">você</span>' : ''}</strong>
          <span class="dim small">${a.atualizado_em ? `${esc(a.atualizado_por || '')} · ${tempoAtras(a.atualizado_em)}` : ''}</span></div>
        ${segStatus(a)}
        ${a.nota ? `<button class="nota" data-act="nota" data-id="${a.id}"><span aria-hidden="true">📝</span> ${esc(a.nota)}</button>` : `<div><button class="link-btn" data-act="nota" data-id="${a.id}">+ Nota</button></div>`}
      </div>`).join('') : '<p class="dim small" style="margin:0">Ninguém responsável ainda.</p>'}
    <details class="mudar" ${lista.length ? '' : 'open'}>
      <summary>Mudar quem chama</summary>
      <div class="chips">${dirs.map(d => `<button class="chip" data-act="toggle-resp" data-jovem="${j.id}" data-id="${d.id}" aria-pressed="${atuais.has(d.id)}">${esc(d.nome)}</button>`).join('')}</div>
    </details>
    <div class="dlg-foot">
      <button class="btn ghost" data-act="editar-jovem" data-id="${j.id}">${ICON.lapis}Editar cadastro</button>
      <button class="btn" data-act="fechar">Fechar</button>
    </div>`, { tipo: 'jovem', id: jid });
}

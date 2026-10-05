// Aba Minha lista.
import { badgeAniver } from '../aniversarios.js';
import { atribs, diretor, evento, jovem, porJovem } from '../dados.js';
import { S, STATUS, STATUS_BY_ID } from '../estado.js';
import { ICON } from '../icones.js';
import { cartaoInstalar } from '../pwa.js';
import { encerrada } from '../frequencia.js';
import { botaoJustificar } from '../justificativas.js';
import { presenca } from './presenca.js';
import { $, byNome, celular, digitos, esc, faixa, faixaBadge, fmtTel, idade, iniciais, linkWhats, nomeCurto, subNome, telIntl } from '../util.js';
import { linhaVinculos } from '../vinculos.js';
import { conviteNotificacoes } from '../notificacoes.js';

export function segStatus(a) {
  return `<div class="seg" role="group" aria-label="Status da chamada">
    ${STATUS.map(s => `<button class="st-${s.id}" data-act="status" data-id="${a.id}" data-status="${s.id}" aria-pressed="${a.status === s.id}">${s.label}</button>`).join('')}
  </div>`;
}

export function botoesContato(j, a) {
  const ev = evento();
  const wa = linkWhats(ev, j);
  const aid = a ? `data-id="${a.id}"` : '';
  if (!digitos(j.telefone)) {
    return `<div class="row-btns"><button class="btn small ghost" data-act="editar-jovem" data-id="${j.id}">+ Adicionar telefone</button></div>`;
  }
  return `<div class="row-btns">
    <a class="btn wa" href="${esc(wa)}" target="_blank" rel="noopener" data-act="contato" ${aid}>${ICON.wa}WhatsApp</a>
    <a class="btn" href="tel:+${telIntl(j.telefone)}" data-act="contato" ${aid}>${ICON.tel}Ligar</a>
  </div>`;
}

export function cardMinha(a, pj) {
  const j = jovem(a.jovem_id);
  const outros = pj.get(a.jovem_id).filter(x => x.id !== a.id);
  const temTel = !!digitos(j.telefone);
  const resolvido = a.status === 'confirmado' || a.status === 'nao_vai';
  const meta = [
    presenca(j.id) ? '<span class="veio">Veio</span>' : '',
    badgeAniver(j),
    faixa(j) ? faixaBadge(j) : '<span class="dim">idade não informada</span>',
    temTel ? `<span>${esc(fmtTel(j.telefone))}</span>` : '',
  ].filter(Boolean).join('<span class="sep" aria-hidden="true">·</span>');
  const contato = temTel
    ? `<div class="acoes">
        <a class="btn ${resolvido ? 'wa-suave' : 'wa'}" href="${esc(linkWhats(evento(), j))}" target="_blank" rel="noopener" data-act="contato" data-id="${a.id}">${ICON.wa}WhatsApp</a>
        <a class="btn" href="tel:+${telIntl(j.telefone)}" data-act="contato" data-id="${a.id}">${ICON.tel}Ligar</a>
      </div>`
    : `<button class="btn tracejado" data-act="editar-jovem" data-id="${j.id}">+ Adicionar telefone</button>`;
  return `
    <article class="pcard st-${a.status}">
      <div class="pcard-top">
        <span class="avatar" aria-hidden="true">${esc(iniciais(j.nome))}</span>
        <div class="pcard-id">
          <h3>${esc(nomeCurto(j))}</h3>${subNome(j)}
          <div class="pcard-meta">${meta}</div>
        </div>
        <button class="icon-btn" data-act="jovem" data-id="${j.id}" aria-label="Detalhes de ${esc(j.nome)}" title="Detalhes">${ICON.mais}</button>
      </div>
      ${linhaVinculos(j.id)}
      ${j.obs ? `<p class="pcard-obs">${esc(j.obs)}</p>` : ''}
      ${contato}
      ${segStatus(a)}
      ${a.nota ? `<button class="nota" data-act="nota" data-id="${a.id}"><span aria-hidden="true">📝</span> ${esc(a.nota)}</button>` : ''}
      <div class="pcard-foot">
        <div class="outros">${outros.length
          ? outros.map(o => `<span class="st-${o.status}"><span class="dot"></span>Com ${esc(nomeCurto(diretor(o.diretor_id)))} · ${STATUS_BY_ID[o.status].label}</span>`).join('')
          : '<span class="dim">Só você chama</span>'}</div>
        ${a.nota ? '' : `<button class="link-btn" data-act="nota" data-id="${a.id}">+ Nota</button>`}
      </div>
      ${faltou(a, j) ? `<div class="pcard-just"><span>${a.status === 'nao_vai' ? 'Motivo de não ir:' : '<b>Confirmou e faltou.</b> Motivo:'}</span>${botaoJustificar(a.evento_id, j.id)}</div>` : ''}
    </article>`;
}

// pede o motivo de quem avisou que não vai, ou confirmou e não veio (lista encerrada)
const faltou = (a, j) => a.status === 'nao_vai' || (a.status === 'confirmado' && encerrada(evento()) && !presenca(j.id));

export function viewMinha() {
  const minhas = atribs().filter(a => a.diretor_id === S.me);
  if (!minhas.length) {
    return `<div class="vazio"><p>Você não tem ninguém pra chamar neste evento.</p>
      <p class="small">A distribuição é feita em Gerenciar.</p></div>`;
  }
  const pj = porJovem();
  minhas.sort((a, b) => byNome(jovem(a.jovem_id), jovem(b.jovem_id)));
  const feitas = minhas.filter(a => a.status !== 'pendente').length;
  const grupos = [
    ['Pra chamar', minhas.filter(a => a.status === 'pendente')],
    ['Aguardando resposta', minhas.filter(a => a.status === 'chamado')],
    ['Resolvidos', minhas.filter(a => a.status === 'confirmado' || a.status === 'nao_vai')],
  ].filter(([, l]) => l.length);
  return `
    ${celular() ? cartaoInstalar({ dispensavel: true }) : ''}
    ${conviteNotificacoes()}
    <div class="minha-head">
      <h2>Sua lista</h2>
      <span class="tag">${feitas} de ${minhas.length} chamados</span>
    </div>
    ${grupos.map(([titulo, l]) => `
      <section class="grupo">
        <h4 class="grupo-titulo">${titulo} <span>${l.length}</span></h4>
        <div class="pgrid">${l.map(a => cardMinha(a, pj)).join('')}</div>
      </section>`).join('')}`;
}

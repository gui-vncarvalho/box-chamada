// Aba Minha lista.
import { badgeAniver } from '../aniversarios.js';
import { atribs, diretor, evento, jovem, porJovem } from '../dados.js';
import { S, STATUS, STATUS_BY_ID } from '../estado.js';
import { ICON } from '../icones.js';
import { cartaoInstalar } from '../pwa.js';
import { encerrada } from '../frequencia.js';
import { botaoJustificar, justificativa } from '../justificativas.js';
import { presenca } from './presenca.js';
import { $, byNome, celular, digitos, esc, faixaBadge, fmtTel, iniciais, linkWhats, nomeCurto, telIntl } from '../util.js';
import { linhaVinculos } from '../vinculos.js';
import { conviteNotificacoes } from '../notificacoes.js';
import { estadoVazio } from '../vazio.js';

export function segStatus(a) {
  return `<div class="seg" role="group" aria-label="Status da chamada">
    ${STATUS.map(s => `<button class="st-${s.id}" data-act="status" data-id="${a.id}" data-status="${s.id}" aria-pressed="${a.status === s.id}">${s.label}</button>`).join('')}
  </div>`;
}

// sub do card: nome completo (se tem apelido) · telefone · vínculo · com quem mais chama
function subCard(j, outros) {
  const v = linhaVinculos(j.id, 1).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return [
    (j.apelido || '').trim() ? esc(j.nome) : '',
    digitos(j.telefone) ? esc(fmtTel(j.telefone)) : '',
    v ? esc(v) : '',
    outros.length ? 'com ' + esc(outros.map(o => nomeCurto(diretor(o.diretor_id))).join(' e ')) : '',
  ].filter(Boolean).join(' · ');
}

export function cardMinha(a, pj, { recolher = false } = {}) {
  const j = jovem(a.jovem_id);
  const outros = pj.get(a.jovem_id).filter(x => x.id !== a.id);
  const temTel = !!digitos(j.telefone);
  const nome = esc(nomeCurto(j));
  const contato = temTel
    ? `<a class="circ wa" href="${esc(linkWhats(evento(), j))}" target="_blank" rel="noopener" data-act="contato" data-id="${a.id}" aria-label="WhatsApp de ${nome}" title="WhatsApp">${ICON.wa}</a>
       <a class="circ" href="tel:+${telIntl(j.telefone)}" data-act="contato" data-id="${a.id}" aria-label="Ligar pra ${nome}" title="Ligar">${ICON.tel}</a>`
    : `<button class="circ tracejado" data-act="editar-jovem" data-id="${j.id}" aria-label="Adicionar telefone de ${nome}" title="Adicionar telefone">${ICON.mais1}</button>`;
  const sub = subCard(j, outros);
  return `
    <article class="pcard st-${a.status}" data-aid="${a.id}">
      <div class="pcard-top">
        <button class="pcard-quem" data-act="jovem" data-id="${j.id}" aria-label="Detalhes de ${esc(j.nome)}">
          <span class="avatar" aria-hidden="true">${esc(iniciais(j.nome))}</span>
          <span class="pcard-id">
            <span class="pcard-nome"><h3>${nome}</h3>${ICON.chevron}</span>
            <span class="pcard-sub">${faixaBadge(j)}${presenca(j.id) ? '<span class="veio">Veio</span>' : ''}${badgeAniver(j)}${sub ? `<span class="pcard-sub-txt">${sub}</span>` : ''}</span>
          </span>
        </button>
        ${contato}
      </div>
      ${j.obs ? `<p class="pcard-obs">${esc(j.obs)}</p>` : ''}
      ${segStatus(a)}
      ${a.nota ? `<button class="nota" data-act="nota" data-id="${a.id}"><span aria-hidden="true">📝</span> ${esc(a.nota)}</button>` : ''}
      ${faltou(a, j) ? `<div class="pcard-just"><span>${a.status === 'nao_vai' ? 'Motivo de não ir:' : '<b>Confirmou e faltou.</b> Motivo:'}</span>${botaoJustificar(a.evento_id, j.id)}</div>` : ''}
      ${recolher ? `<button class="link-btn pcard-recolher" data-act="m-expandir" data-id="${a.id}" aria-expanded="true">Recolher</button>` : ''}
    </article>`;
}

// "Já respondeu": uma linha só; o toque abre o card completo
function linhaRespondeu(a) {
  const j = jovem(a.jovem_id);
  const st = STATUS_BY_ID[a.status];
  return `
    <button class="mrow st-${a.status}" data-act="m-expandir" data-id="${a.id}" aria-expanded="false">
      <span class="avatar" aria-hidden="true">${esc(iniciais(j.nome))}</span>
      <span class="mrow-id"><strong>${esc(nomeCurto(j))}</strong>${(j.apelido || '').trim() ? `<small>${esc(j.nome)}</small>` : ''}</span>
      <span class="pill">${st.label}</span>
    </button>`;
}

// pede o motivo de quem avisou que não vai, ou confirmou e não veio (lista encerrada)
const faltou = (a, j) => a.status === 'nao_vai' || (a.status === 'confirmado' && encerrada(evento()) && !presenca(j.id));

export function viewMinha() {
  const minhas = atribs().filter(a => a.diretor_id === S.me);
  if (!minhas.length) {
    return estadoVazio({
      ilustra: 'largada', titulo: 'Ninguém pra chamar ainda',
      texto: 'Você não tem ninguém pra chamar neste evento. A distribuição é feita em Gerenciar.',
      acao: { rotulo: 'Distribuir quem falta', act: 'distribuir', modo: 'faltantes', icone: 'addPessoa' },
    });
  }
  const pj = porJovem();
  minhas.sort((a, b) => byNome(jovem(a.jovem_id), jovem(b.jovem_id)));
  const feitas = minhas.filter(a => a.status !== 'pendente').length;
  const conta = Object.fromEntries(STATUS.map(st => [st.id, minhas.filter(a => a.status === st.id).length]));
  const f = S.mFiltro && conta[S.mFiltro] ? S.mFiltro : '';
  const vis = f ? minhas.filter(a => a.status === f) : minhas;
  const pra = vis.filter(a => a.status === 'pendente' || a.status === 'chamado');
  const resp = vis.filter(a => a.status === 'confirmado' || a.status === 'nao_vai');
  const ROT = { pendente: 'Pendentes', chamado: 'Chamei', confirmado: 'Confirmou', nao_vai: 'Não vai' };
  // quem precisa de motivo (faltou sem justificativa) continua aberto
  const aberto = a => S.mAbertos.has(a.id) || (faltou(a, jovem(a.jovem_id)) && !justificativa(a.evento_id, a.jovem_id));
  return `
    ${celular() ? cartaoInstalar({ dispensavel: true }) : ''}
    ${conviteNotificacoes()}
    <div class="minha-head">
      <h2>Sua lista</h2>
      <span class="tag">${feitas} de ${minhas.length} chamados</span>
    </div>
    <div class="mfiltros" role="group" aria-label="Filtrar por status">
      ${STATUS.map(st => `<button class="mchip st-${st.id}" data-act="m-filtro" data-id="${st.id}" aria-pressed="${f === st.id}" ${conta[st.id] ? '' : 'disabled'}>
        <span class="dot" aria-hidden="true"></span>${ROT[st.id]}<span class="n">${conta[st.id]}</span></button>`).join('')}
    </div>
    ${feitas === minhas.length && !f ? estadoVazio({
      ilustra: 'chegada', titulo: 'Tudo chamado!', texto: 'Você chamou todo mundo da sua lista. Agora é com eles.',
      acao: { rotulo: 'Ver a equipe', act: 'tab', id: 'equipe', secundaria: true },
    }) : ''}
    ${pra.length ? `
      <section class="grupo">
        <h4 class="grupo-titulo pra">Pra chamar <span>${pra.length}</span></h4>
        <div class="pgrid">${pra.map(a => cardMinha(a, pj)).join('')}</div>
      </section>` : ''}
    ${resp.length ? `
      <section class="grupo">
        <h4 class="grupo-titulo">Já respondeu <span>${resp.length}</span></h4>
        <div class="pgrid respondeu">${resp.map(a => aberto(a) ? cardMinha(a, pj, { recolher: S.mAbertos.has(a.id) }) : linhaRespondeu(a)).join('')}</div>
      </section>` : ''}`;
}

// Aba Equipe: um cartão por pessoa da diretoria, com barra por status e chips dos jovens.
import { atribs, diretor, jovem } from '../dados.js';
import { S, STATUS, STATUS_BY_ID } from '../estado.js';
import { byNome, esc, iniciais, nomeCurto } from '../util.js';

function cartao(d, lista) {
  const minhas = lista.filter(a => a.diretor_id === d.id)
    .sort((a, b) => byNome(jovem(a.jovem_id), jovem(b.jovem_id)));
  const feitas = minhas.filter(a => a.status !== 'pendente').length;
  const total = minhas.length;
  const eu = d.id === S.me;
  // barra segmentada: um trecho por status, proporcional à quantidade
  const segs = STATUS.map(st => [st.id, minhas.filter(a => a.status === st.id).length]).filter(([, n]) => n);
  const resumo = segs.map(([id, n]) => `${n} ${STATUS_BY_ID[id].label.toLowerCase()}`).join(', ');
  return `
    <article class="ecard ${eu ? 'card-eu' : ''}">
      <div class="ecard-head">
        <span class="avatar" aria-hidden="true">${esc(iniciais(d.nome))}</span>
        <h3>${esc(nomeCurto(d))}${eu ? ' <span class="voce">você</span>' : ''}</h3>
        <strong class="ecard-n ${total && feitas === total ? 'completo' : ''}">${feitas}<span>/${total}</span></strong>
      </div>
      ${total ? `
        <div class="ecard-barra" role="img" aria-label="${esc(resumo)}">${segs.map(([id, n]) => `<span class="st-${id}" style="flex:${n} 1 0"></span>`).join('')}</div>
        <div class="ecard-jovens">${minhas.map(a => `
          <button class="echip st-${a.status}" data-act="jovem" data-id="${a.jovem_id}" title="${STATUS_BY_ID[a.status].label}">
            <span class="dot" aria-hidden="true"></span>${esc(nomeCurto(jovem(a.jovem_id)))}<span class="sr">: ${STATUS_BY_ID[a.status].label}</span>
          </button>`).join('')}</div>`
        : '<p class="dim small">Sem chamadas neste evento.</p>'}
    </article>`;
}

export function viewEquipe() {
  const lista = atribs();
  const eu = diretor(S.me);
  const bloco = (eq, titulo) => {
    const ds = S.data.diretores
      .filter(d => d.equipe === eq && (d.ativo || lista.some(a => a.diretor_id === d.id)))
      .sort((a, b) => (a.id === S.me ? -1 : b.id === S.me ? 1 : byNome(a, b)));
    if (!ds.length) return '';
    return `
      <section class="egrupo">
        <h4 class="grupo-titulo pra-equipe">${titulo} <span>${ds.length}</span></h4>
        <div class="egrid">${ds.map(d => cartao(d, lista)).join('')}</div>
      </section>`;
  };
  const f = bloco('F', 'Equipe feminina');
  const m = bloco('M', 'Equipe masculina');
  return eu?.equipe === 'M' ? m + f : f + m;
}

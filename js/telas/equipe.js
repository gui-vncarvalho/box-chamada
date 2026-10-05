// Aba Equipe.
import { atribs, diretor, evento, jovem } from '../dados.js';
import { S, STATUS_BY_ID } from '../estado.js';
import { $, byNome, esc, nomeCurto } from '../util.js';

export function viewEquipe() {
  const lista = atribs();
  const eu = diretor(S.me);
  const bloco = (eq, titulo) => {
    const ds = S.data.diretores
      .filter(d => d.equipe === eq && (d.ativo || lista.some(a => a.diretor_id === d.id)))
      .sort((a, b) => (a.id === S.me ? -1 : b.id === S.me ? 1 : byNome(a, b)));
    if (!ds.length) return '';
    return `
      <div class="section-title"><h2>${titulo}</h2><span class="tag">${ds.length} pessoas</span></div>
      <div class="grid">${ds.map(d => {
        const minhas = lista.filter(a => a.diretor_id === d.id)
          .sort((a, b) => byNome(jovem(a.jovem_id), jovem(b.jovem_id)));
        const feitas = minhas.filter(a => a.status !== 'pendente').length;
        const total = minhas.length;
        return `
        <div class="card ${d.id === S.me ? 'card-eu' : ''}">
          <div class="card-head">
            <h3>${esc(nomeCurto(d))}${d.id === S.me ? ' <span class="voce">você</span>' : ''}</h3>
            <span class="pill ${total && feitas === total ? 'st-confirmado' : ''}">${feitas}/${total}</span>
          </div>
          <div class="mini-track"><div class="mini-fill" style="width:${total ? (feitas / total) * 100 : 0}%"></div></div>
          ${total ? `<ul class="lista">${minhas.map(a => `
            <li><button class="row st-${a.status} ${a.status !== 'pendente' ? 'feito' : ''}" data-act="jovem" data-id="${a.jovem_id}">
              <span class="dot"></span><span class="nome">${esc(nomeCurto(jovem(a.jovem_id)))}</span>
              ${a.status === 'pendente' ? '' : `<span class="pill st-${a.status}">${STATUS_BY_ID[a.status].label}</span>`}
            </button></li>`).join('')}</ul>` : '<p class="dim small">Sem chamadas neste evento.</p>'}
        </div>`;
      }).join('')}</div>`;
  };
  const f = bloco('F', 'Equipe feminina');
  const m = bloco('M', 'Equipe masculina');
  return eu?.equipe === 'M' ? m + f : f + m;
}

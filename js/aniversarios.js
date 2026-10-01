// Aniversariantes (jovens e diretoria).
import { diretor, jovem } from './dados.js';
import { abrirDlg, dlg } from './dialogos.js';
import { S } from './estado.js';
import { ICON } from './icones.js';
import { $, byNome, esc, faixa, faixaBadge, idade, plural, primeiroNome, telIntl } from './util.js';

export function proximoAniver(nasc, base = new Date()) {
  if (!nasc) return null;
  const [y, m, d] = nasc.split('-').map(Number);
  const hoje = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const bissexto = a => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
  // quem nasceu em 29/02 comemora em 28/02 nos anos que não são bissextos
  const noAno = a => new Date(a, m - 1, m === 2 && d === 29 && !bissexto(a) ? 28 : d);
  let data = noAno(hoje.getFullYear());
  if (data < hoje) data = noAno(hoje.getFullYear() + 1);
  return { data, dias: Math.round((data - hoje) / 86400000), idade: data.getFullYear() - y };
}

export function quandoAniver(a, longo = false) {
  if (a.dias === 0) return 'Hoje';
  if (a.dias === 1) return 'Amanhã';
  if (a.dias < 7) {
    const dia = a.data.toLocaleDateString('pt-BR', { weekday: longo ? 'long' : 'short' }).replace('.', '');
    return dia.charAt(0).toUpperCase() + dia.slice(1);
  }
  return longo ? `em ${a.dias} dias` : a.data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function aniversariantes() {
  return [
    ...S.data.jovens.filter(j => j.ativo && j.nascimento).map(p => ({ tipo: 'jovem', p })),
    ...S.data.diretores.filter(d => d.ativo && d.nascimento).map(p => ({ tipo: 'diretor', p })),
  ]
    .map(x => ({ ...x, ...proximoAniver(x.p.nascimento) }))
    .sort((a, b) => a.dias - b.dias || byNome(a.p, b.p));
}

export function badgeAniver(p) {
  const a = proximoAniver(p.nascimento);
  if (!a || a.dias > 6) return '';
  return `<span class="aniver-badge ${a.dias === 0 ? 'hoje' : ''}" title="Aniversário ${a.data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}">🎂 ${quandoAniver(a)}</span>`;
}

export function renderAniver() {
  if (!S.data) return '';
  const lista = aniversariantes();
  if (!lista.length) return '';
  const semana = lista.filter(x => x.dias <= 6);
  const temHoje = semana.some(x => x.dias === 0);
  const nomes = semana.length
    ? semana.slice(0, 3).map(x => `<span><b>${quandoAniver(x)}</b> ${esc(primeiroNome(x.p.nome))}</span>`).join('')
      + (semana.length > 3 ? `<span class="mais">+${semana.length - 3}</span>` : '')
    : `<span>Próximo: <b>${esc(primeiroNome(lista[0].p.nome))}</b>, em ${lista[0].dias} dias (${lista[0].data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})</span>`;
  return `
    <button class="aniver-faixa ${temHoje ? 'hoje' : ''}" data-act="aniversarios">
      <span class="aniver-ic" aria-hidden="true">🎂</span>
      <span class="aniver-txt">
        <strong>${temHoje ? 'Tem aniversário hoje!' : semana.length ? 'Aniversariantes da semana' : 'Aniversariantes'}</strong>
        <span class="aniver-nomes">${nomes}</span>
      </span>
      <span class="chevron">${ICON.chevron}</span>
    </button>`;
}

export function mensagemParabens(p) {
  const eu = diretor(S.me);
  return `Feliz aniversário, ${primeiroNome(p.nome)}! 🎉🎂 Que Deus te abençoe muito nesse novo ano de vida. ` +
    `Um abraço de toda a galera do Box!${eu ? ` — ${eu.nome}` : ''}`;
}

export function dlgAniversarios() {
  const lista = aniversariantes();
  const semData = S.data.jovens.filter(j => j.ativo && !j.nascimento).length;
  const dirSemData = S.data.diretores.filter(d => d.ativo && !d.nascimento).length;
  const grupos = [];
  for (const x of lista) {
    let titulo;
    if (x.dias <= 6) titulo = 'Esta semana';
    else {
      titulo = x.data.toLocaleDateString('pt-BR', { month: 'long' });
      titulo = titulo.charAt(0).toUpperCase() + titulo.slice(1);
      if (x.data.getFullYear() !== new Date().getFullYear()) titulo += ` de ${x.data.getFullYear()}`;
    }
    if (!grupos.length || grupos[grupos.length - 1][0] !== titulo) grupos.push([titulo, []]);
    grupos[grupos.length - 1][1].push(x);
  }
  const linha = x => {
    const tel = telIntl(x.p.telefone);
    const mes = x.data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const tag = x.tipo === 'diretor' ? '<span class="pill st-chamado">Diretoria</span>' : (faixa(x.p) ? faixaBadge(x.p) : '');
    return `
      <li class="aniver-row ${x.dias === 0 ? 'hoje' : ''}">
        <span class="cal-tile"><small>${mes}</small><strong>${x.data.getDate()}</strong></span>
        <span class="aniver-info">
          <span class="aniver-nome"><strong>${esc(x.p.nome)}</strong>${tag}</span>
          <small>Faz ${x.idade} anos · ${x.dias === 0 ? '<b>hoje 🎉</b>' : x.dias === 1 ? 'amanhã' : quandoAniver(x, true).toLowerCase()}</small>
        </span>
        ${tel ? `<a class="btn small ${x.dias === 0 ? 'wa' : ''}" href="https://api.whatsapp.com/send?phone=${tel}&text=${encodeURIComponent(mensagemParabens(x.p))}" target="_blank" rel="noopener">${ICON.wa}Parabéns</a>` : ''}
      </li>`;
  };
  abrirDlg(`
    <div class="dlg-head">
      <div><h2>🎂 Aniversariantes</h2><p class="dlg-sub">Jovens e diretoria, a partir de hoje.</p></div>
      <button class="x" data-act="fechar" aria-label="Fechar">${ICON.xis}</button>
    </div>
    ${lista.length ? grupos.map(([t, itens]) => `
      <section>
        <h4 class="grupo-titulo">${t} <span>${itens.length}</span></h4>
        <ul class="aniver-lista">${itens.map(linha).join('')}</ul>
      </section>`).join('') : '<div class="vazio"><p>Ninguém com data de nascimento cadastrada ainda.</p></div>'}
    ${semData || dirSemData ? `
      <div class="aniver-falta">
        <span>${[semData && plural(semData, 'jovem', 'jovens'), dirSemData && `${dirSemData} da diretoria`].filter(Boolean).join(' e ')} sem data de nascimento.</span>
        ${semData ? '<button class="link-btn" data-act="ir-sem-nasc">Completar →</button>' : ''}
      </div>` : ''}
    <div class="dlg-foot fim"><button class="btn" data-act="fechar">Fechar</button></div>`);
}

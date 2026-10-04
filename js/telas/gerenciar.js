// Aba Gerenciar: eventos, jovens (com filtros) e diretoria.
import { sair } from '../acoes.js';
import { badgeAniver, proximoAniver } from '../aniversarios.js';
import { buscaInteligente, MESES } from '../busca.js';
import { atribs, diretor, evento, jovem } from '../dados.js';
import { distribuir } from '../distribuir.js';
import { S } from '../estado.js';
import { ICON } from '../icones.js';
import { cartaoInstalar } from '../pwa.js';
import { $, byNome, contagem, dataEvento, digitos, embaralhar, esc, faixa, faixaBadge, fmtTel, hojeISO, horaGeral, idade, iniciais, plural, PUBLICO_LABEL, quandoEvento } from '../util.js';
import { ESTADO_CIVIL, ESTADO_LABEL, pessoa } from '../vinculos.js';

export function calTile(e) {
  if (!e.data) return '<span class="cal-tile vazio"><strong>?</strong><small>sem data</small></span>';
  const [y, m, d] = e.data.split('-').map(Number);
  const mes = new Date(y, m - 1, d).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `<span class="cal-tile"><small>${mes}</small><strong>${d}</strong></span>`;
}

export function statusEvento(e) {
  if (e.arquivado) return ['Arquivado', ''];
  if (e.id === S.eventoId) return ['Selecionado', 'st-confirmado'];
  const cd = contagem(e);
  if (cd && cd[1] === 'passado') return ['Já aconteceu', ''];
  return ['Aberto', 'st-chamado'];
}

export function mgEventos() {
  const ev = evento();
  const hoje = hojeISO();
  const evs = [...S.data.eventos].sort((a, b) =>
    (a.arquivado - b.arquivado) || ((b.data || '') >= hoje) - ((a.data || '') >= hoje) || (b.data || '').localeCompare(a.data || ''));
  const acao = (act, modo, ic, titulo, desc, perigo) => `
    <button class="acao ${perigo ? 'perigo' : ''}" data-act="${act}" ${modo ? `data-modo="${modo}"` : ''}>
      <span class="acao-ic">${ICON[ic]}</span>
      <span class="acao-txt"><strong>${titulo}</strong><small>${desc}</small></span>
    </button>`;
  return `
    <div class="mg-head">
      <div><h2>Eventos</h2><p>Crie os cultos e defina quem chama quem.</p></div>
      <button class="btn primary" data-act="novo-evento">${ICON.mais1}Novo evento</button>
    </div>
    ${ev ? `
    <article class="mg-atual">
      <div class="mg-atual-top">
        ${calTile(ev)}
        <div class="mg-atual-id">
          <span class="eyebrow">Evento selecionado</span>
          <h3>${esc(ev.nome)}</h3>
          <span class="dim small">${esc([quandoEvento(ev), PUBLICO_LABEL[ev.publico], plural(ev.chamadas_por_jovem, 'chamada', 'chamadas') + ' por jovem'].filter(Boolean).join(' · '))}</span>
        </div>
        <button class="btn small" data-act="editar-evento" data-id="${ev.id}">${ICON.lapis}Editar</button>
      </div>
      <div class="acoes-grid">
        ${acao('distribuir', 'faltantes', 'addPessoa', 'Distribuir quem falta', 'Dá responsável pra quem ainda não tem')}
        ${acao('distribuir', 'refazer', 'embaralhar', 'Refazer distribuição', 'Sorteia de novo quem chama quem')}
        ${acao('copiar-lista', '', 'copiar', 'Copiar lista pro grupo', 'Texto pronto pra colar no WhatsApp')}
        ${contagem(ev)?.[1] === 'passado' ? acao('encerrar-evento', '', 'check', 'Encerrar evento', 'Finaliza a chamada e manda pro histórico') : ''}
        ${acao('zerar', '', 'desfazer', 'Zerar marcações', 'Volta todas as chamadas pra pendente', true)}
      </div>
    </article>` : ''}
    <h4 class="grupo-titulo">Todos os eventos <span>${evs.length}</span></h4>
    <div class="mg-lista">${evs.map(e => {
      const [st, cls] = statusEvento(e);
      return `
      <button class="ev-item ${e.arquivado ? 'arq' : ''}" data-act="editar-evento" data-id="${e.id}">
        ${calTile(e)}
        <span class="ev-item-txt"><strong>${esc(e.nome)}</strong><small>${esc([dataEvento(e, { weekday: 'long' }), horaGeral(e), PUBLICO_LABEL[e.publico]].filter(Boolean).join(' · '))}</small></span>
        <span class="pill ${cls}">${st}</span>
        <span class="chevron">${ICON.chevron}</span>
      </button>`;
    }).join('') || '<div class="vazio"><p>Nenhum evento ainda.</p></div>'}</div>`;
}

export const MG_FILTROS = {
  todos: ['Todos', () => true],
  sem_tel: ['Sem telefone', j => j.ativo && !digitos(j.telefone)],
  sem_nasc: ['Sem nascimento', j => j.ativo && !j.nascimento],
  inativos: ['Inativos', j => !j.ativo],
};

export const MG_F_PADRAO = { faixa: '', idadeMin: '', idadeMax: '', mes: '', civil: '', equipe: '' };

export const MES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const MG_ORDENS = [['nome', 'Nome'], ['idade', 'Idade'], ['aniver', 'Próximo aniversário']];

export function filtroPainel(j) {
  const f = S.mgF;
  if (f.faixa === 'box' || f.faixa === 'sprint') { if (faixa(j) !== f.faixa) return false; }
  else if (f.faixa === 'sem' && j.nascimento) return false;
  const i = idade(j.nascimento);
  if (f.idadeMin !== '' && (i == null || i < Number(f.idadeMin))) return false;
  if (f.idadeMax !== '' && (i == null || i > Number(f.idadeMax))) return false;
  if (f.mes === 'semana') { const a = proximoAniver(j.nascimento); if (!a || a.dias > 6) return false; }
  else if (f.mes !== '' && (!j.nascimento || Number(j.nascimento.slice(5, 7)) !== Number(f.mes))) return false;
  if (f.civil === 'nao' ? !!j.estado_civil : f.civil && j.estado_civil !== f.civil) return false;
  if (f.equipe && j.genero !== f.equipe) return false;
  return true;
}

export function resumoFiltros() {
  const f = S.mgF;
  const ch = [];
  if (f.faixa) ch.push(['faixa', { box: 'Box', sprint: 'Sprint', sem: 'Sem idade' }[f.faixa]]);
  if (f.idadeMin !== '' || f.idadeMax !== '') {
    ch.push(['idade', f.idadeMin !== '' && f.idadeMax !== '' ? `${f.idadeMin} a ${f.idadeMax} anos` : f.idadeMin !== '' ? `${f.idadeMin}+ anos` : `até ${f.idadeMax} anos`]);
  }
  if (f.mes) ch.push(['mes', f.mes === 'semana' ? '🎂 esta semana' : `🎂 ${MESES[f.mes - 1].replace('marco', 'março')}`]);
  if (f.civil) ch.push(['civil', f.civil === 'nao' ? 'Relacionamento não informado' : ESTADO_CIVIL.find(e => e[0] === f.civil)[1]]);
  if (f.equipe) ch.push(['equipe', f.equipe === 'F' ? 'Feminina' : 'Masculina']);
  return ch;
}

export function listaMgFiltrada() {
  const busca = buscaInteligente(S.buscaMg);
  const js = S.data.jovens.filter(j => MG_FILTROS[S.mgFiltro][1](j) && filtroPainel(j) && busca(j));
  const ord = {
    nome: (a, b) => byNome(a, b),
    idade: (a, b) => (idade(a.nascimento) ?? 999) - (idade(b.nascimento) ?? 999) || byNome(a, b),
    aniver: (a, b) => (proximoAniver(a.nascimento)?.dias ?? 999) - (proximoAniver(b.nascimento)?.dias ?? 999) || byNome(a, b),
  }[S.mgOrdem];
  return js.sort(ord);
}

export function htmlListaMgJovens() {
  const js = listaMgFiltrada();
  const total = S.data.jovens.length;
  const ch = resumoFiltros();
  const resumo = `
    <div class="mg-resumo">
      <span class="dim small">${js.length === total ? plural(total, 'jovem', 'jovens') : `${js.length} de ${total} jovens`}</span>
      ${ch.map(([k, t]) => `<button class="chip-filtro" data-act="mgf-limpar" data-id="${k}">${esc(t)}${ICON.xis}</button>`).join('')}
      ${ch.length > 1 ? '<button class="link-btn" data-act="mgf-limpar" data-id="tudo">Limpar tudo</button>' : ''}
    </div>`;
  if (!js.length) {
    return resumo + `<div class="vazio"><p>${S.buscaMg.trim() || ch.length ? 'Ninguém com essa combinação.' : 'Ninguém nesse filtro. 🎉'}</p></div>`;
  }
  return resumo + `<div class="jgrid">${js.map(j => {
    const tel = digitos(j.telefone);
    const an = proximoAniver(j.nascimento);
    return `
    <button class="jcard mg-jovem ${j.ativo ? '' : 'inativo'}" data-act="editar-jovem" data-id="${j.id}">
      <span class="avatar" aria-hidden="true">${esc(iniciais(j.nome))}</span>
      <span class="jcard-txt">
        <span class="jcard-nome"><strong>${esc(j.nome)}</strong>${faixa(j) ? faixaBadge(j) : ''}${badgeAniver(j)}${j.ativo ? '' : '<span class="pill">Inativo</span>'}</span>
        <span class="jcard-resp">
          <span>${j.genero === 'F' ? 'Feminina' : 'Masculina'}</span>
          ${tel ? `<span>${esc(fmtTel(j.telefone))}</span>` : '<span class="falta">sem telefone</span>'}
          ${an ? `<span>🎂 ${an.data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>` : '<span class="falta">sem nascimento</span>'}
          ${j.estado_civil ? `<span>${ESTADO_LABEL[j.estado_civil][j.genero]}</span>` : ''}
        </span>
      </span>
      <span class="chevron">${ICON.lapis}</span>
    </button>`;
  }).join('')}</div>`;
}

export function painelFiltros() {
  const f = S.mgF;
  const grupo = (titulo, chave, opcoes) => `
    <div class="pf-grupo"><span class="eyebrow">${titulo}</span>
      <div class="chips">${opcoes.map(([v, l]) => `<button class="chip" data-act="mgf" data-k="${chave}" data-v="${v}" aria-pressed="${String(chave === 'ordem' ? S.mgOrdem : f[chave]) === String(v)}">${l}</button>`).join('')}</div>
    </div>`;
  return `
    <div class="painel-filtros" id="mgpainel">
      ${grupo('Faixa', 'faixa', [['', 'Todas'], ['box', 'Box'], ['sprint', 'Sprint'], ['sem', 'Sem idade']])}
      <div class="pf-grupo"><span class="eyebrow">Idade</span>
        <div class="pf-idade">
          <input type="number" inputmode="numeric" min="0" max="120" placeholder="de" data-mgf-idade="idadeMin" value="${esc(f.idadeMin)}" aria-label="Idade mínima">
          <span class="dim">até</span>
          <input type="number" inputmode="numeric" min="0" max="120" placeholder="até" data-mgf-idade="idadeMax" value="${esc(f.idadeMax)}" aria-label="Idade máxima">
          <span class="dim">anos</span>
        </div>
      </div>
      ${grupo('Aniversário', 'mes', [['', 'Qualquer'], ['semana', 'Esta semana'], ...MES_CURTO.map((m, i) => [String(i + 1), m])])}
      ${grupo('Relacionamento', 'civil', [['', 'Qualquer'], ['solteiro', 'Solteiro(a)'], ['namorando', 'Namorando'], ['noivo', 'Noivo(a)'], ['casado', 'Casado(a)'], ['nao', 'Não informado']])}
      ${grupo('Equipe', 'equipe', [['', 'Todas'], ['F', 'Feminina'], ['M', 'Masculina']])}
      ${grupo('Ordenar por', 'ordem', MG_ORDENS)}
    </div>`;
}

export function mgJovens() {
  const d = S.data;
  const ativos = d.jovens.filter(j => j.ativo);
  const cont = { box: 0, sprint: 0 };
  ativos.forEach(j => { const f = faixa(j); if (f) cont[f]++; });
  const nFiltro = id => d.jovens.filter(MG_FILTROS[id][1]).length;
  const stat = (n, label, cls, filtro) => filtro
    ? `<button class="mg-stat ${cls} ${S.mgFiltro === filtro ? 'ativo' : ''}" data-act="mg-filtro" data-id="${S.mgFiltro === filtro ? 'todos' : filtro}"><strong>${n}</strong><span>${label}</span></button>`
    : `<button class="mg-stat ${cls} ${S.mgF.faixa === cls ? 'ativo' : ''}" data-act="mgf" data-k="faixa" data-v="${S.mgF.faixa === cls ? '' : cls}"><strong>${n}</strong><span>${label}</span></button>`;
  const nAtivos = resumoFiltros().length;
  return `
    <div class="mg-head">
      <div><h2>Jovens</h2><p>${plural(ativos.length, 'jovem ativo', 'jovens ativos')} no cadastro.</p></div>
      <div class="row-btns">
        <button class="btn" data-act="importar">${ICON.upload}Importar lista</button>
        <button class="btn primary" data-act="novo-jovem">${ICON.mais1}Jovem</button>
      </div>
    </div>
    <div class="mg-stats">
      ${stat(cont.box, 'no Box', 'box')}
      ${stat(cont.sprint, 'no Sprint', 'sprint')}
      ${stat(nFiltro('sem_tel'), 'sem telefone', nFiltro('sem_tel') ? 'alerta' : '', 'sem_tel')}
      ${stat(nFiltro('sem_nasc'), 'sem nascimento', nFiltro('sem_nasc') ? 'alerta' : '', 'sem_nasc')}
    </div>
    <div class="jtoolbar">
      <div class="pres-busca">
        <label class="busca">${ICON.lupa}
          <input type="search" id="busca-mg" placeholder="Nome, 18, box, casado, outubro…" value="${esc(S.buscaMg)}" aria-label="Buscar jovem" autocomplete="off">
        </label>
        <button class="btn ${S.mgPainel || nAtivos ? 'ativo-filtro' : ''}" data-act="mgf-painel" aria-expanded="${S.mgPainel}">${ICON.filtro}<span>Filtros</span>${nAtivos ? `<span class="n-filtro">${nAtivos}</span>` : ''}</button>
      </div>
      <p class="busca-dica">Combine termos: <code>sprint outubro</code> · <code>casado 25-30</code> · <code>17+</code> · <code>12/10</code> · <code>semana</code> · pedaço do telefone</p>
      ${S.mgPainel ? painelFiltros() : ''}
      <div class="jfiltros"><div class="chips" role="group" aria-label="Cadastro">${Object.entries(MG_FILTROS).map(([id, [l]]) => `
        <button class="chip" data-act="mg-filtro" data-id="${id}" aria-pressed="${S.mgFiltro === id}">${l}<span class="c">${nFiltro(id)}</span></button>`).join('')}
      </div></div>
    </div>
    <div id="mglista">${htmlListaMgJovens()}</div>`;
}

export function mgDiretoria() {
  const lista = atribs();
  const eu = diretor(S.me);
  const bloco = (eq, titulo) => {
    const ds = S.data.diretores.filter(d => d.equipe === eq);
    if (!ds.length) return '';
    return `
      <h4 class="grupo-titulo">${titulo} <span>${ds.length}</span></h4>
      <div class="dir-grid">${ds.map(p => {
        const n = lista.filter(a => a.diretor_id === p.id).length;
        return `
        <button class="dir-card ${p.ativo ? '' : 'inativo'}" data-act="editar-diretor" data-id="${p.id}">
          <span class="avatar" aria-hidden="true">${esc(iniciais(p.nome))}</span>
          <span class="dir-txt">
            <strong>${esc(p.nome)}${p.id === S.me ? ' <span class="voce">você</span>' : ''}${badgeAniver(p)}</strong>
            <small>${p.ativo ? (evento() ? plural(n, 'chamada', 'chamadas') + ' neste evento' : 'Ativo') : 'Inativo · fora das distribuições'}${p.nascimento ? '' : ' · <span class="falta">sem nascimento</span>'}</small>
          </span>
          <span class="chevron">${ICON.lapis}</span>
        </button>`;
      }).join('')}</div>`;
  };
  const f = bloco('F', 'Equipe feminina');
  const m = bloco('M', 'Equipe masculina');
  return `
    <div class="mg-head">
      <div><h2>Diretoria</h2><p>Quem recebe jovens pra chamar na distribuição.</p></div>
      <button class="btn primary" data-act="novo-diretor">${ICON.mais1}Pessoa</button>
    </div>
    ${eu?.equipe === 'M' ? m + f : f + m}
    ${cartaoInstalar()}
    <div class="aparelho">
      <div><strong>Este aparelho</strong><small>Você está como <b>${esc(eu ? eu.nome : 'Visitante')}</b>.</small></div>
      <div class="row-btns">
        <button class="btn small" data-act="trocar-eu">Trocar pessoa</button>
        <button class="btn small danger" data-act="sair">Sair</button>
      </div>
    </div>`;
}

export function viewGerenciar() {
  const abas = [['eventos', 'Eventos', ICON.cal], ['jovens', 'Jovens', ICON.grupo], ['diretoria', 'Diretoria', ICON.user]];
  const corpo = { eventos: mgEventos, jovens: mgJovens, diretoria: mgDiretoria }[S.mgTab]();
  return `
    <div class="mg-abas" role="tablist">${abas.map(([id, l, ic]) => `
      <button role="tab" data-act="mg-tab" data-id="${id}" aria-selected="${S.mgTab === id}">${ic}<span>${l}</span></button>`).join('')}
    </div>
    <div class="mg-corpo">${corpo}</div>`;
}

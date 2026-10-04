// Presença ao longo do tempo: cultos de um evento, resumo, frequência por pessoa e "quem sumiu".
import { rpc } from './api.js';
import { diretor, porJovem, statusJovem } from './dados.js';
import { abrirDlg } from './dialogos.js';
import { S } from './estado.js';
import { ICON } from './icones.js';
import { botaoJustificar, justificativa, MOTIVOS } from './justificativas.js';
import { byNome, celular, dataEvento, esc, faixa, faixaBadge, hojeISO, iniciais, plural, porFaixa, primeiroNome, toast } from './util.js';

const CULTOS_SUMIU = 2; // faltou nos 2 últimos cultos encerrados…
const JANELA_SUMIU = 6; // …e tinha vindo em algum dos 6 anteriores

/* ---------- cultos de um evento ---------- */
// Evento Box + Sprint com horário por faixa vira dois cultos; os outros, um só ("geral").
export function cultosDoEvento(ev) {
  if (!ev) return [];
  if (!porFaixa(ev)) return [['geral', 'Presença']];
  const c = [['sprint', `Sprint${ev.hora_sprint ? ` ${ev.hora_sprint}` : ''}`], ['box', `Box${ev.hora_box ? ` ${ev.hora_box}` : ''}`]];
  // presença marcada antes da divisão por culto continua visível
  if ((S.data?.presencas || []).some(p => p.evento_id === ev.id && (p.culto || 'geral') === 'geral')) c.push(['geral', 'Sem culto']);
  return c;
}

export const pessoaDe = p => p.jovem_id || p.diretor_id;
export const presencasDoEvento = eid => (S.data?.presencas || []).filter(p => p.evento_id === eid);
export const veioNoEvento = (eid, id) => presencasDoEvento(eid).some(p => pessoaDe(p) === id);
export const encerrada = ev => !!ev?.presenca_encerrada_em;

/* ---------- resumo ---------- */
// Calculado na hora de encerrar e salvo junto do evento (os números não mudam se o cadastro mudar depois).
export function calcularResumo(ev) {
  const pres = presencasDoEvento(ev.id);
  const jovemDe = id => S.data.jovens.find(j => j.id === id);
  const cultos = {};
  for (const [c, rot] of cultosDoEvento(ev)) {
    const doCulto = pres.filter(p => (p.culto || 'geral') === c);
    const jovens = doCulto.filter(p => p.jovem_id).map(p => jovemDe(p.jovem_id)).filter(Boolean);
    cultos[c] = {
      rotulo: rot, jovens: jovens.length, diretoria: doCulto.filter(p => p.diretor_id).length,
      box: jovens.filter(j => faixa(j) === 'box').length, sprint: jovens.filter(j => faixa(j) === 'sprint').length,
    };
  }
  const jovensDia = new Set(pres.filter(p => p.jovem_id).map(p => p.jovem_id));
  const status = new Map([...porJovem((S.data.atribuicoes || []).filter(a => a.evento_id === ev.id))].map(([id, l]) => [id, statusJovem(l)]));
  const confirmados = [...status].filter(([, s]) => s === 'confirmado').map(([id]) => id);
  return {
    cultos,
    jovens: jovensDia.size,
    diretoria: new Set(pres.filter(p => p.diretor_id).map(p => p.diretor_id)).size,
    confirmados: confirmados.length,
    confirmados_vieram: confirmados.filter(id => jovensDia.has(id)).length,
    faltaram: confirmados.filter(id => !jovensDia.has(id)),
    nao_vao: [...status].filter(([, s]) => s === 'nao_vai').map(([id]) => id),
    visitantes: [...jovensDia].filter(id => { const j = jovemDe(id); return ev.data && j?.criado_em && hojeISO(new Date(j.criado_em)) === ev.data; }).length,
  };
}

export const resumoDe = ev => ev.presenca_resumo || calcularResumo(ev);

/* ---------- cultos passados ---------- */
// Entram os eventos com a lista encerrada ou que já aconteceram e têm presença marcada.
export function cultosPassados() {
  const hoje = hojeISO();
  return S.data.eventos
    .filter(e => encerrada(e) || (e.data && e.data < hoje && presencasDoEvento(e.id).length))
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
}

/* ---------- por pessoa ---------- */
export function frequencia(jid, n = 6) {
  const lista = cultosPassados().filter(encerrada).slice(0, n).map(ev => ({ ev, veio: veioNoEvento(ev.id, jid), just: justificativa(ev.id, jid) }));
  return { lista, vieram: lista.filter(x => x.veio).length };
}

export function htmlFrequencia(jid) {
  const { lista, vieram } = frequencia(jid);
  if (!lista.length) return '<p class="dim small" style="margin:0">Nenhum culto encerrado ainda.</p>';
  return `
    <div class="freq-resumo"><strong>Veio em ${vieram} de ${plural(lista.length, 'culto', 'últimos cultos')}</strong>
      <span class="freq-pontos">${lista.slice().reverse().map(x => `<span class="${x.veio ? 'veio' : 'faltou'}" title="${esc(x.ev.nome)} · ${esc(dataEvento(x.ev, { day: '2-digit', month: '2-digit' }))}"></span>`).join('')}</span>
    </div>
    <ul class="freq-lista">${lista.map(x => `
      <li class="${x.veio ? 'veio' : 'faltou'}">
        <span>${x.veio ? '✓' : '✗'} ${esc(x.ev.nome)} <small>${esc(dataEvento(x.ev, { day: '2-digit', month: '2-digit' }))}</small></span>
        ${x.veio ? '' : botaoJustificar(x.ev.id, jid)}
      </li>`).join('')}</ul>`;
}

/* ---------- quem sumiu ---------- */
export function quemSumiu() {
  const encerrados = cultosPassados().filter(encerrada);
  if (encerrados.length < CULTOS_SUMIU + 1) return null; // ainda não dá pra saber
  const recentes = encerrados.slice(0, CULTOS_SUMIU);
  const anteriores = encerrados.slice(CULTOS_SUMIU, CULTOS_SUMIU + JANELA_SUMIU);
  return S.data.jovens
    .filter(j => j.ativo && recentes.every(ev => !veioNoEvento(ev.id, j.id)))
    .map(j => ({ j, ultima: anteriores.find(ev => veioNoEvento(ev.id, j.id)) }))
    .filter(x => x.ultima)
    .sort((a, b) => byNome(a.j, b.j));
}

/* ---------- aba Histórico › Presenças ---------- */
function numeros(r) {
  return `${plural(r.jovens, 'jovem', 'jovens')}${r.diretoria ? ` · ${r.diretoria} da diretoria` : ''}${r.visitantes ? ` · ${plural(r.visitantes, 'visitante', 'visitantes')}` : ''}`;
}

export function viewPresencasHist() {
  const cultos = cultosPassados();
  const sumiu = quemSumiu();
  const mes = ev => {
    if (!ev.data) return '<span class="cal-tile vazio"><strong>?</strong><small>sem data</small></span>';
    const [y, m, d] = ev.data.split('-').map(Number);
    return `<span class="cal-tile"><small>${new Date(y, m - 1, d).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</small><strong>${d}</strong></span>`;
  };
  return `
    <section class="grupo">
      <h4 class="grupo-titulo">Quem sumiu ${sumiu?.length ? `<span>${sumiu.length}</span>` : ''}</h4>
      ${sumiu === null
        ? `<p class="dim small sumiu-vazio">Aparece aqui quem estava vindo e faltou nos ${CULTOS_SUMIU} últimos cultos. Precisa de pelo menos ${CULTOS_SUMIU + 1} cultos com a lista encerrada.</p>`
        : sumiu.length ? `<div class="jgrid">${sumiu.map(({ j, ultima }) => `
          <button class="jcard sumiu" data-act="jovem" data-id="${j.id}">
            <span class="avatar" aria-hidden="true">${esc(j.nome.slice(0, 1).toUpperCase())}</span>
            <span class="jcard-txt"><span class="jcard-nome"><strong>${esc(j.nome)}</strong></span>
              <span class="jcard-resp"><span>Faltou nos ${CULTOS_SUMIU} últimos · veio por último em ${esc(ultima.nome)} (${esc(dataEvento(ultima, { day: '2-digit', month: '2-digit' }))})</span></span></span>
            <span class="chevron">${ICON.chevron}</span>
          </button>`).join('')}</div>`
        : '<p class="dim small sumiu-vazio">Ninguém sumiu. 🙌</p>'}
    </section>
    <section class="grupo">
      <h4 class="grupo-titulo">Cultos <span>${cultos.length}</span></h4>
      ${cultos.length ? `<div class="mg-lista">${cultos.map(ev => {
        const r = resumoDe(ev);
        return `
        <button class="ev-item" data-act="resumo-culto" data-id="${ev.id}">
          ${mes(ev)}
          <span class="ev-item-txt"><strong>${esc(ev.nome)}</strong>
            <small>${numeros(r)}${r.confirmados ? ` · ${r.confirmados_vieram}/${r.confirmados} confirmados vieram` : ''}</small></span>
          <span class="pill ${encerrada(ev) ? '' : 'st-chamado'}">${encerrada(ev) ? 'Encerrada' : 'Aberta'}</span>
          <span class="chevron">${ICON.chevron}</span>
        </button>`;
      }).join('')}</div>` : '<div class="vazio"><p>Nenhum culto com presença ainda.</p></div>'}
    </section>`;
}

/* ---------- chamadas de um evento (quem chamou quem) ---------- */
// Eventos abertos já vêm no carregamento; os encerrados são buscados quando a aba abre.
const chamadasCache = {};
export function chamadasCarregadas(ev) {
  if (!ev.arquivado) return (S.data.atribuicoes || []).filter(a => a.evento_id === ev.id);
  return chamadasCache[ev.id] || null;
}
async function buscarChamadas(ev) {
  chamadasCache[ev.id] = await rpc('box_chamadas_evento', { p_evento: ev.id });
}

function htmlChamadas(lista) {
  if (!lista.length) return '<div class="vazio"><p>Este evento não tem chamadas registradas.</p></div>';
  const nomeJ = id => S.data.jovens.find(j => j.id === id)?.nome || '—';
  const feitas = lista.filter(a => a.status !== 'pendente').length;
  const ninguem = [...porJovem(lista)].filter(([, l]) => l.every(a => a.status === 'pendente')).map(([id]) => nomeJ(id))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const porDir = new Map();
  for (const a of lista) {
    if (!porDir.has(a.diretor_id)) porDir.set(a.diretor_id, []);
    porDir.get(a.diretor_id).push(a);
  }
  const linhas = [...porDir].map(([did, l]) => ({
    nome: diretor(did)?.nome || '—', total: l.length, feitas: l.filter(a => a.status !== 'pendente').length,
    pend: l.filter(a => a.status === 'pendente').map(a => nomeJ(a.jovem_id)).sort((a, b) => a.localeCompare(b, 'pt-BR')),
  })).sort((a, b) => b.pend.length - a.pend.length || a.nome.localeCompare(b.nome, 'pt-BR'));
  return `
    <div class="faltas-resumo">
      <strong>${feitas} de ${plural(lista.length, 'chamada feita', 'chamadas feitas')}</strong>
      ${ninguem.length ? `<span class="just-pill alerta">${plural(ninguem.length, 'jovem que ninguém chamou', 'jovens que ninguém chamou')}</span>` : '<span class="just-pill">✓ Todo jovem recebeu contato</span>'}
    </div>
    ${ninguem.length ? `<h4 class="grupo-titulo">Ninguém chamou <span>${ninguem.length}</span></h4>
      <div class="nomes alerta">${ninguem.map(n => `<span>${esc(n)}</span>`).join('')}</div>` : ''}
    <h4 class="grupo-titulo">Diretoria <span>${linhas.length}</span></h4>
    <div class="ch-grid">${linhas.map(r => `
      <div class="ch-card ${r.pend.length ? '' : 'ok'}">
        <div class="ch-top"><strong>${esc(r.nome)}</strong><span class="pill ${r.pend.length ? '' : 'st-confirmado'}">${r.feitas}/${r.total}</span></div>
        <div class="mini-track"><div class="mini-fill" style="width:${r.total ? (r.feitas / r.total) * 100 : 0}%"></div></div>
        ${r.pend.length ? `<small>Não chamou: <b>${r.pend.map(esc).join(', ')}</b></small>` : '<small class="ok">✓ Chamou todo mundo</small>'}
      </div>`).join('')}</div>`;
}

/* ---------- resumo de um culto ---------- */
const MOTIVO_IC = Object.fromEntries(MOTIVOS.map(([id, ic, l]) => [id, `${ic} ${l}`]));

function linhaPessoa(x, mostrarCulto) {
  const tag = x.dir ? '<span class="pill st-chamado">Diretoria</span>' : x.j && faixa(x.j) ? faixaBadge(x.j) : '';
  return `
    <div class="rp ${x.dir ? 'dir' : ''}">
      <span class="avatar" aria-hidden="true">${esc(iniciais(x.nome))}</span>
      <span class="rp-txt"><strong>${esc(x.nome)}</strong>
        <small>${tag}${mostrarCulto && x.cultos.length ? `<span class="rp-cultos">${x.cultos.join(' · ')}</span>` : ''}</small></span>
    </div>`;
}

export function dlgResumoCulto(eid) {
  const ev = S.data.eventos.find(e => e.id === eid);
  if (!ev) return;
  const st = S.resumo?.eid === eid ? S.resumo : (S.resumo = { eid, aba: 'presentes', culto: 'todos' });
  const r = resumoDe(ev);
  const cultos = cultosDoEvento(ev);
  const rotCulto = Object.fromEntries(cultos.map(([c, rot]) => [c, rot.split(' ')[0]]));
  const jovemDe = id => S.data.jovens.find(j => j.id === id);
  const nome = id => jovemDe(id)?.nome || S.data.diretores.find(d => d.id === id)?.nome || '—';

  // quem veio, com os cultos de cada um
  const pessoas = new Map();
  for (const p of presencasDoEvento(ev.id)) {
    const id = pessoaDe(p);
    const c = p.culto || 'geral';
    if (st.culto !== 'todos' && c !== st.culto) continue;
    if (!pessoas.has(id)) pessoas.set(id, { id, nome: nome(id), dir: !!p.diretor_id, j: jovemDe(id), cultos: [] });
    if (cultos.length > 1) pessoas.get(id).cultos.push(rotCulto[c] || c);
  }
  const lista = [...pessoas.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const jovens = lista.filter(x => !x.dir);
  const dir = lista.filter(x => x.dir);
  const visitantes = jovens.filter(x => ev.data && x.j?.criado_em && hojeISO(new Date(x.j.criado_em)) === ev.data);

  const faltaram = (r.faltaram || []).filter(jovemDe);
  const avisaram = (r.nao_vao || []).filter(jovemDe);
  const todasFaltas = [...faltaram, ...avisaram];
  const comMotivo = todasFaltas.map(id => justificativa(ev.id, id)).filter(Boolean);
  const porMotivo = Object.entries(comMotivo.reduce((m, x) => ({ ...m, [x.motivo]: (m[x.motivo] || 0) + 1 }), {}))
    .sort((a, b) => b[1] - a[1]);
  const linhaFalta = id => `<li><span class="avatar" aria-hidden="true">${esc(iniciais(nome(id)))}</span><span class="jf-nome">${esc(nome(id))}</span>${botaoJustificar(ev.id, id)}</li>`;

  const chamadas = chamadasCarregadas(ev);
  const abas = [['presentes', 'Presentes', lista.length], ['faltas', 'Faltas', todasFaltas.length], ['visitantes', 'Visitantes', visitantes.length],
    ['chamadas', 'Chamadas', chamadas ? `${chamadas.filter(a => a.status !== 'pendente').length}/${chamadas.length}` : '…']];
  let corpo;
  if (st.aba === 'chamadas') {
    if (chamadas) corpo = htmlChamadas(chamadas);
    else {
      corpo = '<div class="vazio"><span class="spinner" aria-hidden="true"></span><p>Buscando as chamadas…</p></div>';
      buscarChamadas(ev)
        .then(() => { if (S.dlg?.tipo === 'resumo' && S.dlg.id === ev.id && S.resumo?.aba === 'chamadas') dlgResumoCulto(ev.id); })
        .catch(() => { chamadasCache[ev.id] = []; dlgResumoCulto(ev.id); });
    }
  } else if (st.aba === 'presentes') {
    corpo = `
      ${cultos.length > 1 ? `<div class="chips resumo-filtro">${[['todos', 'Todos'], ...cultos].map(([c, rot]) => `
        <button class="chip" data-act="resumo-culto-filtro" data-id="${c}" aria-pressed="${st.culto === c}">${esc(rot)}</button>`).join('')}</div>` : ''}
      <h4 class="grupo-titulo">Jovens <span>${jovens.length}</span></h4>
      ${jovens.length ? `<div class="rp-grid">${jovens.map(x => linhaPessoa(x, st.culto === 'todos')).join('')}</div>` : '<p class="dim small">Ninguém.</p>'}
      ${dir.length ? `<h4 class="grupo-titulo">Diretoria <span>${dir.length}</span></h4>
        <div class="rp-grid">${dir.map(x => linhaPessoa(x, st.culto === 'todos')).join('')}</div>` : ''}`;
  } else if (st.aba === 'faltas') {
    corpo = todasFaltas.length ? `
      <div class="faltas-resumo">
        <strong>${comMotivo.length} de ${todasFaltas.length} com motivo</strong>
        ${porMotivo.map(([m, n]) => `<span class="just-pill">${MOTIVO_IC[m] || m} ${n}</span>`).join('')}
      </div>
      ${faltaram.length ? `<h4 class="grupo-titulo">Confirmaram e não vieram <span>${faltaram.length}</span></h4>
        <ul class="just-lista">${faltaram.map(linhaFalta).join('')}</ul>` : ''}
      ${avisaram.length ? `<h4 class="grupo-titulo">Avisaram que não iam <span>${avisaram.length}</span></h4>
        <ul class="just-lista">${avisaram.map(linhaFalta).join('')}</ul>` : ''}`
      : '<div class="vazio"><p>Nenhuma falta de quem confirmou. 🙌</p></div>';
  } else {
    corpo = visitantes.length
      ? `<div class="rp-grid">${visitantes.map(x => linhaPessoa(x, cultos.length > 1)).join('')}</div>`
      : '<div class="vazio"><p>Ninguém veio pela primeira vez.</p></div>';
  }

  abrirDlg(`
    <div class="dlg-head">
      <div><h2>${esc(ev.nome)}</h2><p class="dlg-sub">${esc(dataEvento(ev) || 'sem data')}${encerrada(ev) ? ` · lista encerrada por ${esc(ev.presenca_encerrada_por || '—')}` : ' · lista aberta'}</p></div>
      <button class="x" data-act="fechar" aria-label="Fechar">${ICON.xis}</button>
    </div>
    <div class="resumo-nums">
      <div><strong>${r.jovens}</strong><small>jovens</small></div>
      <div><strong>${r.diretoria}</strong><small>diretoria</small></div>
      <div><strong>${r.confirmados_vieram}<span>/${r.confirmados}</span></strong><small>confirmados vieram</small></div>
      <div><strong>${r.visitantes}</strong><small>primeira vez</small></div>
    </div>
    ${cultos.length > 1 && r.cultos ? `<p class="resumo-cultos">${cultos.filter(([c]) => r.cultos[c]).map(([c, rot]) => {
      const x = r.cultos[c];
      return `<span><b>${esc(rot)}</b> ${plural(x.jovens, 'jovem', 'jovens')} (${x.box} Box · ${x.sprint} Sprint)${x.diretoria ? ` + ${x.diretoria} da diretoria` : ''}</span>`;
    }).join('')}</p>` : ''}
    <div class="hist-modos resumo-abas" role="tablist">${abas.map(([id, l, n]) => `
      <button role="tab" data-act="resumo-aba" data-id="${id}" aria-selected="${st.aba === id}">${l} <span class="c">${n}</span></button>`).join('')}</div>
    <div class="resumo-corpo">${corpo}</div>
    <div class="dlg-foot">
      <button class="btn" data-act="compartilhar-resumo" data-id="${eid}">${ICON.copiar}Enviar pro grupo</button>
      <button class="btn" data-act="fechar">Fechar</button>
    </div>`, { tipo: 'resumo', id: eid, largo: true });
}

/* ---------- resumo curto pro grupo do WhatsApp ---------- */
export async function textoResumo(ev) {
  const r = resumoDe(ev);
  if (!chamadasCarregadas(ev)) { try { await buscarChamadas(ev); } catch { /* sem chamadas no texto */ } }
  const chamadas = chamadasCarregadas(ev) || [];
  const data = dataEvento(ev);
  const visitantes = [...new Set(presencasDoEvento(ev.id).filter(p => p.jovem_id).map(p => p.jovem_id))]
    .map(id => S.data.jovens.find(j => j.id === id))
    .filter(j => j && ev.data && j.criado_em && hojeISO(new Date(j.criado_em)) === ev.data)
    .map(j => primeiroNome(j.nome));
  const cultos = cultosDoEvento(ev).filter(([c]) => c !== 'geral' && r.cultos?.[c]);
  return [
    `*${ev.nome}*${data ? ` — ${data}` : ''}`,
    `✅ ${plural(r.jovens, 'jovem', 'jovens')}${r.diretoria ? ` + ${r.diretoria} da diretoria` : ''}`,
    cultos.length > 1 ? `⏱️ ${cultos.map(([c, rot]) => `${rot}: ${plural(r.cultos[c].jovens, 'jovem', 'jovens')}`).join(' · ')}` : '',
    r.confirmados ? `🙌 ${r.confirmados_vieram} de ${plural(r.confirmados, 'confirmado veio', 'confirmados vieram')}` : '',
    visitantes.length ? `✨ Primeira vez: ${visitantes.join(', ')}` : '',
    chamadas.length ? `📞 Chamadas: ${chamadas.filter(a => a.status !== 'pendente').length} de ${chamadas.length} feitas` : '',
  ].filter(Boolean).join('\n');
}

// Celular: abre o compartilhar do sistema (escolhe o WhatsApp e o grupo). Computador: copia.
export async function compartilharResumo(eid) {
  const ev = S.data.eventos.find(e => e.id === eid);
  if (!ev) return;
  const texto = await textoResumo(ev);
  if (navigator.share && celular()) {
    try { await navigator.share({ text: texto }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(texto);
    toast('Resumo copiado, é só colar no grupo');
  } catch {
    toast('Não deu pra copiar automaticamente.', true);
  }
}


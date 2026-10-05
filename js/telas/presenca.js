// Aba Presença: um ou dois cultos (Sprint/Box), jovens e diretoria, encerrar a lista.
import { badgeAniver } from '../aniversarios.js';
import { carregar, falha, rpc } from '../api.js';
import { buscaInteligente } from '../busca.js';
import { diretor, evento, jovem, nomeQuem, porJovem, statusJovem } from '../dados.js';
import { confirmar, semAnimacao } from '../dialogos.js';
import { DEMO, S, STATUS_BY_ID } from '../estado.js';
import { abrirForm, EQUIPES } from '../formulario.js';
import { calcularResumo, cultosDoEvento, dlgResumoCulto, encerrada, pessoaDe, resumoDe } from '../frequencia.js';
import { ICON } from '../icones.js';
import { render } from '../render.js';
import { $, byNome, contagem, dataEvento, esc, faixa, faixaBadge, hojeISO, iniciais, nomeCurto, subNome, nomeMensagem, plural, primeiroNome, semAcento, toast, uid } from '../util.js';
import { pessoa, textoVinculo, vinculosDe } from '../vinculos.js';

export const presencasEv = () => (S.data?.presencas || []).filter(p => p.evento_id === S.eventoId);

// Presença no evento (em qualquer culto): usada no selo "Veio" e na busca.
export const presenca = id => presencasEv().find(p => pessoaDe(p) === id);

// Culto selecionado na aba (o primeiro do evento, se o escolhido não existir).
export function cultoAtual() {
  const cultos = cultosDoEvento(evento());
  return cultos.some(([c]) => c === S.pCulto) ? S.pCulto : cultos[0]?.[0] || 'geral';
}
const culto = p => p.culto || 'geral';
export const presencaNoCulto = (id, c = cultoAtual()) => presencasEv().find(p => pessoaDe(p) === id && culto(p) === c);

// A aba só faz sentido a partir do dia do evento.
export function presencaLiberada(ev) {
  if (!ev) return false;
  if (DEMO && !S.simularReal) return true;
  const cd = contagem(ev);
  return !cd || cd[1] === 'hoje' || cd[1] === 'passado';
}

// Lista encerrada abre em "Presentes", até alguém escolher outro filtro.
export const filtroP = () => (encerrada(evento()) && !S.pFiltroManual ? 'presentes' : S.pFiltro);

export const P_FILTROS = [
  ['todos', 'Todos'],
  ['presentes', 'Presentes'],
  ['faltam', 'Confirmados que faltam'],
  ['diretoria', 'Diretoria'],
];

export function dadosPresenca() {
  const ev = evento();
  const c = cultoAtual();
  const pj = porJovem();
  const linhas = [
    ...S.data.jovens
      .filter(j => j.ativo || presenca(j.id))
      .map(j => {
        const l = pj.get(j.id) || [];
        return { j, l, s: statusJovem(l), dir: false, p: presencaNoCulto(j.id, c), outro: presencasEv().find(p => p.jovem_id === j.id && culto(p) !== c) };
      }),
    ...S.data.diretores
      .filter(d => d.ativo || presenca(d.id))
      .map(d => ({ j: d, l: [], s: 'pendente', dir: true, p: presencaNoCulto(d.id, c), outro: presencasEv().find(p => p.diretor_id === d.id && culto(p) !== c) })),
  ];
  const jovens = linhas.filter(r => !r.dir);
  const presentes = jovens.filter(r => r.p);
  // "confirmados vieram" vale pro dia todo: quem confirmou pode ter ido em qualquer culto
  const confirmados = jovens.filter(r => r.s === 'confirmado');
  const novo = r => ev.data && r.j.criado_em && hojeISO(new Date(r.j.criado_em)) === ev.data;
  return {
    rows: linhas,
    total: presentes.length,
    diretoria: linhas.filter(r => r.dir && r.p).length,
    confVieram: confirmados.filter(r => presenca(r.j.id)).length,
    confTotal: confirmados.length,
    semConfirmar: presentes.filter(r => r.s !== 'confirmado').length,
    novos: presentes.filter(novo).length,
    box: presentes.filter(r => faixa(r.j) === 'box').length,
    sprint: presentes.filter(r => faixa(r.j) === 'sprint').length,
    noDia: new Set(presencasEv().filter(p => p.jovem_id).map(p => p.jovem_id)).size,
  };
}

export const passaFiltroP = (r, f) => f === 'todos' || (f === 'diretoria' ? r.dir
  : f === 'presentes' ? !!r.p : !r.dir && !presenca(r.j.id) && r.s === 'confirmado');

export function htmlTopoPresenca() {
  const ev = evento();
  const d = dadosPresenca();
  const varios = cultosDoEvento(ev).length > 1;
  return `
    <div class="pres-num">
      <span class="eyebrow">Jovens presentes${varios ? ' neste culto' : ''}</span>
      <strong>${d.total}</strong>
      <small>${ev.publico === 'todos' && d.total ? `${d.box} Box · ${d.sprint} Sprint` : ''}${varios ? `${d.total ? ' · ' : ''}${plural(d.noDia, 'jovem', 'jovens')} no dia` : ''}</small>
    </div>
    <div class="pres-tiles">
      <div class="pres-tile st-confirmado"><strong>${d.confVieram}<span>/${d.confTotal}</span></strong><small>confirmados vieram</small></div>
      <div class="pres-tile st-chamado"><strong>${d.semConfirmar}</strong><small>vieram sem confirmar</small></div>
      <div class="pres-tile st-presente"><strong>${d.novos}</strong><small>primeira vez</small></div>
      <div class="pres-tile st-diretoria"><strong>${d.diretoria}</strong><small>da diretoria</small></div>
    </div>`;
}

export function cardPresenca({ j, l, s, p, dir, outro }) {
  const cultos = cultosDoEvento(evento());
  const nomeOutro = outro && (cultos.find(([c]) => c === culto(outro))?.[1] || '').split(' ')[0];
  const quem = l.length ? l.map(a => esc(nomeCurto(diretor(a.diretor_id)))).join(' e ') : '';
  const sub = p
    ? `Chegou ${new Date(p.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${p.marcado_por ? ` · por ${esc(p.marcado_por)}` : ''}`
    : dir ? `Diretoria · equipe ${j.equipe === 'F' ? 'feminina' : 'masculina'}`
    : s === 'pendente' ? (quem ? `Ninguém chamou ainda · ${quem}` : 'Não estava na lista de chamada')
    : `${STATUS_BY_ID[s].label}${quem ? ` · ${quem}` : ''}`;
  return `
    <button class="pcheck ${p ? 'presente' : ''} st-${s} ${dir ? 'dir' : ''}" data-act="presenca" data-id="${j.id}" aria-pressed="${!!p}">
      <span class="avatar" aria-hidden="true">${p ? ICON.check : esc(iniciais(j.nome))}</span>
      <span class="jcard-txt">
        <span class="jcard-nome"><strong>${esc(nomeCurto(j))}</strong>${dir ? '<span class="pill st-chamado">Diretoria</span>' : faixa(j) ? faixaBadge(j) : ''}${badgeAniver(j)}</span>${subNome(j)}
        <span class="pcheck-sub">${!p && s === 'confirmado' ? '<span class="dot"></span>' : ''}${sub}${nomeOutro ? ` · <b class="no-outro">✓ também no ${esc(nomeOutro)}</b>` : ''}</span>
      </span>
      <span class="pcheck-box" aria-hidden="true">${ICON.check}</span>
    </button>`;
}

export function htmlListaPresenca() {
  const q = semAcento(S.buscaP);
  const busca = buscaInteligente(S.buscaP);
  const d = dadosPresenca();
  const rows = d.rows
    .filter(r => passaFiltroP(r, filtroP()) && busca(r.j))
    .sort((a, b) => byNome(a.j, b.j));
  if (!rows.length) {
    if (q && filtroP() !== 'diretoria' && !encerrada(evento())) {
      return `<div class="vazio"><p>Ninguém com “${esc(S.buscaP.trim())}” no cadastro.</p>
        <button class="btn primary" data-act="visitante">${ICON.addPessoa}Cadastrar “${esc(S.buscaP.trim())}” como visitante</button></div>`;
    }
    const f = filtroP();
    return `<div class="vazio"><p>${f === 'faltam' ? 'Todos os confirmados vieram. 🙌' : f === 'presentes' ? 'Ninguém marcado neste culto.' : 'Ninguém aqui.'}</p></div>`;
  }
  const sug = S.sugJunto;
  // a sugestão fica na mesma célula do card (não ocupa a linha inteira da grade)
  return `<div class="jgrid pres-grid">${rows.map(r => !(sug && sug.jid === r.j.id) ? cardPresenca(r) : `<div class="pcell">${cardPresenca(r)}
    <div class="pres-junto">
      <span><b>Veio junto?</b> Toque pra marcar também:</span>
      <div class="chips">${sug.ids.map(id => {
        const t = textoVinculo(vinculosDe(r.j.id).find(v => v.a_id === id || v.b_id === id), id);
        return `<button class="chip" data-act="presenca-junto" data-id="${id}">${ICON.check}${esc(pessoa(id)?.p.nome || '')}${t ? ` <small>· ${esc(t.rot.toLowerCase())}</small>` : ''}</button>`;
      }).join('')}</div>
      <button class="x" data-act="junto-fechar" aria-label="Dispensar">${ICON.xis}</button>
    </div></div>`).join('')}</div>`;
}

export function htmlChipsPresenca() {
  const d = dadosPresenca();
  const fechada = encerrada(evento());
  return P_FILTROS.map(([id, l]) => `
    <button class="chip" data-act="p-filtro" data-id="${id}" aria-pressed="${filtroP() === id}">${fechada && id === 'faltam' ? 'Faltaram' : l}<span class="c">${d.rows.filter(r => passaFiltroP(r, id)).length}</span></button>`).join('');
}

function htmlEncerrada(ev) {
  const r = resumoDe(ev);
  const quando = new Date(ev.presenca_encerrada_em);
  return `
    <section class="pres-encerrada">
      <span class="pres-encerrada-ic">${ICON.check}</span>
      <div class="pres-encerrada-txt">
        <span class="eyebrow">Lista encerrada</span>
        <strong>${plural(r.jovens, 'jovem', 'jovens')}${r.diretoria ? ` · ${r.diretoria} da diretoria` : ''}</strong>
        <small>por ${esc(ev.presenca_encerrada_por || '—')} em ${quando.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. A lista abaixo fica só pra consulta.</small>
      </div>
      <div class="row-btns">
        <button class="btn ghost" data-act="reabrir-presenca">Reabrir</button>
        <button class="btn primary" data-act="resumo-culto" data-id="${ev.id}">Ver resumo</button>
      </div>
    </section>`;
}

export function viewPresenca() {
  const ev = evento();
  const cd = contagem(ev);
  const cultos = cultosDoEvento(ev);
  const c = cultoAtual();
  const fechada = encerrada(ev);
  const aviso = DEMO && cd && cd[1] !== 'hoje' && cd[1] !== 'passado'
    ? `<div class="pres-aviso demo">${ICON.info}<div><strong>Liberada só no modo demonstração</strong>
      <small>No site real, a aba Presença só aparece no dia do evento (${esc(dataEvento(ev))}).</small></div></div>`
    : '';
  return `
    ${aviso}
    ${fechada ? htmlEncerrada(ev) : ''}
    ${cultos.length > 1 ? `<div class="pres-cultos" role="tablist" aria-label="Culto">${cultos.map(([id, rot]) => `
      <button role="tab" data-act="p-culto" data-id="${id}" aria-selected="${c === id}">${esc(rot)}
        <span class="c">${presencasEv().filter(p => culto(p) === id).length}</span></button>`).join('')}</div>` : ''}
    <div class="${fechada ? 'pres-fechada' : ''}">
      <section class="pres-topo" id="ptopo">${htmlTopoPresenca()}</section>
      <div class="jtoolbar">
        <div class="pres-busca">
          <label class="busca">${ICON.lupa}
            <input type="search" id="busca-p" placeholder="${fechada ? 'Buscar na lista' : 'Quem chegou?'}" value="${esc(S.buscaP)}" aria-label="Buscar pessoa" autocomplete="off">
          </label>
          ${fechada ? '' : `<button class="btn primary" data-act="visitante">${ICON.addPessoa}<span>Visitante</span></button>`}
        </div>
        <div class="jfiltros"><div class="chips" id="pchips" role="group" aria-label="Filtrar">${htmlChipsPresenca()}</div></div>
      </div>
      <div id="plista">${htmlListaPresenca()}</div>
    </div>
    ${fechada ? '' : `
      <div class="pres-encerrar">
        <span class="pres-encerrar-ic">${ICON.check}</span>
        <div><strong>Terminou o culto?</strong><small>Encerrar trava as marcações e salva o resumo${cultos.length > 1 ? ' dos dois cultos' : ''}. Dá pra reabrir depois.</small></div>
        <button class="btn hero-cta" data-act="encerrar-presenca">Encerrar lista</button>
      </div>`}`;
}

export function atualizarPresenca() {
  if (S.tab !== 'presenca' || !$('#plista')) return render();
  $('#ptopo').innerHTML = htmlTopoPresenca();
  $('#pchips').innerHTML = htmlChipsPresenca();
  $('#plista').innerHTML = htmlListaPresenca();
  document.querySelectorAll('.pres-cultos [data-id] .c').forEach(el => {
    el.textContent = presencasEv().filter(p => culto(p) === el.parentElement.dataset.id).length;
  });
}

export async function togglePresenca(id, junto = false) {
  const ev = evento();
  if (!presencaLiberada(ev) || encerrada(ev)) return;
  const quem = pessoa(id);
  if (!quem) return;
  const c = cultoAtual();
  const atual = presencaNoCulto(id, c);
  const lista = S.data.presencas;
  if (atual) S.data.presencas = lista.filter(p => p !== atual);
  else {
    S.data.presencas = [...lista, {
      id: uid(), evento_id: ev.id, culto: c, marcado_por: nomeQuem(), em: new Date().toISOString(),
      jovem_id: quem.tipo === 'jovem' ? id : null, diretor_id: quem.tipo === 'diretor' ? id : null,
    }];
  }
  if (!junto) {
    // ao marcar alguém, sugere quem tem vínculo e ainda não chegou neste culto
    const ligados = atual ? [] : vinculosDe(id).map(v => (v.a_id === id ? v.b_id : v.a_id))
      .filter(x => pessoa(x)?.p.ativo && !presencaNoCulto(x, c));
    S.sugJunto = ligados.length ? { jid: id, ids: [...new Set(ligados)] } : null;
  } else if (S.sugJunto) {
    S.sugJunto.ids = S.sugJunto.ids.filter(x => x !== id);
    if (!S.sugJunto.ids.length) S.sugJunto = null;
  }
  navigator.vibrate?.(12);
  S.data.historico.unshift({ evento_id: ev.id, quem: nomeQuem(), jovem: quem.p.nome, status: atual ? 'ausente' : 'presente', em: new Date().toISOString() });
  atualizarPresenca();
  if (!junto && S.sugJunto) $('.pres-junto')?.scrollIntoView({ block: 'nearest', behavior: semAnimacao() ? 'auto' : 'smooth' });
  try {
    await rpc('box_presenca', { p_evento: ev.id, p_jovem: id, p_presente: !atual, p_quem: nomeQuem(), p_culto: c });
  } catch (e) {
    S.data.presencas = lista;
    S.data.historico.shift();
    if (String(e.message).includes('lista_encerrada')) {
      toast('A lista foi encerrada por outra pessoa.', true);
      await carregar();
      return render();
    }
    atualizarPresenca();
    falha(e);
  }
}

export async function encerrarPresenca() {
  const ev = evento();
  const r = calcularResumo(ev);
  const ok = await confirmar({
    titulo: 'Encerrar a lista de presença?', ok: 'Encerrar',
    texto: `${plural(r.jovens, 'jovem', 'jovens')}${r.diretoria ? ` e ${r.diretoria} da diretoria` : ''} marcados.
      Depois de encerrar ninguém mais marca, mas dá pra reabrir pra corrigir.`,
  });
  if (!ok) return;
  try {
    await rpc('box_encerrar_presenca', { p_evento: ev.id, p_encerrar: true, p_quem: nomeQuem(), p_resumo: r });
    await carregar();
    render();
    S.resumo = null;
    dlgResumoCulto(ev.id);
  } catch (e) { falha(e); }
}

export async function reabrirPresenca() {
  const ev = evento();
  const ok = await confirmar({ titulo: 'Reabrir a lista?', ok: 'Reabrir', texto: 'As marcações voltam a ficar liberadas. Ao encerrar de novo, o resumo é refeito.' });
  if (!ok) return;
  try {
    await rpc('box_encerrar_presenca', { p_evento: ev.id, p_encerrar: false, p_quem: nomeQuem() });
    await carregar();
    render();
  } catch (e) { falha(e); }
}

// Evento que já aconteceu: encerra a presença (se aberta), finaliza a chamada e manda pro histórico.
export async function encerrarEvento() {
  const ev = evento();
  const presencaAberta = !encerrada(ev);
  const ok = await confirmar({
    titulo: `Encerrar “${esc(ev.nome)}”?`, ok: 'Encerrar evento',
    texto: `${presencaAberta ? 'A lista de presença é encerrada com o resumo, a' : 'A'} chamada é finalizada (sai da Minha lista de todo mundo)
      e o evento vai pro histórico. O resumo fica em Histórico › Presenças. Dá pra reabrir em Gerenciar › Eventos.`,
  });
  if (!ok) return;
  try {
    if (presencaAberta) await rpc('box_encerrar_presenca', { p_evento: ev.id, p_encerrar: true, p_quem: nomeQuem(), p_resumo: calcularResumo(ev) });
    await rpc('box_salvar', { p_tabela: 'eventos', p_dados: { ...ev, arquivado: true } });
    await carregar();
    render();
    toast(`${ev.nome} encerrado. O resumo fica em Histórico › Presenças.`);
  } catch (e) { falha(e); }
}

export function formVisitante() {
  const ev = evento();
  if (!presencaLiberada(ev) || encerrada(ev)) return;
  const nomeBusca = S.buscaP.trim();
  const c = cultoAtual();
  abrirForm({
    titulo: 'Visitante',
    sub: `Cadastra e já marca presença em ${esc(ev.nome)}${c !== 'geral' ? ` (${c === 'box' ? 'Box' : 'Sprint'})` : ''}.`,
    textoSalvar: 'Cadastrar e marcar presença',
    campos: [
      { nome: 'nome', label: 'Nome', obrig: true, full: true, autofocus: true, placeholder: 'Nome completo' },
      { nome: 'apelido', label: 'Apelido', full: true, placeholder: 'Opcional' },
      { nome: 'genero', label: 'Equipe', tipo: 'segmentado', padrao: 'F', opcoes: EQUIPES, full: true },
      { nome: 'telefone', label: 'WhatsApp', tipo: 'tel', placeholder: '(11) 91234-5678' },
      { nome: 'nascimento', label: 'Data de nascimento', tipo: 'date', dica: 'Opcional' },
    ],
    valores: { nome: nomeBusca },
    onSalvar: async dados => {
      dados.id = uid();
      dados.obs = `Primeira vez: ${ev.nome}${ev.data ? ` (${dataEvento(ev, { day: '2-digit', month: '2-digit', year: 'numeric' })})` : ''}`;
      await rpc('box_salvar', { p_tabela: 'jovens', p_dados: dados });
      await rpc('box_presenca', { p_evento: ev.id, p_jovem: dados.id, p_presente: true, p_quem: nomeQuem(), p_culto: c });
      S.buscaP = '';
      toast(`${nomeMensagem(dados)} cadastrado(a) e presente 🎉`);
    },
  });
}

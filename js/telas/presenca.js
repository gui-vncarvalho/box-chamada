// Aba Presença.
import { badgeAniver } from '../aniversarios.js';
import { falha, rpc } from '../api.js';
import { buscaInteligente } from '../busca.js';
import { diretor, evento, jovem, nomeQuem, porJovem, statusJovem } from '../dados.js';
import { demo } from '../demo.js';
import { confirmar, semAnimacao } from '../dialogos.js';
import { DEMO, S, STATUS_BY_ID } from '../estado.js';
import { abrirForm, EQUIPES } from '../formulario.js';
import { ICON } from '../icones.js';
import { render } from '../render.js';
import { $, byNome, contagem, dataEvento, esc, faixa, faixaBadge, hojeISO, iniciais, primeiroNome, semAcento, toast, uid } from '../util.js';
import { textoVinculo, vinculosDe } from '../vinculos.js';

export const presencasEv = () => (S.data?.presencas || []).filter(p => p.evento_id === S.eventoId);

export const presenca = jid => presencasEv().find(p => p.jovem_id === jid);

// A aba só faz sentido a partir do dia do evento.
export function presencaLiberada(ev) {
  if (!ev) return false;
  if (DEMO && !S.simularReal) return true;
  const cd = contagem(ev);
  return !cd || cd[1] === 'hoje' || cd[1] === 'passado';
}

export const P_FILTROS = [
  ['todos', 'Todos'],
  ['presentes', 'Presentes'],
  ['faltam', 'Confirmados que faltam'],
];

export function dadosPresenca() {
  const ev = evento();
  const pj = porJovem();
  const pres = new Map(presencasEv().map(p => [p.jovem_id, p]));
  const rows = S.data.jovens
    .filter(j => j.ativo || pres.has(j.id))
    .map(j => {
      const l = pj.get(j.id) || [];
      return { j, l, s: statusJovem(l), p: pres.get(j.id) };
    });
  const presentes = rows.filter(r => r.p);
  const confirmados = rows.filter(r => r.s === 'confirmado');
  const novo = r => ev.data && r.j.criado_em && hojeISO(new Date(r.j.criado_em)) === ev.data;
  return {
    rows,
    total: presentes.length,
    confVieram: confirmados.filter(r => r.p).length,
    confTotal: confirmados.length,
    semConfirmar: presentes.filter(r => r.s !== 'confirmado').length,
    novos: presentes.filter(novo).length,
    box: presentes.filter(r => faixa(r.j) === 'box').length,
    sprint: presentes.filter(r => faixa(r.j) === 'sprint').length,
  };
}

export const passaFiltroP = (r, f) => f === 'todos' || (f === 'presentes' ? !!r.p : !r.p && r.s === 'confirmado');

export function htmlTopoPresenca() {
  const ev = evento();
  const d = dadosPresenca();
  return `
    <div class="pres-num">
      <span class="eyebrow">Presentes</span>
      <strong>${d.total}</strong>
      ${ev.publico === 'todos' && d.total ? `<small>${d.box} Box · ${d.sprint} Sprint</small>` : ''}
    </div>
    <div class="pres-tiles">
      <div class="pres-tile st-confirmado"><strong>${d.confVieram}<span>/${d.confTotal}</span></strong><small>confirmados vieram</small></div>
      <div class="pres-tile st-chamado"><strong>${d.semConfirmar}</strong><small>vieram sem confirmar</small></div>
      <div class="pres-tile st-presente"><strong>${d.novos}</strong><small>primeira vez</small></div>
    </div>`;
}

export function cardPresenca({ j, l, s, p }) {
  const quem = l.length ? l.map(a => esc(diretor(a.diretor_id)?.nome)).join(' e ') : '';
  const sub = p
    ? `Chegou ${new Date(p.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${p.marcado_por ? ` · por ${esc(p.marcado_por)}` : ''}`
    : s === 'pendente' ? (quem ? `Ninguém chamou ainda · ${quem}` : 'Não estava na lista de chamada')
    : `${STATUS_BY_ID[s].label}${quem ? ` · ${quem}` : ''}`;
  return `
    <button class="pcheck ${p ? 'presente' : ''} st-${s}" data-act="presenca" data-id="${j.id}" aria-pressed="${!!p}">
      <span class="avatar" aria-hidden="true">${p ? ICON.check : esc(iniciais(j.nome))}</span>
      <span class="jcard-txt">
        <span class="jcard-nome"><strong>${esc(j.nome)}</strong>${faixa(j) ? faixaBadge(j) : ''}${badgeAniver(j)}</span>
        <span class="pcheck-sub">${!p && s === 'confirmado' ? '<span class="dot"></span>' : ''}${sub}</span>
      </span>
      <span class="pcheck-box" aria-hidden="true">${ICON.check}</span>
    </button>`;
}

export function htmlListaPresenca() {
  const q = semAcento(S.buscaP);
  const busca = buscaInteligente(S.buscaP);
  const d = dadosPresenca();
  const rows = d.rows
    .filter(r => passaFiltroP(r, S.pFiltro) && busca(r.j))
    .sort((a, b) => byNome(a.j, b.j));
  if (!rows.length) {
    if (q) {
      return `<div class="vazio"><p>Ninguém com “${esc(S.buscaP.trim())}” no cadastro.</p>
        <button class="btn primary" data-act="visitante">${ICON.addPessoa}Cadastrar “${esc(S.buscaP.trim())}” como visitante</button></div>`;
    }
    return `<div class="vazio"><p>${S.pFiltro === 'faltam' ? 'Todos os confirmados já chegaram. 🙌' : S.pFiltro === 'presentes' ? 'Ninguém marcado ainda.' : 'Nenhum jovem no cadastro.'}</p></div>`;
  }
  const sug = S.sugJunto;
  return `<div class="jgrid">${rows.map(r => cardPresenca(r) + (sug && sug.jid === r.j.id ? `
    <div class="pres-junto">
      <span><b>Veio junto?</b> Toque pra marcar também:</span>
      <div class="chips">${sug.ids.map(id => {
        const t = textoVinculo(vinculosDe(r.j.id).find(v => v.a_id === id || v.b_id === id), id);
        return `<button class="chip" data-act="presenca-junto" data-id="${id}">${ICON.check}${esc(jovem(id).nome)}${t ? ` <small>· ${esc(t.rot.toLowerCase())}</small>` : ''}</button>`;
      }).join('')}</div>
      <button class="x" data-act="junto-fechar" aria-label="Dispensar">${ICON.xis}</button>
    </div>` : '')).join('')}</div>`;
}

export function htmlChipsPresenca() {
  const d = dadosPresenca();
  return P_FILTROS.map(([id, l]) => `
    <button class="chip" data-act="p-filtro" data-id="${id}" aria-pressed="${S.pFiltro === id}">${l}<span class="c">${d.rows.filter(r => passaFiltroP(r, id)).length}</span></button>`).join('');
}

export function viewPresenca() {
  const ev = evento();
  const cd = contagem(ev);
  const aviso = DEMO && cd && cd[1] !== 'hoje' && cd[1] !== 'passado'
    ? `<div class="pres-aviso demo">${ICON.info}<div><strong>Liberada só no modo demonstração</strong>
      <small>No site real, a aba Presença só aparece no dia do evento (${esc(dataEvento(ev))}).</small></div></div>`
    : '';
  return `
    ${aviso}
    <section class="pres-topo" id="ptopo">${htmlTopoPresenca()}</section>
    <div class="jtoolbar">
      <div class="pres-busca">
        <label class="busca">${ICON.lupa}
          <input type="search" id="busca-p" placeholder="Quem chegou?" value="${esc(S.buscaP)}" aria-label="Buscar jovem" autocomplete="off">
        </label>
        <button class="btn primary" data-act="visitante">${ICON.addPessoa}<span>Visitante</span></button>
      </div>
      <div class="jfiltros"><div class="chips" id="pchips" role="group" aria-label="Filtrar">${htmlChipsPresenca()}</div></div>
    </div>
    <div id="plista">${htmlListaPresenca()}</div>`;
}

export function atualizarPresenca() {
  if (S.tab !== 'presenca' || !$('#plista')) return render();
  $('#ptopo').innerHTML = htmlTopoPresenca();
  $('#pchips').innerHTML = htmlChipsPresenca();
  $('#plista').innerHTML = htmlListaPresenca();
}

export async function togglePresenca(jid, junto = false) {
  const ev = evento();
  if (!presencaLiberada(ev)) return;
  const atual = presenca(jid);
  const lista = S.data.presencas;
  if (atual) S.data.presencas = lista.filter(p => p !== atual);
  else S.data.presencas = [...lista, { evento_id: ev.id, jovem_id: jid, marcado_por: nomeQuem(), em: new Date().toISOString() }];
  if (!junto) {
    // ao marcar alguém, sugere quem tem vínculo e ainda não chegou
    const ligados = atual ? [] : vinculosDe(jid).map(v => (v.a_id === jid ? v.b_id : v.a_id)).filter(id => jovem(id)?.ativo && !presenca(id));
    S.sugJunto = ligados.length ? { jid, ids: [...new Set(ligados)] } : null;
  } else if (S.sugJunto) {
    S.sugJunto.ids = S.sugJunto.ids.filter(id => id !== jid);
    if (!S.sugJunto.ids.length) S.sugJunto = null;
  }
  navigator.vibrate?.(12);
  S.data.historico.unshift({ evento_id: ev.id, quem: nomeQuem(), jovem: jovem(jid)?.nome, status: atual ? 'ausente' : 'presente', em: new Date().toISOString() });
  atualizarPresenca();
  if (!junto && S.sugJunto) $('.pres-junto')?.scrollIntoView({ block: 'nearest', behavior: semAnimacao() ? 'auto' : 'smooth' });
  try {
    await rpc('box_presenca', { p_evento: ev.id, p_jovem: jid, p_presente: !atual, p_quem: nomeQuem() });
  } catch (e) {
    S.data.presencas = lista;
    S.data.historico.shift();
    atualizarPresenca();
    falha(e);
  }
}

export function formVisitante() {
  const ev = evento();
  if (!presencaLiberada(ev)) return;
  const nomeBusca = S.buscaP.trim();
  abrirForm({
    titulo: 'Visitante',
    sub: `Cadastra e já marca presença em ${esc(ev.nome)}.`,
    textoSalvar: 'Cadastrar e marcar presença',
    campos: [
      { nome: 'nome', label: 'Nome', obrig: true, full: true, autofocus: true, placeholder: 'Nome (apelido)' },
      { nome: 'genero', label: 'Equipe', tipo: 'segmentado', padrao: 'F', opcoes: EQUIPES, full: true },
      { nome: 'telefone', label: 'WhatsApp', tipo: 'tel', placeholder: '(11) 91234-5678' },
      { nome: 'nascimento', label: 'Data de nascimento', tipo: 'date', dica: 'Opcional' },
    ],
    valores: { nome: nomeBusca },
    onSalvar: async dados => {
      dados.id = uid();
      dados.obs = `Primeira vez: ${ev.nome}${ev.data ? ` (${dataEvento(ev, { day: '2-digit', month: '2-digit', year: 'numeric' })})` : ''}`;
      await rpc('box_salvar', { p_tabela: 'jovens', p_dados: dados });
      await rpc('box_presenca', { p_evento: ev.id, p_jovem: dados.id, p_presente: true, p_quem: nomeQuem() });
      S.buscaP = '';
      toast(`${primeiroNome(dados.nome)} cadastrado(a) e presente 🎉`);
    },
  });
}

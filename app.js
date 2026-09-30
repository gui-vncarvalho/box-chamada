'use strict';

/* =====================================================================
   Central de Chamada BOX
   ===================================================================== */

const CFG = window.BOX_CONFIG || {};
const DEMO = !CFG.supabaseUrl || !CFG.supabaseKey;
const IDADE_BOX = 17;
const POLL_MS = 12000;

const LS = {
  get(k) { try { return localStorage.getItem('box:' + k); } catch { return null; } },
  set(k, v) {
    try { v == null ? localStorage.removeItem('box:' + k) : localStorage.setItem('box:' + k, v); } catch {}
  },
};

const STATUS = [
  { id: 'pendente', label: 'Pendente', feed: 'voltou para pendente' },
  { id: 'chamado', label: 'Chamei', feed: 'chamou' },
  { id: 'confirmado', label: 'Confirmou', feed: 'confirmou' },
  { id: 'nao_vai', label: 'Não vai', feed: 'marcou "não vai" para' },
];
const STATUS_BY_ID = Object.fromEntries(STATUS.map(s => [s.id, s]));
const PRIORIDADE = { confirmado: 4, nao_vai: 3, chamado: 2, pendente: 1 };

const MSG_PADRAO =
  'Oi, {nome}! Tudo bem? 😊 Aqui é {eu}, do Box. Passando pra te chamar pro {evento}{quando}. ' +
  'Bora? Vai ser muito bom ter você com a gente! 🔥';

const S = {
  codigo: LS.get('codigo'),
  me: LS.get('me'),
  eventoId: LS.get('evento'),
  tab: LS.get('tab') || 'minha',
  busca: '',
  filtro: 'todos',
  buscaMg: '',
  data: null,
  dlg: null,
  erroLogin: '',
};

/* ---------------------------------------------------------------------
   Utilidades
   --------------------------------------------------------------------- */
const $ = sel => document.querySelector(sel);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Math.random().toString(16).slice(2) + Date.now());

function idade(nasc) {
  if (!nasc) return null;
  const [y, m, d] = nasc.split('-').map(Number);
  const t = new Date();
  let a = t.getFullYear() - y;
  if (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < d)) a--;
  return a;
}
function faixa(j) {
  const i = idade(j.nascimento);
  if (i == null) return null;
  return i >= IDADE_BOX ? 'box' : 'sprint';
}
function faixaBadge(j) {
  const i = idade(j.nascimento);
  const f = faixa(j);
  if (!f) return '<span class="faixa nd" title="Sem data de nascimento">idade?</span>';
  return `<span class="faixa ${f}">${f === 'box' ? 'Box' : 'Sprint'} · ${i}</span>`;
}
function elegivel(j, ev) {
  if (!j.ativo) return false;
  if (ev.publico === 'todos') return true;
  const f = faixa(j);
  return f == null || f === ev.publico;
}

function digitos(tel) { return String(tel || '').replace(/\D/g, ''); }
function fmtTel(tel) {
  const d = digitos(tel).replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel || '';
}
function telIntl(tel) {
  const d = digitos(tel);
  if (d.length === 10 || d.length === 11) return '55' + d;
  return d;
}

function dataEvento(ev, opts = { weekday: 'long', day: '2-digit', month: '2-digit' }) {
  if (!ev.data) return '';
  const [y, m, d] = ev.data.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', opts);
}
function quandoEvento(ev) {
  return [dataEvento(ev), ev.hora].filter(Boolean).join(' · ');
}
const PUBLICO_LABEL = { box: 'Box (17+)', sprint: 'Sprint (até 16)', todos: 'Box + Sprint' };

function primeiroNome(nome) { return String(nome).replace(/\s*\(.*?\)\s*/g, ' ').trim(); }

function mensagem(ev, jovem) {
  const eu = diretor(S.me);
  let quando = '';
  if (ev.data) quando += ` ${dataEvento(ev)}`;
  if (ev.hora) quando += `, às ${ev.hora}`;
  if (quando) quando = ',' + quando;
  return (ev.mensagem || MSG_PADRAO)
    .replaceAll('{nome}', primeiroNome(jovem.nome))
    .replaceAll('{eu}', eu ? eu.nome : 'a diretoria')
    .replaceAll('{evento}', ev.nome)
    .replaceAll('{quando}', quando)
    .replaceAll('{data}', dataEvento(ev))
    .replaceAll('{hora}', ev.hora || '');
}
function linkWhats(ev, jovem) {
  const n = telIntl(jovem.telefone);
  if (!n) return null;
  return `https://api.whatsapp.com/send?phone=${n}&text=${encodeURIComponent(mensagem(ev, jovem))}`;
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function tempoAtras(ts) {
  const s = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 60) return 'agora';
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

function embaralhar(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    [a[i], a[k]] = [a[k], a[i]];
  }
  return a;
}

let toastTimer;
function toast(msg, erro = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show' + (erro ? ' erro' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, erro ? 4000 : 2200);
}

const ICON = {
  wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.2Z"/></svg>',
  tel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
};

/* ---------------------------------------------------------------------
   Distribuição automática (quem chama quem)
   --------------------------------------------------------------------- */
function distribuir(ev, jovens, diretores, existentes, manter) {
  const pares = manter ? existentes.map(a => ({ jovem_id: a.jovem_id, diretor_id: a.diretor_id })) : [];
  const carga = new Map(diretores.map(d => [d.id, 0]));
  pares.forEach(p => carga.has(p.diretor_id) && carga.set(p.diretor_id, carga.get(p.diretor_id) + 1));
  for (const j of embaralhar(jovens.filter(j => elegivel(j, ev)))) {
    const dirs = diretores.filter(d => d.ativo && d.equipe === j.genero);
    const ja = new Set(pares.filter(p => p.jovem_id === j.id).map(p => p.diretor_id));
    const faltam = Math.min(ev.chamadas_por_jovem, dirs.length) - ja.size;
    if (faltam <= 0) continue;
    const rnd = new Map(dirs.map(d => [d.id, Math.random()]));
    dirs
      .filter(d => !ja.has(d.id))
      .sort((a, b) => carga.get(a.id) - carga.get(b.id) || rnd.get(a.id) - rnd.get(b.id))
      .slice(0, faltam)
      .forEach(d => {
        carga.set(d.id, carga.get(d.id) + 1);
        pares.push({ jovem_id: j.id, diretor_id: d.id });
      });
  }
  return pares;
}

/* ---------------------------------------------------------------------
   Modo demonstração (dados fictícios no navegador)
   --------------------------------------------------------------------- */
const demo = (() => {
  const KEY = 'box-demo-db';
  function seed() {
    const dirF = ['Ana', 'Bia', 'Carol', 'Dani', 'Lu'];
    const dirM = ['Rafa', 'Téo', 'Vini', 'Zé'];
    const jovF = ['Alice', 'Bruna', 'Camila', 'Duda', 'Elisa', 'Helena', 'Isa', 'Júlia', 'Laís', 'Lara', 'Manu', 'Nina'];
    const jovM = ['Arthur', 'Bento', 'Caio', 'Davi', 'Enzo', 'Heitor', 'Igor', 'Lucas', 'Miguel', 'Pedro'];
    const hoje = new Date();
    const nasc = i => {
      const idadeFake = 14 + (i * 7) % 11;
      return `${hoje.getFullYear() - idadeFake}-0${1 + (i % 9)}-1${i % 9}`;
    };
    const diretores = [
      ...dirF.map(nome => ({ id: uid(), nome, equipe: 'F', telefone: null, ativo: true })),
      ...dirM.map(nome => ({ id: uid(), nome, equipe: 'M', telefone: null, ativo: true })),
    ];
    const jovens = [...jovF.map(n => [n, 'F']), ...jovM.map(n => [n, 'M'])].map(([nome, genero], i) => ({
      id: uid(), nome, genero, ativo: true, obs: null,
      telefone: i % 5 === 3 ? null : `119${String(80000000 + i * 1234567).slice(0, 8)}`,
      nascimento: i % 6 === 5 ? null : nasc(i),
    }));
    const sab = new Date(hoje);
    sab.setDate(hoje.getDate() + ((6 - hoje.getDay() + 7) % 7 || 7));
    const ev = {
      id: uid(), nome: 'Culto Box', data: sab.toISOString().slice(0, 10), hora: '19h30',
      publico: 'box', chamadas_por_jovem: 2, mensagem: null, arquivado: false, criado_em: new Date().toISOString(),
    };
    const atribuicoes = distribuir(ev, jovens, diretores, [], false).map(p => ({
      id: uid(), evento_id: ev.id, ...p, status: 'pendente', nota: null, atualizado_por: null, atualizado_em: null,
    }));
    return { diretores, jovens, eventos: [ev], atribuicoes, historico: [] };
  }
  function load() {
    try { const t = localStorage.getItem(KEY); if (t) return JSON.parse(t); } catch {}
    const db = seed();
    save(db);
    return db;
  }
  function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} }
  const nome = (lista, id) => (lista.find(x => x.id === id) || {}).nome;

  return {
    box_carregar() {
      const db = load();
      const ativos = new Set(db.eventos.filter(e => !e.arquivado).map(e => e.id));
      return {
        diretores: [...db.diretores].sort(byNome),
        jovens: [...db.jovens].sort(byNome),
        eventos: [...db.eventos].sort((a, b) => (b.data || '').localeCompare(a.data || '')),
        atribuicoes: db.atribuicoes.filter(a => ativos.has(a.evento_id)),
        historico: db.historico.slice(0, 300),
      };
    },
    box_status({ p_id, p_status, p_quem, p_nota }) {
      const db = load();
      const a = db.atribuicoes.find(x => x.id === p_id);
      if (!a) throw new Error('nao_encontrado');
      if (p_status) a.status = p_status;
      if (p_nota != null) a.nota = p_nota || null;
      a.atualizado_por = p_quem;
      a.atualizado_em = new Date().toISOString();
      if (p_status) {
        db.historico.unshift({
          id: Date.now(), evento_id: a.evento_id, quem: p_quem, status: p_status, em: a.atualizado_em,
          jovem: nome(db.jovens, a.jovem_id), diretor: nome(db.diretores, a.diretor_id),
        });
      }
      save(db);
    },
    box_salvar({ p_tabela, p_dados }) {
      const db = load();
      const lista = db[p_tabela];
      if (!lista) throw new Error('tabela_invalida');
      const rows = Array.isArray(p_dados) ? p_dados : [p_dados];
      for (const r of rows) {
        const limpo = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === '' ? null : v]));
        const i = lista.findIndex(x => x.id === r.id);
        if (i >= 0) lista[i] = { ...lista[i], ...limpo };
        else lista.push({ ativo: true, arquivado: false, criado_em: new Date().toISOString(), ...limpo, id: r.id || uid() });
      }
      save(db);
      return rows.length;
    },
    box_excluir({ p_tabela, p_id }) {
      const db = load();
      db[p_tabela] = db[p_tabela].filter(x => x.id !== p_id);
      const campo = { jovens: 'jovem_id', diretores: 'diretor_id', eventos: 'evento_id' }[p_tabela];
      db.atribuicoes = db.atribuicoes.filter(a => a[campo] !== p_id);
      if (p_tabela === 'eventos') db.historico = db.historico.filter(h => h.evento_id !== p_id);
      save(db);
    },
    box_atribuir({ p_evento, p_pares }) {
      const db = load();
      const chave = p => p.jovem_id + '|' + p.diretor_id;
      const novos = new Set(p_pares.map(chave));
      db.atribuicoes = db.atribuicoes.filter(a => a.evento_id !== p_evento || novos.has(chave(a)));
      const existentes = new Set(db.atribuicoes.filter(a => a.evento_id === p_evento).map(chave));
      for (const p of p_pares) {
        if (!existentes.has(chave(p))) {
          db.atribuicoes.push({ id: uid(), evento_id: p_evento, ...p, status: 'pendente', nota: null, atualizado_por: null, atualizado_em: null });
        }
      }
      save(db);
    },
    box_zerar({ p_evento }) {
      const db = load();
      db.atribuicoes.forEach(a => {
        if (a.evento_id === p_evento) Object.assign(a, { status: 'pendente', nota: null, atualizado_por: null, atualizado_em: null });
      });
      db.historico = db.historico.filter(h => h.evento_id !== p_evento);
      save(db);
    },
  };
})();

/* ---------------------------------------------------------------------
   API
   --------------------------------------------------------------------- */
async function rpc(fn, args = {}) {
  const payload = { p_codigo: S.codigo, ...args };
  if (DEMO) {
    await new Promise(r => setTimeout(r, 120));
    return JSON.parse(JSON.stringify(demo[fn](payload) ?? null));
  }
  const headers = { apikey: CFG.supabaseKey, 'Content-Type': 'application/json' };
  if (!CFG.supabaseKey.startsWith('sb_')) headers.Authorization = `Bearer ${CFG.supabaseKey}`;
  const r = await fetch(`${CFG.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers, body: JSON.stringify(payload),
  });
  if (!r.ok) {
    let msg = r.statusText;
    try { msg = (await r.json()).message || msg; } catch {}
    const e = new Error(msg);
    if (msg === 'codigo_invalido') e.codigoInvalido = true;
    throw e;
  }
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function carregar() {
  S.data = await rpc('box_carregar');
  const evs = eventosAtivos();
  if (!evs.find(e => e.id === S.eventoId)) {
    S.eventoId = eventoPadrao(evs)?.id || null;
    LS.set('evento', S.eventoId);
  }
  if (S.me && S.me !== 'visitante' && !diretor(S.me)) { S.me = null; LS.set('me', null); }
}

function falha(e) {
  console.error(e);
  if (e.codigoInvalido) { sair('O código de acesso mudou. Entre de novo.'); return; }
  toast('Não deu pra salvar. Confira a internet e tente de novo.', true);
}

/* ---------------------------------------------------------------------
   Seletores de dados
   --------------------------------------------------------------------- */
const diretor = id => S.data?.diretores.find(d => d.id === id);
const jovem = id => S.data?.jovens.find(j => j.id === id);
const evento = () => S.data?.eventos.find(e => e.id === S.eventoId);
const eventosAtivos = () => (S.data?.eventos || []).filter(e => !e.arquivado);
const atribs = () => (S.data?.atribuicoes || []).filter(a => a.evento_id === S.eventoId);
const nomeQuem = () => (S.me && S.me !== 'visitante' ? diretor(S.me)?.nome : null) || 'Alguém';

function eventoPadrao(evs) {
  const hoje = new Date().toISOString().slice(0, 10);
  const futuros = evs.filter(e => e.data && e.data >= hoje).sort((a, b) => a.data.localeCompare(b.data));
  return futuros[0] || evs[0];
}

function statusJovem(lista) {
  return lista.reduce((best, a) => (PRIORIDADE[a.status] > PRIORIDADE[best] ? a.status : best), 'pendente');
}
function porJovem(lista = atribs()) {
  const m = new Map();
  for (const a of lista) {
    if (!m.has(a.jovem_id)) m.set(a.jovem_id, []);
    m.get(a.jovem_id).push(a);
  }
  return m;
}

/* ---------------------------------------------------------------------
   Render: portão (código) e escolha de identidade
   --------------------------------------------------------------------- */
function renderGate() {
  $('#app').innerHTML = `
    <div class="gate">
      <h1>Chamada <span>BOX</span></h1>
      <p class="dim">Central da diretoria do Box pra chamar a galera pros cultos e eventos.</p>
      ${DEMO ? '<div class="demo-banner">Modo demonstração: qualquer código entra e os dados são fictícios.</div>' : ''}
      <form id="form-login">
        <label class="field">Código de acesso da diretoria
          <input name="codigo" type="password" autocomplete="current-password" required autofocus
                 placeholder="O código que a liderança passou">
        </label>
        <div class="erro">${esc(S.erroLogin)}</div>
        <button class="btn primary" type="submit">Entrar</button>
      </form>
    </div>`;
}

function renderQuem() {
  const ds = S.data.diretores.filter(d => d.ativo);
  const grupo = eq => ds.filter(d => d.equipe === eq)
    .map(d => `<button class="btn" data-act="sou" data-id="${d.id}">${esc(d.nome)}</button>`).join('');
  $('#app').innerHTML = `
    <div class="gate">
      <h1>Quem é <span>você?</span></h1>
      <p class="dim">Assim o site mostra a sua lista e registra quem marcou cada chamada. Fica salvo neste aparelho.</p>
      ${ds.length ? '' : '<p class="aviso">Ninguém da diretoria cadastrado ainda. Entre como visitante e cadastre em Gerenciar.</p>'}
      ${grupo('F') ? `<h3>Equipe feminina</h3><div class="pick-grid">${grupo('F')}</div>` : ''}
      ${grupo('M') ? `<h3>Equipe masculina</h3><div class="pick-grid">${grupo('M')}</div>` : ''}
      <button class="btn ghost" data-act="sou" data-id="visitante">Não estou na lista (só visualizar)</button>
    </div>`;
}

/* ---------------------------------------------------------------------
   Render: app principal
   --------------------------------------------------------------------- */
function render() {
  if (!S.codigo || !S.data) return renderGate();
  if (!S.me) return renderQuem();

  const ev = evento();
  const evs = eventosAtivos();
  const eu = diretor(S.me);
  const minhasPend = ev ? atribs().filter(a => a.diretor_id === S.me && a.status === 'pendente').length : 0;
  const tabs = [
    ['minha', 'Minha', minhasPend],
    ['equipe', 'Equipe'],
    ['jovens', 'Jovens'],
    ['historico', 'Histórico'],
    ['gerenciar', 'Gerenciar'],
  ].filter(([id]) => id !== 'minha' || eu);
  if (!tabs.find(t => t[0] === S.tab)) S.tab = tabs[0][0];

  $('#app').innerHTML = `
    ${DEMO ? '<div class="demo-banner">Modo demonstração: dados fictícios salvos só neste navegador.</div>' : ''}
    <header class="top">
      <div class="top-line">
        <h1>Chamada <span>BOX</span></h1>
        <button class="me-chip" data-act="trocar-eu" title="Trocar pessoa">${ICON.user}<span>${esc(eu ? eu.nome : 'Visitante')}</span></button>
      </div>
      ${evs.length ? `
        <select class="ev-select" id="sel-evento" aria-label="Evento">
          ${evs.map(e => `<option value="${e.id}" ${e.id === S.eventoId ? 'selected' : ''}>${esc(e.nome)}${e.data ? ' — ' + esc(dataEvento(e, { day: '2-digit', month: '2-digit' })) : ''}</option>`).join('')}
        </select>
        <div class="ev-info">${esc([quandoEvento(ev), 'Público: ' + PUBLICO_LABEL[ev.publico], ev.chamadas_por_jovem + ' chamada(s) por jovem'].filter(Boolean).join(' · '))}</div>
      ` : ''}
    </header>
    ${ev ? renderPlacar() : ''}
    <nav class="tabs" role="tablist">
      ${tabs.map(([id, label, n]) => `<button class="tab" role="tab" data-act="tab" data-id="${id}" aria-selected="${S.tab === id}">${label}${n ? `<span class="n">${n}</span>` : ''}</button>`).join('')}
    </nav>
    <main id="view">${renderView()}</main>`;
}

function renderView() {
  if (S.tab === 'gerenciar') return viewGerenciar();
  if (!evento()) {
    return `<div class="vazio"><p>Nenhum evento aberto ainda.</p>
      <button class="btn primary" data-act="novo-evento">Criar evento</button></div>`;
  }
  if (S.tab === 'minha') return viewMinha();
  if (S.tab === 'equipe') return viewEquipe();
  if (S.tab === 'jovens') return viewJovens();
  if (S.tab === 'historico') return viewHistorico();
  return '';
}

function renderPlacar() {
  const lista = atribs();
  const feitas = lista.filter(a => a.status !== 'pendente').length;
  const pct = lista.length ? Math.round((feitas / lista.length) * 100) : 0;
  const pj = porJovem(lista);
  const cont = { confirmado: 0, nao_vai: 0, aberto: 0 };
  for (const l of pj.values()) {
    const s = statusJovem(l);
    if (s === 'confirmado' || s === 'nao_vai') cont[s]++;
    else cont.aberto++;
  }
  return `
    <section class="board" aria-label="Progresso">
      <div class="board-num">${feitas}<small>de ${lista.length} chamadas feitas</small></div>
      <div class="board-bar-col">
        <div class="track"><div class="fill" style="width:${pct}%"></div></div>
        <div class="board-bar-label"><span>${pct}% concluído</span><span>${plural(pj.size, 'jovem', 'jovens')}</span></div>
      </div>
      <div class="board-stats">
        <span class="stat pill st-confirmado"><span class="dot"></span>${plural(cont.confirmado, 'confirmado', 'confirmados')}</span>
        <span class="stat pill st-nao_vai"><span class="dot"></span>${cont.nao_vai} ${cont.nao_vai === 1 ? 'não vai' : 'não vão'}</span>
        <span class="stat pill st-pendente"><span class="dot"></span>${cont.aberto} sem resposta</span>
      </div>
    </section>`;
}

function segStatus(a) {
  return `<div class="seg" role="group" aria-label="Status da chamada">
    ${STATUS.map(s => `<button class="st-${s.id}" data-act="status" data-id="${a.id}" data-status="${s.id}" aria-pressed="${a.status === s.id}">${s.label}</button>`).join('')}
  </div>`;
}

function botoesContato(j, a) {
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

function viewMinha() {
  const minhas = atribs().filter(a => a.diretor_id === S.me);
  if (!minhas.length) {
    return `<div class="vazio"><p>Você não tem ninguém pra chamar neste evento.</p>
      <p class="small">A distribuição é feita em Gerenciar.</p></div>`;
  }
  const pj = porJovem();
  const ordem = { pendente: 0, chamado: 1, confirmado: 2, nao_vai: 3 };
  minhas.sort((a, b) => ordem[a.status] - ordem[b.status] || byNome(jovem(a.jovem_id), jovem(b.jovem_id)));
  const feitas = minhas.filter(a => a.status !== 'pendente').length;
  return `
    <div class="section-title"><h2>Sua lista</h2><span class="tag">${feitas} de ${minhas.length} chamados</span></div>
    <div class="grid">
      ${minhas.map(a => {
        const j = jovem(a.jovem_id);
        const outros = pj.get(a.jovem_id).filter(x => x.id !== a.id);
        return `
        <article class="card pcard st-${a.status}">
          <div class="card-head">
            <div class="titulo"><h3>${esc(j.nome)}</h3>${faixaBadge(j)}</div>
            <button class="btn small ghost" data-act="jovem" data-id="${j.id}">Detalhes</button>
          </div>
          <div class="meta">
            <span>${digitos(j.telefone) ? esc(fmtTel(j.telefone)) : 'sem telefone'}</span>
            ${j.obs ? `<span>${esc(j.obs)}</span>` : ''}
          </div>
          ${botoesContato(j, a)}
          ${segStatus(a)}
          ${outros.length ? `<div class="outros">Também chama: ${outros.map(o => `<span class="pill st-${o.status}"><span class="dot"></span>${esc(diretor(o.diretor_id)?.nome)}: ${STATUS_BY_ID[o.status].label}</span>`).join('')}</div>` : ''}
          ${a.nota ? `<div class="nota">📝 ${esc(a.nota)}</div>` : ''}
          <div><button class="btn small ghost" data-act="nota" data-id="${a.id}">${a.nota ? 'Editar nota' : '+ Nota'}</button></div>
        </article>`;
      }).join('')}
    </div>`;
}

function viewEquipe() {
  const lista = atribs();
  const bloco = (eq, titulo) => {
    const ds = S.data.diretores.filter(d => d.equipe === eq && (d.ativo || lista.some(a => a.diretor_id === d.id)));
    if (!ds.length) return '';
    return `
      <div class="section-title"><h2>${titulo}</h2><span class="tag">${ds.length} pessoas</span></div>
      <div class="grid">${ds.map(d => {
        const minhas = lista.filter(a => a.diretor_id === d.id)
          .sort((a, b) => byNome(jovem(a.jovem_id), jovem(b.jovem_id)));
        const feitas = minhas.filter(a => a.status !== 'pendente').length;
        const total = minhas.length;
        return `
        <div class="card">
          <div class="card-head">
            <h3>${esc(d.nome)}${d.id === S.me ? ' <span class="dim small">(você)</span>' : ''}</h3>
            <span class="pill ${total && feitas === total ? 'st-confirmado' : ''}">${feitas}/${total}</span>
          </div>
          <div class="mini-track"><div class="mini-fill" style="width:${total ? (feitas / total) * 100 : 0}%"></div></div>
          ${total ? `<ul class="lista">${minhas.map(a => `
            <li><button class="row st-${a.status} ${a.status !== 'pendente' ? 'feito' : ''}" data-act="jovem" data-id="${a.jovem_id}">
              <span class="dot"></span><span class="nome">${esc(jovem(a.jovem_id).nome)}</span>
              <span class="pill st-${a.status}">${STATUS_BY_ID[a.status].label}</span>
            </button></li>`).join('')}</ul>` : '<p class="dim small">Sem chamadas neste evento.</p>'}
        </div>`;
      }).join('')}</div>`;
  };
  return bloco('F', 'Equipe feminina') + bloco('M', 'Equipe masculina');
}

function viewJovens() {
  const ev = evento();
  const pj = porJovem();
  const q = S.busca.trim().toLowerCase();
  const filtros = [['todos', 'Todos'], ['aberto', 'Sem resposta'], ['confirmado', 'Confirmados'], ['nao_vai', 'Não vão']];
  let rows = [...pj.keys()].map(id => ({ j: jovem(id), l: pj.get(id) })).filter(r => r.j);
  rows = rows.map(r => ({ ...r, s: statusJovem(r.l) }));
  if (S.filtro === 'aberto') rows = rows.filter(r => r.s === 'pendente' || r.s === 'chamado');
  else if (S.filtro !== 'todos') rows = rows.filter(r => r.s === S.filtro);
  if (q) rows = rows.filter(r => r.j.nome.toLowerCase().includes(q));
  rows.sort((a, b) => byNome(a.j, b.j));

  const semResp = S.data.jovens.filter(j => elegivel(j, ev) && !pj.has(j.id)).sort(byNome);

  return `
    <div class="toolbar">
      <input type="search" id="busca" placeholder="Buscar jovem…" value="${esc(S.busca)}" aria-label="Buscar jovem">
      <div class="chips">${filtros.map(([id, l]) => `<button class="chip" data-act="filtro" data-id="${id}" aria-pressed="${S.filtro === id}">${l}</button>`).join('')}</div>
    </div>
    <div class="card"><ul class="lista">
      ${rows.length ? rows.map(({ j, l, s }) => `
        <li><button class="row st-${s}" data-act="jovem" data-id="${j.id}">
          <span class="dot"></span>
          <span class="nome">${esc(j.nome)} ${faixaBadge(j)}
            <small>${l.map(a => esc(diretor(a.diretor_id)?.nome) + (a.status === 'pendente' ? '' : ` (${STATUS_BY_ID[a.status].label.toLowerCase()})`)).join(' · ')}</small>
          </span>
          <span class="pill st-${s}">${s === 'pendente' ? 'Ninguém chamou' : STATUS_BY_ID[s].label}</span>
        </button></li>`).join('') : '<li class="dim small" style="padding:8px">Ninguém nesse filtro.</li>'}
    </ul></div>
    ${semResp.length ? `
      <div class="section-title"><h2>Sem responsável</h2><span class="tag">${semResp.length} jovens do público deste evento</span></div>
      <p class="dim small" style="margin-top:-6px">Toque para escolher quem chama, ou use "Distribuir quem falta" em Gerenciar.</p>
      <div class="card"><ul class="lista">${semResp.map(j => `
        <li><button class="row" data-act="jovem" data-id="${j.id}"><span class="nome">${esc(j.nome)} ${faixaBadge(j)}</span><span class="dim small">definir</span></button></li>`).join('')}
      </ul></div>` : ''}`;
}

function viewHistorico() {
  const h = S.data.historico.filter(x => x.evento_id === S.eventoId);
  if (!h.length) return '<div class="vazio"><p>Nenhuma marcação ainda. O histórico aparece aqui assim que a equipe começar.</p></div>';
  return `<div class="card"><ul class="lista feed">${h.slice(0, 150).map(x => {
    const quemMarcou = x.quem && x.quem !== x.diretor ? ` <span class="dim">(chamada de ${esc(x.diretor)})</span>` : '';
    return `<li><span><strong>${esc(x.quem)}</strong> ${STATUS_BY_ID[x.status]?.feed || x.status} <strong>${esc(x.jovem)}</strong>${quemMarcou}</span>
      <time datetime="${esc(x.em)}">${tempoAtras(x.em)}</time></li>`;
  }).join('')}</ul></div>`;
}

function viewGerenciar() {
  const ev = evento();
  const d = S.data;
  const q = S.buscaMg.trim().toLowerCase();
  const js = d.jovens.filter(j => !q || j.nome.toLowerCase().includes(q));
  const semTel = d.jovens.filter(j => j.ativo && !digitos(j.telefone)).length;
  const semNasc = d.jovens.filter(j => j.ativo && !j.nascimento).length;
  const cont = { box: 0, sprint: 0 };
  d.jovens.forEach(j => { const f = j.ativo && faixa(j); if (f) cont[f]++; });

  return `
    <section class="mg-section">
      <div class="card-head"><h2>Eventos</h2><button class="btn small primary" data-act="novo-evento">+ Novo evento</button></div>
      ${ev ? `
      <div class="card">
        <div class="card-head"><h3>${esc(ev.nome)}</h3><button class="btn small" data-act="editar-evento" data-id="${ev.id}">Editar</button></div>
        <div class="meta"><span>${esc(quandoEvento(ev) || 'sem data')}</span><span>${PUBLICO_LABEL[ev.publico]}</span><span>${ev.chamadas_por_jovem} chamada(s) por jovem</span></div>
        <div class="row-btns">
          <button class="btn small" data-act="distribuir" data-modo="faltantes">Distribuir quem falta</button>
          <button class="btn small" data-act="distribuir" data-modo="refazer">Refazer distribuição</button>
          <button class="btn small" data-act="copiar-lista">Copiar lista pro grupo</button>
          <button class="btn small danger" data-act="zerar">Zerar marcações</button>
        </div>
      </div>` : ''}
      <ul class="lista" style="margin-top:8px">${d.eventos.map(e => `
        <li><button class="row" data-act="editar-evento" data-id="${e.id}">
          <span class="nome">${esc(e.nome)}<small>${esc(quandoEvento(e) || 'sem data')}</small></span>
          ${e.arquivado ? '<span class="pill">arquivado</span>' : e.id === S.eventoId ? '<span class="pill st-confirmado">aberto agora</span>' : '<span class="pill st-chamado">aberto</span>'}
        </button></li>`).join('')}</ul>
    </section>

    <section class="mg-section">
      <div class="card-head"><h2>Jovens <span class="dim small">${d.jovens.length}</span></h2>
        <div class="row-btns"><button class="btn small" data-act="importar">Importar lista</button><button class="btn small primary" data-act="novo-jovem">+ Jovem</button></div>
      </div>
      <p class="small dim" style="margin:0 0 8px">${cont.box} no Box · ${cont.sprint} no Sprint
        ${semNasc ? ` · <span class="aviso">${semNasc} sem data de nascimento</span>` : ''}
        ${semTel ? ` · <span class="aviso">${semTel} sem telefone</span>` : ''}</p>
      <div class="toolbar"><input type="search" id="busca-mg" placeholder="Buscar…" value="${esc(S.buscaMg)}" aria-label="Buscar jovem"></div>
      <div class="card"><ul class="lista">${js.map(j => `
        <li><button class="row ${j.ativo ? '' : 'feito'}" data-act="editar-jovem" data-id="${j.id}">
          <span class="nome">${esc(j.nome)} ${faixaBadge(j)}<small>${j.genero === 'F' ? 'Feminino' : 'Masculino'} · ${digitos(j.telefone) ? esc(fmtTel(j.telefone)) : 'sem telefone'}${j.ativo ? '' : ' · inativo'}</small></span>
          <span class="dim small">editar</span>
        </button></li>`).join('') || '<li class="dim small" style="padding:8px">Nenhum jovem.</li>'}</ul></div>
    </section>

    <section class="mg-section">
      <div class="card-head"><h2>Diretoria <span class="dim small">${d.diretores.length}</span></h2><button class="btn small primary" data-act="novo-diretor">+ Pessoa</button></div>
      <div class="card"><ul class="lista">${d.diretores.map(p => `
        <li><button class="row ${p.ativo ? '' : 'feito'}" data-act="editar-diretor" data-id="${p.id}">
          <span class="nome">${esc(p.nome)}<small>${p.equipe === 'F' ? 'Equipe feminina' : 'Equipe masculina'}${p.ativo ? '' : ' · inativo'}</small></span>
          <span class="dim small">editar</span>
        </button></li>`).join('')}</ul></div>
    </section>

    <section class="mg-section">
      <div class="card-head"><h2>Este aparelho</h2></div>
      <div class="row-btns"><button class="btn small" data-act="trocar-eu">Trocar pessoa</button><button class="btn small danger" data-act="sair">Sair (esquecer código)</button></div>
    </section>`;
}

/* ---------------------------------------------------------------------
   Diálogos
   --------------------------------------------------------------------- */
const dlg = () => $('#dlg');
function abrirDlg(html, estado) {
  S.dlg = estado || { tipo: 'html' };
  dlg().innerHTML = `<div class="dlg-body">${html}</div>`;
  if (!dlg().open) dlg().showModal();
}
function fecharDlg() {
  if (dlg().open) dlg().close();
}

function renderDlgJovem(jid) {
  const j = jovem(jid);
  const ev = evento();
  if (!j || !ev) return fecharDlg();
  const lista = atribs().filter(a => a.jovem_id === jid)
    .sort((a, b) => byNome(diretor(a.diretor_id), diretor(b.diretor_id)));
  const minha = lista.find(a => a.diretor_id === S.me);
  const atuais = new Set(lista.map(a => a.diretor_id));
  const dirs = S.data.diretores.filter(d => d.ativo || atuais.has(d.id))
    .sort((a, b) => (a.equipe === j.genero ? 0 : 1) - (b.equipe === j.genero ? 0 : 1) || byNome(a, b));

  abrirDlg(`
    <div class="dlg-head">
      <div><h2>${esc(j.nome)}</h2>
        <div class="meta" style="margin-top:6px">${faixaBadge(j)}<span>${digitos(j.telefone) ? esc(fmtTel(j.telefone)) : 'sem telefone'}</span>${j.obs ? `<span>${esc(j.obs)}</span>` : ''}</div>
      </div>
      <button class="x" data-act="fechar" aria-label="Fechar">×</button>
    </div>
    ${botoesContato(j, minha)}
    <h3>Chamadas — ${esc(ev.nome)}</h3>
    ${lista.length ? lista.map(a => `
      <div class="resp">
        <div class="resp-head"><strong>${esc(diretor(a.diretor_id)?.nome)}${a.diretor_id === S.me ? ' (você)' : ''}</strong>
          <span class="dim small">${a.atualizado_em ? `${esc(a.atualizado_por || '')} · ${tempoAtras(a.atualizado_em)}` : ''}</span></div>
        ${segStatus(a)}
        ${a.nota ? `<div class="nota">📝 ${esc(a.nota)}</div>` : ''}
        <div><button class="btn small ghost" data-act="nota" data-id="${a.id}">${a.nota ? 'Editar nota' : '+ Nota'}</button></div>
      </div>`).join('') : '<p class="dim small">Ninguém responsável ainda.</p>'}
    <details ${lista.length ? '' : 'open'}>
      <summary>Mudar quem chama</summary>
      <div class="chips">${dirs.map(d => `<button class="chip" data-act="toggle-resp" data-jovem="${j.id}" data-id="${d.id}" aria-pressed="${atuais.has(d.id)}">${esc(d.nome)}</button>`).join('')}</div>
    </details>
    <div class="dlg-foot">
      <button class="btn small ghost" data-act="editar-jovem" data-id="${j.id}">Editar cadastro</button>
      <button class="btn small" data-act="fechar">Fechar</button>
    </div>`, { tipo: 'jovem', id: jid });
}

/* Formulário genérico */
function abrirForm({ titulo, campos, valores = {}, onSalvar, onExcluir, textoExcluir = 'Excluir' }) {
  const campo = c => {
    const v = valores[c.nome] ?? c.padrao ?? '';
    const cls = c.full ? 'field full' : 'field';
    const hint = c.dica ? `<span class="hint">${c.dica}</span>` : '';
    if (c.tipo === 'checkbox') {
      return `<label class="check ${c.full ? 'full' : ''}"><input type="checkbox" name="${c.nome}" ${v ? 'checked' : ''}> ${c.label}</label>`;
    }
    if (c.tipo === 'select') {
      return `<label class="${cls}">${c.label}<select name="${c.nome}">${c.opcoes.map(([ov, ol]) => `<option value="${ov}" ${String(v) === ov ? 'selected' : ''}>${ol}</option>`).join('')}</select>${hint}</label>`;
    }
    if (c.tipo === 'textarea') {
      return `<label class="${cls}">${c.label}<textarea name="${c.nome}" placeholder="${esc(c.placeholder || '')}">${esc(v)}</textarea>${hint}</label>`;
    }
    return `<label class="${cls}">${c.label}<input name="${c.nome}" type="${c.tipo || 'text'}" value="${esc(v)}" ${c.obrig ? 'required' : ''} ${c.extra || ''} placeholder="${esc(c.placeholder || '')}">${hint}</label>`;
  };
  abrirDlg(`
    <form id="form-dlg" class="dlg-body" style="padding:0">
      <div class="dlg-head"><h2>${titulo}</h2><button type="button" class="x" data-act="fechar" aria-label="Fechar">×</button></div>
      <div class="form-grid">${campos.map(campo).join('')}</div>
      <div class="dlg-foot">
        ${onExcluir ? `<button type="button" class="btn danger" id="btn-excluir">${textoExcluir}</button>` : '<span></span>'}
        <div class="row-btns"><button type="button" class="btn ghost" data-act="fechar">Cancelar</button><button class="btn primary" type="submit">Salvar</button></div>
      </div>
    </form>`, { tipo: 'form' });

  const form = $('#form-dlg');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const dados = { ...valores };
    for (const c of campos) {
      const el = form.elements[c.nome];
      dados[c.nome] = c.tipo === 'checkbox' ? el.checked : c.tipo === 'number' ? Number(el.value) : el.value.trim();
    }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      await onSalvar(dados);
      fecharDlg();
      await recarregar();
    } catch (err) { falha(err); btn.disabled = false; }
  });
  if (onExcluir) {
    $('#btn-excluir').addEventListener('click', async () => {
      try {
        if ((await onExcluir()) === false) return;
        fecharDlg();
        await recarregar();
      } catch (err) { falha(err); }
    });
  }
}

const CAMPOS_JOVEM = [
  { nome: 'nome', label: 'Nome', obrig: true, full: true },
  { nome: 'genero', label: 'Equipe', tipo: 'select', opcoes: [['F', 'Feminina'], ['M', 'Masculina']] },
  { nome: 'nascimento', label: 'Data de nascimento', tipo: 'date', dica: `Define Box (${IDADE_BOX}+) ou Sprint` },
  { nome: 'telefone', label: 'WhatsApp / telefone', tipo: 'tel', placeholder: '(11) 91234-5678', full: true },
  { nome: 'obs', label: 'Observação', full: true, placeholder: 'Ex.: veio pela primeira vez na vigília' },
  { nome: 'ativo', label: 'Ativo (entra nas distribuições)', tipo: 'checkbox', padrao: true, full: true },
];

function formJovem(j) {
  abrirForm({
    titulo: j ? 'Editar jovem' : 'Novo jovem',
    campos: CAMPOS_JOVEM,
    valores: j || {},
    onSalvar: dados => rpc('box_salvar', { p_tabela: 'jovens', p_dados: dados }),
    onExcluir: j && (async () => {
      if (!confirm(`Excluir ${j.nome}? Some de todas as listas. (Se só não participa mais, prefira desmarcar "Ativo".)`)) return false;
      await rpc('box_excluir', { p_tabela: 'jovens', p_id: j.id });
    }),
  });
}

function formDiretor(p) {
  abrirForm({
    titulo: p ? 'Editar pessoa da diretoria' : 'Nova pessoa da diretoria',
    campos: [
      { nome: 'nome', label: 'Nome', obrig: true, full: true },
      { nome: 'equipe', label: 'Equipe', tipo: 'select', opcoes: [['F', 'Feminina'], ['M', 'Masculina']] },
      { nome: 'telefone', label: 'Telefone', tipo: 'tel' },
      { nome: 'ativo', label: 'Ativo (recebe chamadas na distribuição)', tipo: 'checkbox', padrao: true, full: true },
    ],
    valores: p || {},
    onSalvar: dados => rpc('box_salvar', { p_tabela: 'diretores', p_dados: dados }),
    onExcluir: p && (async () => {
      if (!confirm(`Excluir ${p.nome}? As chamadas dela(e) nos eventos abertos ficam sem responsável.`)) return false;
      await rpc('box_excluir', { p_tabela: 'diretores', p_id: p.id });
      if (S.me === p.id) { S.me = null; LS.set('me', null); }
    }),
  });
}

function formEvento(e) {
  abrirForm({
    titulo: e ? 'Editar evento' : 'Novo evento',
    campos: [
      { nome: 'nome', label: 'Nome', obrig: true, full: true, placeholder: 'Ex.: Culto Box, Vigília, Retiro' },
      { nome: 'data', label: 'Data', tipo: 'date' },
      { nome: 'hora', label: 'Horário', placeholder: '19h30' },
      { nome: 'publico', label: 'Quem chamar', tipo: 'select', padrao: 'box', opcoes: [['box', PUBLICO_LABEL.box], ['sprint', PUBLICO_LABEL.sprint], ['todos', PUBLICO_LABEL.todos]] },
      { nome: 'chamadas_por_jovem', label: 'Diretores por jovem', tipo: 'number', padrao: 2, extra: 'min="1" max="5"' },
      { nome: 'mensagem', label: 'Mensagem do WhatsApp', tipo: 'textarea', full: true, placeholder: MSG_PADRAO,
        dica: 'Deixe vazio pra usar a padrão. Use {nome}, {eu}, {evento}, {quando}, {data}, {hora}.' },
      ...(e ? [{ nome: 'arquivado', label: 'Arquivar (some da lista de eventos abertos)', tipo: 'checkbox', full: true }] : []),
    ],
    valores: e || {},
    onSalvar: async dados => {
      if (!dados.id) dados.id = uid();
      await rpc('box_salvar', { p_tabela: 'eventos', p_dados: dados });
      if (!e) {
        S.eventoId = dados.id;
        LS.set('evento', dados.id);
        await recarregar();
        const pares = distribuir(dados, S.data.jovens, S.data.diretores, [], false);
        await rpc('box_atribuir', { p_evento: dados.id, p_pares: pares });
        toast(`Evento criado e ${pares.length} chamadas distribuídas`);
      }
    },
    onExcluir: e && (async () => {
      if (!confirm(`Excluir "${e.nome}" e todo o progresso dele? Se só acabou, prefira "Arquivar".`)) return false;
      await rpc('box_excluir', { p_tabela: 'eventos', p_id: e.id });
    }),
  });
}

function parseData(s) {
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += y > (new Date().getFullYear() % 100) ? 1900 : 2000;
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? s : null;
}

function parseImport(texto, generoPadrao) {
  const existentes = new Map(S.data.jovens.map(j => [j.nome.toLowerCase(), j]));
  return texto.split('\n').map(l => l.trim()).filter(Boolean).map(linha => {
    const partes = linha.split(/\s*[;\t,]\s*/).filter(Boolean);
    const r = { nome: partes.shift() };
    const obs = [];
    for (const p of partes) {
      const data = parseData(p);
      if (data) r.nascimento = data;
      else if (/^[fm]$/i.test(p)) r.genero = p.toUpperCase();
      else if (digitos(p).length >= 8 && /^[\d\s()+-]+$/.test(p)) r.telefone = p;
      else obs.push(p);
    }
    if (obs.length) r.obs = obs.join(', ');
    const ja = existentes.get(r.nome.toLowerCase());
    // cadastro existente: só sobrescreve o que veio na linha
    if (ja) return { ...ja, ...r, nome: ja.nome, _existe: true };
    return { genero: generoPadrao, ...r };
  });
}

function dlgImportar() {
  abrirDlg(`
    <form id="form-imp" class="dlg-body" style="padding:0">
      <div class="dlg-head"><h2>Importar lista</h2><button type="button" class="x" data-act="fechar" aria-label="Fechar">×</button></div>
      <p class="small dim" style="margin:0">Uma pessoa por linha: <strong>nome; telefone; nascimento; F ou M</strong>. Só o nome é obrigatório, e a ordem dos outros tanto faz.
        Nomes que já existem são atualizados.</p>
      <textarea name="texto" rows="8" placeholder="Maria Souza; 11 91234-5678; 14/03/2007&#10;João Pedro; 11 99876-5432; 02/11/2008; M"></textarea>
      <label class="field">Equipe (quando a linha não disser F/M)
        <select name="genero"><option value="F">Feminina</option><option value="M">Masculina</option></select></label>
      <div class="dim small" id="imp-preview"></div>
      <div class="dlg-foot"><span></span><div class="row-btns"><button type="button" class="btn ghost" data-act="fechar">Cancelar</button><button class="btn primary" type="submit">Importar</button></div></div>
    </form>`, { tipo: 'form' });
  const form = $('#form-imp');
  const preview = () => {
    const rows = parseImport(form.texto.value, form.genero.value);
    const novos = rows.filter(r => !r._existe).length;
    $('#imp-preview').textContent = rows.length ? `${novos} novos · ${rows.length - novos} atualizados` : '';
  };
  form.addEventListener('input', preview);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const rows = parseImport(form.texto.value, form.genero.value).map(({ _existe, ...r }) => r);
    if (!rows.length) return;
    try {
      await rpc('box_salvar', { p_tabela: 'jovens', p_dados: rows });
      fecharDlg();
      toast(`${rows.length} jovens importados`);
      await recarregar();
    } catch (err) { falha(err); }
  });
}

function textoGrupo() {
  const ev = evento();
  const lista = atribs();
  const linhas = [`*${ev.nome}*${quandoEvento(ev) ? ' — ' + quandoEvento(ev) : ''}`, '', 'Quem chama quem:'];
  for (const eq of ['F', 'M']) {
    const ds = S.data.diretores.filter(d => d.equipe === eq);
    for (const d of ds) {
      const nomes = lista.filter(a => a.diretor_id === d.id).map(a => jovem(a.jovem_id).nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      if (nomes.length) linhas.push(`*${d.nome}:* ${nomes.join(', ')}`);
    }
    linhas.push('');
  }
  linhas.push(`Marquem no site conforme forem chamando 👉 ${location.origin}${location.pathname}`);
  return linhas.join('\n');
}

/* ---------------------------------------------------------------------
   Ações
   --------------------------------------------------------------------- */
async function recarregar() {
  try { await carregar(); } catch (e) { falha(e); }
  render();
  if (dlg().open && S.dlg?.tipo === 'jovem') renderDlgJovem(S.dlg.id);
}

async function setStatus(aid, status, nota) {
  const a = S.data.atribuicoes.find(x => x.id === aid);
  if (!a) return;
  const antes = { ...a };
  if (status) a.status = status;
  if (nota != null) a.nota = nota || null;
  a.atualizado_por = nomeQuem();
  a.atualizado_em = new Date().toISOString();
  if (status) {
    S.data.historico.unshift({
      evento_id: a.evento_id, quem: nomeQuem(), status, em: a.atualizado_em,
      jovem: jovem(a.jovem_id)?.nome, diretor: diretor(a.diretor_id)?.nome,
    });
  }
  render();
  if (dlg().open && S.dlg?.tipo === 'jovem') renderDlgJovem(S.dlg.id);
  try {
    await rpc('box_status', { p_id: aid, p_status: status || null, p_quem: nomeQuem(), p_nota: nota ?? null });
  } catch (e) {
    Object.assign(a, antes);
    if (status) S.data.historico.shift();
    render();
    falha(e);
  }
}

async function toggleResp(jid, did) {
  const lista = atribs();
  const tem = lista.some(a => a.jovem_id === jid && a.diretor_id === did);
  const alvo = lista.find(a => a.jovem_id === jid && a.diretor_id === did);
  if (tem && alvo.status !== 'pendente' && !confirm('Essa chamada já tem marcação. Remover mesmo assim?')) return;
  const pares = lista.map(a => ({ jovem_id: a.jovem_id, diretor_id: a.diretor_id }))
    .filter(p => !(p.jovem_id === jid && p.diretor_id === did));
  if (!tem) pares.push({ jovem_id: jid, diretor_id: did });
  try {
    await rpc('box_atribuir', { p_evento: S.eventoId, p_pares: pares });
    await recarregar();
  } catch (e) { falha(e); }
}

async function acaoDistribuir(modo) {
  const ev = evento();
  const lista = atribs();
  if (modo === 'refazer') {
    const marcadas = lista.filter(a => a.status !== 'pendente').length;
    if (!confirm(`Sortear de novo quem chama quem em "${ev.nome}"?` +
      (marcadas ? `\n\n${marcadas} chamada(s) já marcadas: se a mesma dupla sair de novo a marcação fica, se não, se perde.` : ''))) return;
  }
  const pares = distribuir(ev, S.data.jovens, S.data.diretores, lista, modo === 'faltantes');
  const novos = pares.length - (modo === 'faltantes' ? lista.length : 0);
  try {
    await rpc('box_atribuir', { p_evento: ev.id, p_pares: pares });
    toast(modo === 'faltantes' ? (novos ? `${novos} chamadas adicionadas` : 'Todo mundo já tem responsável') : 'Distribuição refeita');
    await recarregar();
  } catch (e) { falha(e); }
}

function sair(msg = '') {
  S.codigo = null;
  S.data = null;
  S.erroLogin = msg;
  LS.set('codigo', null);
  fecharDlg();
  render();
}

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const { act, id } = el.dataset;

  switch (act) {
    case 'sou':
      S.me = id;
      LS.set('me', id);
      S.tab = id === 'visitante' ? 'equipe' : 'minha';
      render();
      break;
    case 'trocar-eu': S.me = null; LS.set('me', null); render(); break;
    case 'tab': {
      S.tab = id;
      LS.set('tab', id);
      render();
      const topo = $('.tabs').offsetTop;
      if (window.scrollY > topo) window.scrollTo({ top: topo });
      break;
    }
    case 'filtro': S.filtro = id; render(); break;
    case 'status': await setStatus(id, el.dataset.status); break;
    case 'contato': {
      const a = id && S.data.atribuicoes.find(x => x.id === id);
      // espera o link abrir antes de redesenhar a tela
      if (a && a.status === 'pendente') setTimeout(() => { setStatus(id, 'chamado'); toast('Marcado como "Chamei"'); }, 400);
      break;
    }
    case 'nota': {
      const a = S.data.atribuicoes.find(x => x.id === id);
      const t = prompt(`Nota sobre ${jovem(a.jovem_id).nome}:`, a.nota || '');
      if (t !== null) await setStatus(id, null, t.trim());
      break;
    }
    case 'jovem': renderDlgJovem(id); break;
    case 'toggle-resp': await toggleResp(el.dataset.jovem, id); break;
    case 'fechar': fecharDlg(); break;
    case 'novo-evento': formEvento(); break;
    case 'editar-evento': formEvento(S.data.eventos.find(x => x.id === id)); break;
    case 'novo-jovem': formJovem(); break;
    case 'editar-jovem': formJovem(jovem(id)); break;
    case 'novo-diretor': formDiretor(); break;
    case 'editar-diretor': formDiretor(diretor(id)); break;
    case 'importar': dlgImportar(); break;
    case 'distribuir': await acaoDistribuir(el.dataset.modo); break;
    case 'zerar':
      if (confirm(`Zerar todas as marcações e o histórico de "${evento().nome}"? Os responsáveis continuam os mesmos.`)) {
        try { await rpc('box_zerar', { p_evento: S.eventoId }); await recarregar(); toast('Marcações zeradas'); } catch (err) { falha(err); }
      }
      break;
    case 'copiar-lista': {
      const t = textoGrupo();
      try { await navigator.clipboard.writeText(t); toast('Lista copiada, é só colar no grupo'); }
      catch {
        abrirDlg(`<div class="dlg-head"><h2>Lista pro grupo</h2><button class="x" data-act="fechar">×</button></div>
          <textarea rows="14" readonly>${esc(t)}</textarea>`);
      }
      break;
    }
    case 'sair': if (confirm('Esquecer o código neste aparelho?')) sair(); break;
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'sel-evento') {
    S.eventoId = e.target.value;
    LS.set('evento', S.eventoId);
    render();
  }
});

document.addEventListener('input', e => {
  if (e.target.id === 'busca' || e.target.id === 'busca-mg') {
    const campo = e.target.id === 'busca' ? 'busca' : 'buscaMg';
    S[campo] = e.target.value;
    const pos = e.target.selectionStart;
    $('#view').innerHTML = renderView();
    const novo = $('#' + e.target.id);
    novo.focus();
    novo.setSelectionRange(pos, pos);
  }
});

document.addEventListener('submit', async e => {
  if (e.target.id !== 'form-login') return;
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  S.codigo = e.target.codigo.value.trim();
  try {
    await carregar();
    LS.set('codigo', S.codigo);
    S.erroLogin = '';
  } catch (err) {
    S.codigo = null;
    S.erroLogin = err.codigoInvalido ? 'Código incorreto.' : 'Não consegui conectar. Confira a internet.';
  }
  render();
});

dlg().addEventListener('close', () => { S.dlg = null; });
dlg().addEventListener('click', e => { if (e.target === dlg()) fecharDlg(); });

/* Atualização automática: busca o que os outros marcaram. */
async function poll() {
  if (!S.codigo || !S.data || document.hidden || dlg().open) return;
  const ativo = document.activeElement;
  if (ativo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ativo.tagName)) return;
  try {
    await carregar();
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  } catch (e) {
    if (e.codigoInvalido) sair('O código de acesso mudou. Entre de novo.');
  }
}
setInterval(poll, POLL_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });

(async function iniciar() {
  if (S.codigo) {
    try { await carregar(); }
    catch (e) {
      if (e.codigoInvalido) { S.codigo = null; LS.set('codigo', null); S.erroLogin = 'O código de acesso mudou. Entre de novo.'; }
      else S.erroLogin = 'Não consegui conectar. Confira a internet e recarregue.';
      S.data = null;
    }
  }
  render();
})();

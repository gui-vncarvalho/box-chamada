'use strict';

/* =====================================================================
   Central de Chamada BOX
   ===================================================================== */

const CFG = window.BOX_CONFIG || {};
// ?demo na URL força dados fictícios, bom pra testar sem mexer no banco real
const DEMO = new URLSearchParams(location.search).has('demo') || !CFG.supabaseUrl || !CFG.supabaseKey;
const IDADE_BOX = 17;
const POLL_MS = 12000;

const LS = {
  pre: DEMO ? 'box-demo:' : 'box:',
  get(k) { try { return localStorage.getItem(LS.pre + k); } catch { return null; } },
  set(k, v) {
    try { v == null ? localStorage.removeItem(LS.pre + k) : localStorage.setItem(LS.pre + k, v); } catch {}
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
  faixaJ: 'todas',
  histFiltro: 'todos',
  mgTab: LS.get('mgTab') || 'eventos',
  mgFiltro: 'todos',
  buscaP: '',
  pFiltro: 'todos',
  limJ: 20,
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

// data local (YYYY-MM-DD); toISOString() usa UTC e vira o dia às 21h no Brasil
function hojeISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  mais: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  relogio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  grupo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.3c2 .8 3.5 2.8 3.5 5.7"/></svg>',
  trocar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17.5 19 7"/></svg>',
  bandeira: '<svg viewBox="0 0 24 24"><path d="M4 3v19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 4h15v10H5z" fill="#f3e9d2"/><path d="M5 4h3.75v3.33H5zM12.5 4h3.75v3.33H12.5zM8.75 7.33h3.75v3.34H8.75zM16.25 7.33H20v3.34h-3.75zM5 10.67h3.75V14H5zM12.5 10.67h3.75V14H12.5z" fill="#12161c"/></svg>',
  lupa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  xis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  desfazer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  mais1: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  lapis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
  addPessoa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3.1-7 7-7s7 3 7 7M19 8v6M16 11h6"/></svg>',
  embaralhar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
  copiar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>',
  lixo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/></svg>',
  alerta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></svg>',
  entrada: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>',
  engrenagem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
  lista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 11l2 2 4-4M9 17h6"/></svg>',
  jovens: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="7.5" r="3"/><circle cx="5" cy="10" r="2.2"/><circle cx="19" cy="10" r="2.2"/><path d="M6.5 20c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5M1.5 19c0-2.2 1.4-3.8 3.5-4.2M22.5 19c0-2.2-1.4-3.8-3.5-4.2"/></svg>',
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
      id: uid(), nome: 'Culto Box', data: hojeISO(sab), hora: '19h30',
      publico: 'box', chamadas_por_jovem: 2, mensagem: null, arquivado: false, criado_em: new Date().toISOString(),
    };
    const atribuicoes = distribuir(ev, jovens, diretores, [], false).map(p => ({
      id: uid(), evento_id: ev.id, ...p, status: 'pendente', nota: null, atualizado_por: null, atualizado_em: null,
    }));
    return { diretores, jovens, eventos: [ev], atribuicoes, presencas: [], historico: [] };
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
        presencas: db.presencas || [],
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
      db.presencas = (db.presencas || []).filter(x => x[campo] !== p_id);
      if (p_tabela === 'eventos') db.historico = db.historico.filter(h => h.evento_id !== p_id);
      save(db);
    },
    box_presenca({ p_evento, p_jovem, p_presente, p_quem }) {
      const db = load();
      db.presencas = db.presencas || [];
      const i = db.presencas.findIndex(x => x.evento_id === p_evento && x.jovem_id === p_jovem);
      if (p_presente === i >= 0) return;
      if (p_presente) db.presencas.push({ evento_id: p_evento, jovem_id: p_jovem, marcado_por: p_quem, em: new Date().toISOString() });
      else db.presencas.splice(i, 1);
      db.historico.unshift({ id: Date.now(), evento_id: p_evento, quem: p_quem, jovem: nome(db.jovens, p_jovem), status: p_presente ? 'presente' : 'ausente', em: new Date().toISOString() });
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

let primeiraCarga = true;
async function carregar() {
  S.data = await rpc('box_carregar');
  S.data.presencas ||= [];
  const evs = eventosAtivos();
  const salvo = evs.find(e => e.id === S.eventoId);
  const hoje = hojeISO();
  const passou = salvo && salvo.data && salvo.data < hoje;
  if (!salvo || (primeiraCarga && passou && evs.some(e => e.data && e.data >= hoje))) {
    S.eventoId = eventoPadrao(evs)?.id || null;
    LS.set('evento', S.eventoId);
  }
  if (S.me && S.me !== 'visitante' && !diretor(S.me)) { S.me = null; LS.set('me', null); }
  primeiraCarga = false;
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
  const hoje = hojeISO();
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
      <div class="marca"><div><div class="marca-nome">Chamada</div><div class="marca-sub">Diretoria · Juventude Box</div></div></div>
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
    ...(presencaLiberada(ev) ? [['presenca', 'Presença']] : []),
    ['equipe', 'Equipe'],
    ['jovens', 'Jovens'],
    ['historico', 'Histórico'],
    ['gerenciar', 'Gerenciar'],
  ].filter(([id]) => id !== 'minha' || eu);
  if (!tabs.find(t => t[0] === S.tab)) S.tab = tabs[0][0];

  $('#app').innerHTML = `
    ${DEMO ? '<div class="demo-banner">Modo demonstração: dados fictícios salvos só neste navegador.</div>' : ''}
    <header class="topo">
      <div class="marca">
        <div>
          <div class="marca-nome">Chamada</div>
          <div class="marca-sub">Diretoria · Juventude Box</div>
        </div>
      </div>
      <button class="me-chip" data-act="trocar-eu" title="Trocar pessoa">${ICON.user}<span>${esc(eu ? eu.nome : 'Visitante')}</span></button>
    </header>
    ${renderHero(ev, evs)}
    <nav class="tabs" role="tablist">
      ${tabs.map(([id, label, n]) => `
        <button class="tab" role="tab" data-act="tab" data-id="${id}" aria-selected="${S.tab === id}">
          <span class="tab-ic">${TAB_ICON[id]}</span>
          <span class="tab-lbl">${label}</span>${n ? `<span class="n" aria-label="${n} pendentes">${n}</span>` : ''}
        </button>`).join('')}
    </nav>
    <main id="view">${renderView()}</main>`;
  ligarScrollInfinito();
}

const TAB_ICON = {
  get minha() { return ICON.lista; },
  get presenca() { return ICON.entrada; },
  get equipe() { return ICON.grupo; },
  get jovens() { return ICON.jovens; },
  get historico() { return ICON.relogio; },
  get gerenciar() { return ICON.engrenagem; },
};
const celular = () => matchMedia('(max-width: 700px)').matches;

// Leva a tela pro começo do conteúdo da aba (sem esconder atrás das abas fixas no desktop).
function rolarParaConteudo({ sempre = false, suave = false } = {}) {
  const view = $('#view');
  if (!view) return;
  const folga = celular() ? 12 : $('.tabs').offsetHeight + 20;
  const alvo = view.getBoundingClientRect().top + window.scrollY - folga;
  if (sempre || window.scrollY > alvo) window.scrollTo({ top: alvo, behavior: suave ? 'smooth' : 'auto' });
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
  if (S.tab === 'presenca') return viewPresenca();
  return '';
}

function contagem(ev) {
  if (!ev.data) return null;
  const [y, m, d] = ev.data.split('-').map(Number);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((new Date(y, m - 1, d) - hoje) / 86400000);
  if (dias === 0) return ['É hoje!', 'hoje'];
  if (dias === 1) return ['Amanhã', 'breve'];
  if (dias > 1) return [`Em ${dias} dias`, dias <= 7 ? 'breve' : 'futuro'];
  return ['Já aconteceu', 'passado'];
}

function chipsEvento(ev) {
  const data = dataEvento(ev);
  return [
    data && [ICON.cal, data.charAt(0).toUpperCase() + data.slice(1)],
    ev.hora && [ICON.relogio, ev.hora],
    [ICON.grupo, PUBLICO_LABEL[ev.publico]],
    [ICON.tel, plural(ev.chamadas_por_jovem, 'chamada', 'chamadas') + ' por jovem'],
  ].filter(Boolean).map(([ic, t]) => `<li>${ic}<span>${esc(t)}</span></li>`).join('');
}

function renderHero(ev, evs) {
  if (!ev) {
    return `<section class="hero hero-vazio">
      <div><div class="eyebrow">Evento</div><h2 class="ev-nome">Nenhum evento aberto</h2>
      <p class="dim">Crie o próximo culto pra distribuir as chamadas.</p></div>
      <div><button class="btn primary" data-act="novo-evento">+ Criar evento</button></div>
    </section>`;
  }
  const cd = contagem(ev);
  const lista = atribs();
  const feitas = lista.filter(a => a.status !== 'pendente').length;
  const pct = lista.length ? Math.round((feitas / lista.length) * 100) : 0;
  const pj = porJovem(lista);
  const cont = { confirmado: 0, nao_vai: 0, aberto: 0 };
  for (const l of pj.values()) {
    const st = statusJovem(l);
    if (st === 'confirmado' || st === 'nao_vai') cont[st]++;
    else cont.aberto++;
  }
  const tile = (st, filtro, n, label) => `
    <button class="tile st-${st}" data-act="ver-filtro" data-id="${filtro}" title="Ver na aba Jovens">
      <strong>${n}</strong><span><span class="dot"></span>${label}</span>
    </button>`;
  return `
    <section class="hero" aria-label="Evento selecionado">
      <div class="hero-ev">
        <div class="hero-label">
          <span class="eyebrow">Evento</span>
          ${cd ? `<span class="countdown cd-${cd[1]}">${cd[0]}</span>` : ''}
          ${evs.length > 1 ? `<button class="btn small trocar" data-act="trocar-evento">${ICON.trocar}Trocar evento</button>` : ''}
        </div>
        <h2 class="ev-nome">${esc(ev.nome)}</h2>
        <ul class="ev-chips">${chipsEvento(ev)}</ul>
        ${cd && cd[1] === 'hoje' && S.tab !== 'presenca' ? `<button class="btn presenca-cta" data-act="tab" data-id="presenca">${ICON.entrada}Marcar presença</button>` : ''}
      </div>
      <div class="hero-prog">
        <div class="eyebrow">Progresso das chamadas</div>
        <div class="prog-num">
          <strong>${feitas}</strong><span>de ${lista.length} feitas</span>
          <em>${pct}%</em>
        </div>
        <div class="pista" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Chamadas feitas">
          <div class="pista-fill" style="width:${pct}%"></div>
          <span class="bandeira">${ICON.bandeira}</span>
        </div>
        <div class="tiles">
          ${tile('confirmado', 'confirmado', cont.confirmado, cont.confirmado === 1 ? 'Confirmado' : 'Confirmados')}
          ${tile('nao_vai', 'nao_vai', cont.nao_vai, cont.nao_vai === 1 ? 'Não vai' : 'Não vão')}
          ${tile('pendente', 'aberto', cont.aberto, 'Sem resposta')}
        </div>
      </div>
    </section>`;
}

function dlgEventos() {
  const evs = eventosAtivos().slice().sort((a, b) => (a.data || '9').localeCompare(b.data || '9'));
  abrirDlg(`
    <div class="dlg-head"><h2>Escolher evento</h2><button class="x" data-act="fechar" aria-label="Fechar">×</button></div>
    <div class="ev-opcoes">${evs.map(e => {
      const cd = contagem(e);
      const atual = e.id === S.eventoId;
      return `<button class="ev-opcao ${atual ? 'atual' : ''}" data-act="escolher-evento" data-id="${e.id}" aria-current="${atual}">
        <span class="ev-opcao-txt"><strong>${esc(e.nome)}</strong><small>${esc(quandoEvento(e) || 'sem data')} · ${PUBLICO_LABEL[e.publico]}</small></span>
        ${cd ? `<span class="countdown cd-${cd[1]}">${cd[0]}</span>` : ''}
        <span class="ev-check">${atual ? ICON.check : ''}</span>
      </button>`;
    }).join('')}</div>
    <div class="dlg-foot"><button class="btn small ghost" data-act="novo-evento">+ Novo evento</button><button class="btn small" data-act="fechar">Fechar</button></div>`);
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

function iniciais(nome) {
  const partes = primeiroNome(nome).split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] || '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

function cardMinha(a, pj) {
  const j = jovem(a.jovem_id);
  const outros = pj.get(a.jovem_id).filter(x => x.id !== a.id);
  const temTel = !!digitos(j.telefone);
  const resolvido = a.status === 'confirmado' || a.status === 'nao_vai';
  const meta = [
    presenca(j.id) ? '<span class="veio">Veio</span>' : '',
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
          <h3>${esc(j.nome)}</h3>
          <div class="pcard-meta">${meta}</div>
        </div>
        <button class="icon-btn" data-act="jovem" data-id="${j.id}" aria-label="Detalhes de ${esc(j.nome)}" title="Detalhes">${ICON.mais}</button>
      </div>
      ${j.obs ? `<p class="pcard-obs">${esc(j.obs)}</p>` : ''}
      ${contato}
      ${segStatus(a)}
      ${a.nota ? `<button class="nota" data-act="nota" data-id="${a.id}"><span aria-hidden="true">📝</span> ${esc(a.nota)}</button>` : ''}
      <div class="pcard-foot">
        <div class="outros">${outros.length
          ? outros.map(o => `<span class="st-${o.status}"><span class="dot"></span>Com ${esc(diretor(o.diretor_id)?.nome)} · ${STATUS_BY_ID[o.status].label}</span>`).join('')
          : '<span class="dim">Só você chama</span>'}</div>
        ${a.nota ? '' : `<button class="link-btn" data-act="nota" data-id="${a.id}">+ Nota</button>`}
      </div>
    </article>`;
}

function viewMinha() {
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

function viewEquipe() {
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
            <h3>${esc(d.nome)}${d.id === S.me ? ' <span class="voce">você</span>' : ''}</h3>
            <span class="pill ${total && feitas === total ? 'st-confirmado' : ''}">${feitas}/${total}</span>
          </div>
          <div class="mini-track"><div class="mini-fill" style="width:${total ? (feitas / total) * 100 : 0}%"></div></div>
          ${total ? `<ul class="lista">${minhas.map(a => `
            <li><button class="row st-${a.status} ${a.status !== 'pendente' ? 'feito' : ''}" data-act="jovem" data-id="${a.jovem_id}">
              <span class="dot"></span><span class="nome">${esc(jovem(a.jovem_id).nome)}</span>
              ${a.status === 'pendente' ? '' : `<span class="pill st-${a.status}">${STATUS_BY_ID[a.status].label}</span>`}
            </button></li>`).join('')}</ul>` : '<p class="dim small">Sem chamadas neste evento.</p>'}
        </div>`;
      }).join('')}</div>`;
  };
  const f = bloco('F', 'Equipe feminina');
  const m = bloco('M', 'Equipe masculina');
  return eu?.equipe === 'M' ? m + f : f + m;
}

const PAG_JOVENS = 20;
const semAcento = t => String(t || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

function linhasJovens() {
  const pj = porJovem();
  return [...pj.keys()]
    .map(id => ({ j: jovem(id), l: pj.get(id) }))
    .filter(r => r.j)
    .map(r => ({ ...r, s: statusJovem(r.l) }))
    .filter(r => S.faixaJ === 'todas' || faixa(r.j) === S.faixaJ);
}
const passaFiltro = (r, f) => f === 'todos' || r.s === f || (f === 'aberto' && (r.s === 'pendente' || r.s === 'chamado'));

function cardJovem({ j, l, s }) {
  return `
    <button class="jcard st-${s}" data-act="jovem" data-id="${j.id}">
      <span class="avatar" aria-hidden="true">${esc(iniciais(j.nome))}</span>
      <span class="jcard-txt">
        <span class="jcard-nome"><strong>${esc(j.nome)}</strong>${faixa(j) ? faixaBadge(j) : ''}${presenca(j.id) ? '<span class="veio">Veio</span>' : ''}</span>
        <span class="jcard-resp">${l.length ? l.map(a => `<span class="st-${a.status}"><span class="dot"></span>${esc(diretor(a.diretor_id)?.nome)}${a.status === 'pendente' ? '' : ' · ' + STATUS_BY_ID[a.status].label}</span>`).join('') : '<span class="dim">Sem responsável</span>'}</span>
      </span>
      <span class="pill st-${s}">${s === 'pendente' ? 'Ninguém chamou' : STATUS_BY_ID[s].label}</span>
    </button>`;
}

function htmlListaJovens() {
  const q = semAcento(S.busca);
  const rows = linhasJovens()
    .filter(r => passaFiltro(r, S.filtro) && (!q || semAcento(r.j.nome).includes(q)))
    .sort((a, b) => byNome(a.j, b.j));
  if (!rows.length) {
    return `<div class="vazio"><p>${q ? `Ninguém encontrado com “${esc(S.busca.trim())}”.` : 'Ninguém nesse filtro.'}</p></div>`;
  }
  const visiveis = rows.slice(0, S.limJ);
  const faltam = rows.length - visiveis.length;
  return `
    <div class="jgrid">${visiveis.map(cardJovem).join('')}</div>
    <div class="jrodape">
      ${faltam ? `<div id="jmais" class="jmais"><span class="spinner" aria-hidden="true"></span>Carregando mais…</div>` : ''}
      <span class="dim small">Mostrando ${visiveis.length} de ${rows.length}</span>
    </div>`;
}

function viewJovens() {
  const ev = evento();
  const rows = linhasJovens();
  const filtros = [['todos', 'Todos'], ['aberto', 'Sem resposta'], ['confirmado', 'Confirmados'], ['nao_vai', 'Não vão']];
  const pjTodos = porJovem();
  const semResp = S.data.jovens.filter(j => elegivel(j, ev) && !pjTodos.has(j.id)).sort(byNome);
  const faixas = [['todas', 'Todas'], ['box', 'Box'], ['sprint', 'Sprint']];

  return `
    <div class="jtoolbar">
      <label class="busca">${ICON.lupa}
        <input type="search" id="busca" placeholder="Buscar pelo nome…" value="${esc(S.busca)}" aria-label="Buscar jovem" autocomplete="off">
      </label>
      <div class="jfiltros">
        <div class="chips" role="group" aria-label="Filtrar por status">${filtros.map(([id, l]) => `
          <button class="chip" data-act="filtro" data-id="${id}" aria-pressed="${S.filtro === id}">${l}<span class="c">${rows.filter(r => passaFiltro(r, id)).length}</span></button>`).join('')}
        </div>
        ${ev.publico === 'todos' ? `<div class="seg-mini" role="group" aria-label="Filtrar por faixa">${faixas.map(([id, l]) => `
          <button data-act="faixa-j" data-id="${id}" aria-pressed="${S.faixaJ === id}">${l}</button>`).join('')}</div>` : ''}
      </div>
    </div>
    <div id="jlista">${htmlListaJovens()}</div>
    ${semResp.length ? `
      <section class="grupo">
        <h4 class="grupo-titulo">Sem responsável <span>${semResp.length}</span></h4>
        <p class="dim small" style="margin:-4px 0 10px">Toque pra escolher quem chama, ou use "Distribuir quem falta" em Gerenciar.</p>
        <div class="jgrid">${semResp.map(j => cardJovem({ j, l: [], s: 'pendente' }).replace('Ninguém chamou', 'Definir')).join('')}</div>
      </section>` : ''}`;
}

let obsJovens;
function ligarScrollInfinito() {
  obsJovens?.disconnect();
  const el = $('#jmais');
  if (!el) return;
  obsJovens = new IntersectionObserver(entradas => {
    if (entradas.some(e => e.isIntersecting)) {
      S.limJ += PAG_JOVENS;
      atualizarListaJovens();
    }
  }, { rootMargin: '400px 0px' });
  obsJovens.observe(el);
}
function atualizarListaJovens() {
  const c = $('#jlista');
  if (!c) return;
  c.innerHTML = htmlListaJovens();
  ligarScrollInfinito();
}

/* ---------------------------------------------------------------------
   Presença
   --------------------------------------------------------------------- */
const presencasEv = () => (S.data?.presencas || []).filter(p => p.evento_id === S.eventoId);
const presenca = jid => presencasEv().find(p => p.jovem_id === jid);

// A aba só faz sentido a partir do dia do evento.
function presencaLiberada(ev) {
  if (!ev) return false;
  if (DEMO) return true;
  const cd = contagem(ev);
  return !cd || cd[1] === 'hoje' || cd[1] === 'passado';
}

const P_FILTROS = [
  ['todos', 'Todos'],
  ['presentes', 'Presentes'],
  ['faltam', 'Confirmados que faltam'],
];

function dadosPresenca() {
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

const passaFiltroP = (r, f) => f === 'todos' || (f === 'presentes' ? !!r.p : !r.p && r.s === 'confirmado');

function htmlTopoPresenca() {
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

function cardPresenca({ j, l, s, p }) {
  const quem = l.length ? l.map(a => esc(diretor(a.diretor_id)?.nome)).join(' e ') : '';
  const sub = p
    ? `Chegou ${new Date(p.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${p.marcado_por ? ` · por ${esc(p.marcado_por)}` : ''}`
    : s === 'pendente' ? (quem ? `Ninguém chamou ainda · ${quem}` : 'Não estava na lista de chamada')
    : `${STATUS_BY_ID[s].label}${quem ? ` · ${quem}` : ''}`;
  return `
    <button class="pcheck ${p ? 'presente' : ''} st-${s}" data-act="presenca" data-id="${j.id}" aria-pressed="${!!p}">
      <span class="avatar" aria-hidden="true">${p ? ICON.check : esc(iniciais(j.nome))}</span>
      <span class="jcard-txt">
        <span class="jcard-nome"><strong>${esc(j.nome)}</strong>${faixa(j) ? faixaBadge(j) : ''}</span>
        <span class="pcheck-sub">${!p && s === 'confirmado' ? '<span class="dot"></span>' : ''}${sub}</span>
      </span>
      <span class="pcheck-box" aria-hidden="true">${ICON.check}</span>
    </button>`;
}

function htmlListaPresenca() {
  const q = semAcento(S.buscaP);
  const d = dadosPresenca();
  const rows = d.rows
    .filter(r => passaFiltroP(r, S.pFiltro) && (!q || semAcento(r.j.nome).includes(q)))
    .sort((a, b) => byNome(a.j, b.j));
  if (!rows.length) {
    if (q) {
      return `<div class="vazio"><p>Ninguém com “${esc(S.buscaP.trim())}” no cadastro.</p>
        <button class="btn primary" data-act="visitante">${ICON.addPessoa}Cadastrar “${esc(S.buscaP.trim())}” como visitante</button></div>`;
    }
    return `<div class="vazio"><p>${S.pFiltro === 'faltam' ? 'Todos os confirmados já chegaram. 🙌' : S.pFiltro === 'presentes' ? 'Ninguém marcado ainda.' : 'Nenhum jovem no cadastro.'}</p></div>`;
  }
  return `<div class="jgrid">${rows.map(cardPresenca).join('')}</div>`;
}

function htmlChipsPresenca() {
  const d = dadosPresenca();
  return P_FILTROS.map(([id, l]) => `
    <button class="chip" data-act="p-filtro" data-id="${id}" aria-pressed="${S.pFiltro === id}">${l}<span class="c">${d.rows.filter(r => passaFiltroP(r, id)).length}</span></button>`).join('');
}

function viewPresenca() {
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

function atualizarPresenca() {
  if (S.tab !== 'presenca' || !$('#plista')) return render();
  $('#ptopo').innerHTML = htmlTopoPresenca();
  $('#pchips').innerHTML = htmlChipsPresenca();
  $('#plista').innerHTML = htmlListaPresenca();
}

async function togglePresenca(jid) {
  const ev = evento();
  if (!presencaLiberada(ev)) return;
  const atual = presenca(jid);
  const lista = S.data.presencas;
  if (atual) S.data.presencas = lista.filter(p => p !== atual);
  else S.data.presencas = [...lista, { evento_id: ev.id, jovem_id: jid, marcado_por: nomeQuem(), em: new Date().toISOString() }];
  navigator.vibrate?.(12);
  S.data.historico.unshift({ evento_id: ev.id, quem: nomeQuem(), jovem: jovem(jid)?.nome, status: atual ? 'ausente' : 'presente', em: new Date().toISOString() });
  atualizarPresenca();
  try {
    await rpc('box_presenca', { p_evento: ev.id, p_jovem: jid, p_presente: !atual, p_quem: nomeQuem() });
  } catch (e) {
    S.data.presencas = lista;
    S.data.historico.shift();
    atualizarPresenca();
    falha(e);
  }
}

function formVisitante() {
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

const HIST_ICON = { chamado: 'tel', confirmado: 'check', nao_vai: 'xis', pendente: 'desfazer', presente: 'entrada', ausente: 'desfazer' };

function fraseHist(x) {
  const quem = `<strong>${esc(x.quem)}</strong>`;
  const jov = `<strong>${esc(x.jovem)}</strong>`;
  const outro = x.diretor && x.diretor !== x.quem ? x.diretor : null;
  if (x.status === 'presente') return [`${jov} chegou`, `presença marcada por ${esc(x.quem)}`];
  if (x.status === 'ausente') return [`${quem} desmarcou a presença de ${jov}`, ''];
  if (x.status === 'chamado') {
    return [`${quem} chamou ${jov}`, outro ? `pela lista de ${esc(outro)}` : ''];
  }
  if (x.status === 'confirmado' || x.status === 'nao_vai') {
    return [`${jov} ${x.status === 'confirmado' ? 'confirmou presença' : 'não vai'}`,
      `marcado por ${esc(x.quem)}${outro ? ` · lista de ${esc(outro)}` : ''}`];
  }
  return [`${quem} desfez a marcação de ${jov}`, outro ? `da lista de ${esc(outro)}` : ''];
}

function diaHist(iso) {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(Date.now() - 86400000);
  const mesmo = (a, b) => a.toDateString() === b.toDateString();
  if (mesmo(d, hoje)) return 'Hoje';
  if (mesmo(d, ontem)) return 'Ontem';
  const t = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function viewHistorico() {
  const eu = diretor(S.me);
  let h = S.data.historico.filter(x => x.evento_id === S.eventoId);
  // cliques repetidos viram uma entrada só
  h = h.filter((x, i) => {
    const ant = h[i - 1];
    return !ant || ant.quem !== x.quem || ant.jovem !== x.jovem || ant.diretor !== x.diretor || ant.status !== x.status;
  });
  const total = h.length;
  if (eu && S.histFiltro === 'meus') h = h.filter(x => x.quem === eu.nome || x.diretor === eu.nome);

  const topo = `
    <div class="hist-top">
      <span class="dim small">${plural(total, 'marcação', 'marcações')} neste evento</span>
      ${eu ? `<div class="seg-mini" role="group" aria-label="Filtrar histórico">
        <button data-act="hist-filtro" data-id="todos" aria-pressed="${S.histFiltro !== 'meus'}">Todos</button>
        <button data-act="hist-filtro" data-id="meus" aria-pressed="${S.histFiltro === 'meus'}">Meus</button>
      </div>` : ''}
    </div>`;
  if (!h.length) {
    return topo + `<div class="vazio"><p>${total ? 'Nenhuma marcação sua ou da sua lista ainda.' : 'Nenhuma marcação ainda. O histórico aparece aqui assim que a equipe começar.'}</p></div>`;
  }

  const dias = [];
  for (const x of h.slice(0, 200)) {
    const d = diaHist(x.em);
    if (!dias.length || dias[dias.length - 1][0] !== d) dias.push([d, []]);
    dias[dias.length - 1][1].push(x);
  }
  return topo + dias.map(([dia, itens]) => `
    <section class="grupo">
      <h4 class="grupo-titulo">${dia} <span>${itens.length}</span></h4>
      <ol class="timeline">${itens.map(x => {
        const [frase, sub] = fraseHist(x);
        const j = S.data.jovens.find(y => y.nome === x.jovem);
        const hora = new Date(x.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const recente = Date.now() - new Date(x.em) < 3600000;
        return `<li class="tl st-${x.status}">
          <span class="tl-ic" aria-hidden="true">${ICON[HIST_ICON[x.status]] || ''}</span>
          <${j ? `button data-act="jovem" data-id="${j.id}"` : 'div'} class="tl-corpo">
            <span class="tl-txt"><span>${frase}</span>${sub ? `<small>${sub}</small>` : ''}</span>
            <time datetime="${esc(x.em)}" title="${esc(new Date(x.em).toLocaleString('pt-BR'))}">${recente ? tempoAtras(x.em) : hora}</time>
          </${j ? 'button' : 'div'}>
        </li>`;
      }).join('')}</ol>
    </section>`).join('');
}

function calTile(e) {
  if (!e.data) return '<span class="cal-tile vazio"><strong>?</strong><small>sem data</small></span>';
  const [y, m, d] = e.data.split('-').map(Number);
  const mes = new Date(y, m - 1, d).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `<span class="cal-tile"><small>${mes}</small><strong>${d}</strong></span>`;
}

function statusEvento(e) {
  if (e.arquivado) return ['Arquivado', ''];
  if (e.id === S.eventoId) return ['Selecionado', 'st-confirmado'];
  const cd = contagem(e);
  if (cd && cd[1] === 'passado') return ['Já aconteceu', ''];
  return ['Aberto', 'st-chamado'];
}

function mgEventos() {
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
        ${acao('zerar', '', 'desfazer', 'Zerar marcações', 'Volta todas as chamadas pra pendente', true)}
      </div>
    </article>` : ''}
    <h4 class="grupo-titulo">Todos os eventos <span>${evs.length}</span></h4>
    <div class="mg-lista">${evs.map(e => {
      const [st, cls] = statusEvento(e);
      return `
      <button class="ev-item ${e.arquivado ? 'arq' : ''}" data-act="editar-evento" data-id="${e.id}">
        ${calTile(e)}
        <span class="ev-item-txt"><strong>${esc(e.nome)}</strong><small>${esc([dataEvento(e, { weekday: 'long' }), e.hora, PUBLICO_LABEL[e.publico]].filter(Boolean).join(' · '))}</small></span>
        <span class="pill ${cls}">${st}</span>
        <span class="chevron">${ICON.chevron}</span>
      </button>`;
    }).join('') || '<div class="vazio"><p>Nenhum evento ainda.</p></div>'}</div>`;
}

const MG_FILTROS = {
  todos: ['Todos', () => true],
  sem_tel: ['Sem telefone', j => j.ativo && !digitos(j.telefone)],
  sem_nasc: ['Sem nascimento', j => j.ativo && !j.nascimento],
  inativos: ['Inativos', j => !j.ativo],
};

function htmlListaMgJovens() {
  const q = semAcento(S.buscaMg);
  const js = S.data.jovens
    .filter(MG_FILTROS[S.mgFiltro][1])
    .filter(j => !q || semAcento(j.nome).includes(q));
  if (!js.length) return `<div class="vazio"><p>${q ? `Ninguém encontrado com “${esc(S.buscaMg.trim())}”.` : 'Ninguém nesse filtro. 🎉'}</p></div>`;
  return `<div class="jgrid">${js.map(j => {
    const tel = digitos(j.telefone);
    return `
    <button class="jcard mg-jovem ${j.ativo ? '' : 'inativo'}" data-act="editar-jovem" data-id="${j.id}">
      <span class="avatar" aria-hidden="true">${esc(iniciais(j.nome))}</span>
      <span class="jcard-txt">
        <span class="jcard-nome"><strong>${esc(j.nome)}</strong>${faixa(j) ? faixaBadge(j) : ''}${j.ativo ? '' : '<span class="pill">Inativo</span>'}</span>
        <span class="jcard-resp">
          <span>${j.genero === 'F' ? 'Feminina' : 'Masculina'}</span>
          ${tel ? `<span>${esc(fmtTel(j.telefone))}</span>` : '<span class="falta">sem telefone</span>'}
          ${j.nascimento ? '' : '<span class="falta">sem nascimento</span>'}
        </span>
      </span>
      <span class="chevron">${ICON.lapis}</span>
    </button>`;
  }).join('')}</div>`;
}

function mgJovens() {
  const d = S.data;
  const ativos = d.jovens.filter(j => j.ativo);
  const cont = { box: 0, sprint: 0 };
  ativos.forEach(j => { const f = faixa(j); if (f) cont[f]++; });
  const nFiltro = id => d.jovens.filter(MG_FILTROS[id][1]).length;
  const stat = (n, label, cls, filtro) => filtro
    ? `<button class="mg-stat ${cls} ${S.mgFiltro === filtro ? 'ativo' : ''}" data-act="mg-filtro" data-id="${S.mgFiltro === filtro ? 'todos' : filtro}"><strong>${n}</strong><span>${label}</span></button>`
    : `<div class="mg-stat ${cls}"><strong>${n}</strong><span>${label}</span></div>`;
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
      <label class="busca">${ICON.lupa}
        <input type="search" id="busca-mg" placeholder="Buscar pelo nome…" value="${esc(S.buscaMg)}" aria-label="Buscar jovem" autocomplete="off">
      </label>
      <div class="jfiltros"><div class="chips" role="group" aria-label="Filtrar">${Object.entries(MG_FILTROS).map(([id, [l]]) => `
        <button class="chip" data-act="mg-filtro" data-id="${id}" aria-pressed="${S.mgFiltro === id}">${l}<span class="c">${nFiltro(id)}</span></button>`).join('')}
      </div></div>
    </div>
    <div id="mglista">${htmlListaMgJovens()}</div>`;
}

function mgDiretoria() {
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
            <strong>${esc(p.nome)}${p.id === S.me ? ' <span class="voce">você</span>' : ''}</strong>
            <small>${p.ativo ? (evento() ? plural(n, 'chamada', 'chamadas') + ' neste evento' : 'Ativo') : 'Inativo · fora das distribuições'}</small>
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
    <div class="aparelho">
      <div><strong>Este aparelho</strong><small>Você está como <b>${esc(eu ? eu.nome : 'Visitante')}</b>.</small></div>
      <div class="row-btns">
        <button class="btn small" data-act="trocar-eu">Trocar pessoa</button>
        <button class="btn small danger" data-act="sair">Sair</button>
      </div>
    </div>`;
}

function viewGerenciar() {
  const abas = [['eventos', 'Eventos', ICON.cal], ['jovens', 'Jovens', ICON.grupo], ['diretoria', 'Diretoria', ICON.user]];
  const corpo = { eventos: mgEventos, jovens: mgJovens, diretoria: mgDiretoria }[S.mgTab]();
  return `
    <div class="mg-abas" role="tablist">${abas.map(([id, l, ic]) => `
      <button role="tab" data-act="mg-tab" data-id="${id}" aria-selected="${S.mgTab === id}">${ic}<span>${l}</span></button>`).join('')}
    </div>
    <div class="mg-corpo">${corpo}</div>`;
}

/* ---------------------------------------------------------------------
   Diálogos
   --------------------------------------------------------------------- */
const dlg = () => $('#dlg');
const semAnimacao = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function abrirDlg(html, estado, d = dlg()) {
  const novoTipo = (estado || { tipo: 'html' }).tipo;
  const trocou = d === dlg() && S.dlg && S.dlg.tipo !== novoTipo;
  if (d === dlg()) S.dlg = estado || { tipo: 'html' };
  d.classList.remove('fechando');
  const rolagem = !trocou && d.open ? d.scrollTop : 0;
  d.innerHTML = `<div class="dlg-body ${trocou ? 'troca' : ''}" tabindex="-1">${html}</div>`;
  if (!d.open) d.showModal();
  d.scrollTop = rolagem;
  // foco no primeiro campo marcado (ou no corpo), nunca no botão de fechar
  (d.querySelector('[autofocus]') || d.querySelector('.dlg-body')).focus({ preventScroll: true });
}

function fecharDlg(d = dlg()) {
  if (!d.open) return Promise.resolve();
  if (d._fechando) return d._fechando;
  d._fechando = new Promise(res => {
    const fim = () => {
      if (!d.classList.contains('fechando')) return;
      d.classList.remove('fechando');
      d.close();
      d._fechando = null;
      res();
    };
    d.classList.add('fechando');
    if (semAnimacao()) return fim();
    d.addEventListener('animationend', fim, { once: true });
    setTimeout(fim, 320);
  });
  return d._fechando;
}

/* Confirmação e texto no lugar do confirm()/prompt() do navegador */
function confirmar({ titulo, texto = '', ok = 'Confirmar', perigo = false }) {
  const d = $('#dlg2');
  return new Promise(res => {
    abrirDlg(`
      <div class="confirma">
        <span class="confirma-ic ${perigo ? 'perigo' : ''}">${perigo ? ICON.alerta : ICON.info}</span>
        <h2>${titulo}</h2>
        ${texto ? `<p>${texto}</p>` : ''}
      </div>
      <div class="dlg-foot fim">
        <button class="btn ghost" data-r="0">Cancelar</button>
        <button class="btn ${perigo ? 'danger-solid' : 'primary'}" data-r="1" autofocus>${ok}</button>
      </div>`, null, d);
    const responder = v => { d.onclick = d.oncancel = null; fecharDlg(d).then(() => res(v)); };
    d.onclick = e => {
      const b = e.target.closest('[data-r]');
      if (b) responder(b.dataset.r === '1');
      else if (e.target === d) responder(false);
    };
    d.oncancel = e => { e.preventDefault(); responder(false); };
  });
}

function pedirTexto({ titulo, sub = '', valor = '', placeholder = '' }) {
  const d = $('#dlg2');
  return new Promise(res => {
    abrirDlg(`
      <form class="form-texto">
        <div class="dlg-head"><div><h2>${titulo}</h2>${sub ? `<p class="dlg-sub">${sub}</p>` : ''}</div></div>
        <textarea name="t" rows="3" placeholder="${esc(placeholder)}" autofocus>${esc(valor)}</textarea>
        <div class="dlg-foot fim">
          ${valor ? '<button type="button" class="btn danger" data-r="apagar" style="margin-right:auto">Apagar</button>' : ''}
          <button type="button" class="btn ghost" data-r="0">Cancelar</button>
          <button class="btn primary">Salvar</button>
        </div>
      </form>`, null, d);
    const form = d.querySelector('form');
    const ta = form.t;
    ta.setSelectionRange(ta.value.length, ta.value.length);
    const responder = v => { d.onclick = d.oncancel = null; fecharDlg(d).then(() => res(v)); };
    form.onsubmit = e => { e.preventDefault(); responder(ta.value.trim()); };
    ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); responder(ta.value.trim()); } };
    d.onclick = e => {
      const b = e.target.closest('[data-r]');
      if (b) responder(b.dataset.r === 'apagar' ? '' : null);
      else if (e.target === d) responder(null);
    };
    d.oncancel = e => { e.preventDefault(); responder(null); };
  });
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
  const s = statusJovem(lista);

  abrirDlg(`
    <div class="dlg-head">
      <div class="dlg-pessoa st-${s}">
        <span class="avatar" aria-hidden="true">${esc(iniciais(j.nome))}</span>
        <div><h2>${esc(j.nome)}</h2>
          <div class="pcard-meta">${[faixa(j) ? faixaBadge(j) : '<span>idade não informada</span>', digitos(j.telefone) ? `<span>${esc(fmtTel(j.telefone))}</span>` : '<span>sem telefone</span>'].join('<span class="sep" aria-hidden="true">·</span>')}</div>
        </div>
      </div>
      <button class="x" data-act="fechar" aria-label="Fechar">${ICON.xis}</button>
    </div>
    ${j.obs ? `<p class="pcard-obs">${esc(j.obs)}</p>` : ''}
    ${digitos(j.telefone) ? `<div class="acoes">
      <a class="btn wa" href="${esc(linkWhats(ev, j))}" target="_blank" rel="noopener" data-act="contato" ${minha ? `data-id="${minha.id}"` : ''}>${ICON.wa}WhatsApp</a>
      <a class="btn" href="tel:+${telIntl(j.telefone)}" data-act="contato" ${minha ? `data-id="${minha.id}"` : ''}>${ICON.tel}Ligar</a>
    </div>` : `<button class="btn tracejado" data-act="editar-jovem" data-id="${j.id}">+ Adicionar telefone</button>`}
    <h4 class="grupo-titulo">Chamadas · ${esc(ev.nome)}</h4>
    ${lista.length ? lista.map(a => `
      <div class="resp">
        <div class="resp-head"><strong>${esc(diretor(a.diretor_id)?.nome)}${a.diretor_id === S.me ? ' <span class="voce">você</span>' : ''}</strong>
          <span class="dim small">${a.atualizado_em ? `${esc(a.atualizado_por || '')} · ${tempoAtras(a.atualizado_em)}` : ''}</span></div>
        ${segStatus(a)}
        ${a.nota ? `<button class="nota" data-act="nota" data-id="${a.id}"><span aria-hidden="true">📝</span> ${esc(a.nota)}</button>` : `<div><button class="link-btn" data-act="nota" data-id="${a.id}">+ Nota</button></div>`}
      </div>`).join('') : '<p class="dim small" style="margin:0">Ninguém responsável ainda.</p>'}
    <details class="mudar" ${lista.length ? '' : 'open'}>
      <summary>Mudar quem chama</summary>
      <div class="chips">${dirs.map(d => `<button class="chip" data-act="toggle-resp" data-jovem="${j.id}" data-id="${d.id}" aria-pressed="${atuais.has(d.id)}">${esc(d.nome)}</button>`).join('')}</div>
    </details>
    <div class="dlg-foot">
      <button class="btn ghost" data-act="editar-jovem" data-id="${j.id}">${ICON.lapis}Editar cadastro</button>
      <button class="btn" data-act="fechar">Fechar</button>
    </div>`, { tipo: 'jovem', id: jid });
}

/* ---------------------------------------------------------------------
   Formulário genérico
   tipos: text, tel, date, segmentado, stepper, switch, mensagem
   --------------------------------------------------------------------- */
function mascaraTel(v) {
  let d = digitos(v);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function textoIdade(nasc) {
  const i = idade(nasc);
  if (i == null || i < 0 || i > 120) return null;
  return `${i} anos · ${i >= IDADE_BOX ? 'Box' : 'Sprint'}`;
}

function abrirForm({ titulo, sub = '', campos, valores = {}, onSalvar, onExcluir, textoExcluir = 'Excluir', textoSalvar = 'Salvar' }) {
  const campo = c => {
    const v = valores[c.nome] ?? c.padrao ?? '';
    const cls = `field ${c.full ? 'full' : ''}`;
    const dica = c.dica ? `<span class="hint">${c.dica}</span>` : '';
    const af = c.autofocus ? 'autofocus' : '';
    switch (c.tipo) {
      case 'switch':
        return `<label class="switch-row full">
          <span class="switch-txt"><strong>${c.label}</strong>${c.dica ? `<small>${c.dica}</small>` : ''}</span>
          <input type="checkbox" class="switch" role="switch" name="${c.nome}" ${v ? 'checked' : ''}>
        </label>`;
      case 'segmentado':
        return `<fieldset class="${cls}"><legend>${c.label}</legend>
          <div class="seg-form ${c.opcoes.some(o => o[2]) ? 'com-desc' : ''}">${c.opcoes.map(([ov, ol, od]) => `
            <label><input type="radio" name="${c.nome}" value="${ov}" ${String(v) === ov ? 'checked' : ''}>
              <span><strong>${ol}</strong>${od ? `<small>${od}</small>` : ''}</span></label>`).join('')}
          </div>${dica}</fieldset>`;
      case 'stepper':
        return `<div class="${cls}"><span class="lbl">${c.label}</span>
          <div class="stepper">
            <button type="button" data-step="-1" aria-label="Menos">−</button>
            <input type="number" name="${c.nome}" value="${esc(v)}" min="${c.min}" max="${c.max}" inputmode="numeric" aria-label="${c.label}">
            <button type="button" data-step="1" aria-label="Mais">+</button>
          </div>${dica}</div>`;
      case 'mensagem':
        return `<div class="${cls}"><span class="lbl">${c.label}</span>
          <textarea name="${c.nome}" rows="4" placeholder="${esc(MSG_PADRAO)}">${esc(v)}</textarea>
          <div class="vars"><span class="hint">Inserir:</span>${['nome', 'eu', 'evento', 'quando'].map(x => `<button type="button" class="var" data-var="{${x}}">{${x}}</button>`).join('')}</div>
          <div class="previa"><span class="eyebrow">Prévia no WhatsApp</span><div class="bolha" data-previa></div></div>
          ${dica}</div>`;
      default: {
        const tipo = c.tipo || 'text';
        const val = tipo === 'tel' ? mascaraTel(v) : v;
        const extra = tipo === 'tel' ? 'inputmode="tel" data-tel' : tipo === 'date' ? 'data-idade' : '';
        const hint = tipo === 'date'
          ? `<span class="hint" data-hint-idade data-padrao="${esc(c.dica || '')}">${textoIdade(v) || c.dica || ''}</span>`
          : dica;
        return `<label class="${cls}"><span class="lbl">${c.label}</span>
          <input name="${c.nome}" type="${tipo}" value="${esc(val)}" ${c.obrig ? 'required' : ''} ${af} ${extra}
            placeholder="${esc(c.placeholder || '')}" autocomplete="off">${hint}</label>`;
      }
    }
  };

  abrirDlg(`
    <form id="form-dlg" novalidate>
      <div class="dlg-head">
        <div><h2>${titulo}</h2>${sub ? `<p class="dlg-sub">${sub}</p>` : ''}</div>
        <button type="button" class="x" data-act="fechar" aria-label="Fechar">${ICON.xis}</button>
      </div>
      <div class="form-grid">${campos.map(campo).join('')}</div>
      <div class="dlg-foot">
        ${onExcluir ? `<button type="button" class="btn danger" id="btn-excluir">${ICON.lixo}${textoExcluir}</button>` : '<span></span>'}
        <div class="row-btns"><button type="button" class="btn ghost" data-act="fechar">Cancelar</button><button class="btn primary" type="submit">${textoSalvar}</button></div>
      </div>
    </form>`, { tipo: 'form' });

  const form = $('#form-dlg');
  const previa = form.querySelector('[data-previa]');
  const atualizarPrevia = () => {
    if (!previa) return;
    const ev = { nome: form.elements.nome?.value.trim() || 'Evento', data: form.elements.data?.value, hora: form.elements.hora?.value.trim(), mensagem: form.elements.mensagem.value.trim() };
    previa.textContent = mensagem(ev, { nome: 'Ana' });
  };
  atualizarPrevia();

  form.addEventListener('input', e => {
    const t = e.target;
    if (t.matches('[data-tel]')) t.value = mascaraTel(t.value);
    if (t.matches('[data-idade]')) {
      const h = form.querySelector('[data-hint-idade]');
      h.textContent = textoIdade(t.value) || h.dataset.padrao;
      h.classList.toggle('ok', !!textoIdade(t.value));
    }
    t.closest('.field')?.classList.remove('invalido');
    atualizarPrevia();
  });
  form.addEventListener('click', e => {
    const passo = e.target.closest('[data-step]');
    if (passo) {
      const inp = passo.parentElement.querySelector('input');
      const n = Math.min(Number(inp.max), Math.max(Number(inp.min), (Number(inp.value) || 0) + Number(passo.dataset.step)));
      inp.value = n;
    }
    const vb = e.target.closest('[data-var]');
    if (vb) {
      const ta = form.elements.mensagem;
      if (!ta.value) ta.value = MSG_PADRAO;
      const [i, f] = [ta.selectionStart, ta.selectionEnd];
      ta.setRangeText(vb.dataset.var, i, f, 'end');
      ta.focus();
      atualizarPrevia();
    }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const dados = { ...valores };
    for (const c of campos) {
      const el = form.elements[c.nome];
      dados[c.nome] = c.tipo === 'switch' ? el.checked : c.tipo === 'stepper' ? Number(el.value) : String(el.value).trim();
    }
    const faltando = campos.filter(c => c.obrig && !dados[c.nome]);
    if (faltando.length) {
      faltando.forEach(c => form.elements[c.nome].closest('.field').classList.add('invalido'));
      form.elements[faltando[0].nome].focus();
      return;
    }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    btn.classList.add('carregando');
    try {
      await onSalvar(dados);
      await fecharDlg();
      await recarregar();
    } catch (err) { falha(err); btn.disabled = false; btn.classList.remove('carregando'); }
  });
  if (onExcluir) {
    $('#btn-excluir').addEventListener('click', async () => {
      try {
        if ((await onExcluir()) === false) return;
        await fecharDlg();
        await recarregar();
      } catch (err) { falha(err); }
    });
  }
}

const EQUIPES = [['F', 'Feminina'], ['M', 'Masculina']];

function formJovem(j) {
  abrirForm({
    titulo: j ? 'Editar jovem' : 'Novo jovem',
    sub: j ? `Dados de ${esc(j.nome)}` : 'Cadastre pra entrar nas listas de chamada.',
    campos: [
      { nome: 'nome', label: 'Nome', obrig: true, full: true, autofocus: !j, placeholder: 'Nome (apelido)' },
      { nome: 'genero', label: 'Equipe', tipo: 'segmentado', padrao: 'F', opcoes: EQUIPES, full: true },
      { nome: 'nascimento', label: 'Data de nascimento', tipo: 'date', dica: `Define Box (${IDADE_BOX}+) ou Sprint` },
      { nome: 'telefone', label: 'WhatsApp', tipo: 'tel', placeholder: '(11) 91234-5678' },
      { nome: 'obs', label: 'Observação', full: true, placeholder: 'Ex.: veio pela primeira vez na vigília' },
      { nome: 'ativo', label: 'Ativo', tipo: 'switch', padrao: true, dica: 'Entra nas distribuições de chamada' },
    ],
    valores: j || {},
    onSalvar: dados => rpc('box_salvar', { p_tabela: 'jovens', p_dados: dados }),
    onExcluir: j && (async () => {
      const ok = await confirmar({
        titulo: `Excluir ${esc(j.nome)}?`, perigo: true, ok: 'Excluir',
        texto: 'Some de todas as listas e eventos. Se a pessoa só não está participando, prefira desligar “Ativo”.',
      });
      if (!ok) return false;
      await rpc('box_excluir', { p_tabela: 'jovens', p_id: j.id });
    }),
  });
}

function formDiretor(p) {
  abrirForm({
    titulo: p ? 'Editar pessoa' : 'Nova pessoa na diretoria',
    sub: p ? `Dados de ${esc(p.nome)}` : 'Ela passa a receber jovens pra chamar.',
    campos: [
      { nome: 'nome', label: 'Nome', obrig: true, full: true, autofocus: !p },
      { nome: 'equipe', label: 'Equipe', tipo: 'segmentado', padrao: 'F', opcoes: EQUIPES, full: true },
      { nome: 'telefone', label: 'Telefone', tipo: 'tel', full: true, placeholder: '(11) 91234-5678' },
      { nome: 'ativo', label: 'Ativo', tipo: 'switch', padrao: true, dica: 'Recebe jovens na distribuição' },
    ],
    valores: p || {},
    onSalvar: dados => rpc('box_salvar', { p_tabela: 'diretores', p_dados: dados }),
    onExcluir: p && (async () => {
      const ok = await confirmar({
        titulo: `Excluir ${esc(p.nome)}?`, perigo: true, ok: 'Excluir',
        texto: 'As chamadas dessa pessoa nos eventos abertos ficam sem responsável. Se só vai dar um tempo, prefira desligar “Ativo”.',
      });
      if (!ok) return false;
      await rpc('box_excluir', { p_tabela: 'diretores', p_id: p.id });
      if (S.me === p.id) { S.me = null; LS.set('me', null); }
    }),
  });
}

function formEvento(e) {
  abrirForm({
    titulo: e ? 'Editar evento' : 'Novo evento',
    sub: e ? esc(e.nome) : 'Ao salvar, as chamadas já são distribuídas automaticamente.',
    textoSalvar: e ? 'Salvar' : 'Criar e distribuir',
    campos: [
      { nome: 'nome', label: 'Nome', obrig: true, full: true, autofocus: !e, placeholder: 'Ex.: Box Day, Vigília, Retiro' },
      { nome: 'data', label: 'Data', tipo: 'date' },
      { nome: 'hora', label: 'Horário', placeholder: 'Ex.: 17h Teens · 20h Juventude' },
      { nome: 'publico', label: 'Quem chamar', tipo: 'segmentado', padrao: 'box', full: true, opcoes: [
        ['box', 'Box', `${IDADE_BOX} anos ou mais`], ['sprint', 'Sprint', `até ${IDADE_BOX - 1} anos`], ['todos', 'Box + Sprint', 'todo mundo'],
      ] },
      { nome: 'chamadas_por_jovem', label: 'Diretores por jovem', tipo: 'stepper', padrao: 2, min: 1, max: 5, full: true, dica: 'Quantas pessoas da diretoria chamam cada jovem' },
      { nome: 'mensagem', label: 'Mensagem do WhatsApp', tipo: 'mensagem', full: true, dica: 'Deixe vazio pra usar a mensagem padrão.' },
      ...(e ? [{ nome: 'arquivado', label: 'Arquivar evento', tipo: 'switch', dica: 'Some da lista de eventos abertos' }] : []),
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
      const ok = await confirmar({
        titulo: `Excluir “${esc(e.nome)}”?`, perigo: true, ok: 'Excluir evento',
        texto: 'Apaga o evento e todo o progresso e histórico dele. Se ele só já aconteceu, prefira “Arquivar”.',
      });
      if (!ok) return false;
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
    <form id="form-imp">
      <div class="dlg-head">
        <div><h2>Importar lista</h2><p class="dlg-sub">Cole uma pessoa por linha. Quem já existe é atualizado.</p></div>
        <button type="button" class="x" data-act="fechar" aria-label="Fechar">${ICON.xis}</button>
      </div>
      <div class="formato"><span class="eyebrow">Formato</span><code>nome; telefone; nascimento; F ou M</code><small>Só o nome é obrigatório, e a ordem dos outros tanto faz.</small></div>
      <textarea name="texto" rows="7" autofocus placeholder="Maria Souza; 11 91234-5678; 14/03/2007&#10;João Pedro; 11 99876-5432; 02/11/2008; M"></textarea>
      <fieldset class="field"><legend>Equipe, quando a linha não disser F/M</legend>
        <div class="seg-form">${EQUIPES.map(([v, l], i) => `<label><input type="radio" name="genero" value="${v}" ${i ? '' : 'checked'}><span><strong>${l}</strong></span></label>`).join('')}</div>
      </fieldset>
      <div id="imp-preview"></div>
      <div class="dlg-foot"><span></span><div class="row-btns"><button type="button" class="btn ghost" data-act="fechar">Cancelar</button><button class="btn primary" type="submit" disabled>Importar</button></div></div>
    </form>`, { tipo: 'form' });
  const form = $('#form-imp');
  const preview = () => {
    const rows = parseImport(form.texto.value, form.genero.value);
    const novos = rows.filter(r => !r._existe).length;
    form.querySelector('[type=submit]').disabled = !rows.length;
    form.querySelector('[type=submit]').textContent = rows.length ? `Importar ${rows.length}` : 'Importar';
    $('#imp-preview').innerHTML = rows.length ? `
      <div class="imp-resumo"><span class="pill st-confirmado">${plural(novos, 'novo', 'novos')}</span>${rows.length - novos ? `<span class="pill st-chamado">${plural(rows.length - novos, 'atualizado', 'atualizados')}</span>` : ''}</div>
      <ul class="imp-lista">${rows.slice(0, 8).map(r => `
        <li><strong>${esc(r.nome)}</strong>
          <span>${r.genero === 'M' ? 'Masc.' : 'Fem.'}</span>
          <span class="${r.telefone ? '' : 'falta'}">${r.telefone ? esc(mascaraTel(r.telefone)) : 'sem tel.'}</span>
          <span class="${r.nascimento ? '' : 'falta'}">${r.nascimento ? textoIdade(r.nascimento) || '?' : 'sem nasc.'}</span>
          ${r._existe ? '<em>atualiza</em>' : ''}</li>`).join('')}
        ${rows.length > 8 ? `<li class="dim">+ ${rows.length - 8}…</li>` : ''}</ul>` : '';
  };
  form.addEventListener('input', preview);
  form.addEventListener('change', preview);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const rows = parseImport(form.texto.value, form.genero.value).map(({ _existe, ...r }) => r);
    if (!rows.length) return;
    try {
      await rpc('box_salvar', { p_tabela: 'jovens', p_dados: rows });
      await fecharDlg();
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
  if (tem && alvo.status !== 'pendente' && !(await confirmar({
    titulo: 'Tirar essa pessoa da chamada?', perigo: true, ok: 'Remover',
    texto: `A chamada de ${esc(diretor(did)?.nome)} já está marcada como “${STATUS_BY_ID[alvo.status].label}” e essa marcação vai se perder.`,
  }))) return;
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
    if (!(await confirmar({
      titulo: 'Refazer a distribuição?', ok: 'Sortear de novo', perigo: marcadas > 0,
      texto: `Sorteia de novo quem chama quem em “${esc(ev.nome)}”.` +
        (marcadas ? ` <strong>${plural(marcadas, 'chamada já marcada', 'chamadas já marcadas')}</strong>: se a mesma dupla sair de novo a marcação fica; se não, ela se perde.` : ''),
    }))) return;
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
    case 'trocar-evento': dlgEventos(); break;
    case 'escolher-evento':
      S.eventoId = id;
      LS.set('evento', id);
      await fecharDlg();
      render();
      break;
    case 'ver-filtro': {
      S.tab = 'jovens';
      S.filtro = id;
      S.limJ = PAG_JOVENS;
      LS.set('tab', 'jovens');
      render();
      rolarParaConteudo({ sempre: true, suave: true });
      break;
    }
    case 'tab': {
      S.tab = id;
      S.limJ = PAG_JOVENS;
      LS.set('tab', id);
      render();
      rolarParaConteudo({ sempre: el.classList.contains('presenca-cta'), suave: el.classList.contains('presenca-cta') });
      break;
    }
    case 'filtro': S.filtro = id; S.limJ = PAG_JOVENS; render(); break;
    case 'hist-filtro': S.histFiltro = id; render(); break;
    case 'presenca': await togglePresenca(id); break;
    case 'p-filtro': S.pFiltro = id; atualizarPresenca(); break;
    case 'visitante': formVisitante(); break;
    case 'faixa-j': S.faixaJ = id; S.limJ = PAG_JOVENS; render(); break;
    case 'status': await setStatus(id, el.dataset.status); break;
    case 'contato': {
      const a = id && S.data.atribuicoes.find(x => x.id === id);
      // espera o link abrir antes de redesenhar a tela
      if (a && a.status === 'pendente') setTimeout(() => { setStatus(id, 'chamado'); toast('Marcado como "Chamei"'); }, 400);
      break;
    }
    case 'nota': {
      const a = S.data.atribuicoes.find(x => x.id === id);
      const t = await pedirTexto({
        titulo: a.nota ? 'Editar nota' : 'Nova nota', sub: `Sobre ${esc(jovem(a.jovem_id).nome)}`,
        valor: a.nota || '', placeholder: 'Ex.: vai levar uma amiga, chega atrasado…',
      });
      if (t !== null) await setStatus(id, null, t);
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
      if (await confirmar({
        titulo: 'Zerar as marcações?', perigo: true, ok: 'Zerar tudo',
        texto: `Todas as chamadas de “${esc(evento().nome)}” voltam pra pendente e o histórico é apagado. Quem chama quem continua igual.`,
      })) {
        try { await rpc('box_zerar', { p_evento: S.eventoId }); await recarregar(); toast('Marcações zeradas'); } catch (err) { falha(err); }
      }
      break;
    case 'copiar-lista': {
      const t = textoGrupo();
      try { await navigator.clipboard.writeText(t); toast('Lista copiada, é só colar no grupo'); }
      catch {
        abrirDlg(`<div class="dlg-head"><div><h2>Lista pro grupo</h2><p class="dlg-sub">Selecione e copie o texto.</p></div><button class="x" data-act="fechar" aria-label="Fechar">${ICON.xis}</button></div>
          <textarea rows="14" readonly>${esc(t)}</textarea>`);
      }
      break;
    }
    case 'sair':
      if (await confirmar({ titulo: 'Sair deste aparelho?', ok: 'Sair', texto: 'O código de acesso é esquecido e vai ser pedido de novo na próxima vez.' })) sair();
      break;
    case 'mg-tab':
      S.mgTab = id;
      LS.set('mgTab', id);
      render();
      break;
    case 'mg-filtro':
      S.mgFiltro = id;
      render();
      break;
  }
});

document.addEventListener('input', e => {
  if (e.target.id === 'busca') {
    S.busca = e.target.value;
    S.limJ = PAG_JOVENS;
    atualizarListaJovens();
    return;
  }
  if (e.target.id === 'busca-p') {
    S.buscaP = e.target.value;
    $('#plista').innerHTML = htmlListaPresenca();
    return;
  }
  if (e.target.id === 'busca-mg') {
    S.buscaMg = e.target.value;
    $('#mglista').innerHTML = htmlListaMgJovens();
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
dlg().addEventListener('cancel', e => { e.preventDefault(); fecharDlg(); });

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

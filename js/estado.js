// Configuração, constantes e estado da tela.
import { evento } from './dados.js';
import { demo } from './demo.js';
import { dlg } from './dialogos.js';
import { faixa } from './util.js';

export const CFG = window.BOX_CONFIG || {};

// ?demo na URL força dados fictícios, bom pra testar sem mexer no banco real
export const DEMO = new URLSearchParams(location.search).has('demo') || !CFG.supabaseUrl || !CFG.supabaseKey;

export const IDADE_BOX = 17;

export const POLL_MS = 12000;

export const LS = {
  pre: DEMO ? 'box-demo:' : 'box:',
  get(k) { try { return localStorage.getItem(LS.pre + k); } catch { return null; } },
  set(k, v) {
    try { v == null ? localStorage.removeItem(LS.pre + k) : localStorage.setItem(LS.pre + k, v); } catch {}
  },
};

export const STATUS = [
  { id: 'pendente', label: 'Pendente', feed: 'voltou para pendente' },
  { id: 'chamado', label: 'Chamei', feed: 'chamou' },
  { id: 'confirmado', label: 'Confirmou', feed: 'confirmou' },
  { id: 'nao_vai', label: 'Não vai', feed: 'marcou "não vai" para' },
];

export const STATUS_BY_ID = Object.fromEntries(STATUS.map(s => [s.id, s]));

export const PRIORIDADE = { confirmado: 4, nao_vai: 3, chamado: 2, pendente: 1 };

export const MSG_PADRAO =
  'Oi, {nome}! Tudo bem? 😊 Aqui é {eu}, do Box. Passando pra te chamar pro {evento}{quando}. ' +
  'Bora? Vai ser muito bom ter você com a gente! 🔥';

export const S = {
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
  mgF: { faixa: '', idadeMin: '', idadeMax: '', mes: '', civil: '', equipe: '' },
  mgOrdem: 'nome',
  mgPainel: false,
  buscaP: '',
  push: { situacao: 'carregando', inscricao: null },
  pCulto: '',
  histModo: 'marcacoes',
  pFiltro: 'todos',
  limJ: 20,
  buscaMg: '',
  data: null,
  dlg: null,
  erroLogin: '',
};

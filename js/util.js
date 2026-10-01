// Utilidades: datas, idades, telefone, textos e avisos.
import { diretor, evento, jovem } from './dados.js';
import { IDADE_BOX, MSG_PADRAO, S } from './estado.js';

export const $ = sel => document.querySelector(sel);

export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const byNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Math.random().toString(16).slice(2) + Date.now());

// data local (YYYY-MM-DD); toISOString() usa UTC e vira o dia às 21h no Brasil
export function hojeISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function idade(nasc) {
  if (!nasc) return null;
  const [y, m, d] = nasc.split('-').map(Number);
  const t = new Date();
  let a = t.getFullYear() - y;
  if (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < d)) a--;
  return a;
}

export function faixa(j) {
  const i = idade(j.nascimento);
  if (i == null) return null;
  return i >= IDADE_BOX ? 'box' : 'sprint';
}

export function faixaBadge(j) {
  const i = idade(j.nascimento);
  const f = faixa(j);
  if (!f) return '<span class="faixa nd" title="Sem data de nascimento">idade?</span>';
  return `<span class="faixa ${f}">${f === 'box' ? 'Box' : 'Sprint'} · ${i}</span>`;
}

export function elegivel(j, ev) {
  if (!j.ativo) return false;
  if (ev.publico === 'todos') return true;
  const f = faixa(j);
  return f == null || f === ev.publico;
}

export function digitos(tel) { return String(tel || '').replace(/\D/g, ''); }

export function fmtTel(tel) {
  const d = digitos(tel).replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel || '';
}

export function telIntl(tel) {
  const d = digitos(tel);
  if (d.length === 10 || d.length === 11) return '55' + d;
  return d;
}

export function dataEvento(ev, opts = { weekday: 'long', day: '2-digit', month: '2-digit' }) {
  if (!ev.data) return '';
  const [y, m, d] = ev.data.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', opts);
}

// Horário de cada faixa só vale em evento Box + Sprint.
export const porFaixa = ev => ev.publico === 'todos' && (ev.hora_box || ev.hora_sprint);

export function horaGeral(ev) {
  if (ev.hora || !porFaixa(ev)) return ev.hora || '';
  return [ev.hora_sprint && `${ev.hora_sprint} (Sprint)`, ev.hora_box && `${ev.hora_box} (Box)`].filter(Boolean).join(' e ');
}

export function horaPara(ev, j) {
  const f = porFaixa(ev) && j && faixa(j);
  if (f === 'box' && ev.hora_box) return ev.hora_box;
  if (f === 'sprint' && ev.hora_sprint) return ev.hora_sprint;
  return horaGeral(ev);
}

export function quandoEvento(ev) {
  return [dataEvento(ev), horaGeral(ev)].filter(Boolean).join(' · ');
}

export const PUBLICO_LABEL = { box: 'Box (17+)', sprint: 'Sprint (até 16)', todos: 'Box + Sprint' };

export function primeiroNome(nome) { return String(nome).replace(/\s*\(.*?\)\s*/g, ' ').trim(); }

export function mensagem(ev, jovem) {
  const eu = diretor(S.me);
  let quando = '';
  if (ev.data) quando += ` ${dataEvento(ev)}`;
  const hora = horaPara(ev, jovem);
  if (hora) quando += `, às ${hora}`;
  if (quando) quando = ',' + quando;
  return (ev.mensagem || MSG_PADRAO)
    .replaceAll('{nome}', primeiroNome(jovem.nome))
    .replaceAll('{eu}', eu ? eu.nome : 'a diretoria')
    .replaceAll('{evento}', ev.nome)
    .replaceAll('{quando}', quando)
    .replaceAll('{data}', dataEvento(ev))
    .replaceAll('{hora}', hora);
}

export function linkWhats(ev, jovem) {
  const n = telIntl(jovem.telefone);
  if (!n) return null;
  return `https://api.whatsapp.com/send?phone=${n}&text=${encodeURIComponent(mensagem(ev, jovem))}`;
}

export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

export function tempoAtras(ts) {
  const s = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 60) return 'agora';
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

export function embaralhar(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    [a[i], a[k]] = [a[k], a[i]];
  }
  return a;
}

export let toastTimer;

export function toast(msg, erro = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show' + (erro ? ' erro' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, erro ? 4000 : 2200);
}

export const celular = () => matchMedia('(max-width: 700px)').matches;

export function contagem(ev) {
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

export function iniciais(nome) {
  const partes = primeiroNome(nome).split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] || '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

export const semAcento = t => String(t || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

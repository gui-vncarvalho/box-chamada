// Acesso ao banco (Supabase) e carga dos dados.
import { sair } from './acoes.js';
import { diretor, evento, eventoPadrao, eventosAtivos } from './dados.js';
import { demo } from './demo.js';
import { CFG, DEMO, LS, S } from './estado.js';
import { $, hojeISO, toast } from './util.js';

export async function rpc(fn, args = {}) {
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

export let primeiraCarga = true;

// Presenças/justificativas de cultos antigos (fora da "janela" que o carregamento
// traz) buscadas sob demanda; ficam em memória e são mescladas a cada carregamento.
const extras = {};
export const naJanela = eid => !S.data?.janela || S.data.janela.includes(eid);

function mesclarExtras() {
  for (const [eid, x] of Object.entries(extras)) {
    if (naJanela(eid)) continue;
    S.data.presencas = S.data.presencas.filter(p => p.evento_id !== eid).concat(x.presencas || []);
    S.data.justificativas = S.data.justificativas.filter(j => j.evento_id !== eid).concat(x.justificativas || []);
  }
}

// Garante que as presenças de um culto estejam carregadas. Devolve true se precisou buscar.
export async function garantirEvento(eid, { recarregar = false } = {}) {
  if (naJanela(eid) || (extras[eid] && !recarregar)) return false;
  extras[eid] = await rpc('box_presencas_evento', { p_evento: eid });
  mesclarExtras();
  return true;
}

export async function carregar() {
  S.data = await rpc('box_carregar');
  S.data.presencas ||= [];
  S.data.vinculos ||= [];
  S.data.justificativas ||= [];
  mesclarExtras();
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

export function falha(e) {
  console.error(e);
  if (e.codigoInvalido) { sair('O código de acesso mudou. Entre de novo.'); return; }
  toast('Não deu pra salvar. Confira a internet e tente de novo.', true);
}

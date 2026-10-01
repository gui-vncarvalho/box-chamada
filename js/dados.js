// Consultas sobre os dados carregados.
import { PRIORIDADE, S } from './estado.js';
import { hojeISO } from './util.js';

export const diretor = id => S.data?.diretores.find(d => d.id === id);

export const jovem = id => S.data?.jovens.find(j => j.id === id);

export const evento = () => S.data?.eventos.find(e => e.id === S.eventoId);

export const eventosAtivos = () => (S.data?.eventos || []).filter(e => !e.arquivado);

export const atribs = () => (S.data?.atribuicoes || []).filter(a => a.evento_id === S.eventoId);

export const nomeQuem = () => (S.me && S.me !== 'visitante' ? diretor(S.me)?.nome : null) || 'Alguém';

export function eventoPadrao(evs) {
  const hoje = hojeISO();
  const futuros = evs.filter(e => e.data && e.data >= hoje).sort((a, b) => a.data.localeCompare(b.data));
  return futuros[0] || evs[0];
}

export function statusJovem(lista) {
  return lista.reduce((best, a) => (PRIORIDADE[a.status] > PRIORIDADE[best] ? a.status : best), 'pendente');
}

export function porJovem(lista = atribs()) {
  const m = new Map();
  for (const a of lista) {
    if (!m.has(a.jovem_id)) m.set(a.jovem_id, []);
    m.get(a.jovem_id).push(a);
  }
  return m;
}

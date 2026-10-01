// Distribuição automática de quem chama quem.
import { elegivel, embaralhar } from './util.js';

export function distribuir(ev, jovens, diretores, existentes, manter) {
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

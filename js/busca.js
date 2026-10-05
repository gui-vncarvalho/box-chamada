// Busca inteligente: idade, faixa, relacionamento, aniversário…
import { aniversariantes, proximoAniver } from './aniversarios.js';
import { $, digitos, faixa, idade, semAcento } from './util.js';
import { textoVinculo, vinculosDe } from './vinculos.js';

export const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const PALAVRAS_VAZIAS = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'em', 'com', 'anos', 'ano', 'idade', 'aniversario', 'aniversariante', 'aniversariantes', 'niver', 'mes', 'quem', 'faz', 'que']);

export const TERMOS_CIVIL = {
  casado: 'casado', casada: 'casado', casados: 'casado', casadas: 'casado',
  solteiro: 'solteiro', solteira: 'solteiro', solteiros: 'solteiro', solteiras: 'solteiro',
  namorando: 'namorando', namorado: 'namorando', namorada: 'namorando',
  noivo: 'noivo', noiva: 'noivo', noivos: 'noivo', noivas: 'noivo',
};

export const TERMOS_EQUIPE = {
  feminina: 'F', feminino: 'F', meninas: 'F', menina: 'F', mulheres: 'F', mulher: 'F',
  masculina: 'M', masculino: 'M', meninos: 'M', menino: 'M', homens: 'M', homem: 'M',
};

export function termoBusca(t) {
  let m;
  if ((m = t.match(/^(\d{1,3})\s*(?:-|a|ate)\s*(\d{1,3})$/))) {
    const [a, b] = [Number(m[1]), Number(m[2])].sort((x, y) => x - y);
    return p => { const i = idade(p.nascimento); return i != null && i >= a && i <= b; };
  }
  if ((m = t.match(/^(\d{1,3})\+$/))) return p => (idade(p.nascimento) ?? -1) >= Number(m[1]);
  if (/^\d{1,3}$/.test(t) && Number(t) <= 120) return p => idade(p.nascimento) === Number(t);
  if ((m = t.match(/^(\d{1,2})\/(\d{1,2})$/))) {
    const alvo = `-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return p => !!p.nascimento && p.nascimento.endsWith(alvo);
  }
  if (/^\d{4,}$/.test(t)) return p => digitos(p.telefone).includes(t);
  if (t === 'box' || t === 'boxer' || t === 'boxers') return p => faixa(p) === 'box';
  if (t === 'sprint' || t === 'teens' || t === 'teen') return p => faixa(p) === 'sprint';
  if (t === 'semana') return p => { const a = proximoAniver(p.nascimento); return !!a && a.dias <= 6; };
  if (t === 'hoje') return p => proximoAniver(p.nascimento)?.dias === 0;
  if (TERMOS_CIVIL[t]) return p => p.estado_civil === TERMOS_CIVIL[t];
  if (TERMOS_EQUIPE[t]) return p => (p.genero || p.equipe) === TERMOS_EQUIPE[t];
  const mes = t.length >= 3 ? MESES.findIndex(n => n === t || (t.length === 3 && n.startsWith(t))) : -1;
  if (mes >= 0) return p => !!p.nascimento && Number(p.nascimento.slice(5, 7)) === mes + 1;
  return p => {
    const vinc = vinculosDe(p.id).map(v => textoVinculo(v, p.id)?.texto || '').join(' ');
    return semAcento(`${p.nome} ${p.apelido || ''} ${p.obs || ''} ${vinc}`).includes(t);
  };
}

export function buscaInteligente(texto) {
  const termos = semAcento(texto).split(/\s+/).filter(t => t && !PALAVRAS_VAZIAS.has(t));
  if (!termos.length) return () => true;
  const testes = termos.map(termoBusca);
  return p => testes.every(f => f(p));
}

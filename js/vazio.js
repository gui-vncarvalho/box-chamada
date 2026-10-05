// Estados vazios ilustrados (cartão com desenho, título, texto e uma ação opcional).
import { ICON } from './icones.js';
import { esc } from './util.js';

// capacete reaproveitado do hero, encaixado dentro de outro SVG
const capacete = (x, y, w) => ICON.capacete.replace('<svg viewBox', `<svg x="${x}" y="${y}" width="${w}" height="${w * 44 / 64}" viewBox`);
const bandeira = (x, y) => `<g transform="translate(${x} ${y})"><rect width="16" height="16" rx="3" fill="#12161c" stroke="#f3e9d2" stroke-width="1.5"/>
  <path d="M0 0h8v8H0zM8 8h8v8H8z" fill="#f3e9d2"/></g>`;

const ILUSTRA = {
  // capacete parado na largada, pista apagada
  largada: `<svg viewBox="0 0 96 96" aria-hidden="true">
    <rect x="6" y="68" width="84" height="6" rx="3" fill="#2c343f"/>${capacete(4, 38, 40)}${bandeira(74, 46)}</svg>`,
  // capacete na bandeira, pista verde, confete
  chegada: `<svg viewBox="0 0 96 96" aria-hidden="true">
    <rect x="6" y="68" width="84" height="6" rx="3" fill="#38b787"/>${capacete(32, 38, 40)}${bandeira(74, 46)}
    <rect x="14" y="14" width="7" height="7" rx="1.5" fill="#e5392e" transform="rotate(18 17 17)"/>
    <rect x="44" y="6" width="6" height="6" rx="1.5" fill="#f3e9d2" transform="rotate(-14 47 9)"/>
    <rect x="72" y="16" width="7" height="7" rx="1.5" fill="#5a86ee" transform="rotate(30 75 19)"/>
    <rect x="26" y="30" width="5" height="5" rx="1" fill="#e8a53d" transform="rotate(-25 28 32)"/>
    <rect x="84" y="34" width="5" height="5" rx="1" fill="#38b787" transform="rotate(12 86 36)"/></svg>`,
  // lupa sem achar ninguém
  busca: `<svg viewBox="0 0 96 96" aria-hidden="true" fill="none" stroke-linecap="round">
    <circle cx="42" cy="42" r="24" stroke="#5a86ee" stroke-width="6"/><path d="M60 60l18 18" stroke="#5a86ee" stroke-width="8"/>
    <path d="M34 34l16 16M50 34L34 50" stroke="#b4bdc8" stroke-width="4"/></svg>`,
  // relógio pontilhado
  relogio: `<svg viewBox="0 0 96 96" aria-hidden="true" fill="none" stroke-linecap="round">
    <circle cx="48" cy="48" r="34" stroke="#8d97a3" stroke-width="4" stroke-dasharray="2 9"/>
    <path d="M48 28v20l13 9" stroke="#b4bdc8" stroke-width="5" stroke-linejoin="round"/></svg>`,
};

// acao: { rotulo, act, id?, modo?, icone?, secundaria? } ou HTML pronto (string)
export function estadoVazio({ ilustra, titulo, texto = '', acao = null, extra = '' }) {
  const botao = !acao ? '' : typeof acao === 'string' ? acao : `
    <button class="btn ${acao.secundaria ? '' : 'primary'} vz-acao" data-act="${acao.act}"${acao.id ? ` data-id="${esc(acao.id)}"` : ''}${acao.modo ? ` data-modo="${acao.modo}"` : ''}>
      ${acao.icone ? ICON[acao.icone] : ''}${esc(acao.rotulo)}</button>`;
  return `<div class="vazio-card vz-${ilustra}">
    <span class="vz-ilu">${ILUSTRA[ilustra] || ''}</span>
    <h3>${esc(titulo)}</h3>
    ${texto ? `<p>${texto}</p>` : ''}
    ${botao}${extra}
  </div>`;
}

// "Ninguém com “termo”" + Limpar busca (campo = id do input de busca)
export const buscaVazia = (termo, campo, acaoExtra = '') => estadoVazio({
  ilustra: 'busca', titulo: `Ninguém com “${termo.trim()}”`, texto: 'Confira a grafia ou busque por apelido, idade ou mês.',
  acao: acaoExtra || { rotulo: 'Limpar busca', act: 'limpar-busca', id: campo, secundaria: true },
  extra: acaoExtra ? `<button class="btn vz-acao" data-act="limpar-busca" data-id="${campo}">Limpar busca</button>` : '',
});

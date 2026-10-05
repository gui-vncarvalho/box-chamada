// Vínculos (casal, família, amizade) e relacionamento.
import { carregar, falha, rpc } from './api.js';
import { diretor, jovem } from './dados.js';
import { abrirDlg, confirmar, dlg, fecharDlg, renderDlgJovem } from './dialogos.js';
import { S } from './estado.js';
import { ICON } from './icones.js';
import { render, renderView } from './render.js';
import { ligarScrollInfinito } from './telas/jovens.js';
import { $, byNome, esc, faixa, faixaBadge, iniciais, nomeCurto, semAcento, toast } from './util.js';

// rot: tipos simétricos; a/b: direcionais (a → b). Texto pelo gênero de quem é descrito.
export const VINCULOS = {
  conjuge: { grupo: 'Casal', ic: '💍', rot: { F: 'Esposa', M: 'Marido' } },
  noivo: { grupo: 'Casal', ic: '💍', rot: { F: 'Noiva', M: 'Noivo' } },
  namoro: { grupo: 'Casal', ic: '❤️', rot: { F: 'Namorada', M: 'Namorado' } },
  irmao: { grupo: 'Família', ic: '👨‍👩‍👧', rot: { F: 'Irmã', M: 'Irmão' } },
  primo: { grupo: 'Família', ic: '👨‍👩‍👧', rot: { F: 'Prima', M: 'Primo' } },
  pai: { grupo: 'Família', ic: '👨‍👩‍👧', a: { F: 'Mãe', M: 'Pai' }, b: { F: 'Filha', M: 'Filho' } },
  tio: { grupo: 'Família', ic: '👨‍👩‍👧', a: { F: 'Tia', M: 'Tio' }, b: { F: 'Sobrinha', M: 'Sobrinho' } },
  amigo: { grupo: 'Amizade', ic: '🤝', rot: { F: 'Amiga', M: 'Amigo' } },
  convidou: { grupo: 'Amizade', ic: '✉️', verbo: true, a: { F: 'Convidou', M: 'Convidou' }, b: { F: 'Convidada por', M: 'Convidado por' } },
};

export const ESTADO_CIVIL = [['', 'Não informado'], ['solteiro', 'Solteiro(a)'], ['namorando', 'Namorando'], ['noivo', 'Noivo(a)'], ['casado', 'Casado(a)']];

export const ESTADO_LABEL = {
  solteiro: { F: 'Solteira', M: 'Solteiro' }, namorando: { F: 'Namorando', M: 'Namorando' },
  noivo: { F: 'Noiva', M: 'Noivo' }, casado: { F: 'Casada', M: 'Casado' },
};

export function pessoa(id) {
  const j = jovem(id);
  if (j) return { p: j, tipo: 'jovem', g: j.genero };
  const d = diretor(id);
  return d ? { p: d, tipo: 'diretor', g: d.equipe } : null;
}

export const vinculosDe = id => (S.data?.vinculos || []).filter(v => v.a_id === id || v.b_id === id);

// "Esposa de Caio", "Irmão de Duda", "Convidou Alice"
export function textoVinculo(v, id) {
  const def = VINCULOS[v.tipo];
  const eu = pessoa(id);
  const outro = pessoa(v.a_id === id ? v.b_id : v.a_id);
  if (!def || !eu || !outro) return null;
  const rot = def.rot ? def.rot[eu.g] : (v.a_id === id ? def.a : def.b)[eu.g];
  return { ic: def.ic, rot, texto: def.verbo ? `${rot} ${nomeCurto(outro.p)}` : `${rot} de ${nomeCurto(outro.p)}`, outro };
}

export function linhaVinculos(id, max = 2) {
  const itens = vinculosDe(id).map(v => textoVinculo(v, id)).filter(Boolean);
  if (!itens.length) return '';
  const vis = itens.slice(0, max).map(x => `<span>${x.ic} ${esc(x.texto)}</span>`).join('');
  return `<div class="vinc-linha">${vis}${itens.length > max ? `<span class="mais">+${itens.length - max}</span>` : ''}</div>`;
}

export function chipsVinculos(id, removivel = false) {
  const vs = vinculosDe(id);
  if (!vs.length) return '<p class="dim small" style="margin:0">Nenhum vínculo ainda.</p>';
  return `<div class="vinc-chips">${vs.map(v => {
    const t = textoVinculo(v, id);
    if (!t) return '';
    return `<span class="vinc-chip"><span>${t.ic} ${esc(t.texto)}</span>${removivel
      ? `<button type="button" data-act="vinc-remover" data-id="${v.id}" data-pessoa="${id}" aria-label="Remover vínculo">${ICON.xis}</button>` : ''}</span>`;
  }).join('')}</div>`;
}

// Opções do ponto de vista de quem está sendo editado: "Ana é ___ de ___"
export function opcoesVinculo(g) {
  const op = [];
  for (const [tipo, def] of Object.entries(VINCULOS)) {
    if (def.rot) op.push({ tipo, lado: 'a', grupo: def.grupo, label: def.rot[g] });
    else {
      op.push({ tipo, lado: 'a', grupo: def.grupo, label: def.a[g] });
      op.push({ tipo, lado: 'b', grupo: def.grupo, label: def.b[g] });
    }
  }
  return op;
}

export function dlgNovoVinculo(pid, aoSalvar) {
  const eu = pessoa(pid);
  if (!eu) return;
  const d = $('#dlg2');
  const ops = opcoesVinculo(eu.g);
  const grupos = ['Casal', 'Família', 'Amizade'];
  let escolha = null;
  let alvo = null;
  let busca = '';

  const frase = () => {
    if (!escolha) return `<span class="dim">Escolha o tipo e a pessoa.</span>`;
    const def = VINCULOS[escolha.tipo];
    const nomeAlvo = alvo ? `<b>${esc(nomeCurto(pessoa(alvo).p))}</b>` : '<span class="dim">…</span>';
    const rot = escolha.label.toLowerCase();
    return def.verbo
      ? `<b>${esc(nomeCurto(eu.p))}</b> ${rot} ${nomeAlvo}`
      : `<b>${esc(nomeCurto(eu.p))}</b> é ${rot} de ${nomeAlvo}`;
  };
  const listaPessoas = () => {
    const q = semAcento(busca);
    const todos = [
      ...S.data.jovens.filter(j => j.ativo).map(p => ({ p, tipo: 'jovem' })),
      ...S.data.diretores.filter(x => x.ativo).map(p => ({ p, tipo: 'diretor' })),
    ].filter(x => x.p.id !== pid && (!q || semAcento(`${x.p.nome} ${x.p.apelido || ''}`).includes(q))).sort((a, b) => byNome(a.p, b.p));
    if (!todos.length) return '<p class="dim small" style="padding:10px;margin:0">Ninguém encontrado.</p>';
    return todos.slice(0, 40).map(x => `
      <button type="button" class="vinc-pessoa ${alvo === x.p.id ? 'sel' : ''}" data-alvo="${x.p.id}">
        <span class="avatar" aria-hidden="true">${esc(iniciais(x.p.nome))}</span>
        <span>${esc(nomeCurto(x.p))}</span>
        ${x.tipo === 'diretor' ? '<span class="pill st-chamado">Diretoria</span>' : faixa(x.p) ? faixaBadge(x.p) : ''}
      </button>`).join('');
  };
  const pintar = () => {
    d.querySelector('[data-frase]').innerHTML = frase();
    d.querySelector('[data-pessoas]').innerHTML = listaPessoas();
    d.querySelectorAll('[data-op]').forEach(b => b.setAttribute('aria-pressed', String(escolha && b.dataset.op === `${escolha.tipo}:${escolha.lado}`)));
    d.querySelector('[data-salvar]').disabled = !(escolha && alvo);
  };

  abrirDlg(`
    <div class="dlg-head"><div><h2>Novo vínculo</h2><p class="dlg-sub">${esc(nomeCurto(eu.p))}</p></div></div>
    <div class="vinc-frase" data-frase></div>
    ${grupos.map(gr => `
      <div class="vinc-grupo"><span class="eyebrow">${gr}</span>
        <div class="chips">${ops.filter(o => o.grupo === gr).map(o => `<button type="button" class="chip" data-op="${o.tipo}:${o.lado}" aria-pressed="false">${o.label}</button>`).join('')}</div>
      </div>`).join('')}
    <label class="busca">${ICON.lupa}<input type="search" data-busca placeholder="Buscar pessoa…" autocomplete="off" aria-label="Buscar pessoa"></label>
    <div class="vinc-pessoas" data-pessoas></div>
    <div class="dlg-foot fim">
      <button type="button" class="btn ghost" data-r="0">Cancelar</button>
      <button type="button" class="btn primary" data-salvar disabled>Salvar vínculo</button>
    </div>`, null, d);
  pintar();

  const fechar = () => { d.onclick = d.oninput = d.oncancel = null; return fecharDlg(d); };
  d.oninput = e => { if (e.target.matches('[data-busca]')) { busca = e.target.value; d.querySelector('[data-pessoas]').innerHTML = listaPessoas(); } };
  d.oncancel = e => { e.preventDefault(); fechar(); };
  d.onclick = async e => {
    const op = e.target.closest('[data-op]');
    if (op) { const [tipo, lado] = op.dataset.op.split(':'); escolha = ops.find(o => o.tipo === tipo && o.lado === lado); return pintar(); }
    const pe = e.target.closest('[data-alvo]');
    if (pe) { alvo = pe.dataset.alvo; return pintar(); }
    if (e.target.closest('[data-r]') || e.target === d) return fechar();
    const salvar = e.target.closest('[data-salvar]');
    if (salvar && escolha && alvo) {
      salvar.disabled = true;
      salvar.classList.add('carregando');
      const [a, b] = escolha.lado === 'a' ? [pid, alvo] : [alvo, pid];
      try {
        await rpc('box_vinculo', { p_a: a, p_b: b, p_tipo: escolha.tipo, p_remover: false });
        await fechar();
        await carregar();
        toast('Vínculo salvo');
        aoSalvar?.();
      } catch (err) { falha(err); salvar.disabled = false; salvar.classList.remove('carregando'); }
    }
  };
}

export async function atualizarTelaVinculos(pid) {
  if (dlg().open && S.dlg?.tipo === 'jovem') renderDlgJovem(S.dlg.id);
  else atualizarVinculosForm(pid);
  const y = window.scrollY;
  const dialogoAberto = dlg().open;
  if (dialogoAberto) {
    // atualiza a tela de trás sem mexer no diálogo
    const v = $('#view');
    if (v) { v.innerHTML = renderView(); ligarScrollInfinito(); }
  } else render();
  window.scrollTo(0, y);
}

export async function removerVinculo(vid, pid, aoRemover) {
  const v = (S.data.vinculos || []).find(x => x.id === vid);
  if (!v) return;
  const t = textoVinculo(v, pid);
  const ok = await confirmar({ titulo: 'Remover vínculo?', ok: 'Remover', perigo: true, texto: t ? `“${esc(t.texto)}” deixa de aparecer pras duas pessoas.` : '' });
  if (!ok) return;
  try {
    await rpc('box_vinculo', { p_a: v.a_id, p_b: v.b_id, p_tipo: v.tipo, p_remover: true });
    await carregar();
    aoRemover?.();
  } catch (err) { falha(err); }
}

// Seção de vínculos dentro do formulário de cadastro (pessoas já salvas)
export function secaoVinculosForm(pid) {
  return `
    <div class="vinc-secao full">
      <div class="vinc-secao-head"><span class="lbl">Vínculos</span>
        ${pid ? `<button type="button" class="link-btn" data-act="vinc-novo" data-id="${pid}">+ Adicionar vínculo</button>` : ''}</div>
      <div data-vinc-lista>${pid ? chipsVinculos(pid, true) : '<p class="dim small" style="margin:0">Salve o cadastro primeiro pra adicionar vínculos.</p>'}</div>
    </div>`;
}

export function atualizarVinculosForm(pid) {
  const el = $('#form-dlg [data-vinc-lista]');
  if (el) el.innerHTML = chipsVinculos(pid, true);
  // casal muda o relacionamento no banco; reflete no formulário aberto
  const p = pessoa(pid)?.p;
  const radio = p && $(`#form-dlg input[name="estado_civil"][value="${p.estado_civil || ''}"]`);
  if (radio) radio.checked = true;
}

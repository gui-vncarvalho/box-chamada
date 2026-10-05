// Justificativa de ausência: motivos prontos + texto livre.
import { carregar, falha, garantirEvento, rpc } from './api.js';
import { nomeQuem, jovem } from './dados.js';
import { abrirDlg, fecharDlg } from './dialogos.js';
import { S } from './estado.js';
import { $, esc, nomeCurto, toast } from './util.js';

export const MOTIVOS = [
  ['trabalho', '💼', 'Trabalho'],
  ['estudo', '📚', 'Escola/faculdade'],
  ['viagem', '✈️', 'Viagem'],
  ['saude', '🩺', 'Saúde'],
  ['familia', '👨‍👩‍👧', 'Família'],
  ['outro', '💬', 'Outro'],
];
const POR_ID = Object.fromEntries(MOTIVOS.map(([id, ic, l]) => [id, { ic, l }]));

export const justificativa = (eid, jid) => (S.data?.justificativas || []).find(x => x.evento_id === eid && x.jovem_id === jid);

export function pillJustificativa(x) {
  if (!x) return '';
  const m = POR_ID[x.motivo] || POR_ID.outro;
  return `<span class="just-pill" title="${esc(x.por ? `Anotado por ${x.por}` : '')}">${m.ic} ${m.l}${x.texto ? ` · ${esc(x.texto)}` : ''}</span>`;
}

// Botão (ou selo clicável) pra anotar/editar o motivo da ausência.
export function botaoJustificar(eid, jid, rotulo = '+ Motivo') {
  const x = justificativa(eid, jid);
  return x
    ? `<button class="just-editar" data-act="justificar" data-evento="${eid}" data-id="${jid}" title="Editar motivo">${pillJustificativa(x)}</button>`
    : `<button class="link-btn" data-act="justificar" data-evento="${eid}" data-id="${jid}">${rotulo}</button>`;
}

export function dlgJustificar(eid, jid, aoSalvar) {
  const d = $('#dlg2');
  const atual = justificativa(eid, jid);
  let motivo = atual?.motivo || null;
  const ev = S.data.eventos.find(e => e.id === eid);
  abrirDlg(`
    <form class="form-texto">
      <div class="dlg-head"><div><h2>Motivo da ausência</h2>
        <p class="dlg-sub">${esc(nomeCurto(jovem(jid)))}${ev ? ` · ${esc(ev.nome)}` : ''}</p></div></div>
      <div class="chips motivos">${MOTIVOS.map(([id, ic, l]) => `
        <button type="button" class="chip" data-motivo="${id}" aria-pressed="${motivo === id}">${ic} ${l}</button>`).join('')}</div>
      <textarea name="t" rows="2" placeholder="Detalhe (opcional): ex.: plantão no trabalho, voltou de viagem no domingo…">${esc(atual?.texto || '')}</textarea>
      <div class="dlg-foot fim">
        ${atual ? '<button type="button" class="btn danger" data-r="apagar" style="margin-right:auto">Apagar</button>' : ''}
        <button type="button" class="btn ghost" data-r="0">Cancelar</button>
        <button class="btn primary" data-salvar ${motivo ? '' : 'disabled'}>Salvar</button>
      </div>
    </form>`, null, d);
  const form = d.querySelector('form');
  const fechar = () => { d.onclick = d.oncancel = null; return fecharDlg(d); };
  const gravar = async (m, texto) => {
    try {
      await rpc('box_justificar', { p_evento: eid, p_jovem: jid, p_motivo: m, p_texto: texto, p_quem: nomeQuem() });
      await fechar();
      await carregar();
      await garantirEvento(eid, { recarregar: true });
      toast(m ? 'Motivo anotado' : 'Motivo apagado');
      aoSalvar?.();
    } catch (e) { falha(e); }
  };
  d.onclick = e => {
    const c = e.target.closest('[data-motivo]');
    if (c) {
      motivo = c.dataset.motivo;
      d.querySelectorAll('[data-motivo]').forEach(b => b.setAttribute('aria-pressed', String(b === c)));
      d.querySelector('[data-salvar]').disabled = false;
      return;
    }
    const r = e.target.closest('[data-r]');
    if (r) return r.dataset.r === 'apagar' ? gravar(null, null) : fechar();
    if (e.target === d) fechar();
  };
  d.oncancel = e => { e.preventDefault(); fechar(); };
  form.onsubmit = e => { e.preventDefault(); if (motivo) gravar(motivo, form.t.value); };
}

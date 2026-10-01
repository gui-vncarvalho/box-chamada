// Formulário genérico dos modais.
import { recarregar } from './acoes.js';
import { falha } from './api.js';
import { evento } from './dados.js';
import { abrirDlg, dlg, fecharDlg } from './dialogos.js';
import { IDADE_BOX, MSG_PADRAO } from './estado.js';
import { ICON } from './icones.js';
import { $, digitos, esc, faixa, idade, mensagem, porFaixa } from './util.js';

export function mascaraTel(v) {
  let d = digitos(v);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function textoIdade(nasc, semFaixa = false) {
  const i = idade(nasc);
  if (i == null || i < 0 || i > 120) return null;
  return semFaixa ? `${i} anos` : `${i} anos · ${i >= IDADE_BOX ? 'Box' : 'Sprint'}`;
}

export function abrirForm({ titulo, sub = '', campos, valores = {}, onSalvar, onExcluir, textoExcluir = 'Excluir', textoSalvar = 'Salvar', extra = '' }) {
  const campo = c => {
    if (c.quando) {
      const html = campoBase(c);
      return `<div class="${c.full ? 'full' : ''} campo-cond" data-quando="${c.quando}">${html}</div>`;
    }
    return campoBase(c);
  };
  const campoBase = c => {
    const v = valores[c.nome] ?? c.padrao ?? '';
    const cls = `field ${c.full ? 'full' : ''}`;
    const dica = c.dica ? `<span class="hint">${c.dica}</span>` : '';
    const af = c.autofocus ? 'autofocus' : '';
    switch (c.tipo) {
      case 'nota':
        return `<p class="form-nota">${ICON.info}<span>${c.texto}</span></p>`;
      case 'switch':
        return `<label class="switch-row full">
          <span class="switch-txt"><strong>${c.label}</strong>${c.dica ? `<small>${c.dica}</small>` : ''}</span>
          <input type="checkbox" class="switch" role="switch" name="${c.nome}" ${v ? 'checked' : ''}>
        </label>`;
      case 'segmentado':
        return `<fieldset class="${cls}"><legend>${c.label}</legend>
          <div class="seg-form ${c.opcoes.some(o => o[2]) ? 'com-desc' : ''} ${c.quebra ? 'quebra' : ''}">${c.opcoes.map(([ov, ol, od]) => `
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
          <div class="previa"><span class="eyebrow">Prévia no WhatsApp</span><div class="previa-bolhas" data-previa></div></div>
          ${dica}</div>`;
      default: {
        const tipo = c.tipo || 'text';
        const val = tipo === 'tel' ? mascaraTel(v) : v;
        const extra = tipo === 'tel' ? 'inputmode="tel" data-tel' : tipo === 'date' ? 'data-idade' : '';
        const hint = tipo === 'date'
          ? `<span class="hint ${textoIdade(v) ? 'ok' : ''}" data-hint-idade data-padrao="${esc(c.dica || '')}" ${c.semFaixa ? 'data-sem-faixa' : ''}>${textoIdade(v, c.semFaixa) || c.dica || ''}</span>`
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
      <div class="form-grid">${campos.map(campo).join('')}${extra}</div>
      <div class="dlg-foot">
        ${onExcluir ? `<button type="button" class="btn danger" id="btn-excluir">${ICON.lixo}${textoExcluir}</button>` : '<span></span>'}
        <div class="row-btns"><button type="button" class="btn ghost" data-act="fechar">Cancelar</button><button class="btn primary" type="submit">${textoSalvar}</button></div>
      </div>
    </form>`, { tipo: 'form' });

  const form = $('#form-dlg');
  const aplicarQuando = () => form.querySelectorAll('[data-quando]').forEach(el => {
    const [k, v] = el.dataset.quando.split('=');
    el.hidden = form.elements[k]?.value !== v;
  });
  aplicarQuando();
  const previa = form.querySelector('[data-previa]');
  const atualizarPrevia = () => {
    if (!previa) return;
    const val = k => form.elements[k]?.value.trim() || '';
    const ev = {
      nome: val('nome') || 'Evento', data: val('data'), hora: val('hora'), publico: val('publico'),
      hora_box: val('hora_box'), hora_sprint: val('hora_sprint'), mensagem: val('mensagem'),
    };
    const ano = new Date().getFullYear();
    previa.innerHTML = porFaixa(ev)
      ? [['Pra quem é do Box', { nome: 'Ana', nascimento: `${ano - 20}-01-01` }], ['Pra quem é do Sprint', { nome: 'Léo', nascimento: `${ano - 15}-01-01` }]]
        .map(([t, j]) => `<small class="previa-rot">${t}</small><div class="bolha">${esc(mensagem(ev, j))}</div>`).join('')
      : `<div class="bolha">${esc(mensagem(ev, { nome: 'Ana' }))}</div>`;
  };
  atualizarPrevia();

  form.addEventListener('input', e => {
    const t = e.target;
    if (t.matches('[data-tel]')) t.value = mascaraTel(t.value);
    if (t.matches('[data-idade]')) {
      const h = form.querySelector('[data-hint-idade]');
      const txt = textoIdade(t.value, 'semFaixa' in h.dataset);
      h.textContent = txt || h.dataset.padrao;
      h.classList.toggle('ok', !!txt);
    }
    t.closest('.field')?.classList.remove('invalido');
    aplicarQuando();
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
    for (const c of campos.filter(c => c.tipo !== 'nota')) {
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

export const EQUIPES = [['F', 'Feminina'], ['M', 'Masculina']];

// Cadastros de jovem, diretoria e evento, e importação de lista.
import { recarregar } from './acoes.js';
import { aniversariantes } from './aniversarios.js';
import { falha, rpc } from './api.js';
import { evento, jovem } from './dados.js';
import { abrirDlg, confirmar, dlg, fecharDlg } from './dialogos.js';
import { distribuir } from './distribuir.js';
import { IDADE_BOX, LS, S } from './estado.js';
import { abrirForm, EQUIPES, mascaraTel, textoIdade } from './formulario.js';
import { ICON } from './icones.js';
import { $, digitos, esc, faixa, mensagem, plural, toast, uid } from './util.js';
import { ESTADO_CIVIL, pessoa, secaoVinculosForm } from './vinculos.js';

export function formJovem(j) {
  abrirForm({
    titulo: j ? 'Editar jovem' : 'Novo jovem',
    sub: j ? `Dados de ${esc(j.nome)}` : 'Cadastre pra entrar nas listas de chamada.',
    campos: [
      { nome: 'nome', label: 'Nome', obrig: true, full: true, autofocus: !j, placeholder: 'Nome (apelido)' },
      { nome: 'genero', label: 'Equipe', tipo: 'segmentado', padrao: 'F', opcoes: EQUIPES, full: true },
      { nome: 'nascimento', label: 'Data de nascimento', tipo: 'date', dica: `Define Box (${IDADE_BOX}+) ou Sprint` },
      { nome: 'telefone', label: 'WhatsApp', tipo: 'tel', placeholder: '(11) 91234-5678' },
      { nome: 'obs', label: 'Observação', full: true, placeholder: 'Ex.: veio pela primeira vez na vigília' },
      { nome: 'estado_civil', label: 'Relacionamento', tipo: 'segmentado', padrao: '', opcoes: ESTADO_CIVIL, full: true, quebra: true },
      { nome: 'ativo', label: 'Ativo', tipo: 'switch', padrao: true, dica: 'Entra nas distribuições de chamada' },
    ],
    extra: secaoVinculosForm(j?.id),
    valores: j || {},
    onSalvar: dados => rpc('box_salvar', { p_tabela: 'jovens', p_dados: dados }),
    onExcluir: j && (async () => {
      const ok = await confirmar({
        titulo: `Excluir ${esc(j.nome)}?`, perigo: true, ok: 'Excluir',
        texto: 'Some de todas as listas e eventos. Se a pessoa só não está participando, prefira desligar “Ativo”.',
      });
      if (!ok) return false;
      await rpc('box_excluir', { p_tabela: 'jovens', p_id: j.id });
    }),
  });
}

export function formDiretor(p) {
  abrirForm({
    titulo: p ? 'Editar pessoa' : 'Nova pessoa na diretoria',
    sub: p ? `Dados de ${esc(p.nome)}` : 'Ela passa a receber jovens pra chamar.',
    campos: [
      { nome: 'nome', label: 'Nome', obrig: true, full: true, autofocus: !p },
      { nome: 'equipe', label: 'Equipe', tipo: 'segmentado', padrao: 'F', opcoes: EQUIPES, full: true },
      { nome: 'telefone', label: 'Telefone', tipo: 'tel', placeholder: '(11) 91234-5678' },
      { nome: 'nascimento', label: 'Data de nascimento', tipo: 'date', semFaixa: true, dica: 'Pra entrar nos aniversariantes' },
      { nome: 'estado_civil', label: 'Relacionamento', tipo: 'segmentado', padrao: '', opcoes: ESTADO_CIVIL, full: true, quebra: true },
      { nome: 'ativo', label: 'Ativo', tipo: 'switch', padrao: true, dica: 'Recebe jovens na distribuição' },
    ],
    extra: secaoVinculosForm(p?.id),
    valores: p || {},
    onSalvar: dados => rpc('box_salvar', { p_tabela: 'diretores', p_dados: dados }),
    onExcluir: p && (async () => {
      const ok = await confirmar({
        titulo: `Excluir ${esc(p.nome)}?`, perigo: true, ok: 'Excluir',
        texto: 'As chamadas dessa pessoa nos eventos abertos ficam sem responsável. Se só vai dar um tempo, prefira desligar “Ativo”.',
      });
      if (!ok) return false;
      await rpc('box_excluir', { p_tabela: 'diretores', p_id: p.id });
      if (S.me === p.id) { S.me = null; LS.set('me', null); }
    }),
  });
}

export function formEvento(e) {
  abrirForm({
    titulo: e ? 'Editar evento' : 'Novo evento',
    sub: e ? esc(e.nome) : 'Ao salvar, as chamadas já são distribuídas automaticamente.',
    textoSalvar: e ? 'Salvar' : 'Criar e distribuir',
    campos: [
      { nome: 'nome', label: 'Nome', obrig: true, full: true, autofocus: !e, placeholder: 'Ex.: Box Day, Vigília, Retiro' },
      { nome: 'data', label: 'Data', tipo: 'date' },
      { nome: 'hora', label: 'Horário', placeholder: 'Ex.: 19h30' },
      { nome: 'publico', label: 'Quem chamar', tipo: 'segmentado', padrao: 'box', full: true, opcoes: [
        ['box', 'Box', `${IDADE_BOX} anos ou mais`], ['sprint', 'Sprint', `até ${IDADE_BOX - 1} anos`], ['todos', 'Box + Sprint', 'todo mundo'],
      ] },
      { nome: 'hora_sprint', label: 'Horário do Sprint', placeholder: 'Ex.: 17h', quando: 'publico=todos', dica: 'Opcional' },
      { nome: 'hora_box', label: 'Horário do Box', placeholder: 'Ex.: 20h', quando: 'publico=todos', dica: 'Opcional' },
      { nome: 'faixa_info', tipo: 'nota', quando: 'publico=todos', full: true,
        texto: 'Com os horários por faixa, cada jovem recebe na mensagem o horário da faixa dele. Quem está sem data de nascimento recebe o horário geral.' },
      { nome: 'chamadas_por_jovem', label: 'Diretores por jovem', tipo: 'stepper', padrao: 2, min: 1, max: 5, full: true, dica: 'Quantas pessoas da diretoria chamam cada jovem' },
      { nome: 'mensagem', label: 'Mensagem do WhatsApp', tipo: 'mensagem', full: true, dica: 'Deixe vazio pra usar a mensagem padrão.' },
      ...(e ? [{ nome: 'arquivado', label: 'Arquivar evento', tipo: 'switch', dica: 'Some da lista de eventos abertos' }] : []),
    ],
    valores: e || {},
    onSalvar: async dados => {
      if (!dados.id) dados.id = uid();
      await rpc('box_salvar', { p_tabela: 'eventos', p_dados: dados });
      if (!e) {
        S.eventoId = dados.id;
        LS.set('evento', dados.id);
        await recarregar();
        const pares = distribuir(dados, S.data.jovens, S.data.diretores, [], false);
        await rpc('box_atribuir', { p_evento: dados.id, p_pares: pares });
        toast(`Evento criado e ${pares.length} chamadas distribuídas`);
      }
    },
    onExcluir: e && (async () => {
      const ok = await confirmar({
        titulo: `Excluir “${esc(e.nome)}”?`, perigo: true, ok: 'Excluir evento',
        texto: 'Apaga o evento e todo o progresso e histórico dele. Se ele só já aconteceu, prefira “Arquivar”.',
      });
      if (!ok) return false;
      await rpc('box_excluir', { p_tabela: 'eventos', p_id: e.id });
    }),
  });
}

export function parseData(s) {
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += y > (new Date().getFullYear() % 100) ? 1900 : 2000;
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? s : null;
}

export function parseImport(texto, generoPadrao) {
  const existentes = new Map(S.data.jovens.map(j => [j.nome.toLowerCase(), j]));
  return texto.split('\n').map(l => l.trim()).filter(Boolean).map(linha => {
    const partes = linha.split(/\s*[;\t,]\s*/).filter(Boolean);
    const r = { nome: partes.shift() };
    const obs = [];
    for (const p of partes) {
      const data = parseData(p);
      if (data) r.nascimento = data;
      else if (/^[fm]$/i.test(p)) r.genero = p.toUpperCase();
      else if (digitos(p).length >= 8 && /^[\d\s()+-]+$/.test(p)) r.telefone = p;
      else obs.push(p);
    }
    if (obs.length) r.obs = obs.join(', ');
    const ja = existentes.get(r.nome.toLowerCase());
    // cadastro existente: só sobrescreve o que veio na linha
    if (ja) return { ...ja, ...r, nome: ja.nome, _existe: true };
    return { genero: generoPadrao, ...r };
  });
}

export function dlgImportar() {
  abrirDlg(`
    <form id="form-imp">
      <div class="dlg-head">
        <div><h2>Importar lista</h2><p class="dlg-sub">Cole uma pessoa por linha. Quem já existe é atualizado.</p></div>
        <button type="button" class="x" data-act="fechar" aria-label="Fechar">${ICON.xis}</button>
      </div>
      <div class="formato"><span class="eyebrow">Formato</span><code>nome; telefone; nascimento; F ou M</code><small>Só o nome é obrigatório, e a ordem dos outros tanto faz.</small></div>
      <textarea name="texto" rows="7" autofocus placeholder="Maria Souza; 11 91234-5678; 14/03/2007&#10;João Pedro; 11 99876-5432; 02/11/2008; M"></textarea>
      <fieldset class="field"><legend>Equipe, quando a linha não disser F/M</legend>
        <div class="seg-form">${EQUIPES.map(([v, l], i) => `<label><input type="radio" name="genero" value="${v}" ${i ? '' : 'checked'}><span><strong>${l}</strong></span></label>`).join('')}</div>
      </fieldset>
      <div id="imp-preview"></div>
      <div class="dlg-foot"><span></span><div class="row-btns"><button type="button" class="btn ghost" data-act="fechar">Cancelar</button><button class="btn primary" type="submit" disabled>Importar</button></div></div>
    </form>`, { tipo: 'form' });
  const form = $('#form-imp');
  const preview = () => {
    const rows = parseImport(form.texto.value, form.genero.value);
    const novos = rows.filter(r => !r._existe).length;
    form.querySelector('[type=submit]').disabled = !rows.length;
    form.querySelector('[type=submit]').textContent = rows.length ? `Importar ${rows.length}` : 'Importar';
    $('#imp-preview').innerHTML = rows.length ? `
      <div class="imp-resumo"><span class="pill st-confirmado">${plural(novos, 'novo', 'novos')}</span>${rows.length - novos ? `<span class="pill st-chamado">${plural(rows.length - novos, 'atualizado', 'atualizados')}</span>` : ''}</div>
      <ul class="imp-lista">${rows.slice(0, 8).map(r => `
        <li><strong>${esc(r.nome)}</strong>
          <span>${r.genero === 'M' ? 'Masc.' : 'Fem.'}</span>
          <span class="${r.telefone ? '' : 'falta'}">${r.telefone ? esc(mascaraTel(r.telefone)) : 'sem tel.'}</span>
          <span class="${r.nascimento ? '' : 'falta'}">${r.nascimento ? textoIdade(r.nascimento) || '?' : 'sem nasc.'}</span>
          ${r._existe ? '<em>atualiza</em>' : ''}</li>`).join('')}
        ${rows.length > 8 ? `<li class="dim">+ ${rows.length - 8}…</li>` : ''}</ul>` : '';
  };
  form.addEventListener('input', preview);
  form.addEventListener('change', preview);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const rows = parseImport(form.texto.value, form.genero.value).map(({ _existe, ...r }) => r);
    if (!rows.length) return;
    try {
      await rpc('box_salvar', { p_tabela: 'jovens', p_dados: rows });
      await fecharDlg();
      toast(`${rows.length} jovens importados`);
      await recarregar();
    } catch (err) { falha(err); }
  });
}

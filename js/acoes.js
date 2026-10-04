// O que cada botão e campo faz.
import { dlgAniversarios } from './aniversarios.js';
import { carregar, falha, rpc } from './api.js';
import { dlgImportar, formDiretor, formEvento, formJovem } from './cadastros.js';
import { atribs, diretor, evento, jovem, nomeQuem } from './dados.js';
import { abrirDlg, confirmar, dlg, fecharDlg, pedirTexto, renderDlgJovem } from './dialogos.js';
import { distribuir } from './distribuir.js';
import { LS, S, STATUS_BY_ID } from './estado.js';
import { ICON } from './icones.js';
import { instalarApp } from './pwa.js';
import { dlgEventos, render, renderView, rolarParaConteudo } from './render.js';
import { htmlListaMgJovens, MG_F_PADRAO } from './telas/gerenciar.js';
import { atualizarListaJovens, PAG_JOVENS } from './telas/jovens.js';
import { atualizarPresenca, formVisitante, htmlListaPresenca, presenca, togglePresenca } from './telas/presenca.js';
import { $, esc, faixa, idade, plural, quandoEvento, toast } from './util.js';
import { atualizarTelaVinculos, dlgNovoVinculo, pessoa, removerVinculo } from './vinculos.js';
import { compartilharResumo, dlgResumoCulto } from './frequencia.js';
import { dlgJustificar } from './justificativas.js';
import { encerrarEvento, encerrarPresenca, reabrirPresenca } from './telas/presenca.js';

export function textoGrupo() {
  const ev = evento();
  const lista = atribs();
  const linhas = [`*${ev.nome}*${quandoEvento(ev) ? ' — ' + quandoEvento(ev) : ''}`, '', 'Quem chama quem:'];
  for (const eq of ['F', 'M']) {
    const ds = S.data.diretores.filter(d => d.equipe === eq);
    for (const d of ds) {
      const nomes = lista.filter(a => a.diretor_id === d.id).map(a => jovem(a.jovem_id).nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      if (nomes.length) linhas.push(`*${d.nome}:* ${nomes.join(', ')}`);
    }
    linhas.push('');
  }
  linhas.push(`Marquem no site conforme forem chamando 👉 ${location.origin}${location.pathname}`);
  return linhas.join('\n');
}

export async function recarregar() {
  try { await carregar(); } catch (e) { falha(e); }
  render();
  if (dlg().open && S.dlg?.tipo === 'jovem') renderDlgJovem(S.dlg.id);
}

export async function setStatus(aid, status, nota) {
  const a = S.data.atribuicoes.find(x => x.id === aid);
  if (!a) return;
  const antes = { ...a };
  if (status) a.status = status;
  if (nota != null) a.nota = nota || null;
  a.atualizado_por = nomeQuem();
  a.atualizado_em = new Date().toISOString();
  if (status) {
    S.data.historico.unshift({
      evento_id: a.evento_id, quem: nomeQuem(), status, em: a.atualizado_em,
      jovem: jovem(a.jovem_id)?.nome, diretor: diretor(a.diretor_id)?.nome,
    });
  }
  render();
  if (dlg().open && S.dlg?.tipo === 'jovem') renderDlgJovem(S.dlg.id);
  try {
    await rpc('box_status', { p_id: aid, p_status: status || null, p_quem: nomeQuem(), p_nota: nota ?? null });
  } catch (e) {
    Object.assign(a, antes);
    if (status) S.data.historico.shift();
    render();
    falha(e);
  }
}

export async function toggleResp(jid, did) {
  const lista = atribs();
  const tem = lista.some(a => a.jovem_id === jid && a.diretor_id === did);
  const alvo = lista.find(a => a.jovem_id === jid && a.diretor_id === did);
  if (tem && alvo.status !== 'pendente' && !(await confirmar({
    titulo: 'Tirar essa pessoa da chamada?', perigo: true, ok: 'Remover',
    texto: `A chamada de ${esc(diretor(did)?.nome)} já está marcada como “${STATUS_BY_ID[alvo.status].label}” e essa marcação vai se perder.`,
  }))) return;
  const pares = lista.map(a => ({ jovem_id: a.jovem_id, diretor_id: a.diretor_id }))
    .filter(p => !(p.jovem_id === jid && p.diretor_id === did));
  if (!tem) pares.push({ jovem_id: jid, diretor_id: did });
  try {
    await rpc('box_atribuir', { p_evento: S.eventoId, p_pares: pares });
    await recarregar();
  } catch (e) { falha(e); }
}

export async function acaoDistribuir(modo) {
  const ev = evento();
  const lista = atribs();
  if (modo === 'refazer') {
    const marcadas = lista.filter(a => a.status !== 'pendente').length;
    if (!(await confirmar({
      titulo: 'Refazer a distribuição?', ok: 'Sortear de novo', perigo: marcadas > 0,
      texto: `Sorteia de novo quem chama quem em “${esc(ev.nome)}”.` +
        (marcadas ? ` <strong>${plural(marcadas, 'chamada já marcada', 'chamadas já marcadas')}</strong>: se a mesma dupla sair de novo a marcação fica; se não, ela se perde.` : ''),
    }))) return;
  }
  const pares = distribuir(ev, S.data.jovens, S.data.diretores, lista, modo === 'faltantes');
  const novos = pares.length - (modo === 'faltantes' ? lista.length : 0);
  try {
    await rpc('box_atribuir', { p_evento: ev.id, p_pares: pares });
    toast(modo === 'faltantes' ? (novos ? `${novos} chamadas adicionadas` : 'Todo mundo já tem responsável') : 'Distribuição refeita');
    await recarregar();
  } catch (e) { falha(e); }
}

export function sair(msg = '') {
  S.codigo = null;
  S.data = null;
  S.erroLogin = msg;
  LS.set('codigo', null);
  fecharDlg();
  render();
}

export async function aoClicar(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const { act, id } = el.dataset;

  switch (act) {
    case 'sou':
      S.me = id;
      LS.set('me', id);
      S.tab = id === 'visitante' ? 'equipe' : 'minha';
      render();
      break;
    case 'trocar-eu': S.me = null; LS.set('me', null); render(); break;
    case 'trocar-evento': dlgEventos(); break;
    case 'escolher-evento':
      S.eventoId = id;
      LS.set('evento', id);
      await fecharDlg();
      render();
      break;
    case 'ver-filtro': {
      S.tab = 'jovens';
      S.filtro = id;
      S.limJ = PAG_JOVENS;
      LS.set('tab', 'jovens');
      render();
      rolarParaConteudo({ sempre: true, suave: true });
      break;
    }
    case 'tab': {
      S.tab = id;
      S.limJ = PAG_JOVENS;
      LS.set('tab', id);
      render();
      rolarParaConteudo({ sempre: el.classList.contains('presenca-cta'), suave: el.classList.contains('presenca-cta') });
      break;
    }
    case 'filtro': S.filtro = id; S.limJ = PAG_JOVENS; render(); break;
    case 'hist-filtro': S.histFiltro = id; render(); break;
    case 'hist-modo': S.histModo = id; render(); break;
    case 'p-culto': S.pCulto = id; S.sugJunto = null; render(); break;
    case 'encerrar-presenca': await encerrarPresenca(); break;
    case 'reabrir-presenca': await reabrirPresenca(); break;
    case 'resumo-culto': S.resumo = null; dlgResumoCulto(id); break;
    case 'resumo-aba': S.resumo.aba = id; dlgResumoCulto(S.resumo.eid); break;
    case 'resumo-culto-filtro': S.resumo.culto = id; dlgResumoCulto(S.resumo.eid); break;
    case 'encerrar-evento': await encerrarEvento(); break;
    case 'compartilhar-resumo': await compartilharResumo(id); break;
    case 'justificar': dlgJustificar(el.dataset.evento, id, atualizarAposJustificar); break;
    case 'presenca': await togglePresenca(id); break;
    case 'p-filtro': S.pFiltro = id; S.pFiltroManual = true; atualizarPresenca(); break;
    case 'visitante': formVisitante(); break;
    case 'aniversarios': dlgAniversarios(); break;
    case 'instalar':
      await instalarApp();
      break;
    case 'instalar-dispensar':
      LS.set('pwa-dispensado', '1');
      render();
      toast('Dá pra instalar depois em Gerenciar › Diretoria.');
      break;
    case 'vinc-novo': dlgNovoVinculo(id, () => atualizarTelaVinculos(id)); break;
    case 'vinc-remover': await removerVinculo(id, el.dataset.pessoa, () => atualizarTelaVinculos(el.dataset.pessoa)); break;
    case 'presenca-junto': await togglePresenca(id, true); break;
    case 'junto-fechar': S.sugJunto = null; atualizarPresenca(); break;
    case 'ir-sem-nasc':
      await fecharDlg();
      Object.assign(S, { tab: 'gerenciar', mgTab: 'jovens', mgFiltro: 'sem_nasc' });
      render();
      rolarParaConteudo({ sempre: true });
      break;
    case 'faixa-j': S.faixaJ = id; S.limJ = PAG_JOVENS; render(); break;
    case 'status': await setStatus(id, el.dataset.status); break;
    case 'contato': {
      const a = id && S.data.atribuicoes.find(x => x.id === id);
      // espera o link abrir antes de redesenhar a tela
      if (a && a.status === 'pendente') setTimeout(() => { setStatus(id, 'chamado'); toast('Marcado como "Chamei"'); }, 400);
      break;
    }
    case 'nota': {
      const a = S.data.atribuicoes.find(x => x.id === id);
      const t = await pedirTexto({
        titulo: a.nota ? 'Editar nota' : 'Nova nota', sub: `Sobre ${esc(jovem(a.jovem_id).nome)}`,
        valor: a.nota || '', placeholder: 'Ex.: vai levar uma amiga, chega atrasado…',
      });
      if (t !== null) await setStatus(id, null, t);
      break;
    }
    case 'jovem': renderDlgJovem(id); break;
    case 'toggle-resp': await toggleResp(el.dataset.jovem, id); break;
    case 'fechar': fecharDlg(); break;
    case 'novo-evento': formEvento(); break;
    case 'editar-evento': formEvento(S.data.eventos.find(x => x.id === id)); break;
    case 'novo-jovem': formJovem(); break;
    case 'editar-jovem': formJovem(jovem(id)); break;
    case 'novo-diretor': formDiretor(); break;
    case 'editar-diretor': formDiretor(diretor(id)); break;
    case 'importar': dlgImportar(); break;
    case 'distribuir': await acaoDistribuir(el.dataset.modo); break;
    case 'zerar':
      if (await confirmar({
        titulo: 'Zerar as marcações?', perigo: true, ok: 'Zerar tudo',
        texto: `Todas as chamadas de “${esc(evento().nome)}” voltam pra pendente e o histórico é apagado. Quem chama quem continua igual.`,
      })) {
        try { await rpc('box_zerar', { p_evento: S.eventoId }); await recarregar(); toast('Marcações zeradas'); } catch (err) { falha(err); }
      }
      break;
    case 'copiar-lista': {
      const t = textoGrupo();
      try { await navigator.clipboard.writeText(t); toast('Lista copiada, é só colar no grupo'); }
      catch {
        abrirDlg(`<div class="dlg-head"><div><h2>Lista pro grupo</h2><p class="dlg-sub">Selecione e copie o texto.</p></div><button class="x" data-act="fechar" aria-label="Fechar">${ICON.xis}</button></div>
          <textarea rows="14" readonly>${esc(t)}</textarea>`);
      }
      break;
    }
    case 'sair':
      if (await confirmar({ titulo: 'Sair deste aparelho?', ok: 'Sair', texto: 'O código de acesso é esquecido e vai ser pedido de novo na próxima vez.' })) sair();
      break;
    case 'mg-tab':
      S.mgTab = id;
      LS.set('mgTab', id);
      render();
      break;
    case 'mgf-painel': S.mgPainel = !S.mgPainel; render(); break;
    case 'mgf':
      if (el.dataset.k === 'ordem') S.mgOrdem = el.dataset.v;
      else S.mgF[el.dataset.k] = el.dataset.v;
      render();
      break;
    case 'mgf-limpar':
      if (id === 'tudo') S.mgF = { ...MG_F_PADRAO };
      else if (id === 'idade') Object.assign(S.mgF, { idadeMin: '', idadeMax: '' });
      else S.mgF[id] = '';
      render();
      break;
    case 'mg-filtro':
      S.mgFiltro = id;
      render();
      break;
  }
}

export function aoDigitar(e) {
  if (e.target.id === 'busca') {
    S.busca = e.target.value;
    S.limJ = PAG_JOVENS;
    atualizarListaJovens();
    return;
  }
  if (e.target.id === 'busca-p') {
    S.buscaP = e.target.value;
    $('#plista').innerHTML = htmlListaPresenca();
    return;
  }
  if (e.target.matches('[data-mgf-idade]')) {
    S.mgF[e.target.dataset.mgfIdade] = e.target.value.replace(/\D/g, '').slice(0, 3);
    $('#mglista').innerHTML = htmlListaMgJovens();
    return;
  }
  if (e.target.id === 'busca-mg') {
    S.buscaMg = e.target.value;
    $('#mglista').innerHTML = htmlListaMgJovens();
  }
}

export async function aoEnviar(e) {
  if (e.target.id !== 'form-login') return;
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  S.codigo = e.target.codigo.value.trim();
  try {
    await carregar();
    LS.set('codigo', S.codigo);
    S.erroLogin = '';
  } catch (err) {
    S.codigo = null;
    S.erroLogin = err.codigoInvalido ? 'Código incorreto.' : 'Não consegui conectar. Confira a internet.';
  }
  render();
}

// Depois de anotar um motivo: redesenha o modal aberto (resumo ou jovem) e a tela de trás.
function atualizarAposJustificar() {
  if (dlg().open && S.dlg?.tipo === 'resumo') dlgResumoCulto(S.dlg.id);
  else if (dlg().open && S.dlg?.tipo === 'jovem') renderDlgJovem(S.dlg.id);
  const y = window.scrollY;
  if (dlg().open) { const v = $('#view'); if (v) v.innerHTML = renderView(); } else render();
  window.scrollTo(0, y);
}

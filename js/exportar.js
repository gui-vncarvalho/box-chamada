// Backup dos dados: planilha (.xlsx) pra ler e JSON completo pra restaurar.
import { falha, rpc } from './api.js';
import { LS } from './estado.js';
import { ICON } from './icones.js';
import { MOTIVOS } from './justificativas.js';
import { dataEvento, esc, toast } from './util.js';

// SheetJS só é baixado quando alguém pede a planilha.
const SHEETJS = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm';
const LEMBRAR_DIAS = 30;

const STATUS = { pendente: 'Pendente', chamado: 'Chamei', confirmado: 'Confirmou', nao_vai: 'Não vai' };
const CIVIL = { solteiro: 'Solteiro(a)', namorando: 'Namorando', noivo: 'Noivo(a)', casado: 'Casado(a)' };
const PUBLICO = { box: 'Box', sprint: 'Sprint', todos: 'Box + Sprint' };
const MOTIVO = Object.fromEntries(MOTIVOS.map(([id, , l]) => [id, l]));
const VINCULO = {
  conjuge: 'Casados', noivo: 'Noivos', namoro: 'Namorados', irmao: 'Irmãos', primo: 'Primos',
  pai: 'É pai/mãe de', tio: 'É tio/tia de', amigo: 'Amigos', convidou: 'Convidou',
};

const dataBR = iso => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const dataHoraBR = iso => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');
const simNao = v => (v ? 'Sim' : 'Não');

function planilhas(d) {
  const pessoa = new Map([...d.jovens.map(j => [j.id, j.nome]), ...d.diretores.map(x => [x.id, x.nome])]);
  const evento = new Map(d.eventos.map(e => [e.id, e]));
  const nomeEv = id => evento.get(id)?.nome || '';
  const dataEv = id => dataBR(evento.get(id)?.data);
  return {
    Jovens: d.jovens.map(j => ({
      Nome: j.nome, Apelido: j.apelido || '', Equipe: j.genero === 'F' ? 'Feminina' : 'Masculina',
      Nascimento: dataBR(j.nascimento), WhatsApp: j.telefone || '', Relacionamento: CIVIL[j.estado_civil] || '',
      Observação: j.obs || '', Ativo: simNao(j.ativo), 'Cadastrado em': dataBR(j.criado_em),
    })),
    Diretoria: d.diretores.map(x => ({
      Nome: x.nome, Apelido: x.apelido || '', Equipe: x.equipe === 'F' ? 'Feminina' : 'Masculina',
      Nascimento: dataBR(x.nascimento), Telefone: x.telefone || '', Relacionamento: CIVIL[x.estado_civil] || '', Ativo: simNao(x.ativo),
    })),
    Eventos: d.eventos.map(e => ({
      Nome: e.nome, Data: dataBR(e.data), Horário: e.hora || '', 'Horário Sprint': e.hora_sprint || '', 'Horário Box': e.hora_box || '',
      Público: PUBLICO[e.publico] || e.publico, 'Chamadas por jovem': e.chamadas_por_jovem, Arquivado: simNao(e.arquivado),
      'Lista encerrada em': dataHoraBR(e.presenca_encerrada_em), 'Encerrada por': e.presenca_encerrada_por || '',
    })),
    Chamadas: d.atribuicoes.map(a => ({
      Evento: nomeEv(a.evento_id), Data: dataEv(a.evento_id), Jovem: pessoa.get(a.jovem_id) || '', 'Quem chama': pessoa.get(a.diretor_id) || '',
      Status: STATUS[a.status] || a.status, Nota: a.nota || '', 'Marcado por': a.atualizado_por || '', 'Marcado em': dataHoraBR(a.atualizado_em),
    })),
    Presenças: d.presencas.map(p => ({
      Evento: nomeEv(p.evento_id), Data: dataEv(p.evento_id), Pessoa: pessoa.get(p.jovem_id || p.diretor_id) || '',
      Tipo: p.diretor_id ? 'Diretoria' : 'Jovem', Culto: { box: 'Box', sprint: 'Sprint' }[p.culto] || '',
      Chegou: dataHoraBR(p.em), 'Marcado por': p.marcado_por || '',
    })),
    Justificativas: d.justificativas.map(x => ({
      Evento: nomeEv(x.evento_id), Data: dataEv(x.evento_id), Jovem: pessoa.get(x.jovem_id) || '',
      Motivo: MOTIVO[x.motivo] || x.motivo, Detalhe: x.texto || '', 'Anotado por': x.por || '', Em: dataHoraBR(x.em),
    })),
    Vínculos: d.vinculos.map(v => ({ Pessoa: pessoa.get(v.a_id) || '', Vínculo: VINCULO[v.tipo] || v.tipo, Com: pessoa.get(v.b_id) || '' })),
    Histórico: d.historico.map(h => ({ Quando: dataHoraBR(h.em), Evento: nomeEv(h.evento_id), Quem: h.quem || '', Jovem: h.jovem || '', Status: STATUS[h.status] || h.status, 'Lista de': h.diretor || '' })),
  };
}

function baixar(nome, blob) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportarDados(formato, botao) {
  botao?.classList.add('carregando');
  if (botao) botao.disabled = true;
  try {
    const dados = await rpc('box_exportar');
    const hoje = new Date().toISOString().slice(0, 10);
    if (formato === 'json') {
      baixar(`chamada-box-backup-${hoje}.json`, new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
    } else {
      const XLSX = await import(SHEETJS);
      const livro = XLSX.utils.book_new();
      for (const [nome, linhas] of Object.entries(planilhas(dados))) {
        const folha = XLSX.utils.json_to_sheet(linhas.length ? linhas : [{ '(vazio)': '' }]);
        // largura das colunas pelo maior conteúdo, pra abrir já legível
        const cols = Object.keys(linhas[0] || { x: '' });
        folha['!cols'] = cols.map(c => ({ wch: Math.min(40, Math.max(c.length, ...linhas.map(l => String(l[c] ?? '').length)) + 2) }));
        XLSX.utils.book_append_sheet(livro, folha, nome);
      }
      XLSX.writeFile(livro, `chamada-box-${hoje}.xlsx`);
    }
    LS.set('ultimo-backup', new Date().toISOString());
    toast('Backup baixado. Guarde num lugar seguro (Drive, por exemplo).');
  } catch (e) {
    falha(e);
  } finally {
    botao?.classList.remove('carregando');
    if (botao) botao.disabled = false;
  }
}

export function cartaoBackup() {
  const ultimo = LS.get('ultimo-backup');
  const dias = ultimo ? Math.floor((Date.now() - new Date(ultimo)) / 86400000) : null;
  const atrasado = dias == null || dias >= LEMBRAR_DIAS;
  const quando = ultimo
    ? `Último backup neste aparelho: ${dataEvento({ data: ultimo.slice(0, 10) }, { day: '2-digit', month: '2-digit', year: 'numeric' })}${dias ? ` (há ${dias} dias)` : ' (hoje)'}.`
    : 'Nenhum backup feito neste aparelho ainda.';
  return `
    <section class="backup ${atrasado ? 'atrasado' : ''}">
      <div class="backup-txt">
        <strong>Backup dos dados</strong>
        <small>Baixe uma cópia de tudo: jovens, diretoria, eventos, chamadas, presenças e justificativas.
          Vale fazer uma vez por mês e guardar no Drive.</small>
        <small class="backup-quando">${esc(quando)}</small>
      </div>
      <div class="row-btns">
        <button class="btn" data-act="exportar" data-id="json" title="Cópia exata do banco, pra restaurar se precisar">Backup completo (.json)</button>
        <button class="btn primary" data-act="exportar" data-id="xlsx">${ICON.baixar}Planilha (.xlsx)</button>
      </div>
    </section>`;
}

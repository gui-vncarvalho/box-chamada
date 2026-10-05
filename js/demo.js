// Modo demonstração: dados fictícios salvos no navegador.
import { aniversariantes } from './aniversarios.js';
import { diretor, jovem } from './dados.js';
import { distribuir } from './distribuir.js';
import { $, byNome, faixa, hojeISO, mensagem, uid } from './util.js';
import { VINCULOS } from './vinculos.js';

export const demo = (() => {
  const KEY = 'box-demo-db-v6';
  function seed() {
    const dirF = ['Ana', 'Bia', 'Carol', 'Dani', 'Lu'];
    const dirM = ['Rafa', 'Téo', 'Vini', 'Zé'];
    const jovF = ['Alice', 'Bruna', 'Camila', 'Duda', 'Elisa', 'Helena', 'Isa', 'Júlia', 'Laís', 'Lara', 'Manu', 'Nina'];
    const jovM = ['Arthur', 'Bento', 'Caio', 'Davi', 'Enzo', 'Heitor', 'Igor', 'Lucas', 'Miguel', 'Pedro'];
    const hoje = new Date();
    const nasc = i => {
      const idadeFake = 14 + (i * 7) % 11;
      return `${hoje.getFullYear() - idadeFake}-0${1 + (i % 9)}-1${i % 9}`;
    };
    const diretores = [
      ...dirF.map(nome => ({ id: uid(), nome, equipe: 'F', telefone: null, ativo: true })),
      ...dirM.map(nome => ({ id: uid(), nome, equipe: 'M', telefone: null, ativo: true })),
    ];
    const jovens = [...jovF.map(n => [n, 'F']), ...jovM.map(n => [n, 'M'])].map(([nome, genero], i) => ({
      id: uid(), nome, genero, ativo: true, obs: null,
      telefone: i % 5 === 3 ? null : `119${String(80000000 + i * 1234567).slice(0, 8)}`,
      nascimento: i % 6 === 5 ? null : nasc(i),
    }));
    // alguns aniversários perto de hoje, pra faixa de aniversariantes aparecer
    const daqui = (dias, anos) => { const d = new Date(hoje); d.setDate(d.getDate() + dias); d.setFullYear(d.getFullYear() - anos); return hojeISO(d); };
    jovens[2].nascimento = daqui(0, 17);
    jovens[13].nascimento = daqui(3, 19);
    jovens[7].nascimento = daqui(12, 15);
    diretores.forEach((d, i) => { d.nascimento = daqui(20 + i * 37, 24 + i); d.telefone = `1197${String(1000000 + i * 7654321).slice(0, 7)}`; });
    diretores[1].nascimento = daqui(5, 26);
    jovens[1].estado_civil = jovens[14].estado_civil = 'casado';
    // apelidos de exemplo, e um nome com parênteses pra lista de revisão
    jovens[16].nome = 'Enzo Gabriel'; jovens[16].apelido = 'Enzinho';
    jovens[18].nome = 'Igor Santos'; jovens[18].apelido = 'Igão';
    jovens[8].nome = 'Laís Fernandes (Lalá)';
    const vinculos = [
      { id: uid(), a_id: jovens[1].id, b_id: jovens[14].id, tipo: 'conjuge' },
      { id: uid(), a_id: jovens[3].id, b_id: jovens[15].id, tipo: 'irmao' },
      { id: uid(), a_id: jovens[4].id, b_id: jovens[0].id, tipo: 'convidou' },
      { id: uid(), a_id: diretores[0].id, b_id: jovens[5].id, tipo: 'irmao' },
    ];
    const sab = new Date(hoje);
    sab.setDate(hoje.getDate() + ((6 - hoje.getDay() + 7) % 7 || 7));
    const ev = {
      id: uid(), nome: 'Culto Box', data: hojeISO(sab), hora: '19h30',
      publico: 'box', chamadas_por_jovem: 2, mensagem: null, arquivado: false, criado_em: new Date().toISOString(),
    };
    const atribuicoes = distribuir(ev, jovens, diretores, [], false).map(p => ({
      id: uid(), evento_id: ev.id, ...p, status: 'pendente', nota: null, atualizado_por: null, atualizado_em: null,
    }));
    // três cultos passados, já encerrados, pra ter histórico de presença
    const passados = [];
    const presencas = [];
    const justificativas = [];
    const some = new Set([jovens[6].id, jovens[17].id]); // vinham e pararam de vir
    [28, 21, 14].forEach((dias, k) => {
      const d = new Date(sab); d.setDate(d.getDate() - dias);
      const doisCultos = k === 2;
      const e = {
        id: uid(), nome: doisCultos ? 'Box Day' : 'Culto Box', data: hojeISO(d), hora: doisCultos ? null : '19h30',
        hora_sprint: doisCultos ? '17h' : null, hora_box: doisCultos ? '20h' : null, publico: doisCultos ? 'todos' : 'box',
        chamadas_por_jovem: 2, mensagem: null, arquivado: true, criado_em: d.toISOString(),
        presenca_encerrada_em: new Date(d.getTime() + 22 * 3600000).toISOString(), presenca_encerrada_por: 'Ana',
      };
      const vieram = jovens.filter((j, i) => some.has(j.id) ? k === 0 : (i + k) % 3 !== 0);
      const culto = j => !doisCultos ? 'geral' : (faixa(j) === 'sprint' ? 'sprint' : 'box');
      vieram.forEach(j => presencas.push({ id: uid(), evento_id: e.id, jovem_id: j.id, diretor_id: null, culto: culto(j), marcado_por: 'Ana', em: e.presenca_encerrada_em }));
      if (doisCultos) presencas.push({ id: uid(), evento_id: e.id, jovem_id: jovens[13].id, diretor_id: null, culto: 'sprint', marcado_por: 'Ana', em: e.presenca_encerrada_em });
      diretores.slice(0, 4).forEach(x => presencas.push({ id: uid(), evento_id: e.id, jovem_id: null, diretor_id: x.id, culto: doisCultos ? 'box' : 'geral', marcado_por: 'Ana', em: e.presenca_encerrada_em }));
      const confirmados = jovens.slice(0, 10).map(j => j.id);
      const veio = new Set(vieram.map(j => j.id));
      const faltaram = confirmados.filter(id => !veio.has(id));
      faltaram.slice(0, 1).forEach(id => justificativas.push({ evento_id: e.id, jovem_id: id, motivo: ['trabalho', 'saude', 'viagem'][k], texto: null, por: 'Ana', em: e.presenca_encerrada_em }));
      const cultos = {};
      for (const c of doisCultos ? ['sprint', 'box'] : ['geral']) {
        const pc = presencas.filter(x => x.evento_id === e.id && x.culto === c);
        const js = pc.filter(x => x.jovem_id).map(x => jovens.find(j => j.id === x.jovem_id));
        cultos[c] = { rotulo: c === 'geral' ? 'Presença' : c === 'box' ? 'Box 20h' : 'Sprint 17h', jovens: js.length, diretoria: pc.filter(x => x.diretor_id).length,
          box: js.filter(j => faixa(j) === 'box').length, sprint: js.filter(j => faixa(j) === 'sprint').length };
      }
      e.presenca_resumo = {
        cultos, jovens: new Set(presencas.filter(x => x.evento_id === e.id && x.jovem_id).map(x => x.jovem_id)).size, diretoria: 4,
        confirmados: confirmados.length, confirmados_vieram: confirmados.length - faltaram.length, faltaram, nao_vao: [], visitantes: 0,
      };
      // chamadas desse culto: o "Téo" (diretores[6]) não chamou ninguém, pra aparecer no resumo
      distribuir({ ...e, publico: 'todos' }, jovens, diretores, [], false).forEach((par, i) => atribuicoes.push({
        id: uid(), evento_id: e.id, ...par, nota: null, atualizado_por: null, atualizado_em: null,
        status: par.diretor_id === diretores[6].id ? 'pendente' : ['confirmado', 'chamado', 'confirmado', 'nao_vai'][i % 4],
      }));
      passados.push(e);
    });
    return { diretores, jovens, eventos: [ev, ...passados], atribuicoes, presencas, justificativas, vinculos, historico: [] };
  }
  function load() {
    try { const t = localStorage.getItem(KEY); if (t) return JSON.parse(t); } catch {}
    const db = seed();
    save(db);
    return db;
  }
  function save(db) { db.versao = (db.versao || 0) + 1; try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} }
  const nome = (lista, id) => (lista.find(x => x.id === id) || {}).nome;

  return {
    box_carregar() {
      const db = load();
      const ativos = new Set(db.eventos.filter(e => !e.arquivado).map(e => e.id));
      return {
        versao: db.versao || 0,
        diretores: [...db.diretores].sort(byNome),
        jovens: [...db.jovens].sort(byNome),
        eventos: [...db.eventos].sort((a, b) => (b.data || '').localeCompare(a.data || '')),
        atribuicoes: db.atribuicoes.filter(a => ativos.has(a.evento_id)),
        presencas: db.presencas || [],
        justificativas: db.justificativas || [],
        vinculos: db.vinculos || [],
        historico: db.historico.slice(0, 300),
      };
    },
    box_status({ p_id, p_status, p_quem, p_nota }) {
      const db = load();
      const a = db.atribuicoes.find(x => x.id === p_id);
      if (!a) throw new Error('nao_encontrado');
      if (p_status) a.status = p_status;
      if (p_nota != null) a.nota = p_nota || null;
      a.atualizado_por = p_quem;
      a.atualizado_em = new Date().toISOString();
      if (p_status) {
        db.historico.unshift({
          id: Date.now(), evento_id: a.evento_id, quem: p_quem, status: p_status, em: a.atualizado_em,
          jovem: nome(db.jovens, a.jovem_id), diretor: nome(db.diretores, a.diretor_id),
        });
      }
      save(db);
    },
    box_salvar({ p_tabela, p_dados }) {
      const db = load();
      const lista = db[p_tabela];
      if (!lista) throw new Error('tabela_invalida');
      const rows = Array.isArray(p_dados) ? p_dados : [p_dados];
      for (const r of rows) {
        const limpo = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === '' ? null : v]));
        const i = lista.findIndex(x => x.id === r.id);
        if (i >= 0) lista[i] = { ...lista[i], ...limpo };
        else lista.push({ ativo: true, arquivado: false, criado_em: new Date().toISOString(), ...limpo, id: r.id || uid() });
      }
      save(db);
      return rows.length;
    },
    box_excluir({ p_tabela, p_id }) {
      const db = load();
      db[p_tabela] = db[p_tabela].filter(x => x.id !== p_id);
      const campo = { jovens: 'jovem_id', diretores: 'diretor_id', eventos: 'evento_id' }[p_tabela];
      db.atribuicoes = db.atribuicoes.filter(a => a[campo] !== p_id);
      db.presencas = (db.presencas || []).filter(x => x[campo] !== p_id && (p_tabela !== 'diretores' || x.diretor_id !== p_id));
      db.justificativas = (db.justificativas || []).filter(x => x[campo] !== p_id);
      db.vinculos = (db.vinculos || []).filter(v => v.a_id !== p_id && v.b_id !== p_id);
      if (p_tabela === 'eventos') db.historico = db.historico.filter(h => h.evento_id !== p_id);
      save(db);
    },
    box_presenca({ p_evento, p_jovem, p_presente, p_quem, p_culto = 'geral' }) {
      const db = load();
      db.presencas = db.presencas || [];
      const ev = db.eventos.find(e => e.id === p_evento);
      if (ev?.presenca_encerrada_em) throw new Error('lista_encerrada');
      const dir = db.diretores.some(d => d.id === p_jovem);
      const culto = p_culto || 'geral';
      const i = db.presencas.findIndex(x => x.evento_id === p_evento && (x.culto || 'geral') === culto && (x.jovem_id || x.diretor_id) === p_jovem);
      if (p_presente === i >= 0) return;
      if (p_presente) db.presencas.push({ id: uid(), evento_id: p_evento, jovem_id: dir ? null : p_jovem, diretor_id: dir ? p_jovem : null, culto, marcado_por: p_quem, em: new Date().toISOString() });
      else db.presencas.splice(i, 1);
      db.historico.unshift({ id: Date.now(), evento_id: p_evento, quem: p_quem, jovem: nome(dir ? db.diretores : db.jovens, p_jovem), status: p_presente ? 'presente' : 'ausente', em: new Date().toISOString() });
      save(db);
    },
    box_encerrar_presenca({ p_evento, p_encerrar, p_quem, p_resumo }) {
      const db = load();
      const ev = db.eventos.find(e => e.id === p_evento);
      Object.assign(ev, p_encerrar
        ? { presenca_encerrada_em: new Date().toISOString(), presenca_encerrada_por: p_quem, presenca_resumo: p_resumo }
        : { presenca_encerrada_em: null, presenca_encerrada_por: null });
      save(db);
    },
    box_push_inscrever() {},
    box_push_remover() {},
    box_push_testar() {},
    box_push_distribuicao() {},
    box_versao() { return load().versao || 0; },
    box_presencas_evento({ p_evento }) {
      const db = load();
      return { presencas: (db.presencas || []).filter(p => p.evento_id === p_evento), justificativas: (db.justificativas || []).filter(j => j.evento_id === p_evento) };
    },
    box_exportar() {
      return { exportado_em: new Date().toISOString(), ...load() };
    },
    box_chamadas_evento({ p_evento }) {
      return load().atribuicoes.filter(a => a.evento_id === p_evento);
    },
    box_justificar({ p_evento, p_jovem, p_motivo, p_texto, p_quem }) {
      const db = load();
      db.justificativas = (db.justificativas || []).filter(x => !(x.evento_id === p_evento && x.jovem_id === p_jovem));
      if (p_motivo) db.justificativas.push({ evento_id: p_evento, jovem_id: p_jovem, motivo: p_motivo, texto: (p_texto || '').trim() || null, por: p_quem, em: new Date().toISOString() });
      save(db);
    },
    box_vinculo({ p_a, p_b, p_tipo, p_remover }) {
      const db = load();
      db.vinculos = db.vinculos || [];
      const mesmo = v => v.tipo === p_tipo && ((v.a_id === p_a && v.b_id === p_b) || (v.a_id === p_b && v.b_id === p_a));
      if (p_remover) db.vinculos = db.vinculos.filter(v => !mesmo(v));
      else if (!db.vinculos.some(v => VINCULOS[p_tipo].rot ? mesmo(v) : v.tipo === p_tipo && v.a_id === p_a && v.b_id === p_b)) {
        db.vinculos.push({ id: uid(), a_id: p_a, b_id: p_b, tipo: p_tipo, criado_em: new Date().toISOString() });
        const st = { conjuge: 'casado', noivo: 'noivo', namoro: 'namorando' }[p_tipo];
        if (st) [...db.jovens, ...db.diretores].forEach(x => { if (x.id === p_a || x.id === p_b) x.estado_civil = st; });
      }
      save(db);
    },
    box_atribuir({ p_evento, p_pares }) {
      const db = load();
      const chave = p => p.jovem_id + '|' + p.diretor_id;
      const novos = new Set(p_pares.map(chave));
      db.atribuicoes = db.atribuicoes.filter(a => a.evento_id !== p_evento || novos.has(chave(a)));
      const existentes = new Set(db.atribuicoes.filter(a => a.evento_id === p_evento).map(chave));
      for (const p of p_pares) {
        if (!existentes.has(chave(p))) {
          db.atribuicoes.push({ id: uid(), evento_id: p_evento, ...p, status: 'pendente', nota: null, atualizado_por: null, atualizado_em: null });
        }
      }
      save(db);
    },
    box_zerar({ p_evento }) {
      const db = load();
      db.atribuicoes.forEach(a => {
        if (a.evento_id === p_evento) Object.assign(a, { status: 'pendente', nota: null, atualizado_por: null, atualizado_em: null });
      });
      db.historico = db.historico.filter(h => h.evento_id !== p_evento);
      save(db);
    },
  };
})();

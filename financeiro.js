import { db } from './db.js';
import { CATEGORIAS_GASTO } from './constants.js';
import { ErroHttp, data as validarData, validarTextoLivre } from './validar.js';

const NOME_CATEGORIA = Object.fromEntries(CATEGORIAS_GASTO);

function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function validarMes(valor) {
  if (valor === undefined || valor === '') return hojeLocal().slice(0, 7);
  if (typeof valor !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) {
    throw new ErroHttp(400, 'Mês inválido (use AAAA-MM)');
  }
  return valor;
}

function mesDeslocado(mes, deslocamento) {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(ano, m - 1 + deslocamento, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ---------- Gastos ----------
function formatarGasto(linha) {
  return { ...linha, valor: linha.valor_cent / 100 };
}

function validarGasto(corpo, { parcial = false } = {}) {
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroHttp(400, 'Envie um objeto JSON');
  }
  const dados = {};

  if (!parcial || 'data' in corpo) {
    const d = validarData(corpo.data, 'data');
    if (!d) throw new ErroHttp(400, 'Informe a data');
    if (d > hojeLocal()) throw new ErroHttp(400, 'A data não pode ser no futuro');
    dados.data = d;
  }
  if (!parcial || 'valor' in corpo) {
    const n = Number(typeof corpo.valor === 'string' ? corpo.valor.replace(',', '.') : corpo.valor);
    if (!Number.isFinite(n) || n <= 0 || n > 10_000_000) {
      throw new ErroHttp(400, 'Informe um valor maior que zero');
    }
    dados.valor_cent = Math.round(n * 100);
  }
  if (!parcial || 'categoria' in corpo) {
    if (typeof corpo.categoria !== 'string' || !Object.hasOwn(NOME_CATEGORIA, corpo.categoria)) {
      throw new ErroHttp(400, 'Categoria inválida');
    }
    dados.categoria = corpo.categoria;
  }
  if (!parcial || 'descricao' in corpo) {
    const d = corpo.descricao;
    dados.descricao = d === undefined || d === null || String(d).trim() === '' ? null : validarTextoLivre(d, 'descricao', 200);
  }
  return dados;
}

function obterGasto(id) {
  const g = db.prepare('SELECT * FROM gastos WHERE id = ?').get(id);
  if (!g) throw new ErroHttp(404, 'Gasto não encontrado');
  return g;
}

export function criarGasto(corpo) {
  const dados = validarGasto(corpo);
  const r = db
    .prepare('INSERT INTO gastos (data, valor_cent, categoria, descricao) VALUES (?, ?, ?, ?)')
    .run(dados.data, dados.valor_cent, dados.categoria, dados.descricao);
  return formatarGasto(obterGasto(Number(r.lastInsertRowid)));
}

export function atualizarGasto(id, corpo) {
  obterGasto(id);
  const dados = validarGasto(corpo, { parcial: true });
  const campos = Object.keys(dados); // vêm da lista fixa do validador
  if (!campos.length) throw new ErroHttp(400, 'Nada para atualizar');
  db.prepare(`UPDATE gastos SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(
    ...campos.map((c) => dados[c]),
    id
  );
  return formatarGasto(obterGasto(id));
}

export function removerGasto(id) {
  obterGasto(id);
  db.prepare('DELETE FROM gastos WHERE id = ?').run(id);
}

// ---------- Resumo do mês ----------
const somaGanhos = db.prepare('SELECT COALESCE(SUM(valor_ganho_cent), 0) AS c FROM fechamentos WHERE data BETWEEN ? AND ?');
const somaGastos = db.prepare('SELECT COALESCE(SUM(valor_cent), 0) AS c FROM gastos WHERE data BETWEEN ? AND ?');

function totaisDoMes(mes) {
  const ini = `${mes}-01`;
  const fim = `${mes}-31`;
  const ganhos = somaGanhos.get(ini, fim).c;
  const gastos = somaGastos.get(ini, fim).c;
  return {
    ganhos: ganhos / 100,
    gastos: gastos / 100,
    lucro: (ganhos - gastos) / 100,
    margem: ganhos > 0 ? (ganhos - gastos) / ganhos : null,
  };
}

function lancamentosDoMes(mes) {
  const ini = `${mes}-01`;
  const fim = `${mes}-31`;
  const ganhos = db
    .prepare(
      'SELECT data, valor_ganho_cent, metodo_pagamento FROM fechamentos WHERE data BETWEEN ? AND ? AND valor_ganho_cent > 0'
    )
    .all(ini, fim)
    .map((f) => ({
      id: `f-${f.data}`,
      tipo: 'ganho',
      data: f.data,
      valor: f.valor_ganho_cent / 100,
      categoria: null,
      descricao: 'Fechamento do dia',
      metodo: f.metodo_pagamento,
      editavel: false, // para mudar, edite o fechamento daquele dia
    }));
  const gastos = db
    .prepare('SELECT * FROM gastos WHERE data BETWEEN ? AND ?')
    .all(ini, fim)
    .map((g) => ({
      id: `g-${g.id}`,
      gasto_id: g.id,
      tipo: 'gasto',
      data: g.data,
      valor: g.valor_cent / 100,
      categoria: g.categoria,
      categoria_nome: NOME_CATEGORIA[g.categoria] ?? g.categoria,
      descricao: g.descricao,
      editavel: true,
    }));
  return [...ganhos, ...gastos].sort((a, b) => (a.data === b.data ? b.id.localeCompare(a.id) : b.data.localeCompare(a.data)));
}

export function resumo(mes) {
  const ini = `${mes}-01`;
  const fim = `${mes}-31`;

  const porCategoria = db
    .prepare('SELECT categoria, SUM(valor_cent) AS c FROM gastos WHERE data BETWEEN ? AND ? GROUP BY categoria ORDER BY c DESC')
    .all(ini, fim)
    .map((l) => ({ categoria: l.categoria, nome: NOME_CATEGORIA[l.categoria] ?? l.categoria, total: l.c / 100 }));

  // Os 12 meses que terminam no mês escolhido, para o gráfico de barras.
  const meses = Array.from({ length: 12 }, (_, i) => {
    const m = mesDeslocado(mes, i - 11);
    return { mes: m, ...totaisDoMes(m) };
  });

  return {
    mes,
    categorias: CATEGORIAS_GASTO.map(([chave, nome]) => ({ chave, nome })),
    totais: totaisDoMes(mes),
    anterior: totaisDoMes(mesDeslocado(mes, -1)),
    por_categoria: porCategoria,
    meses,
    lancamentos: lancamentosDoMes(mes),
  };
}
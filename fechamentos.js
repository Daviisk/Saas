import { db } from './db.js';
import { ErroHttp, data as validarData } from './validar.js';
import { resumoDoDia } from './buscas.js';
import { horasDoDia } from './cronometro.js';

function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dataDaRota(valor) {
  const d = validarData(valor, 'data');
  if (!d) throw new ErroHttp(400, 'Informe a data');
  return d;
}

function inteiro(valor, campo, max = 100000) {
  if (valor === undefined || valor === null || valor === '') return 0;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 0 || n > max) {
    throw new ErroHttp(400, `Campo "${campo}" deve ser um número inteiro entre 0 e ${max}`);
  }
  return n;
}

function decimal(valor, campo, max) {
  if (valor === undefined || valor === null || valor === '') return 0;
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0 || n > max) {
    throw new ErroHttp(400, `Campo "${campo}" deve ser um número entre 0 e ${max}`);
  }
  return n;
}

function textoOpcional(valor, campo, max) {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') throw new ErroHttp(400, `Campo "${campo}" deve ser texto`);
  const s = valor.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim();
  if (s === '') return null;
  if (s.length > max) throw new ErroHttp(400, `Campo "${campo}" passa de ${max} caracteres`);
  return s;
}

function formatar(linha) {
  if (!linha) return null;
  return { ...linha, valor_ganho: linha.valor_ganho_cent / 100 };
}

export function listar(limite = 31) {
  const lim = Math.min(Math.max(Number(limite) || 31, 1), 400);
  return db.prepare('SELECT * FROM fechamentos ORDER BY data DESC LIMIT ?').all(lim).map(formatar);
}

export function obter(data) {
  return formatar(db.prepare('SELECT * FROM fechamentos WHERE data = ?').get(data) ?? null);
}

export function salvar(data, corpo) {
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroHttp(400, 'Envie um objeto JSON');
  }
  if (data > hojeLocal()) throw new ErroHttp(400, 'A data não pode ser no futuro');

  const v = {
    leads_buscados: inteiro(corpo.leads_buscados, 'leads_buscados'),
    leads_separados: inteiro(corpo.leads_separados, 'leads_separados'),
    leads_abordados: inteiro(corpo.leads_abordados, 'leads_abordados'),
    respostas: inteiro(corpo.respostas, 'respostas'),
    projetos_aceitos: inteiro(corpo.projetos_aceitos, 'projetos_aceitos'),
    valor_ganho_cent: Math.round(decimal(corpo.valor_ganho, 'valor_ganho', 10_000_000) * 100),
    metodo_pagamento: textoOpcional(corpo.metodo_pagamento, 'metodo_pagamento', 40),
    horas_trabalhadas: decimal(corpo.horas_trabalhadas, 'horas_trabalhadas', 24),
    observacoes: textoOpcional(corpo.observacoes, 'observacoes', 1000),
  };

  db.prepare(
    `INSERT INTO fechamentos
       (data, leads_buscados, leads_separados, leads_abordados, respostas, projetos_aceitos,
        valor_ganho_cent, metodo_pagamento, horas_trabalhadas, observacoes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (data) DO UPDATE SET
       leads_buscados = excluded.leads_buscados,
       leads_separados = excluded.leads_separados,
       leads_abordados = excluded.leads_abordados,
       respostas = excluded.respostas,
       projetos_aceitos = excluded.projetos_aceitos,
       valor_ganho_cent = excluded.valor_ganho_cent,
       metodo_pagamento = excluded.metodo_pagamento,
       horas_trabalhadas = excluded.horas_trabalhadas,
       observacoes = excluded.observacoes,
       atualizado_em = datetime('now')`
  ).run(
    data, v.leads_buscados, v.leads_separados, v.leads_abordados, v.respostas, v.projetos_aceitos,
    v.valor_ganho_cent, v.metodo_pagamento, v.horas_trabalhadas, v.observacoes
  );
  return obter(data);
}

export function remover(data) {
  const r = db.prepare('DELETE FROM fechamentos WHERE data = ?').run(data);
  if (r.changes === 0) throw new ErroHttp(404, 'Fechamento não encontrado');
}

// Números do dia calculados pelo sistema (horário local do PC):
// buscados = leads diferentes que apareceram nas buscas; separados = leads enviados ao CRM;
// abordados = leads que o CRM marcou como abordados.
export function sugestao(data) {
  const contar = (sql) => db.prepare(sql).get(data).n;
  return {
    buscados: resumoDoDia(data).leadsBuscados,
    separados: contar("SELECT COUNT(*) AS n FROM leads WHERE date(criado_em, 'localtime') = ?"),
    abordados: contar("SELECT COUNT(*) AS n FROM leads WHERE date(abordado_em, 'localtime') = ?"),
    horas: horasDoDia(data),
  };
}
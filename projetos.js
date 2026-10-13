import { db } from './db.js';
import { ETAPAS_PROJETO } from './constants.js';
import { ErroHttp, data as validarData, validarTextoLivre } from './validar.js';

const CHAVES_ETAPA = ETAPAS_PROJETO.map(([chave]) => chave);

// Na primeira vez, importa os leads que já estavam em "Fechado" antes desta tela existir.
if (!db.prepare("SELECT 1 FROM configuracoes WHERE chave = 'projetos_importados'").get()) {
  db.prepare(
    "INSERT OR IGNORE INTO projetos (lead_id, nome, nicho) SELECT id, nome, nicho FROM leads WHERE etapa = 'fechado'"
  ).run();
  db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('projetos_importados', '1')").run();
}

// ---------- Validação ----------
function dinheiroCent(valor, campo) {
  if (valor === undefined || valor === null || valor === '') return 0;
  const n = Number(typeof valor === 'string' ? valor.replace(',', '.') : valor);
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) {
    throw new ErroHttp(400, `Campo "${campo}" deve ser um valor entre 0 e 10.000.000`);
  }
  return Math.round(n * 100);
}

function textoOpcional(valor, campo, max) {
  if (valor === undefined || valor === null || String(valor).trim() === '') return null;
  return validarTextoLivre(valor, campo, max);
}

function validarProjeto(corpo, { parcial = false } = {}) {
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroHttp(400, 'Envie um objeto JSON');
  }
  const dados = {};
  if (!parcial || 'nome' in corpo) dados.nome = validarTextoLivre(corpo.nome, 'nome', 120);
  if (!parcial || 'valor' in corpo) dados.valor_cent = dinheiroCent(corpo.valor, 'valor');
  if (!parcial || 'recebido' in corpo) dados.recebido_cent = dinheiroCent(corpo.recebido, 'recebido');
  if (!parcial || 'prazo' in corpo) dados.prazo = corpo.prazo ? validarData(corpo.prazo, 'prazo') || null : null;
  if (!parcial || 'observacoes' in corpo) dados.observacoes = textoOpcional(corpo.observacoes, 'observacoes', 1000);
  return dados;
}

// ---------- Leitura ----------
function statusPagamento(p) {
  if (p.valor_cent <= 0) return 'sem_valor';
  if (p.recebido_cent >= p.valor_cent) return 'pago';
  if (p.recebido_cent > 0) return 'parcial';
  return 'sem_entrada';
}

function formatar(p) {
  return {
    ...p,
    valor: p.valor_cent / 100,
    recebido: p.recebido_cent / 100,
    saldo: Math.max(p.valor_cent - p.recebido_cent, 0) / 100,
    pagamento: statusPagamento(p),
  };
}

export function obter(id) {
  const p = db.prepare('SELECT * FROM projetos WHERE id = ?').get(id);
  if (!p) throw new ErroHttp(404, 'Projeto não encontrado');
  return formatar(p);
}

export function kanban() {
  const todos = db
    .prepare('SELECT * FROM projetos ORDER BY atualizado_em DESC, id DESC')
    .all()
    .map(formatar);
  const colunas = ETAPAS_PROJETO.map(([etapa, nome]) => {
    const projetos = todos.filter((p) => p.etapa === etapa);
    return { etapa, nome, total: projetos.length, projetos };
  });
  const ativos = todos.filter((p) => p.etapa !== 'entregue');
  return {
    colunas,
    resumo: {
      em_andamento: ativos.length,
      valor_em_andamento: ativos.reduce((soma, p) => soma + p.valor_cent, 0) / 100,
      a_receber: todos.reduce((soma, p) => soma + Math.max(p.valor_cent - p.recebido_cent, 0), 0) / 100,
    },
  };
}

// ---------- Escrita ----------
// Chamado pelo CRM quando um lead vai para "Fechado". Devolve true se criou o projeto.
// "valores" é opcional: { valor, recebido } em reais.
export function garantirProjeto(lead, valores = {}) {
  const valor = dinheiroCent(valores?.valor, 'valor');
  const recebido = dinheiroCent(valores?.recebido, 'recebido');
  const r = db
    .prepare('INSERT OR IGNORE INTO projetos (lead_id, nome, nicho, valor_cent, recebido_cent) VALUES (?, ?, ?, ?, ?)')
    .run(lead.id, lead.nome, lead.nicho ?? null, valor, recebido);
  return Number(r.changes) > 0;
}

export function criar(corpo) {
  const d = validarProjeto(corpo);
  const r = db
    .prepare('INSERT INTO projetos (nome, valor_cent, recebido_cent, prazo, observacoes) VALUES (?, ?, ?, ?, ?)')
    .run(d.nome, d.valor_cent, d.recebido_cent, d.prazo, d.observacoes);
  return obter(Number(r.lastInsertRowid));
}

export function atualizar(id, corpo) {
  obter(id);
  const dados = validarProjeto(corpo, { parcial: true });
  const campos = Object.keys(dados); // vêm da lista fixa do validador
  if (!campos.length) throw new ErroHttp(400, 'Nada para atualizar');
  db.prepare(
    `UPDATE projetos SET ${campos.map((c) => `${c} = ?`).join(', ')}, atualizado_em = datetime('now') WHERE id = ?`
  ).run(...campos.map((c) => dados[c]), id);
  return obter(id);
}

export function moverEtapa(id, etapa) {
  const projeto = obter(id);
  if (!CHAVES_ETAPA.includes(etapa)) throw new ErroHttp(400, 'Etapa inválida');
  if (projeto.etapa === etapa) return projeto;

  db.prepare(
    `UPDATE projetos SET
       etapa = ?,
       entregue_em = CASE WHEN ? = 'entregue' THEN datetime('now') ELSE NULL END,
       atualizado_em = datetime('now')
     WHERE id = ?`
  ).run(etapa, etapa, id);

  // Se o projeto veio do CRM, registra no histórico do lead.
  if (projeto.lead_id) {
    const nome = Object.fromEntries(ETAPAS_PROJETO);
    db.prepare("INSERT INTO lead_notas (lead_id, tipo, texto) VALUES (?, 'sistema', ?)").run(
      projeto.lead_id,
      `Projeto: ${nome[projeto.etapa]} → ${nome[etapa]}`
    );
  }
  return obter(id);
}

export function remover(id) {
  obter(id);
  db.prepare('DELETE FROM projetos WHERE id = ?').run(id);
}
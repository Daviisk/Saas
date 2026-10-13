import { db } from './db.js';
import { TIPOS_SITE } from './constants.js';
import { NICHOS, buscarNicho } from './nichos.js';
import { ErroHttp } from './validar.js';
import { obter as obterLead, transacao } from './leads.js';
import { semAcento } from './provedores/comum.js';
import { gerarCopiesBase } from './copies-base.js';

// ---------- Validação (o texto da copy mantém as quebras de linha) ----------
function textoCurto(valor, campo, max) {
  if (typeof valor !== 'string') throw new ErroHttp(400, `Campo "${campo}" deve ser texto`);
  const s = valor.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) throw new ErroHttp(400, `O campo "${campo}" é obrigatório`);
  if (s.length > max) throw new ErroHttp(400, `Campo "${campo}" passa de ${max} caracteres`);
  return s;
}

function textoLongo(valor, campo, max) {
  if (typeof valor !== 'string') throw new ErroHttp(400, `Campo "${campo}" deve ser texto`);
  const s = valor
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .trim();
  if (!s) throw new ErroHttp(400, `O campo "${campo}" é obrigatório`);
  if (s.length > max) throw new ErroHttp(400, `Campo "${campo}" passa de ${max} caracteres`);
  return s;
}

function validarCopy(corpo, parcial = false) {
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroHttp(400, 'Envie um objeto JSON');
  }
  const v = {};
  if (corpo.nicho !== undefined) {
    if (typeof corpo.nicho !== 'string' || !buscarNicho(corpo.nicho)) throw new ErroHttp(400, 'Nicho inválido');
    v.nicho = corpo.nicho;
  }
  if (corpo.titulo !== undefined) v.titulo = textoCurto(corpo.titulo, 'titulo', 120);
  if (corpo.texto !== undefined) v.texto = textoLongo(corpo.texto, 'texto', 3000);
  if (corpo.dor !== undefined) {
    if (corpo.dor === null || corpo.dor === '') v.dor = null;
    else if (TIPOS_SITE.includes(corpo.dor)) v.dor = corpo.dor;
    else throw new ErroHttp(400, `Campo "dor" deve ser: ${TIPOS_SITE.join(', ')}`);
  }
  if (corpo.nova !== undefined) {
    if ([true, 1, '1'].includes(corpo.nova)) v.nova = 1;
    else if ([false, 0, '0'].includes(corpo.nova)) v.nova = 0;
    else throw new ErroHttp(400, 'Campo "nova" deve ser verdadeiro ou falso');
  }
  if (!parcial) {
    for (const campo of ['nicho', 'titulo', 'texto']) {
      if (v[campo] === undefined) throw new ErroHttp(400, `O campo "${campo}" é obrigatório`);
    }
  }
  if (Object.keys(v).length === 0) throw new ErroHttp(400, 'Nenhum campo válido enviado');
  return v;
}

const COLUNAS = 'id, nicho, titulo, texto, dor, nova, criado_em';
const formatar = (c) => ({ ...c, nova: Boolean(c.nova) });

// ---------- CRUD ----------
export function listar({ nicho, dor, nova, limite } = {}) {
  const onde = [];
  const params = [];
  if (nicho) {
    if (!buscarNicho(nicho)) throw new ErroHttp(400, 'Nicho inválido');
    onde.push('nicho = ?');
    params.push(nicho);
  }
  if (dor) {
    if (!TIPOS_SITE.includes(dor)) throw new ErroHttp(400, 'Situação inválida');
    onde.push('dor = ?');
    params.push(dor);
  }
  if (nova === '1' || nova === '0') {
    onde.push('nova = ?');
    params.push(Number(nova));
  }
  const lim = Math.min(Math.max(Number(limite) || 500, 1), 500);
  const sql = `SELECT ${COLUNAS} FROM copies ${onde.length ? `WHERE ${onde.join(' AND ')}` : ''} ORDER BY nicho, id LIMIT ?`;
  return db.prepare(sql).all(...params, lim).map(formatar);
}

export function obter(id) {
  const c = db.prepare(`SELECT ${COLUNAS} FROM copies WHERE id = ?`).get(id);
  if (!c) throw new ErroHttp(404, 'Copy não encontrada');
  return formatar(c);
}

export function criar(corpo) {
  const v = validarCopy(corpo);
  const r = db
    .prepare('INSERT INTO copies (nicho, titulo, texto, dor, nova) VALUES (?, ?, ?, ?, ?)')
    .run(v.nicho, v.titulo, v.texto, v.dor ?? null, v.nova ?? 1);
  return obter(Number(r.lastInsertRowid));
}

export function atualizar(id, corpo) {
  obter(id);
  const v = validarCopy(corpo, true);
  const campos = Object.keys(v); // vêm da lista fixa do validador
  db.prepare(`UPDATE copies SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(
    ...campos.map((c) => v[c]),
    id
  );
  return obter(id);
}

export function excluir(id) {
  obter(id);
  db.prepare('DELETE FROM copies WHERE id = ?').run(id);
}

// ---------- Copies base: na primeira execução, com a tabela vazia ----------
function semearSeVazio() {
  if (db.prepare('SELECT COUNT(*) AS n FROM copies').get().n > 0) return;
  const inserir = db.prepare('INSERT INTO copies (nicho, titulo, texto, dor, nova) VALUES (?, ?, ?, ?, 1)');
  transacao(() => {
    for (const c of gerarCopiesBase()) inserir.run(c.nicho, c.titulo, c.texto, c.dor);
  });
}
semearSeVazio();

// ---------- Mensagem pronta para um lead ----------
function nomeCurto(nome) {
  // "Samcro Barbershop - Av. Marquês de Pombal" -> "Samcro Barbershop"; "Studio (Unidade 1)" -> "Studio"
  return String(nome).split(' - ')[0].replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function montarMensagem(texto, lead) {
  const nome = nomeCurto(lead.nome);
  return texto.replaceAll('{nome}', nome).replace(/\[nome do estabelecimento\]/gi, nome);
}

function encontrarNicho(valor) {
  if (!valor) return null;
  const alvo = semAcento(valor);
  return NICHOS.find((n) => n.chave === valor || semAcento(n.nome) === alvo) || null;
}

// Copies do nicho do lead, com a da situação dele (sem site, só rede social...) em primeiro.
export function copiesParaLead(leadId) {
  const lead = obterLead(leadId);
  const situacao = TIPOS_SITE.includes(lead.site_tipo) ? lead.site_tipo : 'nenhum';
  const base = { lead: { id: lead.id, nome: lead.nome, site_tipo: lead.site_tipo, situacao } };

  const nicho = encontrarNicho(lead.nicho);
  if (!nicho) return { ...base, nicho: null, copies: [] };

  const numero = lead.whatsapp || lead.telefone;
  const copies = db
    .prepare(`SELECT ${COLUNAS} FROM copies WHERE nicho = ? ORDER BY id`)
    .all(nicho.chave)
    .map((c) => {
      const mensagem = montarMensagem(c.texto, lead);
      return {
        ...formatar(c),
        recomendada: c.dor === situacao,
        mensagem,
        // Colchetes que sobraram na mensagem = algo para preencher antes de enviar.
        pendencia: /\[[^\]]+\]/.test(mensagem),
        whatsapp_url: numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}` : null,
      };
    })
    .sort((a, b) => Number(b.recomendada) - Number(a.recomendada));

  return { ...base, nicho: { chave: nicho.chave, nome: nicho.nome }, copies };
}
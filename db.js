import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });

export const dbPath = path.join(config.dataDir, 'leads.db');
export const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

// Valores em dinheiro são guardados em centavos (inteiro) para não ter erro de arredondamento.
db.exec(`
CREATE TABLE IF NOT EXISTS leads (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nome            TEXT NOT NULL,
  nicho           TEXT,
  categoria       TEXT,
  telefone        TEXT,
  whatsapp        TEXT,
  instagram       TEXT,
  site            TEXT,
  site_tipo       TEXT NOT NULL DEFAULT 'nenhum',
  endereco        TEXT,
  cidade          TEXT,
  uf              TEXT,
  maps_url        TEXT,
  nota            REAL,
  pontuacao       INTEGER,
  temperatura     TEXT,
  dor             TEXT,
  fonte           TEXT,
  fonte_id        TEXT,
  etapa           TEXT NOT NULL DEFAULT 'lead_do_dia',
  verificado      INTEGER NOT NULL DEFAULT 0,
  motivo_descarte TEXT,
  motivo_perda    TEXT,
  proximo_followup TEXT,
  abordado_em     TEXT,
  criado_em       TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (fonte, fonte_id)
);
CREATE INDEX IF NOT EXISTS idx_leads_etapa    ON leads (etapa);
CREATE INDEX IF NOT EXISTS idx_leads_telefone ON leads (telefone);

CREATE TABLE IF NOT EXISTS lead_notas (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id   INTEGER NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  tipo      TEXT NOT NULL DEFAULT 'nota',
  texto     TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- O "depósito": um fechamento por dia. Painel, calendário e financeiro só leem daqui.
CREATE TABLE IF NOT EXISTS fechamentos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  data              TEXT NOT NULL UNIQUE,
  leads_buscados    INTEGER NOT NULL DEFAULT 0,
  leads_separados   INTEGER NOT NULL DEFAULT 0,
  leads_abordados   INTEGER NOT NULL DEFAULT 0,
  respostas         INTEGER NOT NULL DEFAULT 0,
  projetos_aceitos  INTEGER NOT NULL DEFAULT 0,
  valor_ganho_cent  INTEGER NOT NULL DEFAULT 0,
  metodo_pagamento  TEXT,
  horas_trabalhadas REAL NOT NULL DEFAULT 0,
  observacoes       TEXT,
  criado_em         TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Uso de cota por provedor. periodo = 'AAAA-MM-DD' (cota diária) ou 'AAAA-MM' (mensal).
CREATE TABLE IF NOT EXISTS cotas_uso (
  provedor TEXT NOT NULL,
  periodo  TEXT NOT NULL,
  usado    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (provedor, periodo)
);

CREATE TABLE IF NOT EXISTS copies (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nicho     TEXT NOT NULL,
  titulo    TEXT NOT NULL,
  texto     TEXT NOT NULL,
  dor       TEXT,
  nova      INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS nao_contatar (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  telefone  TEXT NOT NULL UNIQUE,
  motivo    TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS buscas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  data        TEXT NOT NULL,
  nicho       TEXT NOT NULL,
  cidade      TEXT NOT NULL,
  uf          TEXT NOT NULL,
  modo        TEXT NOT NULL,
  encontrados INTEGER NOT NULL DEFAULT 0,
  retornados  INTEGER NOT NULL DEFAULT 0,
  provedores  TEXT,
  chaves      TEXT,
  criado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_buscas_data ON buscas (data);

CREATE TABLE IF NOT EXISTS metas (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  chave  TEXT NOT NULL UNIQUE,
  nome   TEXT NOT NULL,
  tipo   TEXT NOT NULL,
  alvo   REAL NOT NULL DEFAULT 1,
  ativa  INTEGER NOT NULL DEFAULT 1,
  ordem  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS metas_marcadas (
  data    TEXT NOT NULL,
  meta_id INTEGER NOT NULL REFERENCES metas (id) ON DELETE CASCADE,
  PRIMARY KEY (data, meta_id)
);

CREATE TABLE IF NOT EXISTS disciplina_dias (
  data          TEXT PRIMARY KEY,
  folga         INTEGER NOT NULL DEFAULT 0,
  feitos        TEXT,
  outros        TEXT,
  classe_manual TEXT,
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS cronometro (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  estado        TEXT NOT NULL DEFAULT 'parado',
  acumulado_seg INTEGER NOT NULL DEFAULT 0,
  retomado_ms   INTEGER,
  data          TEXT
);

CREATE TABLE IF NOT EXISTS cronometro_sessoes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  data      TEXT NOT NULL,
  segundos  INTEGER NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessoes_data ON cronometro_sessoes (data);`);

// Migração: o CREATE TABLE IF NOT EXISTS não adiciona colunas em banco que já existe.
function garantirColuna(tabela, coluna, definicao) {
  const existe = db.prepare(`PRAGMA table_info(${tabela})`).all().some((c) => c.name === coluna);
  if (!existe) db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
}
garantirColuna('leads', 'verificacao', 'TEXT');
db.exec('CREATE INDEX IF NOT EXISTS idx_leads_followup ON leads (proximo_followup)');

// Follow-up automático: quando o lead entrou em "Copy enviada" e se ele já teve follow-up (automático ou manual).
garantirColuna('leads', 'copy_enviada_em', 'TEXT');
garantirColuna('leads', 'followup_tratado_em', 'TEXT');

// Parte 10A: gastos do financeiro. Os ganhos vêm da tabela fechamentos.
db.exec(`
CREATE TABLE IF NOT EXISTS gastos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  data       TEXT NOT NULL,
  valor_cent INTEGER NOT NULL,
  categoria  TEXT NOT NULL,
  descricao  TEXT,
  criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gastos_data ON gastos (data);`);
// Parte 10B: projetos (sites em produção depois que o lead fecha).

db.exec(`
CREATE TABLE IF NOT EXISTS projetos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id       INTEGER UNIQUE REFERENCES leads (id) ON DELETE SET NULL,
  nome          TEXT NOT NULL,
  nicho         TEXT,
  etapa         TEXT NOT NULL DEFAULT 'aguardando_entrada',
  valor_cent    INTEGER NOT NULL DEFAULT 0,
  recebido_cent INTEGER NOT NULL DEFAULT 0,
  prazo         TEXT,
  observacoes   TEXT,
  entregue_em   TEXT,
  criado_em     TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_projetos_etapa ON projetos (etapa);`);

export function fechar() {
  db.close();
}

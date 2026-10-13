import { db } from './db.js';

const inserir = db.prepare(
  `INSERT INTO buscas (data, nicho, cidade, uf, modo, encontrados, retornados, provedores, chaves)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

function hoje() {
  return new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD, no horário do seu PC
}

export function registrarBusca({ nicho, cidade, uf, modo, resumo, provedores, leads }) {
  inserir.run(
    hoje(),
    nicho,
    cidade,
    uf,
    modo,
    resumo.encontrados,
    resumo.retornados,
    JSON.stringify(provedores),
    JSON.stringify(leads.map((l) => `${l.fonte}:${l.fonte_id}`))
  );
}

export function listarBuscas(limite = 50) {
  const lim = Math.min(Math.max(Number(limite) || 50, 1), 200);
  return db
    .prepare(
      'SELECT id, data, nicho, cidade, uf, modo, encontrados, retornados, provedores, criado_em FROM buscas ORDER BY id DESC LIMIT ?'
    )
    .all(lim)
    .map((b) => ({ ...b, provedores: JSON.parse(b.provedores || '[]') }));
}

// Resumo de um dia (AAAA-MM-DD): quantas buscas e quantos leads DIFERENTES apareceram.
export function resumoDoDia(data) {
  const linhas = db.prepare('SELECT chaves FROM buscas WHERE data = ?').all(data);
  const distintos = new Set();
  for (const l of linhas) {
    for (const k of JSON.parse(l.chaves || '[]')) distintos.add(k);
  }
  return { buscas: linhas.length, leadsBuscados: distintos.size };
}
import { db } from './db.js';
import { ETAPAS, ETAPA_DESCARTADO, ETAPAS_ENCERRADAS, ITENS_VERIFICACAO } from './constants.js';
import { ErroHttp, normalizarTelefone, validarTextoLivre } from './validar.js';
import { garantirProjeto } from './projetos.js';
import { linkMapa } from './mapa.js';

// Datas são gravadas em UTC (datetime('now')). Para "hoje" no horário do PC, use o modificador 'localtime' nas consultas.

export function transacao(fn) {
  db.exec('BEGIN');
  try {
    const resultado = fn();
    db.exec('COMMIT');
    return resultado;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

const ETAPAS_COM_ABORDAGEM = ['copy_enviada', 'em_negociacao', 'proposta_enviada', 'fechado'];
const COLUNAS_CARD =
  'id, nome, nicho, categoria, telefone, whatsapp, instagram, site, site_tipo, endereco, cidade, uf, maps_url, nota, pontuacao, temperatura, dor, etapa, verificado, proximo_followup, copy_enviada_em, abordado_em, atualizado_em, motivo_descarte, motivo_perda';

export function obter(id) {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  if (!lead) throw new ErroHttp(404, 'Lead não encontrado');
  return lead;
}

function lerVerificacao(lead) {
  let salvo = {};
  try {
    salvo = JSON.parse(lead.verificacao || '{}');
  } catch {
    salvo = {};
  }
  return Object.fromEntries(ITENS_VERIFICACAO.map((k) => [k, salvo[k] === true]));
}

export function obterComNotas(id) {
  const lead = obter(id);
  lead.notas = listarNotas(id);
  lead.verificacao = lerVerificacao(lead);
  lead.na_lista_nao_contatar = lead.telefone
    ? !!db.prepare('SELECT 1 FROM nao_contatar WHERE telefone = ?').get(lead.telefone)
    : false;
  return lead;
}

export function listar({ etapa, q, limite = 100, deslocamento = 0 } = {}) {
  const onde = [];
  const params = [];
  if (etapa) {
    if (![...ETAPAS, ETAPA_DESCARTADO].includes(etapa)) throw new ErroHttp(400, 'Etapa inválida');
    onde.push('etapa = ?');
    params.push(etapa);
  }
  if (q) {
    const padrao = `%${String(q).replace(/[\\%_]/g, '\\$&')}%`;
    onde.push("(nome LIKE ? ESCAPE '\\' OR nicho LIKE ? ESCAPE '\\' OR cidade LIKE ? ESCAPE '\\' OR telefone LIKE ? ESCAPE '\\')");
    params.push(padrao, padrao, padrao, padrao);
  }
  const lim = Math.min(Math.max(Number(limite) || 100, 1), 500);
  const desl = Math.max(Number(deslocamento) || 0, 0);
  const sql = `SELECT ${COLUNAS_CARD} FROM leads ${onde.length ? `WHERE ${onde.join(' AND ')}` : ''} ORDER BY atualizado_em DESC, id DESC LIMIT ? OFFSET ?`;
  return db.prepare(sql).all(...params, lim, desl);
}

export function kanban() {
  const colunas = [...ETAPAS, ETAPA_DESCARTADO].map((etapa) => {
    const total = db.prepare('SELECT COUNT(*) AS n FROM leads WHERE etapa = ?').get(etapa).n;
    const leads = db
      .prepare(`SELECT ${COLUNAS_CARD} FROM leads WHERE etapa = ? ORDER BY atualizado_em DESC, id DESC LIMIT 200`)
      .all(etapa);
    return { etapa, total, leads };
  });
  const descartados = colunas.find((c) => c.etapa === ETAPA_DESCARTADO)?.total ?? 0;
  return { colunas, descartados };
}

function checarTelefone(telefone, ignorarId = null) {
  if (!telefone) return;
  if (db.prepare('SELECT 1 FROM nao_contatar WHERE telefone = ?').get(telefone)) {
    throw new ErroHttp(409, 'Este telefone está na lista de não contatar');
  }
  const igual = db
    .prepare('SELECT id, nome FROM leads WHERE telefone = ? AND id != ?')
    .get(telefone, ignorarId ?? -1);
  if (igual) throw new ErroHttp(409, `Já existe um lead com este telefone: "${igual.nome}" (id ${igual.id})`);
}

export function criar(dados) {
  checarTelefone(dados.telefone);
  return transacao(() => {
    const campos = Object.keys(dados); // vêm da lista branca do validador
    const sql = `INSERT INTO leads (${campos.join(', ')}) VALUES (${campos.map(() => '?').join(', ')})`;
    let id;
    try {
      id = Number(db.prepare(sql).run(...campos.map((c) => dados[c])).lastInsertRowid);
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) throw new ErroHttp(409, 'Este lead já foi cadastrado (mesma fonte e id)');
      throw e;
    }
    adicionarNota(id, `Lead criado${dados.fonte ? ` (fonte: ${dados.fonte})` : ''}`, 'sistema');
    return obter(id);
  });
}

export function atualizar(id, dados) {
  obter(id);
  if ('telefone' in dados) checarTelefone(dados.telefone, id);
  const campos = Object.keys(dados);
  const sql = `UPDATE leads SET ${campos.map((c) => `${c} = ?`).join(', ')}, atualizado_em = datetime('now') WHERE id = ?`;
  db.prepare(sql).run(...campos.map((c) => dados[c]), id);
  return obter(id);
}

export function moverEtapa(id, etapa, motivo, projeto) {
  const lead = obter(id);
  if (![...ETAPAS, ETAPA_DESCARTADO].includes(etapa)) throw new ErroHttp(400, 'Etapa inválida');
  if (lead.etapa === etapa) return lead;

  const motivoLimpo = motivo ? validarTextoLivre(motivo, 'motivo', 500) : null;
  if ((etapa === 'perdido' || etapa === ETAPA_DESCARTADO) && !motivoLimpo) {
    throw new ErroHttp(400, 'Informe o motivo');
  }

  return transacao(() => {
    db.prepare(
      `UPDATE leads SET
         etapa = ?,
         motivo_perda = ?,
         motivo_descarte = ?,
         copy_enviada_em = CASE WHEN ? = 'copy_enviada' THEN datetime('now') ELSE NULL END,
         followup_tratado_em = NULL,
         abordado_em = CASE WHEN abordado_em IS NULL AND ? = 1 THEN datetime('now') ELSE abordado_em END,
         atualizado_em = datetime('now')
       WHERE id = ?`
    ).run(
      etapa,
      etapa === 'perdido' ? motivoLimpo : null,
      etapa === ETAPA_DESCARTADO ? motivoLimpo : null,
      etapa,
      ETAPAS_COM_ABORDAGEM.includes(etapa) ? 1 : 0,
      id
    );
    if (ETAPAS_ENCERRADAS.includes(etapa)) {
      db.prepare('UPDATE leads SET proximo_followup = NULL WHERE id = ?').run(id);
    }
    const semVerificacao = etapa === 'copy_enviada' && !lead.verificado ? ' — sem verificação completa' : '';
    adicionarNota(
      id,
      `Etapa: ${lead.etapa} → ${etapa}${motivoLimpo ? ` (${motivoLimpo})` : ''}${semVerificacao}`,
      'etapa'
    );
    if (etapa === 'fechado' && garantirProjeto(lead, projeto)) {
      adicionarNota(id, 'Projeto criado no kanban de projetos', 'sistema');
    }
    return obter(id);
  });
}

export function excluir(id) {
  obter(id);
  db.prepare('DELETE FROM leads WHERE id = ?').run(id);
}

export function adicionarNota(leadId, textoNota, tipo = 'nota') {
  db.prepare('INSERT INTO lead_notas (lead_id, tipo, texto) VALUES (?, ?, ?)').run(leadId, tipo, textoNota);
}

export function criarNota(leadId, textoNota) {
  obter(leadId);
  adicionarNota(leadId, validarTextoLivre(textoNota, 'texto'), 'nota');
  return listarNotas(leadId);
}

export function listarNotas(leadId) {
  return db
    .prepare('SELECT id, tipo, texto, criado_em FROM lead_notas WHERE lead_id = ? ORDER BY id DESC')
    .all(leadId);
}

// Lista de "não contatar"
export function listarNaoContatar() {
  return db.prepare('SELECT id, telefone, motivo, criado_em FROM nao_contatar ORDER BY id DESC').all();
}

export function adicionarNaoContatar(telefoneBruto, motivo) {
  const telefone = normalizarTelefone(telefoneBruto);
  if (!telefone) throw new ErroHttp(400, 'Informe o telefone');
  const motivoLimpo = motivo ? validarTextoLivre(motivo, 'motivo', 300) : null;
  db.prepare('INSERT OR IGNORE INTO nao_contatar (telefone, motivo) VALUES (?, ?)').run(telefone, motivoLimpo);
  return listarNaoContatar();
}
// ---------- Follow-up ----------

function formatarSql(data) {
  return data.toISOString().slice(0, 19).replace('T', ' ');
}

function textoQuando(data) {
  return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Aceita { quando: 'data ISO' } ou { dias: 1 a 90 }.
function calcularQuando(corpo) {
  if (corpo.quando) {
    if (typeof corpo.quando !== 'string') throw new ErroHttp(400, 'Data inválida');
    const data = new Date(corpo.quando);
    if (Number.isNaN(data.getTime())) throw new ErroHttp(400, 'Data inválida');
    if (data.getTime() < Date.now() - 60_000) throw new ErroHttp(400, 'Escolha uma data futura');
    return data;
  }
  const dias = Number(corpo.dias);
  if (!Number.isInteger(dias) || dias < 1 || dias > 90) {
    throw new ErroHttp(400, 'Informe de 1 a 90 dias ou uma data');
  }
  return new Date(Date.now() + dias * 86_400_000);
}

export function agendarFollowup(id, corpo = {}) {
  const lead = obter(id);
  if (ETAPAS_ENCERRADAS.includes(lead.etapa)) throw new ErroHttp(400, 'Este lead já está encerrado');
  const data = calcularQuando(corpo);
  const motivo = corpo.motivo ? validarTextoLivre(corpo.motivo, 'motivo', 300) : null;

  return transacao(() => {
    db.prepare(
      "UPDATE leads SET proximo_followup = ?, followup_tratado_em = COALESCE(followup_tratado_em, datetime('now')), atualizado_em = datetime('now') WHERE id = ?"
    ).run(formatarSql(data), id);
    adicionarNota(id, `Follow-up agendado para ${textoQuando(data)}${motivo ? ` — ${motivo}` : ''}`, 'followup');
    return obter(id);
  });
}

// Troca a data de um follow-up que já existe.
export function reagendarFollowup(id, corpo = {}) {
  const lead = obter(id);
  if (!lead.proximo_followup) throw new ErroHttp(400, 'Este lead não tem follow-up agendado');
  const data = calcularQuando(corpo);
  const motivo = corpo.motivo ? validarTextoLivre(corpo.motivo, 'motivo', 300) : null;

  return transacao(() => {
    db.prepare("UPDATE leads SET proximo_followup = ?, atualizado_em = datetime('now') WHERE id = ?").run(
      formatarSql(data),
      id
    );
    adicionarNota(
      id,
      `Follow-up reagendado de ${dataLocal(lead.proximo_followup)} para ${textoQuando(data)}${motivo ? ` — ${motivo}` : ''}`,
      'followup'
    );
    return obter(id);
  });
}

// Agenda o mesmo follow-up para vários leads. Quem já tem follow-up (ou está encerrado) é ignorado.
export function agendarFollowupEmMassa(corpo = {}) {
  const { ids } = corpo;
  if (!Array.isArray(ids) || !ids.length || ids.length > 500 || !ids.every((n) => Number.isInteger(n) && n > 0)) {
    throw new ErroHttp(400, 'Informe os leads');
  }
  const unicos = [...new Set(ids)];
  const data = calcularQuando(corpo);
  const motivo = corpo.motivo ? validarTextoLivre(corpo.motivo, 'motivo', 300) : null;
  const quandoSql = formatarSql(data);
  const quandoTexto = textoQuando(data);
  let agendados = 0;

  transacao(() => {
    for (const id of unicos) {
      const lead = db.prepare('SELECT etapa, proximo_followup FROM leads WHERE id = ?').get(id);
      if (!lead || lead.proximo_followup || ETAPAS_ENCERRADAS.includes(lead.etapa)) continue;
      db.prepare(
        "UPDATE leads SET proximo_followup = ?, followup_tratado_em = COALESCE(followup_tratado_em, datetime('now')), atualizado_em = datetime('now') WHERE id = ?"
      ).run(quandoSql, id);
      adicionarNota(
        id,
        `Follow-up agendado para ${quandoTexto} (em massa)${motivo ? ` — ${motivo}` : ''}`,
        'followup'
      );
      agendados += 1;
    }
  });
  return { agendados, ignorados: unicos.length - agendados };
}

export function concluirFollowup(id) {
  const lead = obter(id);
  if (!lead.proximo_followup) throw new ErroHttp(400, 'Este lead não tem follow-up agendado');
  return transacao(() => {
    db.prepare(
      "UPDATE leads SET proximo_followup = NULL, followup_tratado_em = COALESCE(followup_tratado_em, datetime('now')), atualizado_em = datetime('now') WHERE id = ?"
    ).run(id);
    adicionarNota(id, 'Follow-up feito', 'followup');
    return obter(id);
  });
}

// Atrasados = data anterior a hoje. Hoje = data de hoje (horário do PC).
export function listarFollowups() {
  const marcas = ETAPAS_ENCERRADAS.map(() => '?').join(', ');
  const base = `SELECT ${COLUNAS_CARD} FROM leads WHERE proximo_followup IS NOT NULL AND etapa NOT IN (${marcas})`;
  const atrasados = db
    .prepare(`${base} AND date(proximo_followup, 'localtime') < date('now', 'localtime') ORDER BY proximo_followup`)
    .all(...ETAPAS_ENCERRADAS);
  const hoje = db
    .prepare(`${base} AND date(proximo_followup, 'localtime') = date('now', 'localtime') ORDER BY proximo_followup`)
    .all(...ETAPAS_ENCERRADAS);
  const proximos = db
    .prepare(`${base} AND date(proximo_followup, 'localtime') > date('now', 'localtime') ORDER BY proximo_followup LIMIT 30`)
    .all(...ETAPAS_ENCERRADAS);
  return { atrasados, hoje, proximos };
}

// ---------- Verificação antes de abordar ----------

export function salvarVerificacao(id, itens) {
  const lead = obter(id);
  if (!itens || typeof itens !== 'object' || Array.isArray(itens)) throw new ErroHttp(400, 'Itens inválidos');

  const novo = lerVerificacao(lead);
  for (const chave of Object.keys(itens)) {
    if (!ITENS_VERIFICACAO.includes(chave)) throw new ErroHttp(400, `Item desconhecido: ${chave}`);
    novo[chave] = itens[chave] === true;
  }
  const completo = ITENS_VERIFICACAO.every((k) => novo[k]);

  return transacao(() => {
    // Não mexe em atualizado_em, para o card não pular para o topo da coluna a cada clique.
    db.prepare('UPDATE leads SET verificacao = ?, verificado = ? WHERE id = ?').run(
      JSON.stringify(novo),
      completo ? 1 : 0,
      id
    );
    if (completo && !lead.verificado) adicionarNota(id, 'Verificação completa', 'verificacao');
    return obterComNotas(id);
  });
}

// ---------- Resumo para colar no Claude ----------

const ROTULOS_VERIFICACAO = {
  site_escondido: 'site escondido',
  instagram: 'Instagram',
  horario_fuso: 'horário/fuso no Maps',
  nao_contatar: 'lista de não contatar',
};
const ROTULOS_SITE = {
  nenhum: 'sem site',
  so_rede_social: 'só rede social',
  encurtador: 'link encurtador (não é site de verdade)',
  site: 'tem site',
};

function dataLocal(sqlUtc) {
  if (!sqlUtc) return '';
  return new Date(`${sqlUtc.replace(' ', 'T')}Z`).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function resumoParaClaude(id) {
  const lead = obterComNotas(id);
  const linhas = [`LEAD: ${lead.nome}`];
  const add = (rotulo, valor) => {
    if (valor) linhas.push(`${rotulo}: ${valor}`);
  };

  add('Nicho', [lead.nicho, lead.categoria].filter(Boolean).join(' / '));
  add('Cidade', [lead.cidade, lead.uf].filter(Boolean).join('/'));
  add('Telefone', lead.telefone);
  add('WhatsApp', lead.whatsapp);
  add('Instagram', lead.instagram);
  add('Situação online', ROTULOS_SITE[lead.site_tipo] || lead.site_tipo);
  add('Link do site', lead.site);
  add('Link do Maps', linkMapa(lead));
  add('Dor', lead.dor);
  add('Temperatura', lead.temperatura);
  add('Etapa atual', lead.etapa.replaceAll('_', ' '));
  add('Abordado em', dataLocal(lead.abordado_em));
  add('Follow-up agendado', dataLocal(lead.proximo_followup));

  const pendentes = ITENS_VERIFICACAO.filter((k) => !lead.verificacao[k]).map((k) => ROTULOS_VERIFICACAO[k]);
  add('Verificação pendente', pendentes.join(', '));

  const notas = lead.notas.filter((n) => n.tipo === 'nota').slice(0, 10);
  if (notas.length) {
    linhas.push('', 'NOTAS (mais recentes primeiro):');
    for (const n of notas) linhas.push(`- ${dataLocal(n.criado_em)}: ${n.texto}`);
  }
  const historico = lead.notas.filter((n) => n.tipo !== 'nota').slice(0, 10);
  if (historico.length) {
    linhas.push('', 'HISTÓRICO RECENTE:');
    for (const n of historico) linhas.push(`- ${dataLocal(n.criado_em)}: ${n.texto}`);
  }
  return linhas.join('\n');
}

// ---------- Descartados e não contatar ----------
export function listarDescartados() {
  return db
    .prepare(`SELECT ${COLUNAS_CARD} FROM leads WHERE etapa = ? ORDER BY atualizado_em DESC, id DESC LIMIT 500`)
    .all(ETAPA_DESCARTADO);
}

export function removerNaoContatar(id) {
  const r = db.prepare('DELETE FROM nao_contatar WHERE id = ?').run(id);
  if (r.changes === 0) throw new ErroHttp(404, 'Registro não encontrado');
  return listarNaoContatar();
}
// ---------- Instagram ----------
// Aceita "usuario", "@usuario" ou o link do perfil. Texto vazio remove o Instagram.
function normalizarInstagram(valor) {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') throw new ErroHttp(400, 'Instagram inválido');
  let s = valor.trim();
  if (!s) return null;
  s = s.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '');
  s = s.split(/[/?#]/)[0].replace(/^@/, '');
  if (!/^[A-Za-z0-9._]{1,30}$/.test(s)) {
    throw new ErroHttp(400, 'Usuário de Instagram inválido (use só letras, números, ponto e sublinhado)');
  }
  return s;
}

export function atualizarInstagram(id, valor) {
  const lead = obter(id);
  const novo = normalizarInstagram(valor);
  if ((lead.instagram ?? null) === novo) return obterComNotas(id);

  // Se o "site" do lead era o próprio link do Instagram, ele acompanha a mudança.
  let site = lead.site;
  let siteTipo = lead.site_tipo;
  if (/instagram\.com/i.test(lead.site || '') || (!lead.site && novo)) {
    site = novo ? `https://www.instagram.com/${novo}/` : null;
    siteTipo = novo ? 'so_rede_social' : 'nenhum';
  }

  return transacao(() => {
    db.prepare(
      "UPDATE leads SET instagram = ?, site = ?, site_tipo = ?, atualizado_em = datetime('now') WHERE id = ?"
    ).run(novo, site, siteTipo, id);
    adicionarNota(
      id,
      novo
        ? `Instagram alterado: ${lead.instagram ? `@${lead.instagram}` : 'nenhum'} → @${novo}`
        : `Instagram removido (@${lead.instagram}): perfil não existe`,
      'sistema'
    );
    return obterComNotas(id);
  });
}
// ---------- Follow-up automático (sem resposta após a copy) ----------
// Para testar rápido, troque 24 por 0.02 (cerca de 1 minuto) e volte para 24 depois.
const HORAS_SEM_RESPOSTA = 24;

// Leads que já estavam em "Copy enviada" antes desta função existir (ou entraram por outro caminho):
// usa a data da última mudança de etapa registrada no histórico.
function preencherCopyEnviadaEm() {
  db.prepare(
    `UPDATE leads SET copy_enviada_em = COALESCE(
       (SELECT MAX(criado_em) FROM lead_notas
         WHERE lead_id = leads.id AND tipo = 'etapa' AND texto LIKE ?),
       atualizado_em)
     WHERE etapa = 'copy_enviada' AND copy_enviada_em IS NULL`
  ).run('%→ copy_enviada%');
}

export function agendarFollowupsAutomaticos() {
  preencherCopyEnviadaEm();
  const pendentes = db
    .prepare(
      `SELECT id, copy_enviada_em FROM leads
        WHERE etapa = 'copy_enviada'
          AND proximo_followup IS NULL
          AND followup_tratado_em IS NULL
          AND copy_enviada_em <= datetime('now', ?)`
    )
    .all(`-${HORAS_SEM_RESPOSTA} hours`);
  if (!pendentes.length) return 0;

  const calcularVencimento = db.prepare('SELECT datetime(?, ?) AS d');
  transacao(() => {
    for (const lead of pendentes) {
      const vence = calcularVencimento.get(lead.copy_enviada_em, `+${HORAS_SEM_RESPOSTA} hours`).d;
      db.prepare('UPDATE leads SET proximo_followup = ?, followup_tratado_em = datetime(\'now\') WHERE id = ?').run(
        vence,
        lead.id
      );
      adicionarNota(lead.id, 'Follow-up agendado automaticamente: sem resposta há 24h', 'followup');
    }
  });
  return pendentes.length;
}

let verificadorFollowup = null;

// Roda ao abrir o programa e a cada 5 minutos. Só funciona enquanto o programa estiver aberto.
export function iniciarFollowupAuto() {
  if (verificadorFollowup) return;
  const rodar = () => {
    try {
      const n = agendarFollowupsAutomaticos();
      if (n) console.log(`Follow-up automático: ${n} lead(s) agendado(s)`);
    } catch (e) {
      console.error('Follow-up automático falhou:', e.message);
    }
  };
  rodar();
  verificadorFollowup = setInterval(rodar, 5 * 60_000);
}
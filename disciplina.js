import { db } from './db.js';
import { ErroHttp, data as validarData } from './validar.js';
import { transacao } from './leads.js';

const CLASSES = ['verde', 'amarelo', 'vermelho'];

// ---------- Datas (horário local do PC) ----------
const pad = (n) => String(n).padStart(2, '0');
const dataDe = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hojeLocal = () => dataDe(new Date());

function somarDias(data, n) {
  const [a, m, d] = data.split('-').map(Number);
  return dataDe(new Date(a, m - 1, d + n));
}

export function dataDaRota(valor) {
  const d = validarData(valor, 'data');
  if (!d) throw new ErroHttp(400, 'Informe a data');
  return d;
}

// ---------- Validação ----------
function booleano(valor, campo) {
  if ([true, 1, '1'].includes(valor)) return 1;
  if ([false, 0, '0'].includes(valor)) return 0;
  throw new ErroHttp(400, `Campo "${campo}" deve ser verdadeiro ou falso`);
}

// Mantém as quebras de linha; vazio vira null.
function textoOpcional(valor, campo, max) {
  if (valor === null) return null;
  if (typeof valor !== 'string') throw new ErroHttp(400, `Campo "${campo}" deve ser texto`);
  const s = valor
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .trim();
  if (s === '') return null;
  if (s.length > max) throw new ErroHttp(400, `Campo "${campo}" passa de ${max} caracteres`);
  return s;
}

function naoFuturo(data) {
  if (data > hojeLocal()) throw new ErroHttp(400, 'A data não pode ser no futuro');
}

// ---------- Metas ----------
const numero = (x) => (Number.isInteger(x) ? String(x) : String(x).replace('.', ','));

function rotulo(m) {
  if (m.tipo === 'abordados') return `Abordar ${numero(m.alvo)} leads`;
  if (m.tipo === 'horas') return `Trabalhar pelo menos ${numero(m.alvo)}h`;
  if (m.tipo === 'fechamento') return 'Salvar o fechamento do dia';
  return m.nome;
}

function semearMetas() {
  if (db.prepare('SELECT COUNT(*) AS n FROM metas').get().n > 0) return;
  const inserir = db.prepare('INSERT INTO metas (chave, nome, tipo, alvo, ordem) VALUES (?, ?, ?, ?, ?)');
  transacao(() => {
    inserir.run('abordar', 'Abordar leads', 'abordados', 30, 1);
    inserir.run('horas', 'Horas trabalhadas', 'horas', 4, 2);
    inserir.run('followups', 'Fazer os follow-ups do dia', 'manual', 1, 3);
    inserir.run('video', 'Postar o vídeo diário', 'manual', 1, 4);
    inserir.run('fechamento', 'Salvar o fechamento do dia', 'fechamento', 1, 5);
  });
}
semearMetas();

function formatarMeta(m) {
  return { ...m, rotulo: rotulo(m), automatica: m.tipo !== 'manual', ativa: Boolean(m.ativa) };
}

export function listarMetas() {
  return db.prepare('SELECT * FROM metas ORDER BY ordem, id').all().map(formatarMeta);
}

export function criarMeta(corpo) {
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroHttp(400, 'Envie um objeto JSON');
  }
  const nome = textoOpcional(corpo.nome ?? null, 'nome', 80);
  if (!nome) throw new ErroHttp(400, 'O campo "nome" é obrigatório');
  const ordem = db.prepare('SELECT COALESCE(MAX(ordem), 0) + 1 AS n FROM metas').get().n;
  const chave = `manual-${Date.now().toString(36)}`;
  const r = db
    .prepare("INSERT INTO metas (chave, nome, tipo, alvo, ordem) VALUES (?, ?, 'manual', 1, ?)")
    .run(chave, nome, ordem);
  return formatarMeta(db.prepare('SELECT * FROM metas WHERE id = ?').get(Number(r.lastInsertRowid)));
}

export function atualizarMeta(id, corpo) {
  const m = db.prepare('SELECT * FROM metas WHERE id = ?').get(id);
  if (!m) throw new ErroHttp(404, 'Meta não encontrada');
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroHttp(400, 'Envie um objeto JSON');
  }
  const novo = {};

  if (corpo.alvo !== undefined) {
    if (!['abordados', 'horas'].includes(m.tipo)) throw new ErroHttp(400, 'Esta meta não tem número para ajustar');
    const n = Number(corpo.alvo);
    const max = m.tipo === 'horas' ? 24 : 500;
    if (!Number.isFinite(n) || n <= 0 || n > max || (m.tipo === 'abordados' && !Number.isInteger(n))) {
      throw new ErroHttp(400, `Campo "alvo" deve ser um número maior que 0 e até ${max}`);
    }
    novo.alvo = n;
  }
  if (corpo.ativa !== undefined) novo.ativa = booleano(corpo.ativa, 'ativa');
  if (corpo.nome !== undefined) {
    if (m.tipo !== 'manual') throw new ErroHttp(400, 'Só as metas manuais têm nome editável');
    const nome = textoOpcional(corpo.nome ?? null, 'nome', 80);
    if (!nome) throw new ErroHttp(400, 'O campo "nome" não pode ficar vazio');
    novo.nome = nome;
  }

  const campos = Object.keys(novo); // lista fixa montada acima
  if (campos.length === 0) throw new ErroHttp(400, 'Nenhum campo válido enviado');
  db.prepare(`UPDATE metas SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(
    ...campos.map((c) => novo[c]),
    id
  );
  return formatarMeta(db.prepare('SELECT * FROM metas WHERE id = ?').get(id));
}

// ---------- Avaliação de um dia ----------
function carregarContexto(inicio, fim) {
  const metas = db.prepare('SELECT * FROM metas WHERE ativa = 1 ORDER BY ordem, id').all();
  const fechamentos = new Map(
    db
      .prepare('SELECT data, leads_abordados, horas_trabalhadas FROM fechamentos WHERE data BETWEEN ? AND ?')
      .all(inicio, fim)
      .map((f) => [f.data, f])
  );
  const marcas = new Map();
  for (const m of db.prepare('SELECT data, meta_id FROM metas_marcadas WHERE data BETWEEN ? AND ?').all(inicio, fim)) {
    if (!marcas.has(m.data)) marcas.set(m.data, new Set());
    marcas.get(m.data).add(m.meta_id);
  }
  const dias = new Map(
    db
      .prepare('SELECT * FROM disciplina_dias WHERE data BETWEEN ? AND ?')
      .all(inicio, fim)
      .map((d) => [d.data, d])
  );
  return { metas, fechamentos, marcas, dias };
}

function avaliar(data, ctx) {
  const f = ctx.fechamentos.get(data);
  const d = ctx.dias.get(data);
  const marcadas = ctx.marcas.get(data) ?? new Set();

  const metas = ctx.metas.map((m) => {
    let cumprida;
    let atual = null;
    if (m.tipo === 'abordados') {
      atual = f?.leads_abordados ?? 0;
      cumprida = atual >= m.alvo;
    } else if (m.tipo === 'horas') {
      atual = f?.horas_trabalhadas ?? 0;
      cumprida = atual >= m.alvo;
    } else if (m.tipo === 'fechamento') {
      cumprida = Boolean(f);
    } else {
      cumprida = marcadas.has(m.id);
    }
    return {
      id: m.id,
      rotulo: rotulo(m),
      tipo: m.tipo,
      automatica: m.tipo !== 'manual',
      alvo: m.alvo,
      atual,
      cumprida,
    };
  });

  const total = metas.length;
  const cumpridas = metas.filter((m) => m.cumprida).length;
  const percentual = total > 0 ? Math.round((cumpridas / total) * 100) : 0;
  const temRegistro = Boolean(f) || marcadas.size > 0 || Boolean(d);
  const folga = Boolean(d?.folga);

  let classeAuto = 'vazio';
  if (temRegistro && total > 0) classeAuto = percentual >= 100 ? 'verde' : percentual >= 60 ? 'amarelo' : 'vermelho';
  const classeManual = d?.classe_manual ?? null;

  return {
    data,
    folga,
    tem_registro: temRegistro,
    metas,
    cumpridas,
    total,
    percentual,
    classe_auto: classeAuto,
    classe_manual: classeManual,
    classe: folga ? 'folga' : (classeManual ?? classeAuto),
    feitos: d?.feitos ?? null,
    outros: d?.outros ?? null,
  };
}

export function obterDia(data) {
  return avaliar(data, carregarContexto(data, data));
}

export function salvarDia(data, corpo) {
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroHttp(400, 'Envie um objeto JSON');
  }
  naoFuturo(data);

  const atual = db.prepare('SELECT * FROM disciplina_dias WHERE data = ?').get(data);
  const novo = {
    folga: atual?.folga ?? 0,
    feitos: atual?.feitos ?? null,
    outros: atual?.outros ?? null,
    classe_manual: atual?.classe_manual ?? null,
  };
  let mexeu = false;

  if (corpo.folga !== undefined) {
    novo.folga = booleano(corpo.folga, 'folga');
    mexeu = true;
  }
  if (corpo.feitos !== undefined) {
    novo.feitos = textoOpcional(corpo.feitos ?? null, 'feitos', 2000);
    mexeu = true;
  }
  if (corpo.outros !== undefined) {
    novo.outros = textoOpcional(corpo.outros ?? null, 'outros', 2000);
    mexeu = true;
  }
  if (corpo.classe_manual !== undefined) {
    if (corpo.classe_manual === null || corpo.classe_manual === '') novo.classe_manual = null;
    else if (CLASSES.includes(corpo.classe_manual)) novo.classe_manual = corpo.classe_manual;
    else throw new ErroHttp(400, `Campo "classe_manual" deve ser: ${CLASSES.join(', ')} ou vazio`);
    mexeu = true;
  }
  if (!mexeu) throw new ErroHttp(400, 'Nenhum campo válido enviado');

  if (!novo.folga && !novo.feitos && !novo.outros && !novo.classe_manual) {
    // Nada sobrou para guardar: o dia volta a não ter registro.
    db.prepare('DELETE FROM disciplina_dias WHERE data = ?').run(data);
  } else {
    db.prepare(
      `INSERT INTO disciplina_dias (data, folga, feitos, outros, classe_manual) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (data) DO UPDATE SET
         folga = excluded.folga, feitos = excluded.feitos, outros = excluded.outros,
         classe_manual = excluded.classe_manual, atualizado_em = datetime('now')`
    ).run(data, novo.folga, novo.feitos, novo.outros, novo.classe_manual);
  }
  return obterDia(data);
}

// Marca ou desmarca uma meta manual naquele dia.
export function marcarMeta(data, metaId, feito) {
  naoFuturo(data);
  const meta = db.prepare('SELECT * FROM metas WHERE id = ?').get(metaId);
  if (!meta) throw new ErroHttp(404, 'Meta não encontrada');
  if (meta.tipo !== 'manual') throw new ErroHttp(400, 'Esta meta é marcada sozinha, a partir do fechamento do dia');

  if (booleano(feito, 'feito')) {
    db.prepare('INSERT OR IGNORE INTO metas_marcadas (data, meta_id) VALUES (?, ?)').run(data, metaId);
  } else {
    db.prepare('DELETE FROM metas_marcadas WHERE data = ? AND meta_id = ?').run(data, metaId);
  }
  return obterDia(data);
}

// ---------- Calendário do ano ----------
export function calendario(anoBruto) {
  const ano = anoBruto === undefined ? new Date().getFullYear() : Number(anoBruto);
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw new ErroHttp(400, 'Ano inválido');

  const inicio = `${ano}-01-01`;
  const fim = `${ano}-12-31`;
  const ctx = carregarContexto(inicio, fim);
  const hoje = hojeLocal();

  const dias = [];
  for (let data = inicio; data <= fim; data = somarDias(data, 1)) {
    const r = avaliar(data, ctx);
    dias.push({ data, classe: data > hoje ? 'futuro' : r.classe, cumpridas: r.cumpridas, total: r.total });
  }
  return { ano, hoje, dias };
}

// ---------- Resumo da semana ou do mês (para o gráfico de rosca) ----------
export function resumo(periodo) {
  const hoje = hojeLocal();
  let inicio;
  if (periodo === 'semana') inicio = somarDias(hoje, -6);
  else if (periodo === 'mes') inicio = `${hoje.slice(0, 7)}-01`;
  else throw new ErroHttp(400, 'Período deve ser "semana" ou "mes"');

  const ctx = carregarContexto(inicio, hoje);
  const dias = { verde: 0, amarelo: 0, vermelho: 0, folga: 0, vazio: 0 };
  const porMeta = new Map();
  let cumpridas = 0;
  let naoCumpridas = 0;

  for (let data = inicio; data <= hoje; data = somarDias(data, 1)) {
    const r = avaliar(data, ctx);
    dias[r.classe]++;
    if (r.classe === 'folga' || !r.tem_registro) continue;
    for (const m of r.metas) {
      const item = porMeta.get(m.id) ?? { rotulo: m.rotulo, cumpridas: 0, dias: 0 };
      item.dias++;
      if (m.cumprida) {
        item.cumpridas++;
        cumpridas++;
      } else {
        naoCumpridas++;
      }
      porMeta.set(m.id, item);
    }
  }

  return {
    periodo,
    inicio,
    fim: hoje,
    dias,
    metas: { cumpridas, nao_cumpridas: naoCumpridas },
    por_meta: [...porMeta.values()],
  };
}
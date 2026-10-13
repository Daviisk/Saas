import { db } from './db.js';
import { ETAPAS, ETAPA_DESCARTADO, ETAPAS_ENCERRADAS } from './constants.js';

// "dias atrás" no horário local do PC, no formato AAAA-MM-DD.
function dataLocal(diasAtras = 0) {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const consultaTotais = db.prepare(`
  SELECT COUNT(*) AS dias,
         COALESCE(SUM(leads_buscados), 0)   AS buscados,
         COALESCE(SUM(leads_separados), 0)  AS separados,
         COALESCE(SUM(leads_abordados), 0)  AS abordados,
         COALESCE(SUM(respostas), 0)        AS respostas,
         COALESCE(SUM(projetos_aceitos), 0) AS projetos,
         COALESCE(SUM(valor_ganho_cent), 0) AS valor_cent,
         COALESCE(SUM(horas_trabalhadas), 0) AS horas
  FROM fechamentos WHERE data BETWEEN ? AND ?`);

const consultaDias = db.prepare(`
  SELECT data, leads_buscados, leads_separados, leads_abordados, respostas,
         projetos_aceitos, valor_ganho_cent, horas_trabalhadas
  FROM fechamentos WHERE data BETWEEN ? AND ?`);

const razao = (a, b) => (b > 0 ? a / b : null);

function totais(inicio, fim) {
  const t = consultaTotais.get(inicio, fim);
  const valor = t.valor_cent / 100;
  return {
    inicio,
    fim,
    dias_registrados: t.dias,
    buscados: t.buscados,
    separados: t.separados,
    abordados: t.abordados,
    respostas: t.respostas,
    projetos: t.projetos,
    valor,
    horas: t.horas,
    taxa_resposta: razao(t.respostas, t.abordados),
    taxa_fechamento: razao(t.projetos, t.respostas),
    ticket_medio: razao(valor, t.projetos),
    valor_por_hora: razao(valor, t.horas),
  };
}

// Os últimos N dias contra os N dias anteriores a eles.
function comparar(dias) {
  return {
    atual: totais(dataLocal(dias - 1), dataLocal(0)),
    anterior: totais(dataLocal(dias * 2 - 1), dataLocal(dias)),
  };
}

// Um ponto por dia, com zero nos dias sem fechamento.
function serie(dias) {
  const porData = new Map(consultaDias.all(dataLocal(dias - 1), dataLocal(0)).map((l) => [l.data, l]));
  return Array.from({ length: dias }, (_, i) => {
    const data = dataLocal(dias - 1 - i);
    const l = porData.get(data);
    return {
      data,
      registrado: Boolean(l),
      buscados: l?.leads_buscados ?? 0,
      separados: l?.leads_separados ?? 0,
      abordados: l?.leads_abordados ?? 0,
      respostas: l?.respostas ?? 0,
      projetos: l?.projetos_aceitos ?? 0,
      valor: (l?.valor_ganho_cent ?? 0) / 100,
      horas: l?.horas_trabalhadas ?? 0,
    };
  });
}

// Quantos leads há hoje em cada etapa do CRM.
function funil() {
  const linhas = db.prepare('SELECT etapa, COUNT(*) AS n FROM leads GROUP BY etapa').all();
  const mapa = new Map(linhas.map((l) => [l.etapa, l.n]));
  return [...ETAPAS, ETAPA_DESCARTADO].map((etapa) => ({ etapa, total: mapa.get(etapa) ?? 0 }));
}

// Leads que estão no CRM agora (tudo, menos os descartados).
function leadsNoCrm() {
  return db.prepare('SELECT COUNT(*) AS n FROM leads WHERE etapa != ?').get(ETAPA_DESCARTADO).n;
}

// Situação dos follow-ups: atrasados, de hoje e futuros (agora) e feitos (por período).
function followups() {
  const marcas = ETAPAS_ENCERRADAS.map(() => '?').join(', ');
  const base = `FROM leads WHERE proximo_followup IS NOT NULL AND etapa NOT IN (${marcas})`;
  const contar = (condicao) =>
    db.prepare(`SELECT COUNT(*) AS n ${base} AND ${condicao}`).get(...ETAPAS_ENCERRADAS).n;
  const feitos = (dias) =>
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM lead_notas
          WHERE tipo = 'followup' AND texto = 'Follow-up feito'
            AND date(criado_em, 'localtime') BETWEEN ? AND ?`
      )
      .get(dataLocal(dias - 1), dataLocal(0)).n;

  return {
    atrasados: contar("date(proximo_followup, 'localtime') < date('now', 'localtime')"),
    hoje: contar("date(proximo_followup, 'localtime') = date('now', 'localtime')"),
    agendados: contar("date(proximo_followup, 'localtime') > date('now', 'localtime')"),
    feitos: { hoje: feitos(1), semana: feitos(7), mes: feitos(30) },
  };
}

// Conversão entre etapas: cada lead conta na etapa mais avançada que já alcançou
// (pelo histórico de mudanças), mesmo que depois tenha sido perdido ou descartado.
const ORDEM_FUNIL = ['lead_do_dia', 'qualificado', 'copy_enviada', 'em_negociacao', 'proposta_enviada', 'fechado'];

function conversao() {
  const maisAvancada = new Map();
  const mudancas = db.prepare("SELECT lead_id, texto FROM lead_notas WHERE tipo = 'etapa'").all();
  for (const { lead_id, texto } of mudancas) {
    const destino = /→ ([a-z_]+)/.exec(texto)?.[1];
    const indice = ORDEM_FUNIL.indexOf(destino);
    if (indice > (maisAvancada.get(lead_id) ?? -1)) maisAvancada.set(lead_id, indice);
  }

  const alcancou = ORDEM_FUNIL.map(() => 0);
  for (const lead of db.prepare('SELECT id, etapa FROM leads').all()) {
    const indice = Math.max(0, ORDEM_FUNIL.indexOf(lead.etapa), maisAvancada.get(lead.id) ?? -1);
    for (let i = 0; i <= indice; i += 1) alcancou[i] += 1;
  }
  return ORDEM_FUNIL.map((etapa, i) => ({ etapa, alcancou: alcancou[i] }));
}

export function painel() {
  const hoje = dataLocal(0);
  return {
    data: hoje,
    hoje_registrado: Boolean(db.prepare('SELECT 1 FROM fechamentos WHERE data = ?').get(hoje)),
    hoje: comparar(1),
    semana: comparar(7),
    mes: comparar(30),
    serie: serie(30),
    funil: funil(),
    leads_crm: leadsNoCrm(),
    followups: followups(),
    conversao: conversao(),
  };
}
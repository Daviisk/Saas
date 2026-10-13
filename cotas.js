import { db } from './db.js';
import { config } from './config.js';

// Trava mensal: ao chegar em 90% da cota do mês, o provedor fica bloqueado
// até virar o mês. Não existe botão pra liberar, de propósito.
export const FATOR_TRAVA_MES = 0.9;
// A partir de 70% de uso (dia ou mês) o provedor entra em "atenção".
export const FATOR_AVISO = 0.7;

// Limites REAIS do plano grátis de cada provedor (do seu guia).
// A trava de 90% é aplicada em cima desses números pelo código.
export const PROVEDORES = {
  // OSM: sem limite de volume, só a regra de 1 requisição por segundo
  // (isso o código da busca respeita). O limite diário abaixo é só um teto meu,
  // para não abusar do servidor público e ser banido.
  overpass: { nome: 'OpenStreetMap (Overpass)', chave: null, limiteDia: 300, limiteMes: null },
  geoapify: { nome: 'Geoapify', chave: 'geoapify', limiteDia: 3000, limiteMes: null },
  tomtom: { nome: 'TomTom', chave: 'tomtom', limiteDia: 2500, limiteMes: null },
  // HERE: a cota é mensal (30.000). O limite diário é um teto meu (30.000 / 30 dias)
  // para a cota não acabar nos primeiros dias do mês.
  here: { nome: 'HERE', chave: 'here', limiteDia: 1000, limiteMes: 30000 },
};

function hoje() {
  return new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD, no horário do seu PC
}

function mesAtual() {
  return hoje().slice(0, 7); // AAAA-MM
}

function lerUso(provedor, periodo) {
  const linha = db
    .prepare('SELECT usado FROM cotas_uso WHERE provedor = ? AND periodo = ?')
    .get(provedor, periodo);
  return linha ? linha.usado : 0;
}

function obterProvedor(provedor) {
  const p = PROVEDORES[provedor];
  if (!p) {
    throw Object.assign(new Error('Provedor desconhecido'), { status: 404 });
  }
  return p;
}

export function status(provedor) {
  const p = obterProvedor(provedor);
  const usadoDia = lerUso(provedor, hoje());
  const usadoMes = lerUso(provedor, mesAtual());
  const temChave = p.chave === null || Boolean(config.chaves[p.chave]);
  const travaMes = p.limiteMes ? Math.floor(p.limiteMes * FATOR_TRAVA_MES) : null;

  let motivo = null;
  if (!temChave) motivo = 'sem_chave';
  else if (usadoDia >= Math.floor(p.limiteDia * FATOR_TRAVA_MES)) motivo = 'limite_diario';
  else if (travaMes !== null && usadoMes >= travaMes) motivo = 'trava_mensal';

  const pctDia = usadoDia / p.limiteDia;
  const pctMes = p.limiteMes ? usadoMes / p.limiteMes : 0;

  let nivel = 'ok';
  if (motivo === 'sem_chave') nivel = 'sem_chave';
  else if (motivo) nivel = 'bloqueado';
  else if (Math.max(pctDia, pctMes) >= FATOR_AVISO) nivel = 'atencao';

  return {
    provedor,
    nome: p.nome,
    disponivel: motivo === null,
    motivo,
    nivel,
    dia: { usado: usadoDia, limite: p.limiteDia },
    mes: { usado: usadoMes, limite: p.limiteMes, trava: travaMes },
  };
}

export function statusTodos() {
  return Object.keys(PROVEDORES).map(status);
}

export function podeUsar(provedor) {
  return status(provedor).disponivel;
}

// Chamar depois de cada requisição feita ao provedor.
export function registrarUso(provedor, quantidade = 1) {
  obterProvedor(provedor);
  const sql = `
    INSERT INTO cotas_uso (provedor, periodo, usado) VALUES (?, ?, ?)
    ON CONFLICT (provedor, periodo) DO UPDATE SET usado = usado + excluded.usado`;
  const inserir = db.prepare(sql);
  inserir.run(provedor, hoje(), quantidade);
  inserir.run(provedor, mesAtual(), quantidade);
}
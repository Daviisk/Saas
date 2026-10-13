import { db } from './db.js';
import { ErroHttp } from './validar.js';
import { CATEGORIAS_GASTO, ETAPAS_PROJETO } from './constants.js';

const BOM = '\uFEFF'; // faz o Excel entender os acentos

const NOME_ETAPA = {
  lead_do_dia: 'Lead do dia',
  qualificado: 'Qualificado',
  copy_enviada: 'Copy enviada',
  em_negociacao: 'Em negociação',
  proposta_enviada: 'Proposta enviada',
  fechado: 'Fechado',
  perdido: 'Perdido',
  descartado: 'Descartado',
};
const NOME_SITE = {
  nenhum: 'Sem site',
  so_rede_social: 'Só rede social',
  encurtador: 'Link único',
  site: 'Tem site',
};
const NOME_SITUACAO = { ...NOME_SITE };
const NOME_CATEGORIA = Object.fromEntries(CATEGORIAS_GASTO);
const NOME_ETAPA_PROJETO = Object.fromEntries(ETAPAS_PROJETO);

const pad = (n) => String(n).padStart(2, '0');
function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 5567999990000 -> (67) 99999-0000 (assim o Excel não vira número científico).
function formatarTelefone(valor) {
  if (!valor) return null;
  const d = String(valor).replace(/\D/g, '');
  const local = d.startsWith('55') && (d.length === 12 || d.length === 13) ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return d;
}

// Separador ";" (Excel em português). Textos que começam com = + - @ ganham um apóstrofo,
// para uma planilha nunca executar um "nome" malicioso como fórmula.
function celula(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return String(valor).replace('.', ',');
  let s = String(valor).replace(/\r\n/g, '\n');
  if (/^[\s]*[=+\-@]|^[\t\r]/.test(s)) s = `'${s}`;
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function montarCsv(colunas, linhas) {
  const cabecalho = colunas.map(([titulo]) => celula(titulo)).join(';');
  const corpo = linhas.map((l) => colunas.map(([, valor]) => celula(valor(l))).join(';'));
  return `${BOM}${[cabecalho, ...corpo].join('\r\n')}\r\n`;
}

const TIPOS = {
  leads: {
    consulta: 'SELECT * FROM leads ORDER BY id',
    colunas: [
      ['ID', (l) => l.id],
      ['Nome', (l) => l.nome],
      ['Nicho', (l) => l.nicho],
      ['Categoria', (l) => l.categoria],
      ['Etapa', (l) => NOME_ETAPA[l.etapa] ?? l.etapa],
      ['Temperatura', (l) => l.temperatura],
      ['Pontuação', (l) => l.pontuacao],
      ['Telefone', (l) => formatarTelefone(l.telefone)],
      ['WhatsApp', (l) => formatarTelefone(l.whatsapp)],
      ['Instagram', (l) => l.instagram],
      ['Site', (l) => l.site],
      ['Tipo de site', (l) => NOME_SITE[l.site_tipo] ?? l.site_tipo],
      ['Endereço', (l) => l.endereco],
      ['Cidade', (l) => l.cidade],
      ['UF', (l) => l.uf],
      ['Mapa', (l) => l.maps_url],
      ['Fonte', (l) => l.fonte],
      ['Próximo follow-up', (l) => l.proximo_followup],
      ['Abordado em (UTC)', (l) => l.abordado_em],
      ['Criado em (UTC)', (l) => l.criado_em],
      ['Motivo da perda', (l) => l.motivo_perda],
      ['Motivo do descarte', (l) => l.motivo_descarte],
    ],
  },
  fechamentos: {
    consulta: 'SELECT * FROM fechamentos ORDER BY data',
    colunas: [
      ['Data', (f) => f.data],
      ['Leads buscados', (f) => f.leads_buscados],
      ['Leads separados', (f) => f.leads_separados],
      ['Leads abordados', (f) => f.leads_abordados],
      ['Respostas', (f) => f.respostas],
      ['Projetos aceitos', (f) => f.projetos_aceitos],
      ['Valor ganho (R$)', (f) => f.valor_ganho_cent / 100],
      ['Forma de pagamento', (f) => f.metodo_pagamento],
      ['Horas trabalhadas', (f) => f.horas_trabalhadas],
      ['Observações', (f) => f.observacoes],
    ],
  },
  copies: {
    consulta: 'SELECT * FROM copies ORDER BY nicho, id',
    colunas: [
      ['Nicho', (c) => c.nicho],
      ['Título', (c) => c.titulo],
      ['Situação do lead', (c) => NOME_SITUACAO[c.dor] ?? c.dor],
      ['Nova', (c) => (c.nova ? 'Sim' : 'Não')],
      ['Texto', (c) => c.texto],
    ],
  },
  gastos: {
    consulta: 'SELECT * FROM gastos ORDER BY data, id',
    colunas: [
      ['Data', (g) => g.data],
      ['Valor (R$)', (g) => g.valor_cent / 100],
      ['Categoria', (g) => NOME_CATEGORIA[g.categoria] ?? g.categoria],
      ['Descrição', (g) => g.descricao],
    ],
  },
  projetos: {
    consulta: 'SELECT * FROM projetos ORDER BY id',
    colunas: [
      ['ID', (p) => p.id],
      ['Nome', (p) => p.nome],
      ['Nicho', (p) => p.nicho],
      ['Etapa', (p) => NOME_ETAPA_PROJETO[p.etapa] ?? p.etapa],
      ['Valor total (R$)', (p) => p.valor_cent / 100],
      ['Recebido (R$)', (p) => p.recebido_cent / 100],
      ['Falta receber (R$)', (p) => Math.max(p.valor_cent - p.recebido_cent, 0) / 100],
      ['Prazo', (p) => p.prazo],
      ['Entregue em (UTC)', (p) => p.entregue_em],
      ['Observações', (p) => p.observacoes],
      ['Criado em (UTC)', (p) => p.criado_em],
    ],
  },
};

export function exportar(tipo) {
  const t = TIPOS[tipo];
  if (!t) throw new ErroHttp(404, 'Tipo de exportação inválido');
  return {
    nome: `${tipo}-${hojeLocal()}.csv`,
    conteudo: montarCsv(t.colunas, db.prepare(t.consulta).all()),
  };
}
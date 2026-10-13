import { TIPOS_SITE, TEMPERATURAS } from './constants.js';

export class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

// Remove caracteres de controle e espaços nas pontas. Vazio vira null.
function texto(valor, campo, max) {
  if (valor === null) return null;
  if (typeof valor !== 'string' && typeof valor !== 'number') {
    throw new ErroHttp(400, `Campo "${campo}" deve ser texto`);
  }
  const s = String(valor).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (s === '') return null;
  if (s.length > max) throw new ErroHttp(400, `Campo "${campo}" passa de ${max} caracteres`);
  return s;
}

// Só aceita http(s). Isso impede links "javascript:..." de virarem XSS quando o card exibir o link.
function url(valor, campo) {
  let s = texto(valor, campo, 500);
  if (s === null) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  let u;
  try {
    u = new URL(s);
  } catch {
    throw new ErroHttp(400, `Campo "${campo}" não é um link válido`);
  }
  if (!['http:', 'https:'].includes(u.protocol)) {
    throw new ErroHttp(400, `Campo "${campo}" precisa ser um link http ou https`);
  }
  return u.href;
}

export function normalizarTelefone(valor, campo = 'telefone') {
  const s = texto(valor, campo, 40);
  if (s === null) return null;
  let d = s.replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!/^55\d{10,11}$/.test(d)) {
    throw new ErroHttp(400, `Campo "${campo}" inválido (use DDD + número)`);
  }
  return d;
}

function instagram(valor, campo) {
  let s = texto(valor, campo, 200);
  if (s === null) return null;
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@/, '');
  if (!/^[A-Za-z0-9._]{1,30}$/.test(s)) throw new ErroHttp(400, `Campo "${campo}" inválido`);
  return s;
}

const uf = (valor, campo) => {
  const s = texto(valor, campo, 2);
  if (s === null) return null;
  if (!/^[A-Za-z]{2}$/.test(s)) throw new ErroHttp(400, `Campo "${campo}" deve ter 2 letras`);
  return s.toUpperCase();
};

const opcao = (lista) => (valor, campo) => {
  if (valor === null) return null;
  if (!lista.includes(valor)) throw new ErroHttp(400, `Campo "${campo}" deve ser: ${lista.join(', ')}`);
  return valor;
};

const numero = (min, max, inteiro) => (valor, campo) => {
  if (valor === null) return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n < min || n > max || (inteiro && !Number.isInteger(n))) {
    throw new ErroHttp(400, `Campo "${campo}" deve ser um número entre ${min} e ${max}`);
  }
  return n;
};

const booleano = (valor, campo) => {
  if (valor === true || valor === 1 || valor === '1') return 1;
  if (valor === false || valor === 0 || valor === '0') return 0;
  throw new ErroHttp(400, `Campo "${campo}" deve ser verdadeiro ou falso`);
};

export function data(valor, campo) {
  const s = texto(valor, campo, 10);
  if (s === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`)) || new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) !== s) {
    throw new ErroHttp(400, `Campo "${campo}" deve estar no formato AAAA-MM-DD`);
  }
  return s;
}

// Lista branca: só estes campos entram no banco. Qualquer outro enviado é ignorado.
const REGRAS = {
  nome: (v, c) => texto(v, c, 120),
  nicho: (v, c) => texto(v, c, 80),
  categoria: (v, c) => texto(v, c, 80),
  telefone: (v, c) => normalizarTelefone(v, c),
  whatsapp: (v, c) => normalizarTelefone(v, c),
  instagram,
  site: url,
  site_tipo: opcao(TIPOS_SITE),
  endereco: (v, c) => texto(v, c, 250),
  cidade: (v, c) => texto(v, c, 80),
  uf,
  maps_url: url,
  nota: numero(0, 5, false),
  pontuacao: numero(0, 100, true),
  temperatura: opcao(TEMPERATURAS),
  dor: (v, c) => texto(v, c, 500),
  fonte: (v, c) => texto(v, c, 40),
  fonte_id: (v, c) => texto(v, c, 120),
  verificado: booleano,
  proximo_followup: data,
};

export function validarLead(corpo, { parcial = false } = {}) {
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroHttp(400, 'Envie um objeto JSON');
  }
  const saida = {};
  for (const [campo, regra] of Object.entries(REGRAS)) {
    if (corpo[campo] === undefined) continue;
    const valor = campo === 'verificado' ? corpo[campo] : (corpo[campo] ?? null);
    saida[campo] = regra(valor, campo);
  }
  if (!parcial && !saida.nome) throw new ErroHttp(400, 'O campo "nome" é obrigatório');
  if (parcial && 'nome' in saida && !saida.nome) throw new ErroHttp(400, 'O campo "nome" não pode ficar vazio');
  if (Object.keys(saida).length === 0) throw new ErroHttp(400, 'Nenhum campo válido enviado');
  return saida;
}

export function validarTextoLivre(valor, campo, max = 2000) {
  const s = texto(valor ?? null, campo, max);
  if (s === null) throw new ErroHttp(400, `O campo "${campo}" é obrigatório`);
  return s;
}

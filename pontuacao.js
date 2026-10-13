import { buscarNicho } from './nichos.js';

// Pontos por tipo de site: quem não tem site é o melhor alvo.
const PONTOS_SITE = { nenhum: 50, encurtador: 45, so_rede_social: 40, site: 0 };
const PONTOS_CELULAR = 25; // celular = provável WhatsApp
const PONTOS_FIXO = 10;
const PONTOS_INSTAGRAM = 10; // já investe em divulgação online
const PONTOS_ENDERECO = 5;
const PONTOS_NOTA_BOA = 10; // nota 4.0 ou mais (quando o provedor trouxer nota)
const LIMITE_QUENTE = 70; // a partir daqui o lead é "quente"

const DORES = {
  nenhum: 'Sem site nem presença oficial na internet',
  so_rede_social: 'Só tem rede social, sem site oficial',
  encurtador: 'Usa só link de agendamento ou encurtador, sem site próprio',
  site: 'Já tem site (avalie se está desatualizado, lento ou pouco útil para gerar contato)',
};

// Aceita "+55 67 9 9143 3848", "(67) 3201-8653", "+5567991327889" etc.
function normalizarUm(bruto) {
  let d = String(bruto).replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  return { numero: `+55${d}`, celular: d.length === 11 && d[2] === '9' };
}

// O OSM às vezes traz vários números separados por ";". Prefere o celular.
export function normalizarTelefone(bruto) {
  if (!bruto) return { telefone: null, whatsapp: null, celular: false };
  const lista = String(bruto)
    .split(/[;,]/)
    .map(normalizarUm)
    .filter(Boolean);
  if (lista.length === 0) return { telefone: null, whatsapp: null, celular: false };
  const escolhido = lista.find((t) => t.celular) || lista[0];
  return {
    telefone: escolhido.numero,
    whatsapp: escolhido.celular ? escolhido.numero : null,
    celular: escolhido.celular,
  };
}

function extrairInstagram(site) {
  if (!site) return null;
  const m = String(site).match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (!m) return null;
  if (['p', 'reel', 'reels', 'explore', 'stories'].includes(m[1].toLowerCase())) return null;
  return `https://www.instagram.com/${m[1]}/`;
}

// Recebe o lead cru do provedor e devolve pronto para o CRM.
export function enriquecer(lead, nichoChave, cidade, uf) {
  const nicho = buscarNicho(nichoChave);
  const tel = normalizarTelefone(lead.telefone);
  const instagram = extrairInstagram(lead.site);

  let pontuacao = PONTOS_SITE[lead.site_tipo] ?? 0;
  pontuacao += tel.celular ? PONTOS_CELULAR : tel.telefone ? PONTOS_FIXO : 0;
  if (instagram) pontuacao += PONTOS_INSTAGRAM;
  if (lead.endereco) pontuacao += PONTOS_ENDERECO;
  if (lead.nota && lead.nota >= 4.0) pontuacao += PONTOS_NOTA_BOA;

  return {
    ...lead,
    telefone: tel.telefone,
    whatsapp: tel.whatsapp,
    instagram,
    nicho: nicho ? nicho.nome : nichoChave,
    categoria: nicho ? nicho.categoriaNome : null,
    cidade,
    uf: String(uf).toUpperCase(),
    pontuacao,
    temperatura: pontuacao >= LIMITE_QUENTE ? 'quente' : 'frio',
    dor: DORES[lead.site_tipo] || null,
  };
}
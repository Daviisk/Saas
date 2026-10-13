import { registrarUso, podeUsar } from '../cotas.js';
import { NICHOS } from '../nichos.js';

const PROVEDOR = 'overpass';
const SERVIDORES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const USER_AGENT = 'LeadsApp/1.0 (uso pessoal)';

// Espera mínima entre requisições (1,2 s = respeita a regra de 1 req/s do OSM).
const PAUSA_MS = 1200;

function pausar(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// Nome do estado no OSM a partir da sigla.
const ESTADOS = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
  PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia',
  RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe',
  TO: 'Tocantins',
};

// Monta a query Overpass para um nicho em uma cidade/UF.
function montarQuery(nicho, cidade, uf) {
  const n = NICHOS.find((x) => x.chave === nicho);
  const estado = ESTADOS[String(uf).toUpperCase()];
    if (/["\\]/.test(cidade)) return null;
  if (!n || n.osm.length === 0 || !estado) return null;

  const filtros = n.osm
    .map((tag) => {
      const [k, v] = tag.split('=');
      return `
  nwr["${k}"="${v}"](area.cidade);`;
    })
    .join('');

  return `
[out:json][timeout:60];
area["name"="${estado}"]["boundary"="administrative"]["admin_level"="4"]->.estado;
rel["name"="${cidade}"]["boundary"="administrative"]["admin_level"="8"](area.estado);
map_to_area->.cidade;
(${filtros}
);
out center tags;`;
}

// Converte um elemento OSM em objeto de lead parcial.
function parsearElemento(el) {
  const t = el.tags || {};
  const telefone = t.phone || t['contact:phone'] || t['contact:mobile'] || null;
  const siteTag = t.website || t['contact:website'] || null;
  // Muitos negócios só têm o Instagram cadastrado no mapa (tag contact:instagram).
  const instaTag = String(t['contact:instagram'] || '').trim();
  let instaUrl = null;
  if (/^https?:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]+/i.test(instaTag)) instaUrl = instaTag;
  else if (/^@?[A-Za-z0-9._]{1,30}$/.test(instaTag)) instaUrl = `https://www.instagram.com/${instaTag.replace(/^@/, '')}/`;
  const site = siteTag || instaUrl;

  // Detecta tipo do site (links de redes sociais e encurtadores não são sites reais).
  let site_tipo = 'nenhum';
  if (site) {
    if (/instagram\.com|facebook\.com|linktr\.ee/i.test(site)) site_tipo = 'so_rede_social';
    else if (/bit\.ly|goo\.gl|tinyurl|tuaagenda|wa\.me|api\.whatsapp|beacons\.ai|taplink/i.test(site)) site_tipo = 'encurtador';
    else site_tipo = 'site';
  }

  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  const maps_url = lat && lon
    ? `https://www.google.com/maps?q=${lat},${lon}`
    : null;

  return {
    nome: t.name || null,
    telefone,
    site,
    site_tipo,
    endereco: t['addr:street']
      ? `${t['addr:street']}${t['addr:housenumber'] ? ', ' + t['addr:housenumber'] : ''}`
      : null,
    maps_url,
    fonte: PROVEDOR,
    fonte_id: String(el.id),
  };
}

// Busca leads de um nicho em uma cidade.
// Retorna array de objetos parciais de lead (sem pontuação ainda).
export async function buscarOverpass(nicho, cidade, uf) {
  if (!podeUsar(PROVEDOR)) {
    return { erro: 'cota_esgotada', leads: [] };
  }

  const query = montarQuery(nicho, cidade, uf);
  if (!query) {
    // Nicho sem tags OSM: o Overpass não cobre, pula para o próximo provedor.
    return { erro: 'nicho_sem_suporte', leads: [] };
  }

  await pausar(PAUSA_MS);

  let resposta = null;
  let ultimoErro = 'erro_rede';
  for (const servidor of SERVIDORES) {
    try {
      resposta = await fetch(servidor, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(70000),
      });
    } catch (e) {
      console.error('[overpass] erro de rede em', servidor, e.message);
      ultimoErro = 'erro_rede';
      resposta = null;
      continue;
    }
    // 429 e 5xx = servidor sobrecarregado: tenta o próximo.
    if (resposta.status === 429 || resposta.status >= 500) {
      console.error('[overpass] HTTP', resposta.status, 'em', servidor);
      ultimoErro = `http_${resposta.status}`;
      resposta = null;
      continue;
    }
    break;
  }

  registrarUso(PROVEDOR, 1);

  if (!resposta) return { erro: ultimoErro, leads: [] };

  if (!resposta.ok) {
    console.error('[overpass] HTTP', resposta.status);
    return { erro: `http_${resposta.status}`, leads: [] };
  }

  let json;
  try {
    json = await resposta.json();
  } catch {
    return { erro: 'resposta_invalida', leads: [] };
  }

  const elementos = json.elements || [];
  // Só inclui quem tem nome; sem nome não tem como abordar.
  const todos = elementos.map(parsearElemento).filter((l) => l.nome);
  // Dá para abordar se tiver telefone OU Instagram. Sem nenhum dos dois, fica de fora.
  const temInstagram = (l) => /instagram\.com\/[A-Za-z0-9._]+/i.test(l.site || '');
  const leads = todos.filter((l) => l.telefone || temInstagram(l));

  return { erro: null, leads, semContato: todos.length - leads.length };
  }
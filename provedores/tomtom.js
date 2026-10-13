import { config } from '../config.js';
import { podeUsar, registrarUso } from '../cotas.js';
import { buscarNicho } from '../nichos.js';
import { localizarCidade } from '../geocoder.js';
import { classificarSite, garantirHttps, semAcento } from './comum.js';
import { TERMOS_EXTRA } from './termos-tomtom.js';

const PROVEDOR = 'tomtom';
const URL_BASE = 'https://api.tomtom.com/search/2/poiSearch';
const POR_PAGINA = 100;
const MAX_TERMOS = 3; // termos diferentes por busca
const MAX_PAGINAS = 2; // páginas por termo (só pede a 2ª se a 1ª veio cheia)
const PAUSA_MS = 250; // o limite do TomTom é 5 requisições por segundo

const pausar = (ms) => new Promise((res) => setTimeout(res, ms));

function parsearResultado(r) {
  const poi = r.poi || {};
  const end = r.address || {};
  const site = garantirHttps(poi.url);
  const rua = [end.streetName, end.streetNumber].filter(Boolean).join(', ');
  const lat = r.position?.lat;
  const lon = r.position?.lon;

  return {
    nome: poi.name || null,
    telefone: poi.phone || null,
    site,
    site_tipo: classificarSite(site),
    endereco: rua || null,
    maps_url: lat !== undefined && lon !== undefined ? `https://www.google.com/maps?q=${lat},${lon}` : null,
    fonte: PROVEDOR,
    fonte_id: String(r.id),
  };
}

// Uma requisição ao TomTom. Devolve { erro, resultados }.
async function consultar(termo, local, deslocamento) {
  const url = `${URL_BASE}/${encodeURIComponent(termo)}.json?${new URLSearchParams({
    key: config.chaves.tomtom,
    lat: String(local.lat),
    lon: String(local.lon),
    radius: String(local.raio),
    limit: String(POR_PAGINA),
    ofs: String(deslocamento),
    language: 'pt-BR',
    countrySet: 'BR',
  })}`;

  let resposta;
  try {
    resposta = await fetch(url, { signal: AbortSignal.timeout(30000) });
  } catch (e) {
    console.error('[tomtom] erro de rede:', e.message);
    return { erro: 'erro_rede', resultados: [] };
  }

  registrarUso(PROVEDOR, 1);

  if (!resposta.ok) {
    console.error('[tomtom] HTTP', resposta.status);
    return { erro: `http_${resposta.status}`, resultados: [] };
  }
  const json = await resposta.json().catch(() => null);
  if (!json) return { erro: 'resposta_invalida', resultados: [] };
  return { erro: null, resultados: json.results || [] };
}

// Mesmo formato de retorno do Overpass: { erro, leads, semContato }.
export async function buscarTomtom(nicho, cidade, uf) {
  const n = buscarNicho(nicho);
  if (!n) return { erro: 'nicho_sem_suporte', leads: [] };
  if (!podeUsar(PROVEDOR)) return { erro: 'cota_esgotada', leads: [] };

  const local = await localizarCidade(cidade, uf);
  if (!local) return { erro: 'cidade_nao_encontrada', leads: [] };

  const termos = [...new Set([...n.termos, ...(TERMOS_EXTRA[nicho] || [])])].slice(0, MAX_TERMOS);
  const porId = new Map(); // o mesmo negócio pode aparecer em mais de um termo
  let ultimoErro = null;

  busca: for (const termo of termos) {
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
      if (!podeUsar(PROVEDOR)) {
        ultimoErro = 'cota_esgotada';
        break busca;
      }
      const { erro, resultados } = await consultar(termo, local, pagina * POR_PAGINA);
      if (erro) {
        ultimoErro = erro;
        break busca;
      }
      for (const r of resultados) {
        if (r.type === 'POI' && !porId.has(r.id)) porId.set(r.id, r);
      }
      if (resultados.length < POR_PAGINA) break; // última página deste termo
      await pausar(PAUSA_MS);
    }
    await pausar(PAUSA_MS);
  }

  // Se falhou antes de achar qualquer coisa, devolve o erro. Se já tinha achado, segue com o parcial.
  if (ultimoErro && porId.size === 0) return { erro: ultimoErro, leads: [] };

  // O raio pode pegar cidades vizinhas: só fica quem é da cidade pesquisada.
  const cidadeNorm = semAcento(cidade);
  const todos = [...porId.values()]
    .filter((r) => [r.address?.municipality, r.address?.localName].some((m) => semAcento(m) === cidadeNorm))
    .map(parsearResultado)
    .filter((l) => l.nome);

  // Dá para abordar se tiver telefone OU Instagram.
  const temInstagram = (l) => /instagram\.com\/[A-Za-z0-9._]+/i.test(l.site || '');
  const leads = todos.filter((l) => l.telefone || temInstagram(l));

  return { erro: null, leads, semContato: todos.length - leads.length };
}
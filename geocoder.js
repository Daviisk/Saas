import { db } from './db.js';
import { config } from './config.js';
import { podeUsar, registrarUso } from './cotas.js';

const lerCache = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?');
const gravarCache = db.prepare(
  'INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor'
);

function distanciaM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const rad = (g) => (g * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Raio de busca a partir da caixa da cidade: no mínimo 3 km, no máximo 25 km.
function calcularRaio(r) {
  const b = r.bbox;
  if (!b) return 10000;
  const metade = distanciaM(r.lat, r.lon, b.lat2, b.lon2);
  return Math.min(Math.max(Math.round(metade), 3000), 25000);
}

// Devolve { lat, lon, raio, nome } ou null se não achar / sem cota.
export async function localizarCidade(cidade, uf) {
  const sigla = String(uf).toUpperCase();
  const chaveCache = `geo:${sigla}:${String(cidade).trim().toLowerCase()}`;

  const guardado = lerCache.get(chaveCache);
  if (guardado) return JSON.parse(guardado.valor);

  if (!podeUsar('geoapify')) return null;

  let resposta;
  try {
    resposta = await fetch(
      `https://api.geoapify.com/v1/geocode/search?${new URLSearchParams({
        text: `${cidade}, ${sigla}, Brasil`,
        type: 'city',
        format: 'json',
        limit: '5',
        lang: 'pt',
        apiKey: config.chaves.geoapify,
      })}`,
      { signal: AbortSignal.timeout(20000) }
    );
  } catch (e) {
    console.error('[geocoder] erro de rede:', e.message);
    return null;
  }
  registrarUso('geoapify', 1);

  if (!resposta.ok) {
    console.error('[geocoder] HTTP', resposta.status);
    return null;
  }

  const json = await resposta.json().catch(() => null);
  // Evita cidade homônima de outro estado: só aceita se a UF bater.
  const achada = (json?.results || []).find((r) => String(r.state_code).toUpperCase() === sigla);
  if (!achada) return null;

  const local = {
    lat: achada.lat,
    lon: achada.lon,
    raio: calcularRaio(achada),
    nome: achada.formatted,
  };
  gravarCache.run(chaveCache, JSON.stringify(local));
  return local;
}
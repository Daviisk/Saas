// Funções que todos os provedores usam.

// Classifica o link de "site" de um negócio.
export function classificarSite(site) {
  if (!site) return 'nenhum';
  if (/instagram\.com|facebook\.com|fb\.com|linktr\.ee/i.test(site)) return 'so_rede_social';
  if (/bit\.ly|goo\.gl|tinyurl|tuaagenda|wa\.me|api\.whatsapp|beacons\.ai|taplink/i.test(site)) return 'encurtador';
  return 'site';
}

export function garantirHttps(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

// "São Paulo" -> "sao paulo" (para comparar nomes de cidade).
export function semAcento(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
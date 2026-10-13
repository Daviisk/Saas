// Link do Google Maps que abre a empresa (pesquisa por nome e endereço), em vez de só as coordenadas.
export function linkMapa(lead) {
  if (!lead?.nome) return lead?.maps_url ?? null;
  const local = [lead.endereco, lead.cidade, lead.uf].filter(Boolean).join(', ');
  const consulta = [lead.nome, local].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
}
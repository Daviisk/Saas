// Lista central de nichos do buscador.
// Cada nicho tem: chave, nome, termos de busca (para provedores de busca por texto)
// e tags do OpenStreetMap (para o Overpass). Tags vazias = o OSM cobre mal esse nicho,
// então ele depende dos termos de texto nos outros provedores.

export const CATEGORIAS = [
  {
    chave: 'beleza',
    nome: 'Beleza',
    nichos: [
      { chave: 'barbearia', nome: 'Barbearia', termos: ['barbearia'], osm: ['shop=hairdresser'] },
      { chave: 'salao', nome: 'Salão', termos: ['salão de beleza'], osm: ['shop=hairdresser', 'shop=beauty'] },
      { chave: 'estetica', nome: 'Estética', termos: ['clínica de estética'], osm: ['shop=beauty'] },
      { chave: 'manicure', nome: 'Manicure', termos: ['manicure', 'nail designer'], osm: ['beauty=nails'] },
      { chave: 'cabeleireiro', nome: 'Cabeleireiro', termos: ['cabeleireiro'], osm: ['shop=hairdresser'] },
      { chave: 'sobrancelhas', nome: 'Sobrancelhas', termos: ['design de sobrancelhas'], osm: ['shop=beauty'] },
    ],
  },
  {
    chave: 'alimentacao',
    nome: 'Alimentação',
    nichos: [
      { chave: 'hamburgueria', nome: 'Hamburgueria', termos: ['hamburgueria'], osm: ['amenity=fast_food'] },
      { chave: 'pizzaria', nome: 'Pizzaria', termos: ['pizzaria'], osm: ['amenity=restaurant'] },
      { chave: 'restaurante', nome: 'Restaurante', termos: ['restaurante'], osm: ['amenity=restaurant'] },
      { chave: 'lanchonete', nome: 'Lanchonete', termos: ['lanchonete'], osm: ['amenity=fast_food'] },
      { chave: 'cafeteria', nome: 'Cafeteria', termos: ['cafeteria'], osm: ['amenity=cafe'] },
      { chave: 'doceria', nome: 'Doceria', termos: ['doceria', 'confeitaria'], osm: ['shop=confectionery', 'shop=pastry'] },
      { chave: 'acai', nome: 'Açaí', termos: ['açaí'], osm: ['amenity=ice_cream'] },
      { chave: 'sorveteria', nome: 'Sorveteria', termos: ['sorveteria'], osm: ['amenity=ice_cream'] },
    ],
  },
  {
    chave: 'saude',
    nome: 'Saúde',
    nichos: [
      { chave: 'dentista', nome: 'Dentista', termos: ['dentista'], osm: ['amenity=dentist'] },
      { chave: 'medico', nome: 'Médico', termos: ['clínica médica', 'médico'], osm: ['amenity=doctors'] },
      { chave: 'nutricionista', nome: 'Nutricionista', termos: ['nutricionista'], osm: ['healthcare=dietitian'] },
      { chave: 'psicologo', nome: 'Psicólogo', termos: ['psicólogo'], osm: ['healthcare=psychotherapist'] },
      { chave: 'fisioterapeuta', nome: 'Fisioterapeuta', termos: ['fisioterapeuta', 'clínica de fisioterapia'], osm: ['healthcare=physiotherapist'] },
      { chave: 'veterinario', nome: 'Veterinário', termos: ['veterinário', 'clínica veterinária'], osm: ['amenity=veterinary'] },
    ],
  },
  {
    chave: 'automotivo',
    nome: 'Automotivo',
    nichos: [
      { chave: 'oficina', nome: 'Oficina', termos: ['oficina mecânica'], osm: ['shop=car_repair'] },
      { chave: 'autoeletrica', nome: 'Autoelétrica', termos: ['autoelétrica'], osm: ['shop=car_repair'] },
      { chave: 'lava-jato', nome: 'Lava-jato', termos: ['lava jato'], osm: ['amenity=car_wash'] },
      { chave: 'estetica-automotiva', nome: 'Estética automotiva', termos: ['estética automotiva'], osm: [] },
      { chave: 'funilaria', nome: 'Funilaria', termos: ['funilaria e pintura'], osm: ['shop=car_repair'] },
      { chave: 'loja-de-pecas', nome: 'Loja de peças', termos: ['loja de peças automotivas', 'autopeças'], osm: ['shop=car_parts'] },
    ],
  },
  {
    chave: 'casa-construcao',
    nome: 'Casa e construção',
    nichos: [
      { chave: 'marcenaria', nome: 'Marcenaria', termos: ['marcenaria'], osm: ['craft=carpenter'] },
      { chave: 'marmoraria', nome: 'Marmoraria', termos: ['marmoraria'], osm: ['craft=stonemason'] },
      { chave: 'vidracaria', nome: 'Vidraçaria', termos: ['vidraçaria'], osm: ['craft=glaziery'] },
      { chave: 'arquitetura', nome: 'Arquitetura', termos: ['escritório de arquitetura', 'arquiteto'], osm: ['office=architect'] },
      { chave: 'engenharia', nome: 'Engenharia', termos: ['engenharia civil', 'engenheiro'], osm: ['office=engineer'] },
      { chave: 'materiais-de-construcao', nome: 'Materiais de construção', termos: ['materiais de construção'], osm: ['shop=doityourself', 'shop=hardware'] },
      { chave: 'energia-solar', nome: 'Energia solar', termos: ['energia solar'], osm: [] },
    ],
  },
  {
    chave: 'comercio',
    nome: 'Comércio',
    nichos: [
      { chave: 'roupas', nome: 'Roupas', termos: ['loja de roupas'], osm: ['shop=clothes'] },
      { chave: 'calcados', nome: 'Calçados', termos: ['loja de calçados'], osm: ['shop=shoes'] },
      { chave: 'moveis', nome: 'Móveis', termos: ['loja de móveis'], osm: ['shop=furniture'] },
      { chave: 'eletronicos', nome: 'Eletrônicos', termos: ['loja de eletrônicos'], osm: ['shop=electronics'] },
      { chave: 'cosmeticos', nome: 'Cosméticos', termos: ['loja de cosméticos', 'perfumaria'], osm: ['shop=cosmetics'] },
      { chave: 'oticas', nome: 'Óticas', termos: ['ótica'], osm: ['shop=optician'] },
      { chave: 'joalherias', nome: 'Joalherias', termos: ['joalheria'], osm: ['shop=jewelry'] },
    ],
  },
  {
    chave: 'servicos-profissionais',
    nome: 'Serviços profissionais',
    nichos: [
      { chave: 'imobiliaria', nome: 'Imobiliária', termos: ['imobiliária'], osm: ['office=estate_agent'] },
      { chave: 'corretor', nome: 'Corretor', termos: ['corretor de imóveis'], osm: ['office=estate_agent'] },
      { chave: 'advogado', nome: 'Advogado', termos: ['advogado', 'escritório de advocacia'], osm: ['office=lawyer'] },
      { chave: 'contador', nome: 'Contador', termos: ['contador', 'escritório de contabilidade'], osm: ['office=accountant'] },
      { chave: 'fotografo', nome: 'Fotógrafo', termos: ['fotógrafo', 'estúdio fotográfico'], osm: ['craft=photographer', 'shop=photo'] },
      { chave: 'agencia-de-marketing', nome: 'Agência de marketing', termos: ['agência de marketing'], osm: ['office=advertising_agency'] },
      { chave: 'agencia-de-viagens', nome: 'Agência de viagens', termos: ['agência de viagens'], osm: ['shop=travel_agency'] },
    ],
  },
  {
    chave: 'educacao',
    nome: 'Educação',
    nichos: [
      { chave: 'escola', nome: 'Escola', termos: ['escola particular'], osm: ['amenity=school'] },
      { chave: 'curso-profissionalizante', nome: 'Curso profissionalizante', termos: ['curso profissionalizante'], osm: ['amenity=training'] },
      { chave: 'curso-de-idiomas', nome: 'Curso de idiomas', termos: ['curso de idiomas', 'escola de inglês'], osm: ['amenity=language_school'] },
      { chave: 'autoescola', nome: 'Autoescola', termos: ['autoescola'], osm: ['amenity=driving_school'] },
      { chave: 'reforco-escolar', nome: 'Reforço escolar', termos: ['reforço escolar'], osm: ['amenity=prep_school'] },
    ],
  },
];

// Lista plana: [{ chave, nome, categoria, categoriaNome, termos, osm }]
export const NICHOS = CATEGORIAS.flatMap((cat) =>
  cat.nichos.map((n) => ({ ...n, categoria: cat.chave, categoriaNome: cat.nome }))
);

export function buscarNicho(chave) {
  return NICHOS.find((n) => n.chave === chave) || null;
}

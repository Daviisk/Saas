import { NICHOS } from './nichos.js';

// Modelos de conversão: o que o site facilita e qual recurso extra oferecemos.
const TIPOS = {
  agendamento: { facilite: 'o agendamento', recurso: 'implementar um sistema de agendamento de horários no próprio site' },
  pedido: { facilite: 'os pedidos', recurso: 'criar um cardápio digital no próprio site' },
  catalogo: { facilite: 'o contato e os pedidos', recurso: 'criar um catálogo de produtos no próprio site' },
  orcamento: { facilite: 'o pedido de orçamento', recurso: 'criar um formulário de orçamento no próprio site' },
  contato: { facilite: 'o contato', recurso: 'criar um formulário de contato no próprio site' },
  matricula: { facilite: 'o contato e a matrícula', recurso: 'criar um formulário de interesse no próprio site' },
  imoveis: { facilite: 'o contato dos interessados', recurso: 'criar um catálogo de imóveis com filtros no próprio site' },
};

// Por nicho: [modelo, o que o cliente do negócio quer ver, o que o site apresenta, público (opcional)]
const DADOS = {
  barbearia: ['agendamento', 'os cortes, serviços, profissionais, fotos dos trabalhos e avaliações', 'cada serviço'],
  salao: ['agendamento', 'os serviços, fotos dos resultados, profissionais e diferenciais', 'cada serviço'],
  estetica: ['agendamento', 'os procedimentos, resultados, estrutura e profissionais', 'cada procedimento'],
  manicure: ['agendamento', 'os trabalhos, estilos de unhas e serviços disponíveis', 'os serviços e uma galeria dos trabalhos'],
  cabeleireiro: ['agendamento', 'os cortes, tratamentos, serviços e fotos dos resultados', 'cada serviço'],
  sobrancelhas: ['agendamento', 'os procedimentos, fotos dos resultados e estilos', 'os procedimentos e uma galeria dos trabalhos'],
  hamburgueria: ['pedido', 'o cardápio, fotos dos hambúrgueres, ingredientes e opções', 'o cardápio'],
  pizzaria: ['pedido', 'os sabores, tamanhos, preços e fotos', 'o cardápio'],
  restaurante: ['pedido', 'o cardápio, o ambiente, os pratos e as avaliações', 'o cardápio e o restaurante'],
  lanchonete: ['pedido', 'o cardápio, fotos dos lanches, opções e preços', 'o cardápio'],
  cafeteria: ['pedido', 'o cardápio, os cafés, os doces e o ambiente', 'o cardápio e o ambiente'],
  doceria: ['catalogo', 'bolos, doces, kits e trabalhos anteriores', 'os produtos'],
  acai: ['pedido', 'tamanhos, complementos, combinações e fotos', 'o cardápio'],
  sorveteria: ['pedido', 'os sabores, produtos, opções e fotos', 'os produtos'],
  dentista: ['agendamento', 'os profissionais, especialidades, tratamentos, estrutura e avaliações', 'cada especialidade', 'o paciente'],
  medico: ['agendamento', 'os médicos, especialidades, tratamentos e a estrutura da clínica', 'cada especialidade e profissional', 'o paciente'],
  nutricionista: ['agendamento', 'a formação, as especialidades e o método de atendimento', 'o trabalho'],
  psicologo: ['agendamento', 'o profissional, as áreas de atuação, a abordagem e o formato dos atendimentos', 'o profissional e as áreas de atendimento'],
  fisioterapeuta: ['agendamento', 'os tratamentos, especialidades, estrutura e diferenciais', 'cada tratamento', 'o paciente'],
  veterinario: ['agendamento', 'os serviços, profissionais, estrutura e especialidades', 'os serviços'],
  oficina: ['orcamento', 'os serviços realizados, especialidades, estrutura e fotos dos trabalhos', 'cada serviço'],
  autoeletrica: ['orcamento', 'os serviços, especialidades e os tipos de problemas atendidos', 'os serviços'],
  'lava-jato': ['agendamento', 'os serviços, preços, fotos dos resultados e opções de lavagem', 'os serviços'],
  'estetica-automotiva': ['agendamento', 'fotos de antes e depois, serviços, processos e diferenciais', 'os serviços e uma galeria de resultados'],
  funilaria: ['orcamento', 'fotos de reparos, pintura, antes e depois e serviços realizados', 'os serviços e os resultados'],
  'loja-de-pecas': ['orcamento', 'as categorias de produtos, marcas e disponibilidade', 'os produtos e categorias'],
  marcenaria: ['orcamento', 'o portfólio de projetos, os serviços e os diferenciais', 'os projetos em um portfólio'],
  marmoraria: ['orcamento', 'projetos realizados, tipos de pedras, acabamentos e serviços', 'os projetos e serviços'],
  vidracaria: ['orcamento', 'os tipos de serviços, instalações realizadas e fotos dos projetos', 'os serviços e projetos'],
  arquitetura: ['orcamento', 'os projetos, o estilo, os serviços e trabalhos anteriores', 'os projetos em um portfólio profissional'],
  engenharia: ['orcamento', 'os serviços, projetos realizados, áreas de atuação e experiência', 'os serviços e projetos'],
  'materiais-de-construcao': ['orcamento', 'as categorias de produtos, marcas e ofertas', 'os produtos e categorias'],
  'energia-solar': ['orcamento', 'como funciona, projetos realizados e diferenciais da empresa', 'os serviços e projetos'],
  roupas: ['catalogo', 'as peças, coleções, estilos e novidades', 'os produtos'],
  calcados: ['catalogo', 'os modelos, marcas, estilos e novidades', 'os produtos'],
  moveis: ['catalogo', 'os produtos, ambientes, modelos e medidas', 'os móveis e ambientes'],
  eletronicos: ['catalogo', 'os produtos, marcas, categorias e ofertas', 'os produtos'],
  cosmeticos: ['catalogo', 'as marcas, categorias, produtos e novidades', 'os produtos'],
  oticas: ['catalogo', 'as armações, marcas, serviços e diferenciais', 'os produtos e serviços'],
  joalherias: ['catalogo', 'as peças, coleções, marcas e detalhes dos produtos', 'as peças'],
  imobiliaria: ['imoveis', 'os imóveis disponíveis, fotos, informações e localização', 'os imóveis'],
  corretor: ['imoveis', 'os imóveis disponíveis, fotos, informações e o trabalho do corretor', 'os imóveis e o trabalho'],
  advogado: ['contato', 'as áreas de atuação, equipe, experiência e informações do escritório', 'as áreas de atuação'],
  contador: ['contato', 'os serviços, especialidades, atendimento e diferenciais do escritório', 'os serviços'],
  fotografo: ['orcamento', 'ensaios, eventos, estilos e trabalhos anteriores', 'os trabalhos em um portfólio profissional'],
  'agencia-de-marketing': ['contato', 'serviços, cases, resultados e diferenciais', 'os serviços e cases'],
  'agencia-de-viagens': ['orcamento', 'destinos, pacotes, serviços, fotos e condições', 'os destinos e pacotes'],
  escola: ['matricula', 'a estrutura, a proposta pedagógica, as atividades e as turmas', 'a escola e a estrutura', 'os pais'],
  'curso-profissionalizante': ['matricula', 'os cursos, duração, modalidades e certificados', 'cada curso', 'o aluno'],
  'curso-de-idiomas': ['matricula', 'os idiomas, níveis, metodologia e modalidades', 'os cursos', 'o aluno'],
  autoescola: ['matricula', 'as categorias de habilitação, aulas, processo e horários', 'as categorias e serviços', 'o aluno'],
  'reforco-escolar': ['matricula', 'as matérias atendidas, metodologia, horários e professores', 'os serviços', 'os pais'],
};

// Profissionais autônomos: o texto fala "você" em vez de "vocês".
const SINGULAR = new Set(['nutricionista', 'psicologo', 'fotografo', 'corretor']);

// Ajustes pontuais de um nicho sobre o modelo.
const EXTRA = {
  'agencia-de-viagens': { facilite: 'o contato e o pedido de orçamento', recurso: 'criar um catálogo de viagens no próprio site' },
};

// {nome} vira o nome do negócio na hora de montar a mensagem de cada lead.
const SITUACOES = {
  nenhum: {
    rotulo: 'sem site',
    meio: (d, p) =>
      `Encontrei {nome} no Google Maps e percebi que ${p.tem} presença por lá, mas não encontrei um site próprio. Hoje, quem encontra ${p.voces} até consegue chegar ao contato, mas não tem um espaço próprio para conhecer ${d.mostrar} antes de chamar.`,
    fim: (d) =>
      `A proposta é criar um site próprio que reúna tudo em um só lugar, apresente ${d.apresente} com destaque e facilite ${d.facilite}. Podemos direcionar ${d.publico} para o WhatsApp ou ${d.recurso}. Posso te explicar melhor como funcionaria?`,
  },
  so_rede_social: {
    rotulo: 'só rede social',
    meio: (d) =>
      `Vi {nome} nas redes sociais e percebi que ainda não existe um site próprio. Nas redes, quem chega precisa rolar o perfil para encontrar ${d.mostrar}, e quem pesquisa no Google nem sempre chega até lá.`,
    fim: (d) =>
      `A ideia é criar um site próprio que reúna tudo em um só lugar, apresente ${d.apresente} com destaque, apareça nas buscas do Google e facilite ${d.facilite}. As redes continuam como canal de divulgação e passam a levar as pessoas para o site. Posso te explicar melhor como funcionaria?`,
  },
  encurtador: {
    rotulo: 'link único (Linktree)',
    meio: (d) =>
      `Vi que {nome} usa um link único (tipo Linktree) para reunir as informações, mas não encontrei um site próprio. Esse tipo de link quebra um galho, mas é limitado: tem pouco espaço para apresentar ${d.mostrar}, não aparece bem nas buscas do Google e depende de uma página que não é sua.`,
    fim: (d) =>
      `A proposta é transformar esse link em um site próprio: reunir tudo em um só lugar, apresentar ${d.apresente} com destaque e facilitar ${d.facilite}, com endereço próprio e aparecendo no Google. O que já funciona hoje no link a gente aproveita. Posso te explicar melhor como funcionaria?`,
  },
  site: {
    rotulo: 'site para melhorar',
    meio: (d) =>
      `Dei uma olhada no site de {nome} e acredito que ele poderia trabalhar mais a favor do negócio: ser mais rápido e fácil de usar no celular, mostrar melhor ${d.mostrar} e facilitar ${d.facilite}.`,
    fim: () =>
      'Eu trabalho criando e melhorando sites de negócios locais e, quando dá, aproveito o que já funciona em vez de começar do zero. Posso te mostrar o que eu ajustaria?',
  },
};

export function dadosDoNicho(chave) {
  const linha = DADOS[chave];
  if (!linha) return null;
  const [tipo, mostrar, apresente, publico = 'o cliente'] = linha;
  return { mostrar, apresente, publico, ...TIPOS[tipo], ...(EXTRA[chave] || {}) };
}

export function gerarCopiesBase() {
  const lista = [];
  for (const n of NICHOS) {
    const d = dadosDoNicho(n.chave);
    if (!d) continue;
    const p = SINGULAR.has(n.chave)
      ? { tem: 'você tem', oferece: 'você oferece', voces: 'você' }
      : { tem: 'vocês têm', oferece: 'vocês oferecem', voces: 'vocês' };
    const intro = `Oi, sou o Gabriel, desenvolvedor web. Trabalho criando sites para negócios locais se destacarem na internet e serem encontrados por quem já está procurando o que ${p.oferece}.`;

    for (const [situacao, s] of Object.entries(SITUACOES)) {
      lista.push({
        nicho: n.chave,
        titulo: `${n.nome} — ${s.rotulo}`,
        dor: situacao,
        texto: [intro, s.meio(d, p), s.fim(d)].join('\n\n'),
      });
    }
  }
  return lista;
}
// Etapas do CRM, na ordem do kanban.
export const ETAPAS = [
  'lead_do_dia',
  'qualificado',
  'copy_enviada',
  'em_negociacao',
  'proposta_enviada',
  'fechado',
  'perdido',
];

// Fora do funil: leads reprovados na verificação (separado de "perdido").
export const ETAPA_DESCARTADO = 'descartado';

export const TIPOS_SITE = ['nenhum', 'so_rede_social', 'encurtador', 'site'];
export const TEMPERATURAS = ['quente', 'frio'];
// Etapas em que o lead sai do funil (não precisa mais de follow-up).
export const ETAPAS_ENCERRADAS = ['fechado', 'perdido', ETAPA_DESCARTADO];

// Itens do checklist "verificação antes de abordar".
export const ITENS_VERIFICACAO = ['site_escondido', 'instagram', 'horario_fuso', 'nao_contatar'];
// Categorias de gasto do financeiro: [chave, nome mostrado].
export const CATEGORIAS_GASTO = [
  ['servicos_site', 'Serviços do site (domínio, hospedagem)'],
  ['ia', 'IA (Claude)'],
  ['outros', 'Outros'],
];
// Etapas do kanban de projetos: [chave, nome mostrado].
export const ETAPAS_PROJETO = [
  ['aguardando_entrada', 'Aguardando entrada'],
  ['em_desenvolvimento', 'Em desenvolvimento'],
  ['aguardando_aprovacao', 'Aguardando aprovação do cliente'],
  ['ajustes', 'Ajustes'],
  ['publicado', 'Publicado e hospedado'],
  ['entregue', 'Entregue'],
];
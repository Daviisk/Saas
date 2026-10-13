import { obter as obterLead } from './leads.js';
import { TIPOS_SITE } from './constants.js';
import { NICHOS } from './nichos.js';
import { semAcento } from './provedores/comum.js';
import { dadosDoNicho } from './copies-base.js';
import { linkMapa } from './mapa.js';

const ROTULO_SITE = {
  nenhum: 'Sem site nem presença oficial na internet',
  so_rede_social: 'Só rede social, sem site próprio',
  encurtador: 'Link único (Linktree, bit.ly ou agendamento), sem site próprio',
  site: 'Já tem site (avalie a qualidade antes de abordar)',
};

// Perguntas para puxar conversa, por situação. {mostrar} vem do nicho do lead.
const GANCHOS = {
  nenhum: [
    'Como os clientes costumam chegar até vocês hoje: indicação, Instagram, Google?',
    'Os clientes costumam perguntar por {mostrar} antes de fechar? Onde eles encontram isso hoje?',
    'Se o cliente pudesse ver tudo isso e já chamar no WhatsApp, ajudaria?',
  ],
  so_rede_social: [
    'O Instagram traz clientes novos ou principalmente quem já conhece vocês?',
    'Perdem tempo respondendo as mesmas dúvidas no direct sobre {mostrar}?',
    'Quem pesquisa o negócio no Google acaba chegando até o perfil?',
  ],
  encurtador: [
    'O link único dá conta de mostrar {mostrar}, ou o cliente ainda pergunta no WhatsApp?',
    'Já pensaram em ter um endereço próprio, que aparece no Google e não depende de página de terceiros?',
    'Do que está no link hoje, o que mais gera contato?',
  ],
  site: [
    'O site traz contatos hoje? De que tipo?',
    'Confira antes: abre rápido no celular? Mostra {mostrar}? Tem botão de WhatsApp?',
    'Faz tempo que o site foi atualizado? O que mudou no negócio desde então?',
  ],
};

function encontrarNicho(valor) {
  if (!valor) return null;
  const alvo = semAcento(valor);
  return NICHOS.find((n) => n.chave === valor || semAcento(n.nome) === alvo) || null;
}

export function resumoDoLead(leadId) {
  const lead = obterLead(leadId);
  const situacao = TIPOS_SITE.includes(lead.site_tipo) ? lead.site_tipo : 'nenhum';
  const nicho = encontrarNicho(lead.nicho);
  const d = nicho ? dadosDoNicho(nicho.chave) : null;
  const mostrar = d?.mostrar ?? 'os serviços e as informações do negócio';

  const local = [lead.endereco, [lead.cidade, lead.uf].filter(Boolean).join(' - ')].filter(Boolean).join(' · ');
  const contato = lead.whatsapp
    ? 'WhatsApp (celular)'
    : lead.telefone
      ? 'Telefone fixo (sem WhatsApp confirmado)'
      : lead.instagram
        ? 'Só Instagram'
        : 'Sem contato';

  const panorama = [
    { rotulo: 'Negócio', valor: nicho ? `${lead.nome} (${nicho.nome})` : lead.nome },
    local && { rotulo: 'Local', valor: local },
    { rotulo: 'Presença online', valor: ROTULO_SITE[situacao] },
    { rotulo: 'Contato', valor: contato },
    lead.instagram && { rotulo: 'Instagram', valor: `@${lead.instagram}` },
    lead.nota && { rotulo: 'Nota', valor: String(lead.nota) },
    lead.pontuacao !== null && { rotulo: 'Pontuação', valor: `${lead.pontuacao} (${lead.temperatura ?? '—'})` },
  ].filter(Boolean);

  const numero = lead.whatsapp || lead.telefone;
  return {
    lead: { id: lead.id, nome: lead.nome, situacao },
    nicho: nicho ? { chave: nicho.chave, nome: nicho.nome } : null,
    panorama,
    dor: lead.dor || ROTULO_SITE[situacao],
    oportunidade: d
      ? `Um site próprio que apresente ${d.apresente} com destaque e facilite ${d.facilite}. Extra possível: ${d.recurso}.`
      : 'Um site próprio que reúna as informações do negócio e facilite o contato.',
    ganchos: GANCHOS[situacao].map((g) => g.replaceAll('{mostrar}', mostrar)),
    links: {
      whatsapp: numero ? `https://wa.me/${numero}` : null, // sem texto: você escreve
      instagram: lead.instagram ? `https://instagram.com/${encodeURIComponent(lead.instagram)}` : null,
      site: lead.site,
      mapa: linkMapa(lead),
    },
  };
}
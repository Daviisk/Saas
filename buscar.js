import { api } from './api.js';
import { el } from './dom.js';

const form = document.getElementById('form-buscar');
const selCategoria = document.getElementById('busca-categoria');
const selNicho = document.getElementById('busca-nicho');
const botaoBuscar = document.getElementById('btn-buscar');
const statusBusca = document.getElementById('status-busca');
const avisoErro = document.getElementById('buscar-erro');
const linhaCotas = document.getElementById('cotas-linha');
const areaResultado = document.getElementById('busca-resultado');
const textoResumo = document.getElementById('busca-resumo');
const lista = document.getElementById('busca-lista');
const selTodos = document.getElementById('sel-todos');
const botaoEnviar = document.getElementById('btn-enviar-crm');
const optModo = document.getElementById('opt-modo');
const optLimite = document.getElementById('opt-limite');
const optSite = document.getElementById('opt-site');
import { linkMapa } from './mapa.js';

let categorias = [];
let candidatos = []; // leads da última busca que ainda não foram enviados ao CRM
const caixas = new Map(); // fonte_id -> checkbox
const cartoes = new Map(); // fonte_id -> card

function mostrarErro(mensagem) {
  avisoErro.textContent = mensagem;
  avisoErro.hidden = !mensagem;
}

// ---------- Categoria e nicho ----------
function preencherNichos() {
  const cat = categorias.find((c) => c.chave === selCategoria.value);
  selNicho.replaceChildren(...(cat?.nichos ?? []).map((n) => el('option', { value: n.chave, texto: n.nome })));
}

async function carregarNichos() {
  try {
    categorias = await api('/nichos');
    selCategoria.replaceChildren(...categorias.map((c) => el('option', { value: c.chave, texto: c.nome })));
    preencherNichos();
  } catch (e) {
    mostrarErro(`Não foi possível carregar os nichos: ${e.message}`);
  }
}
selCategoria.addEventListener('change', preencherNichos);

// ---------- Linha de cotas ----------
const MOTIVO_COTA = {
  sem_chave: 'sem chave',
  limite_diario: 'limite do dia atingido',
  trava_mensal: 'travado até o mês virar',
};

async function carregarCotas() {
  try {
    const provedores = await api('/cotas');
    linhaCotas.textContent = provedores
      .map((p) => `${p.nome}: ${p.disponivel ? `${p.dia.usado}/${p.dia.limite} hoje` : MOTIVO_COTA[p.motivo] || 'indisponível'}`)
      .join(' · ');
  } catch {
    linhaCotas.textContent = '';
  }
}

// ---------- Utilidades do card (mesmas do CRM) ----------
function iniciais(nome) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? '?') + (partes[1]?.[0] ?? '')).toUpperCase();
}

function faixaPontuacao(p) {
  if (p === null || p === undefined) return null;
  if (p >= 70) return 'bom';
  if (p >= 40) return 'medio';
  return 'ruim';
}

function canal(texto, href, classe) {
  if (!href) return el('span', { class: `canal ${classe} desativado`, texto });
  return el('a', { class: `canal ${classe}`, href, target: '_blank', rel: 'noopener noreferrer', texto });
}

function criarCard(lead) {
  const local = [lead.cidade, lead.uf].filter(Boolean).join(' - ');
  const faixa = faixaPontuacao(lead.pontuacao);
  const aviso =
    lead.site_tipo === 'so_rede_social' ? 'Site é só rede social'
    : lead.site_tipo === 'encurtador' ? 'Link encurtado'
    : lead.site_tipo === 'nenhum' ? 'Sem site'
    : lead.site_tipo === 'site' ? 'Já tem site'
    : null;
  const numero = lead.whatsapp || lead.telefone;
  const insta = lead.instagram ? `https://instagram.com/${encodeURIComponent(lead.instagram)}` : null;

  const caixa = el('input', { type: 'checkbox', 'aria-label': `Escolher ${lead.nome}`, onchange: atualizarSelecao });
  caixas.set(lead.fonte_id, caixa);

  const card = el(
    'article',
    { class: 'lead-card resultado-card' },
    el('label', { class: 'escolher' }, caixa, 'Escolher este lead'),
    el(
      'div',
      { class: 'lead-topo' },
      el('div', { class: 'avatar', texto: iniciais(lead.nome), 'aria-hidden': 'true' }),
      el('h3', { class: 'lead-nome', texto: lead.nome })
    ),
    el(
      'div',
      { class: 'lead-info' },
      lead.nicho && el('span', { class: 'selo', texto: lead.nicho }),
      faixa && el('span', { class: `selo selo-${faixa}`, texto: `${lead.pontuacao} pts` }),
      lead.temperatura && el('span', { class: 'selo', texto: lead.temperatura === 'quente' ? 'Quente' : 'Frio' }),
      aviso && el('span', { class: 'selo selo-aviso', texto: aviso }),
    !numero && el('span', { class: 'selo selo-aviso', texto: 'Sem telefone' })
    ),
    local && el('p', { class: 'lead-local', texto: lead.endereco ? `${lead.endereco} · ${local}` : local }),
    lead.dor && el('p', { class: 'dor-lead', texto: lead.dor }),
    el(
      'div',
      { class: 'canais' },
      canal('Whats', numero ? `https://wa.me/${numero}` : null, 'canal-whats'),
      canal('Insta', insta, 'canal-insta'),
      canal('Site', lead.site, 'canal-site'),
      canal('Mapa', linkMapa(lead), 'canal-mapa')
    )
  );
  cartoes.set(lead.fonte_id, card);
  return card;
}

// ---------- Seleção e envio ao CRM ----------
function atualizarSelecao() {
  const total = candidatos.length;
  const marcados = candidatos.filter((l) => caixas.get(l.fonte_id)?.checked).length;
  selTodos.checked = total > 0 && marcados === total;
  botaoEnviar.disabled = marcados === 0;
  botaoEnviar.textContent = marcados ? `Enviar ${marcados} para o CRM` : 'Enviar para o CRM';
}

selTodos.addEventListener('change', () => {
  for (const lead of candidatos) {
    const caixa = caixas.get(lead.fonte_id);
    if (caixa) caixa.checked = selTodos.checked;
  }
  atualizarSelecao();
});

function removerCandidato(lead) {
  cartoes.get(lead.fonte_id)?.remove();
  cartoes.delete(lead.fonte_id);
  caixas.delete(lead.fonte_id);
  candidatos = candidatos.filter((l) => l.fonte_id !== lead.fonte_id);
}

botaoEnviar.addEventListener('click', async () => {
  const escolhidos = candidatos.filter((l) => caixas.get(l.fonte_id)?.checked);
  if (!escolhidos.length) return;

  botaoEnviar.disabled = true;
  mostrarErro('');
  let enviados = 0;
  const falhas = [];
  for (const lead of escolhidos) {
    try {
      await api('/leads', { metodo: 'POST', corpo: lead });
      enviados++;
      removerCandidato(lead);
    } catch (e) {
      falhas.push(`${lead.nome}: ${e.message}`);
    }
  }

  statusBusca.textContent = enviados ? `${enviados} lead(s) enviado(s) para o CRM, na etapa "Lead do dia".` : '';
  if (falhas.length) mostrarErro(falhas.join(' | '));
  if (!candidatos.length) lista.replaceChildren(el('p', { class: 'subtitulo', texto: 'Todos os leads desta busca foram enviados.' }));
  atualizarSelecao();
});

// ---------- Busca ----------
function montarResumo(r) {
  const s = r.resumo;
  const partes = [`${s.encontrados} encontrados`, `${s.retornados} para abordar`];
  if (s.semContato) partes.push(`${s.semContato} sem telefone nem Instagram`);
  if (s.comSite) partes.push(`${s.comSite} ignorados por já terem site`);
  if (s.semSite) partes.push(`${s.semSite} ignorados por não terem site`);
  if (s.jaNoCrm) partes.push(`${s.jaNoCrm} já no CRM`);
  if (s.repetidos) partes.push(`${s.repetidos} repetidos entre provedores`);
  if (s.naoContatar) partes.push(`${s.naoContatar} na lista de não contatar`);
  if (s.invalidos) partes.push(`${s.invalidos} com dados inválidos`);

  const origem = r.provedores
    .map((p) => {
      if (p.estado === 'ok') return `${p.nome}: ${p.novos}`;
      if (p.estado === 'dispensado') return `${p.nome}: não precisou`;
      return `${p.nome}: ${p.motivo}`;
    })
    .join(' · ');

  return `${partes.join(' · ')} — Provedores: ${origem}`;
}

function desenharResultado(r) {
  candidatos = r.leads;
  caixas.clear();
  cartoes.clear();
  textoResumo.textContent = montarResumo(r);
  lista.replaceChildren(
    ...(candidatos.length
      ? candidatos.map(criarCard)
      : [el('p', { class: 'subtitulo', texto: 'Nenhum lead novo com telefone ou Instagram nessa busca. Tente outra cidade ou outro nicho.' })])
  );
  areaResultado.hidden = false;
  atualizarSelecao();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  mostrarErro('');
  const corpo = {
    nicho: selNicho.value,
    cidade: form.elements.cidade.value.trim(),
    uf: form.elements.uf.value.trim().toUpperCase(),
  };

  botaoBuscar.disabled = true;
  statusBusca.textContent = 'Buscando… pode levar até um minuto.';
  try {
    desenharResultado(await api('/buscar', { metodo: 'POST', corpo }));
    statusBusca.textContent = '';
  } catch (err) {
    statusBusca.textContent = '';
    mostrarErro(err.message);
  } finally {
    botaoBuscar.disabled = false;
    carregarCotas();
  }
});

// ---------- Opções da busca (ficam salvas no banco) ----------
async function carregarOpcoes() {
  try {
    const c = await api('/configuracoes');
    optModo.value = c.modo_busca;
    optLimite.value = c.limite_busca;
    optSite.value = c.filtro_site;
  } catch {
    // sem as opções salvas, o servidor usa o padrão
  }
}

async function salvarOpcao(campos) {
  try {
    await api('/configuracoes', { metodo: 'PUT', corpo: campos });
    mostrarErro('');
  } catch (e) {
    mostrarErro(e.message);
  }
}

optModo.addEventListener('change', () => salvarOpcao({ modo_busca: optModo.value }));
optLimite.addEventListener('change', () => salvarOpcao({ limite_busca: Number(optLimite.value) }));
optSite.addEventListener('change', () => salvarOpcao({ filtro_site: optSite.value }));

// ---------- Início ----------
carregarNichos();
carregarCotas();
carregarOpcoes();
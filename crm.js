import { api } from './api.js';
import { el } from './dom.js';
import { abrirAbordagem } from './abordagem.js';
import { abrirDetalhe, infoFollowup } from './lead-detalhe.js';
import { linkMapa } from './mapa.js';

const ETAPAS = [
  ['lead_do_dia', 'Lead do dia'],
  ['qualificado', 'Qualificado'],
  ['copy_enviada', 'Copy enviada'],
  ['em_negociacao', 'Em negociação'],
  ['proposta_enviada', 'Proposta enviada'],
  ['fechado', 'Fechado'],
  ['perdido', 'Perdido'],
];
const NOME_ETAPA = Object.fromEntries([...ETAPAS, ['descartado', 'Descartado']]);

const quadro = document.getElementById('kanban');
const avisoErro = document.getElementById('crm-erro');
const totalDescartados = document.getElementById('descartados-total');

// Barra de rolagem espelhada no topo do quadro (fica visível ao descer a página).
const barraTopo = el('div', { class: 'quadro-barra', 'aria-hidden': 'true' }, el('div', { class: 'quadro-barra-fio' }));
quadro.before(barraTopo);
const fioBarraTopo = barraTopo.firstElementChild;

function ajustarBarraTopo() {
  fioBarraTopo.style.width = `${quadro.scrollWidth}px`;
  barraTopo.hidden = quadro.scrollWidth <= quadro.clientWidth + 1;
}

barraTopo.addEventListener('scroll', () => {
  if (quadro.scrollLeft !== barraTopo.scrollLeft) quadro.scrollLeft = barraTopo.scrollLeft;
});
quadro.addEventListener('scroll', () => {
  if (barraTopo.scrollLeft !== quadro.scrollLeft) barraTopo.scrollLeft = quadro.scrollLeft;
});
window.addEventListener('resize', ajustarBarraTopo);
new ResizeObserver(ajustarBarraTopo).observe(quadro);

let leadsPorId = new Map();
let arrastandoId = null;

function mostrarErro(mensagem) {
  avisoErro.textContent = mensagem;
  avisoErro.hidden = !mensagem;
}

// ---------- Utilidades do card ----------
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

function linkWhats(lead) {
  const numero = lead.whatsapp || lead.telefone;
  return numero ? `https://wa.me/${numero}` : null;
}

function linkInsta(lead) {
  return lead.instagram ? `https://instagram.com/${encodeURIComponent(lead.instagram)}` : null;
}

function canal(texto, href, classe) {
  if (!href) return el('span', { class: `canal ${classe} desativado`, texto });
  return el('a', { class: `canal ${classe}`, href, target: '_blank', rel: 'noopener noreferrer', texto });
}

// Timer da coluna "Copy enviada": quanto falta para o follow-up automático.
const HORAS_SEM_RESPOSTA = 24;

function infoTimer(lead) {
  if (lead.etapa !== 'copy_enviada' || lead.proximo_followup || !lead.copy_enviada_em) return null;
  const venceEm = new Date(`${lead.copy_enviada_em.replace(' ', 'T')}Z`).getTime() + HORAS_SEM_RESPOSTA * 3_600_000;
  const falta = venceEm - Date.now();
  if (falta <= 0) return { classe: 'selo-ruim', texto: 'Sem resposta há 24h+' };
  const h = Math.floor(falta / 3_600_000);
  const m = Math.floor((falta % 3_600_000) / 60_000);
  return { classe: '', texto: `Follow-up em ${h}h${String(m).padStart(2, '0')}` };
}

function criarCard(lead) {
  const local = [lead.cidade, lead.uf].filter(Boolean).join(' - ');
  const faixa = faixaPontuacao(lead.pontuacao);
  const aviso =
    lead.site_tipo === 'so_rede_social' ? 'Site é só rede social' : lead.site_tipo === 'encurtador' ? 'Link encurtado' : null;
  const fu = infoFollowup(lead.proximo_followup);
  const timer = infoTimer(lead);
  const precisaVerificar = !lead.verificado && ['lead_do_dia', 'qualificado'].includes(lead.etapa);
    const motivo =
    lead.etapa === 'descartado' ? lead.motivo_descarte : lead.etapa === 'perdido' ? lead.motivo_perda : null;
  const seletor = el(
    'select',
    {
      class: 'mover',
      'aria-label': `Mover ${lead.nome} para outra etapa`,
      onchange: (e) => {
        const destino = e.target.value;
        e.target.value = '';
        moverLead(lead, destino);
      },
    },
    el('option', { value: '', disabled: true, selected: true, texto: 'Mover para…' }),
    Object.entries(NOME_ETAPA)
      .filter(([etapa]) => etapa !== lead.etapa)
      .map(([etapa, nome]) => el('option', { value: etapa, texto: nome }))
  );

  const card = el(
    'article',
    {
      class: 'lead-card',
      draggable: 'true',
      ondragstart: (e) => {
        arrastandoId = lead.id;
        e.dataTransfer.setData('text/plain', String(lead.id));
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('arrastando');
      },
      ondragend: () => {
        arrastandoId = null;
        card.classList.remove('arrastando');
        quadro.querySelectorAll('.sobre').forEach((c) => c.classList.remove('sobre'));
      },
    },
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
            aviso ? el('span', { class: 'selo selo-aviso', texto: aviso }) : null,
      fu ? el('span', { class: `selo ${fu.classe}`, texto: fu.texto }) : null,
      timer ? el('span', { class: `selo ${timer.classe}`, texto: timer.texto }) : null,
      precisaVerificar ? el('span', { class: 'selo selo-aviso', texto: 'Verificar' }) : null
    ),
    local && el('p', { class: 'lead-local', texto: local }),
        motivo ? el('p', { class: 'lead-motivo', texto: `Motivo: ${motivo}` }) : null,
    el(
      'div',
      { class: 'canais' },
      canal('Whats', linkWhats(lead), 'canal-whats'),
      canal('Insta', linkInsta(lead), 'canal-insta'),
      canal('Site', lead.site, 'canal-site'),
      canal('Mapa', linkMapa(lead), 'canal-mapa')
    ),
        el(
      'div',
      { class: 'botoes-card' },
      el('button', {
        type: 'button',
        class: 'botao-sec botao-msg',
        texto: 'Detalhes',
        onclick: () => abrirDetalhe(lead, carregar),
      }),
      el('button', {
        type: 'button',
        class: 'botao-sec botao-msg',
        texto: 'Mensagem',
        onclick: () => abrirAbordagem(lead, carregar),
      })
    ),
    seletor
  );
  return card;
}

// ---------- Follow-up em massa (coluna "Copy enviada") ----------
let dlgMassa = null;
let infoMassa;
let campoQuandoMassa;
let campoMotivoMassa;
let erroMassa;
let idsMassa = [];

function amanhaNove() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function montarDlgMassa() {
  campoQuandoMassa = document.createElement('input');
  campoQuandoMassa.type = 'datetime-local';
  campoQuandoMassa.required = true;

  campoMotivoMassa = document.createElement('input');
  campoMotivoMassa.type = 'text';
  campoMotivoMassa.maxLength = 300;

  infoMassa = el('p', { class: 'subtitulo' });
  erroMassa = el('p', { class: 'erro-form', role: 'alert' });

  const form = el(
    'form',
    {},
    el('h2', { texto: 'Follow-up de todos' }),
    infoMassa,
    el('label', { class: 'campo' }, 'Data e hora do follow-up', campoQuandoMassa),
    el('label', { class: 'campo' }, 'Motivo (opcional)', campoMotivoMassa),
    erroMassa,
    el(
      'div',
      { class: 'dialog-acoes' },
      el('button', { type: 'button', class: 'botao-sec', texto: 'Cancelar', onclick: () => dlgMassa.close() }),
      el('button', { type: 'submit', class: 'botao', texto: 'Agendar para todos' })
    )
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erroMassa.textContent = '';
    try {
      const m = campoMotivoMassa.value.trim();
      await api('/leads/followup-em-massa', {
        metodo: 'POST',
        corpo: {
          ids: idsMassa,
          quando: new Date(campoQuandoMassa.value).toISOString(),
          ...(m ? { motivo: m } : {}),
        },
      });
      dlgMassa.close();
      await carregar();
    } catch (err) {
      erroMassa.textContent = err.message;
    }
  });

  dlgMassa = el('dialog', {}, form);
  document.body.append(dlgMassa);
}

function abrirFollowupEmMassa(leads) {
  if (!dlgMassa) montarDlgMassa();
  idsMassa = leads.map((l) => l.id);
  infoMassa.textContent = `${idsMassa.length} lead(s) sem follow-up serão agendados para o mesmo horário.`;
  erroMassa.textContent = '';
  const agora = new Date();
  agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
  campoQuandoMassa.min = agora.toISOString().slice(0, 16);
  campoQuandoMassa.value = amanhaNove();
  campoMotivoMassa.value = 'Sem resposta após a copy';
  dlgMassa.showModal();
}

function criarBarraFollowup(leads) {
  const semFollowup = leads.filter((l) => !l.proximo_followup);
  if (!semFollowup.length) return null;
  return el(
    'div',
    { class: 'coluna-acao' },
    el('span', { class: 'coluna-acao-info', texto: `${semFollowup.length} sem follow-up` }),
    el('button', {
      type: 'button',
      class: 'botao-sec',
      texto: 'Follow-up de todos',
      onclick: () => abrirFollowupEmMassa(semFollowup),
    })
  );
}

// ---------- Colunas ----------
function criarColuna({ etapa, total, leads }) {
  const corpo = el(
    'div',
    { class: 'coluna-corpo' },
    leads.length ? leads.map(criarCard) : el('p', { class: 'coluna-vazia', texto: 'Nenhum lead aqui ainda' })
  );

  const coluna = el(
    'section',
    {
      class: `coluna coluna-${etapa}`,
      ondragover: (e) => {
        if (arrastandoId === null) return;
        e.preventDefault();
        coluna.classList.add('sobre');
      },
      ondragleave: (e) => {
        if (!coluna.contains(e.relatedTarget)) coluna.classList.remove('sobre');
      },
      ondrop: (e) => {
        e.preventDefault();
        coluna.classList.remove('sobre');
        const lead = leadsPorId.get(arrastandoId);
        if (lead) moverLead(lead, etapa);
      },
    },
    el(
      'header',
      { class: 'coluna-topo' },
      el('h2', { texto: NOME_ETAPA[etapa] }),
      el('span', { class: 'contador', texto: String(total) })
    ),
    etapa === 'copy_enviada' ? criarBarraFollowup(leads) : null,
    corpo
  );
  return coluna;
}

// ---------- Filtros (feitos no navegador, sem consultar o servidor) ----------
const campoBusca = document.getElementById('crm-busca');
const filtroNicho = document.getElementById('crm-filtro-nicho');
const filtroTemp = document.getElementById('crm-filtro-temp');
const botaoLimpar = document.getElementById('crm-limpar-filtros');
let ultimoDado = null;

function semAcento(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function filtrando() {
  return Boolean(campoBusca.value.trim() || filtroNicho.value || filtroTemp.value);
}

function passaFiltro(lead) {
  const q = semAcento(campoBusca.value.trim());
  if (q) {
    const texto = semAcento([lead.nome, lead.nicho, lead.cidade, lead.telefone].filter(Boolean).join(' '));
    if (!texto.includes(q)) return false;
  }
  if (filtroNicho.value && lead.nicho !== filtroNicho.value) return false;
  if (filtroTemp.value && lead.temperatura !== filtroTemp.value) return false;
  return true;
}

function atualizarNichos(colunas) {
  const atual = filtroNicho.value;
  const nichos = [...new Set(colunas.flatMap((c) => c.leads).map((l) => l.nicho).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  );
  filtroNicho.replaceChildren(
    el('option', { value: '', texto: 'Todos os nichos' }),
    ...nichos.map((n) => el('option', { value: n, texto: n }))
  );
  filtroNicho.value = nichos.includes(atual) ? atual : '';
}

// ---------- Animação de entrada dos cards (só ao abrir o CRM) ----------
let animarProximoDesenho = true;

const observador = new IntersectionObserver(
  (entradas) => {
    let ordem = 0;
    for (const entrada of entradas) {
      if (!entrada.isIntersecting) continue;
      const card = entrada.target;
      observador.unobserve(card);
      card.style.animationDelay = `${Math.min(ordem, 6) * 55}ms`;
      ordem += 1;
      card.addEventListener(
        'animationend',
        () => {
          card.classList.remove('revelar', 'visivel');
          card.style.animationDelay = '';
        },
        { once: true }
      );
      card.classList.add('visivel');
    }
  },
  { threshold: 0.08 }
);

function prepararAnimacao() {
  if (!animarProximoDesenho) return;
  animarProximoDesenho = false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  quadro.querySelectorAll('.lead-card').forEach((card) => {
    card.classList.add('revelar');
    observador.observe(card);
  });
}

function desenharQuadro() {
  if (!ultimoDado) return;
  const ativo = filtrando();
  botaoLimpar.hidden = !ativo;
  const colunas = ultimoDado.colunas.map((c) => {
    if (!ativo) return c;
    const leads = c.leads.filter(passaFiltro);
    return { ...c, leads, total: `${leads.length}/${c.total}` };
  });
  quadro.replaceChildren(...colunas.map(criarColuna));
  ajustarBarraTopo();
  prepararAnimacao();
}

function desenhar(dados) {
  ultimoDado = dados;
  const { colunas, descartados } = dados;
  leadsPorId = new Map(colunas.flatMap((c) => c.leads).map((l) => [l.id, l]));
  atualizarNichos(colunas);
  desenharQuadro();
  totalDescartados.textContent = descartados ? `Descartados (fora do funil): ${descartados}` : '';
}

campoBusca.addEventListener('input', desenharQuadro);
filtroNicho.addEventListener('change', desenharQuadro);
filtroTemp.addEventListener('change', desenharQuadro);
botaoLimpar.addEventListener('click', () => {
  campoBusca.value = '';
  filtroNicho.value = '';
  filtroTemp.value = '';
  desenharQuadro();
});

async function carregar() {
  try {
    desenhar(await api('/leads/kanban'));
    mostrarErro('');
  } catch (e) {
    mostrarErro(`Não foi possível carregar os leads: ${e.message}`);
  }
}

// ---------- Mover entre etapas ----------
const dlgMotivo = document.getElementById('dlg-motivo');
const formMotivo = document.getElementById('form-motivo');

function pedirMotivo(titulo) {
  return new Promise((resolver) => {
    document.getElementById('motivo-titulo').textContent = titulo;
    formMotivo.elements.motivo.value = '';
    dlgMotivo.returnValue = '';
    const aoFechar = () => {
      dlgMotivo.removeEventListener('close', aoFechar);
      resolver(dlgMotivo.returnValue === 'ok' ? formMotivo.elements.motivo.value.trim() : '');
    };
    dlgMotivo.addEventListener('close', aoFechar);
    dlgMotivo.showModal();
  });
}

// ---------- Valor ao fechar ----------
let dlgFechado = null;
let tituloFechado;
let campoValorFechado;
let campoEntradaFechado;

function montarDlgFechado() {
  campoValorFechado = document.createElement('input');
  campoValorFechado.type = 'number';
  campoValorFechado.min = '0';
  campoValorFechado.step = '0.01';
  campoValorFechado.inputMode = 'decimal';

  campoEntradaFechado = document.createElement('input');
  campoEntradaFechado.type = 'number';
  campoEntradaFechado.min = '0';
  campoEntradaFechado.step = '0.01';
  campoEntradaFechado.inputMode = 'decimal';

  tituloFechado = el('h2', { texto: 'Fechar lead' });
  const form = el(
    'form',
    {},
    tituloFechado,
    el('p', {
      class: 'subtitulo',
      texto: 'Informe o valor combinado. Se deixar em branco, você preenche depois na tela Projetos.',
    }),
    el('label', { class: 'campo' }, 'Valor total do projeto (R$)', campoValorFechado),
    el('label', { class: 'campo' }, 'Entrada já recebida (R$)', campoEntradaFechado),
    el(
      'div',
      { class: 'dialog-acoes' },
      el('button', { type: 'button', class: 'botao-sec', texto: 'Cancelar', onclick: () => dlgFechado.close('cancelar') }),
      el('button', { type: 'submit', class: 'botao', texto: 'Fechar lead' })
    )
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    dlgFechado.close('ok');
  });
  dlgFechado = el('dialog', {}, form);
  document.body.append(dlgFechado);
}

// Devolve { valor, recebido } ou null se a pessoa cancelar.
function pedirValoresFechamento(nome) {
  if (!dlgFechado) montarDlgFechado();
  tituloFechado.textContent = `Fechar: ${nome}`;
  campoValorFechado.value = '';
  campoEntradaFechado.value = '';
  return new Promise((resolver) => {
    const aoFechar = () => {
      dlgFechado.removeEventListener('close', aoFechar);
      resolver(
        dlgFechado.returnValue === 'ok'
          ? { valor: campoValorFechado.value, recebido: campoEntradaFechado.value }
          : null
      );
    };
    dlgFechado.addEventListener('close', aoFechar);
    dlgFechado.returnValue = '';
    dlgFechado.showModal();
  });
}

async function moverLead(lead, destino) {
  if (!destino || destino === lead.etapa) return;
    if (destino === 'copy_enviada' && !lead.verificado) {
    const seguir = window.confirm(
      'A verificação deste lead não está completa. Mover para "Copy enviada" mesmo assim?'
    );
    if (!seguir) return;
  }
  let motivo;
  if (destino === 'perdido' || destino === 'descartado') {
    const acao = destino === 'perdido' ? 'Motivo da perda' : 'Motivo do descarte';
    motivo = await pedirMotivo(`${acao}: ${lead.nome}`);
    if (!motivo) return;
  }
    let projeto;
  if (destino === 'fechado') {
    projeto = await pedirValoresFechamento(lead.nome);
    if (projeto === null) return;
  }
  try {
    await api(`/leads/${lead.id}/etapa`, { metodo: 'PATCH', corpo: { etapa: destino, motivo, projeto } });
    mostrarErro('');
  } catch (e) {
    mostrarErro(e.message);
  }
  await carregar();
}

// ---------- Novo lead ----------
const dlgNovo = document.getElementById('dlg-novo');
const formNovo = document.getElementById('form-novo');
const erroNovo = document.getElementById('erro-novo');

document.getElementById('btn-novo-lead').addEventListener('click', () => {
  erroNovo.textContent = '';
  dlgNovo.showModal();
});
document.getElementById('cancelar-novo').addEventListener('click', () => dlgNovo.close());

formNovo.addEventListener('submit', async (e) => {
  e.preventDefault();
  erroNovo.textContent = '';
  const dados = {};
  for (const [campo, valor] of new FormData(formNovo)) {
    if (String(valor).trim() !== '') dados[campo] = String(valor).trim();
  }
  dados.fonte = 'manual';
    if (dados.site) {
    const linkDeBio = /(beacons\.ai|linktr\.ee|linktree|bio\.link|lnk\.bio|taplink|bit\.ly|wa\.me|instagram\.com|facebook\.com)/i;
    dados.site_tipo = linkDeBio.test(dados.site) ? 'encurtador' : 'site';
  }
  try {
    await api('/leads', { metodo: 'POST', corpo: dados });
    formNovo.reset();
    dlgNovo.close();
    await carregar();
  } catch (err) {
    erroNovo.textContent = err.message;
  }
});

// ---------- Início ----------
window.addEventListener('hashchange', () => {
  if (!location.hash || location.hash.startsWith('#/crm')) {
    animarProximoDesenho = true;
    carregar();
  }
});
carregar();

// Atualiza o quadro a cada minuto: os timers andam e os follow-ups automáticos aparecem sozinhos.
setInterval(() => {
  const naTela = !location.hash || location.hash.startsWith('#/crm');
  if (naTela && arrastandoId === null && !document.querySelector('dialog[open]')) carregar();
}, 60_000);
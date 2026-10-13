import { api } from './api.js';
import { el } from './dom.js';

const dlg = document.getElementById('dlg-abordagem');
const titulo = document.getElementById('abordagem-titulo');
const subtitulo = document.getElementById('abordagem-sub');
const avisoErro = document.getElementById('abordagem-erro');
const linhaRitmo = document.getElementById('abordagem-ritmo');
const corpo = document.getElementById('abordagem-corpo');
const status = document.getElementById('abordagem-status');
const botaoMarcar = document.getElementById('abordagem-marcar');
const botaoPadrao = document.getElementById('abordagem-padrao');
const abas = {
  copy: document.getElementById('aba-copy'),
  resumo: document.getElementById('aba-resumo'),
};

const NOME_MODO = { copy: 'Copy pronta', resumo: 'Resumo para conversar' };
const ETAPAS_INICIAIS = ['lead_do_dia', 'qualificado'];

let lead = null;
let aoMudar = () => {};
let dados = null; // { resumo, copias } do lead aberto
let modoAtual = 'copy';
let copyUsada = null; // título da copy cujo WhatsApp foi aberto

function mostrarErro(mensagem) {
  avisoErro.textContent = mensagem;
  avisoErro.hidden = !mensagem;
}

function canal(texto, href, classe) {
  if (!href) return el('span', { class: `canal ${classe} desativado`, texto });
  return el('a', { class: `canal ${classe}`, href, target: '_blank', rel: 'noopener noreferrer', texto });
}

// ---------- Aba: resumo para conversar ----------
function desenharResumo() {
  const r = dados.resumo;
  corpo.replaceChildren(
    el('dl', { class: 'panorama' }, ...r.panorama.flatMap((p) => [el('dt', { texto: p.rotulo }), el('dd', { texto: p.valor })])),
    el('div', { class: 'bloco' }, el('h3', { texto: 'Dor' }), el('p', { class: 'dor-destaque', texto: r.dor })),
    el('div', { class: 'bloco' }, el('h3', { texto: 'O que um site resolveria' }), el('p', { texto: r.oportunidade })),
    el(
      'div',
      { class: 'canais' },
      canal('WhatsApp', r.links.whatsapp, 'canal-whats'),
      canal('Instagram', r.links.instagram, 'canal-insta'),
      canal('Site', r.links.site, 'canal-site'),
      canal('Mapa', r.links.mapa, 'canal-mapa')
    )
  );
}

// ---------- Aba: copy pronta ----------
function criarCardCopy(c) {
  const base = dados.resumo.links.whatsapp; // https://wa.me/NUMERO (sem texto)

  const areaTexto = el('textarea', { name: 'mensagem', rows: '11', maxlength: '3000' });
  areaTexto.value = c.mensagem;

  const aviso = el('p', { class: 'erro-form', texto: 'Tem um trecho entre [colchetes] para preencher antes de enviar.' });
  aviso.hidden = true;

  const copiar = el('button', {
    type: 'button',
    class: 'botao-sec',
    texto: 'Copiar texto',
    onclick: async () => {
      try {
        await navigator.clipboard.writeText(areaTexto.value);
        status.textContent = 'Texto copiado.';
      } catch {
        status.textContent = 'Não consegui copiar. Selecione o texto e use Ctrl + C.';
      }
    },
  });

  const abrirZap = el('button', {
    type: 'button',
    class: 'botao',
    texto: 'Abrir WhatsApp com a mensagem',
    onclick: () => {
      copyUsada = c.titulo;
      window.open(`${base}?text=${encodeURIComponent(areaTexto.value.trim())}`, '_blank', 'noopener');
      status.textContent = 'WhatsApp aberto. Revise e envie por lá; depois marque como abordado.';
    },
  });

  function atualizar() {
    const pendente = /\[[^\]]+\]/.test(areaTexto.value);
    aviso.hidden = !pendente;
    abrirZap.disabled = pendente || !base || !areaTexto.value.trim();
  }
  areaTexto.addEventListener('input', atualizar);
  atualizar();

  return el(
    'article',
    { class: 'cartao copy-card' },
    el(
      'div',
      { class: 'copy-topo' },
      el('h3', { texto: c.titulo }),
      c.recomendada && el('span', { class: 'selo selo-bom', texto: 'Recomendada para este lead' }),
      c.nova && el('span', { class: 'selo', texto: 'Nova' })
    ),
    el('label', { class: 'campo' }, 'Mensagem (você pode editar antes de enviar)', areaTexto),
    aviso,
    !base && el('p', { class: 'subtitulo', texto: 'Este lead não tem WhatsApp. Copie o texto e envie pelo Instagram.' }),
    el('div', { class: 'dialog-acoes' }, copiar, abrirZap)
  );
}

function desenharCopies() {
  const { copies, nicho } = dados.copias;
  if (!copies.length) {
    corpo.replaceChildren(
      el('p', {
        class: 'subtitulo',
        texto: nicho
          ? 'Ainda não há copies para este nicho.'
          : 'Não reconheci o nicho deste lead, então não tenho copies para sugerir. Use o resumo para conversar.',
      })
    );
    return;
  }

  const destaque = copies.filter((c) => c.recomendada);
  const resto = copies.filter((c) => !c.recomendada);
  const nos = destaque.map(criarCardCopy);
  if (resto.length) {
    const outras = el(
      'details',
      { class: 'outras-copies' },
      el('summary', { texto: `Outras versões para este nicho (${resto.length})` }),
      ...resto.map(criarCardCopy)
    );
    if (!destaque.length) outras.open = true;
    nos.push(outras);
  }
  corpo.replaceChildren(...nos);
}

// ---------- Abas ----------
function selecionarAba(modo) {
  modoAtual = modo;
  for (const [m, botao] of Object.entries(abas)) botao.setAttribute('aria-selected', String(m === modo));
  status.textContent = '';
  if (!dados) return;
  if (modo === 'copy') desenharCopies();
  else desenharResumo();
}

abas.copy.addEventListener('click', () => selecionarAba('copy'));
abas.resumo.addEventListener('click', () => selecionarAba('resumo'));

botaoPadrao.addEventListener('click', async () => {
  try {
    await api('/configuracoes', { metodo: 'PUT', corpo: { modo_abordagem: modoAtual } });
    status.textContent = `Padrão salvo: ${NOME_MODO[modoAtual]}.`;
  } catch (e) {
    mostrarErro(e.message);
  }
});

// ---------- Marcar como abordado ----------
botaoMarcar.addEventListener('click', async () => {
  if (!lead) return;
    if (!lead.verificado) {
    const seguir = window.confirm('A verificação deste lead não está completa. Marcar como abordado mesmo assim?');
    if (!seguir) return;
  }
  botaoMarcar.disabled = true;
  try {
    const nota = copyUsada ? `Abordagem com a copy: ${copyUsada}` : 'Abordagem por conversa (sem copy pronta)';
    await api(`/leads/${lead.id}/notas`, { metodo: 'POST', corpo: { texto: nota } });
    await api(`/leads/${lead.id}/etapa`, { metodo: 'PATCH', corpo: { etapa: 'copy_enviada' } });
    dlg.close();
    aoMudar();
  } catch (e) {
    mostrarErro(e.message);
    botaoMarcar.disabled = false;
  }
});

document.getElementById('abordagem-fechar').addEventListener('click', () => dlg.close());

// ---------- Abrir ----------
function mostrarRitmo(r) {
  linhaRitmo.textContent = r.aviso || `Abordagens hoje: ${r.hoje} · na última hora: ${r.ultima_hora}`;
  linhaRitmo.classList.toggle('ritmo-aviso', Boolean(r.aviso));
}

export async function abrirAbordagem(leadDoCard, callback) {
  lead = leadDoCard;
  aoMudar = callback || (() => {});
  dados = null;
  copyUsada = null;

  titulo.textContent = lead.nome;
  subtitulo.textContent = [lead.nicho, [lead.cidade, lead.uf].filter(Boolean).join(' - ')].filter(Boolean).join(' · ');
  mostrarErro('');
  status.textContent = '';
  linhaRitmo.textContent = '';
  corpo.replaceChildren(el('p', { class: 'subtitulo', texto: 'Carregando…' }));
  botaoMarcar.hidden = !ETAPAS_INICIAIS.includes(lead.etapa);
  botaoMarcar.disabled = false;
  if (!dlg.open) dlg.showModal();

  try {
    const [config, resumo, copias, ritmo] = await Promise.all([
      api('/configuracoes'),
      api(`/leads/${lead.id}/resumo`),
      api(`/leads/${lead.id}/copies`),
      api('/abordagem/ritmo'),
    ]);
    dados = { resumo, copias };
    mostrarRitmo(ritmo);
    selecionarAba(config.modo_abordagem);
  } catch (e) {
    corpo.replaceChildren();
    mostrarErro(e.message);
  }
}
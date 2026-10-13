import { api } from './api.js';
import { el } from './dom.js';

const ITENS = [
  ['site_escondido', 'Conferi se não há site escondido (busca no Google)'],
  ['instagram', 'Conferi o Instagram'],
  ['horario_fuso', 'Horário e fuso conferidos no Maps'],
  ['nao_contatar', 'Não está na lista de não contatar'],
];

const ROTULO_TIPO = {
  nota: 'Nota',
  sistema: 'Sistema',
  etapa: 'Etapa',
  followup: 'Follow-up',
  verificacao: 'Verificação',
};

function dataHora(sql) {
  if (!sql) return '';
  const d = new Date(`${sql.replace(' ', 'T')}Z`);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Usado pelo card do CRM para o selo de follow-up.
export function infoFollowup(sql) {
  if (!sql) return null;
  const d = new Date(`${sql.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dia = new Date(d);
  dia.setHours(0, 0, 0, 0);
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (dia < hoje) return { classe: 'selo-ruim', texto: `Follow-up atrasado (${data})` };
  if (dia.getTime() === hoje.getTime()) return { classe: 'selo-medio', texto: `Follow-up hoje ${hora}` };
  return { classe: '', texto: `Follow-up ${data}` };
}

function preencher(caixa, ...itens) {
  caixa.replaceChildren(...itens.flat().filter(Boolean));
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const area = document.createElement('textarea');
    area.value = texto;
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

// ---------- Editar a data de um follow-up (usada aqui e no painel) ----------
let dlgEditar = null;
let subEditar;
let campoQuandoEditar;
let campoMotivoEditar;
let erroEditar;
let leadEditando = null;
let aoSalvarEditar = null;

function paraCampoLocal(sql) {
  const d = new Date(`${sql.replace(' ', 'T')}Z`);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function montarDlgEditar() {
  campoQuandoEditar = document.createElement('input');
  campoQuandoEditar.type = 'datetime-local';
  campoQuandoEditar.required = true;

  campoMotivoEditar = document.createElement('input');
  campoMotivoEditar.type = 'text';
  campoMotivoEditar.maxLength = 300;
  campoMotivoEditar.placeholder = 'Ex.: pediu para falar na sexta';

  subEditar = el('p', { class: 'subtitulo' });
  erroEditar = el('p', { class: 'erro-form', role: 'alert' });

  const form = el(
    'form',
    {},
    el('h2', { texto: 'Editar follow-up' }),
    subEditar,
    el('label', { class: 'campo' }, 'Nova data e hora', campoQuandoEditar),
    el('label', { class: 'campo' }, 'Motivo (opcional)', campoMotivoEditar),
    erroEditar,
    el(
      'div',
      { class: 'dialog-acoes' },
      el('button', { type: 'button', class: 'botao-sec', texto: 'Cancelar', onclick: () => dlgEditar.close() }),
      el('button', { type: 'submit', class: 'botao', texto: 'Salvar' })
    )
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erroEditar.textContent = '';
    try {
      const m = campoMotivoEditar.value.trim();
      await api(`/leads/${leadEditando.id}/followup`, {
        metodo: 'PATCH',
        corpo: { quando: new Date(campoQuandoEditar.value).toISOString(), ...(m ? { motivo: m } : {}) },
      });
      dlgEditar.close();
      if (aoSalvarEditar) await aoSalvarEditar();
    } catch (err) {
      erroEditar.textContent = err.message;
    }
  });

  dlgEditar = el('dialog', {}, form);
  document.body.append(dlgEditar);
}

export function editarFollowup(lead, callback) {
  if (!dlgEditar) montarDlgEditar();
  leadEditando = lead;
  aoSalvarEditar = callback;
  subEditar.textContent = lead.nome;
  erroEditar.textContent = '';
  campoMotivoEditar.value = '';

  const agora = new Date();
  agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
  const minimo = agora.toISOString().slice(0, 16);
  campoQuandoEditar.min = minimo;

  // Se o follow-up atual já passou, sugere o horário mais próximo possível.
  const atual = lead.proximo_followup ? paraCampoLocal(lead.proximo_followup) : minimo;
  campoQuandoEditar.value = atual < minimo ? minimo : atual;
  dlgEditar.showModal();
}

let dlg = null;
let tituloEl;
let erroEl;
let statusEl;
let boxFollowup;
let boxInsta;
let boxVerif;
let boxHistorico;
let campoNota;
let leadAtual = null;
let aoFechar = null;
let alterou = false;

// Roda uma ação, mostra o erro se falhar e devolve true/false.
async function agir(fn, muda = true) {
  erroEl.textContent = '';
  try {
    await fn();
    if (muda) alterou = true;
    return true;
  } catch (e) {
    erroEl.textContent = e.message;
    return false;
  }
}

async function recarregar() {
  leadAtual = await api(`/leads/${leadAtual.id}`);
  desenhar();
}

function desenharFollowup() {
  const lead = leadAtual;

  const motivo = document.createElement('input');
  motivo.type = 'text';
  motivo.className = 'det-input';
  motivo.placeholder = 'Motivo (ex.: vai falar com o chefe)';

  const quando = document.createElement('input');
  quando.type = 'datetime-local';
  quando.className = 'det-input';
  const agora = new Date();
  agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
  quando.min = agora.toISOString().slice(0, 16);

  const agendar = (corpo) =>
    agir(async () => {
      const m = motivo.value.trim();
      await api(`/leads/${lead.id}/followup`, {
        metodo: 'POST',
        corpo: { ...corpo, ...(m ? { motivo: m } : {}) },
      });
      await recarregar();
    });

  const atalhos = [
    [1, 'Amanhã'],
    [2, 'Em 2 dias'],
    [3, 'Em 3 dias'],
  ].map(([dias, texto]) =>
    el('button', { type: 'button', class: 'botao-sec', texto, onclick: () => agendar({ dias }) })
  );

  const agendado = lead.proximo_followup
    ? el(
        'div',
        { class: 'det-linha' },
        el('span', { class: 'det-destaque', texto: `Agendado para ${dataHora(lead.proximo_followup)}` }),
        el('button', {
          type: 'button',
          class: 'botao-sec',
          texto: 'Marcar como feito',
          onclick: () =>
            agir(async () => {
              await api(`/leads/${lead.id}/followup/concluir`, { metodo: 'POST' });
              await recarregar();
            }),
        }),
        el('button', {
          type: 'button',
          class: 'botao-sec',
          texto: 'Editar',
          onclick: () =>
            editarFollowup(lead, async () => {
              alterou = true;
              await recarregar();
            }),
        })
      )
    : el('p', { class: 'det-dica', texto: 'Nenhum follow-up agendado.' });

  preencher(
    boxFollowup,
    el('h3', { texto: 'Follow-up' }),
    agendado,
    motivo,
    el('div', { class: 'det-linha' }, atalhos),
    el(
      'div',
      { class: 'det-linha' },
      quando,
      el('button', {
        type: 'button',
        class: 'botao',
        texto: 'Agendar',
        onclick: () => {
          if (!quando.value) {
            erroEl.textContent = 'Escolha data e hora';
            return;
          }
          agendar({ quando: new Date(quando.value).toISOString() });
        },
      })
    )
  );
}

function desenharVerificacao() {
  const lead = leadAtual;
  const linhas = ITENS.map(([chave, texto]) => {
    const caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.checked = lead.verificacao[chave] === true;
    caixa.addEventListener('change', async () => {
      const ok = await agir(async () => {
        leadAtual = await api(`/leads/${lead.id}/verificacao`, {
          metodo: 'PATCH',
          corpo: { itens: { [chave]: caixa.checked } },
        });
        desenhar();
      });
      if (!ok) desenharVerificacao();
    });
    return el('label', { class: 'det-check' }, caixa, el('span', { texto }));
  });

  preencher(
    boxVerif,
    el('h3', { texto: 'Verificação antes de abordar' }),
    lead.na_lista_nao_contatar
      ? el('p', { class: 'det-alerta', texto: 'Atenção: este telefone está na lista de não contatar.' })
      : null,
    linhas,
    el('p', {
      class: 'det-dica',
      texto: lead.verificado
        ? 'Verificação completa.'
        : 'Verificação incompleta. É só um aviso, não bloqueia o envio.',
    })
  );
}

function desenharInstagram() {
  const lead = leadAtual;

  const campo = document.createElement('input');
  campo.type = 'text';
  campo.className = 'det-input';
  campo.placeholder = 'Usuário ou link do perfil';
  campo.value = lead.instagram || '';

  const salvar = (valor) =>
    agir(async () => {
      await api(`/leads/${lead.id}/instagram`, { metodo: 'PATCH', corpo: { instagram: valor } });
      await recarregar();
    });

  const busca = `https://www.google.com/search?q=${encodeURIComponent(
    [lead.nome, lead.cidade, 'instagram'].filter(Boolean).join(' ')
  )}`;

  preencher(
    boxInsta,
    el('h3', { texto: 'Instagram' }),
    lead.instagram
      ? el(
          'p',
          { class: 'det-dica' },
          'Perfil atual: ',
          el('a', {
            href: `https://instagram.com/${encodeURIComponent(lead.instagram)}`,
            target: '_blank',
            rel: 'noopener noreferrer',
            texto: `@${lead.instagram}`,
          })
        )
      : el('p', { class: 'det-dica', texto: 'Este lead não tem Instagram cadastrado.' }),
    campo,
    el(
      'div',
      { class: 'det-linha' },
      el('button', { type: 'button', class: 'botao', texto: 'Salvar', onclick: () => salvar(campo.value) }),
      lead.instagram
        ? el('button', {
            type: 'button',
            class: 'botao-sec',
            texto: 'Perfil não existe (remover)',
            onclick: () => salvar(''),
          })
        : null,
      el('a', { class: 'botao-sec', href: busca, target: '_blank', rel: 'noopener noreferrer', texto: 'Procurar no Google' })
    )
  );
}

function desenharHistorico() {
  const itens = leadAtual.notas;
  preencher(
    boxHistorico,
    itens.length
      ? itens.map((n) =>
          el(
            'div',
            { class: `det-item det-${n.tipo}` },
            el(
              'div',
              { class: 'det-item-topo' },
              el('span', { class: 'det-tipo', texto: ROTULO_TIPO[n.tipo] || n.tipo }),
              el('span', { class: 'det-data', texto: dataHora(n.criado_em) })
            ),
            el('p', { class: 'det-texto', texto: n.texto })
          )
        )
      : el('p', { class: 'det-dica', texto: 'Sem registros ainda.' })
  );
}

function desenhar() {
  desenharFollowup();
  desenharVerificacao();
  desenharInstagram();
  desenharHistorico();
}

async function salvarNota() {
  const texto = campoNota.value.trim();
  if (!texto) return;
  const ok = await agir(async () => {
    await api(`/leads/${leadAtual.id}/notas`, { metodo: 'POST', corpo: { texto } });
    await recarregar();
  });
  if (ok) campoNota.value = '';
}

async function copiarResumo() {
  statusEl.textContent = '';
  await agir(async () => {
    const { texto } = await api(`/leads/${leadAtual.id}/resumo-claude`);
    await copiar(texto);
    statusEl.textContent = 'Resumo copiado. É só colar no chat com o Claude.';
  }, false);
}

function montar() {
  tituloEl = el('h2', { class: 'det-titulo', texto: '' });
  erroEl = el('p', { class: 'aviso-erro', role: 'alert' });
  statusEl = el('span', { class: 'status' });
  boxFollowup = el('section', { class: 'det-secao' });
  boxVerif = el('section', { class: 'det-secao' });
  boxInsta = el('section', { class: 'det-secao' });
  boxHistorico = el('div', { class: 'det-historico' });

  campoNota = document.createElement('textarea');
  campoNota.rows = 3;
  campoNota.className = 'det-input';
  campoNota.placeholder = 'Escreva uma nota sobre este lead…';

  dlg = el(
    'dialog',
    { class: 'dlg-lead' },
    el(
      'header',
      { class: 'det-topo' },
      tituloEl,
      el('button', { type: 'button', class: 'botao-sec', texto: 'Fechar', onclick: () => dlg.close() })
    ),
    erroEl,
    boxFollowup,
    boxVerif,
    boxInsta,
    el(
      'section',
      { class: 'det-secao' },
      el('h3', { texto: 'Notas e histórico' }),
      campoNota,
      el('div', { class: 'det-linha' }, el('button', { type: 'button', class: 'botao', texto: 'Salvar nota', onclick: salvarNota })),
      boxHistorico
    ),
    el(
      'div',
      { class: 'dialog-acoes' },
      statusEl,
      el('button', { type: 'button', class: 'botao-sec', texto: 'Copiar resumo pro Claude', onclick: copiarResumo })
    )
  );
  dlg.addEventListener('close', () => {
    if (alterou && aoFechar) aoFechar();
  });
  document.body.append(dlg);
}

export async function abrirDetalhe(lead, callback) {
  if (!dlg) montar();
  aoFechar = callback;
  alterou = false;
  try {
    leadAtual = await api(`/leads/${lead.id}`);
  } catch (e) {
    window.alert(e.message);
    return;
  }
  tituloEl.textContent = leadAtual.nome;
  erroEl.textContent = '';
  statusEl.textContent = '';
  campoNota.value = '';
  desenhar();
  dlg.showModal();
}
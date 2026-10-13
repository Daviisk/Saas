import { api } from './api.js';
import { el } from './dom.js';

const avisoErro = document.getElementById('desc-erro');
const statusEl = document.getElementById('desc-status');
const boxDesc = document.getElementById('desc-lista');
const boxNc = document.getElementById('nc-lista');
const formNc = document.getElementById('form-nc');
const erroNc = document.getElementById('nc-erro');

function mostrarErro(mensagem) {
  avisoErro.textContent = mensagem;
  avisoErro.hidden = !mensagem;
}

function telefoneBonito(valor) {
  const d = String(valor ?? '').replace(/\D/g, '');
  const local = d.startsWith('55') && (d.length === 12 || d.length === 13) ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return String(valor ?? '');
}

function dataCurta(sql) {
  if (!sql) return '';
  return new Date(`${sql.replace(' ', 'T')}Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// Roda uma ação, mostra o erro se falhar e recarrega as duas listas.
async function agir(fn, mensagemOk = '') {
  try {
    await fn();
    mostrarErro('');
    statusEl.textContent = mensagemOk;
  } catch (e) {
    statusEl.textContent = '';
    mostrarErro(e.message);
  }
  await carregar();
}

// ---------- Descartados ----------
function linhaDescartado(l) {
  const local = [l.cidade, l.uf].filter(Boolean).join(' - ');
  return el(
    'div',
    { class: 'desc-linha' },
    el(
      'div',
      { class: 'desc-info' },
      el('strong', { texto: l.nome }),
      el(
        'div',
        { class: 'lead-info' },
        l.nicho ? el('span', { class: 'selo', texto: l.nicho }) : null,
        local ? el('span', { class: 'selo', texto: local }) : null,
        el('span', { class: 'selo', texto: `Descartado em ${dataCurta(l.atualizado_em)}` })
      ),
      el('p', { class: 'desc-motivo', texto: l.motivo_descarte ? `Motivo: ${l.motivo_descarte}` : 'Sem motivo registrado' })
    ),
    el(
      'div',
      { class: 'desc-acoes' },
      el('button', {
        type: 'button',
        class: 'botao-sec',
        texto: 'Restaurar',
        onclick: () =>
          agir(
            () => api(`/leads/${l.id}/etapa`, { metodo: 'PATCH', corpo: { etapa: 'lead_do_dia' } }),
            `${l.nome} voltou para "Lead do dia".`
          ),
      }),
      l.telefone
        ? el('button', {
            type: 'button',
            class: 'botao-sec',
            texto: 'Não contatar',
            onclick: () =>
              agir(
                () =>
                  api('/nao-contatar', {
                    metodo: 'POST',
                    corpo: { telefone: l.telefone, motivo: l.motivo_descarte || 'Descartado no CRM' },
                  }),
                'Telefone adicionado à lista de não contatar.'
              ),
          })
        : null,
      el('button', {
        type: 'button',
        class: 'botao-sec desc-excluir',
        texto: 'Excluir de vez',
        onclick: () => {
          if (!window.confirm(`Excluir "${l.nome}" de vez? Isso apaga o lead e o histórico dele e não dá pra desfazer.`)) return;
          agir(() => api(`/leads/${l.id}`, { metodo: 'DELETE' }), 'Lead excluído.');
        },
      })
    )
  );
}

function desenharDescartados(lista) {
  boxDesc.replaceChildren(
    ...(lista.length ? lista.map(linhaDescartado) : [el('p', { class: 'subtitulo', texto: 'Nenhum lead descartado.' })])
  );
}

// ---------- Não contatar ----------
function linhaNc(n) {
  return el(
    'div',
    { class: 'desc-linha' },
    el(
      'div',
      { class: 'desc-info' },
      el('strong', { texto: telefoneBonito(n.telefone) }),
      el('p', { class: 'desc-motivo', texto: `${n.motivo || 'Sem motivo registrado'} · desde ${dataCurta(n.criado_em)}` })
    ),
    el('div', { class: 'desc-acoes' }, el('button', {
      type: 'button',
      class: 'botao-sec',
      texto: 'Remover da lista',
      onclick: () => {
        if (!window.confirm(`Remover ${telefoneBonito(n.telefone)} da lista de não contatar?`)) return;
        agir(() => api(`/nao-contatar/${n.id}`, { metodo: 'DELETE' }), 'Telefone removido da lista.');
      },
    }))
  );
}

function desenharNc(lista) {
  boxNc.replaceChildren(
    ...(lista.length ? lista.map(linhaNc) : [el('p', { class: 'subtitulo', texto: 'A lista está vazia.' })])
  );
}

formNc.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  erroNc.textContent = '';
  const dados = new FormData(formNc);
  try {
    await api('/nao-contatar', {
      metodo: 'POST',
      corpo: { telefone: String(dados.get('telefone') ?? ''), motivo: String(dados.get('motivo') ?? '') },
    });
    formNc.reset();
    statusEl.textContent = 'Telefone adicionado à lista de não contatar.';
    await carregar();
  } catch (e) {
    erroNc.textContent = e.message;
  }
});

async function carregar() {
  try {
    const [descartados, naoContatar] = await Promise.all([api('/leads/descartados'), api('/nao-contatar')]);
    desenharDescartados(descartados);
    desenharNc(naoContatar);
  } catch (e) {
    mostrarErro(`Não foi possível carregar: ${e.message}`);
  }
}

window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#/descartados')) {
    statusEl.textContent = '';
    carregar();
  }
});
carregar();
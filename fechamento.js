import { api } from './api.js';
import { el } from './dom.js';

const form = document.getElementById('form-fechamento');
const erro = document.getElementById('erro-fechamento');
const status = document.getElementById('status-fechamento');
const dica = document.getElementById('dica-abordados');
const dicaHoras = document.getElementById('dica-horas');
const corpoTabela = document.querySelector('#tabela-fechamentos tbody');
const resumo = document.getElementById('resumo-semana');

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const CAMPOS_INTEIROS = ['leads_buscados', 'leads_separados', 'leads_abordados', 'respostas', 'projetos_aceitos'];

function dataLocal(diasAtras = 0) {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const hoje = () => dataLocal();
const mostrarDia = (data) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

// Aceita "1.500,50" e "1500.50". Se tem vírgula, os pontos são separador de milhar.
function lerValor(texto) {
  const t = texto.trim();
  if (t === '') return 0;
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(normal);
  if (!Number.isFinite(n) || n < 0) throw new Error('Valor ganho inválido');
  return n;
}

function preencher(registro) {
  for (const campo of CAMPOS_INTEIROS) form.elements[campo].value = registro ? registro[campo] : '';
  form.elements.valor.value = registro && registro.valor_ganho > 0 ? String(registro.valor_ganho).replace('.', ',') : '';
  form.elements.metodo_pagamento.value = registro?.metodo_pagamento ?? '';
  form.elements.horas_trabalhadas.value = registro ? registro.horas_trabalhadas : '';
  form.elements.observacoes.value = registro?.observacoes ?? '';
}

function textoHoras(horas) {
  const min = Math.round(horas * 60);
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}

async function atualizarSugestao(data) {
  dica.hidden = true;
  dica.replaceChildren();
  dicaHoras.hidden = true;
  dicaHoras.replaceChildren();
  try {
    const s = await api(`/fechamentos/sugestao/${data}`);

    // Horas do cronômetro: preenche sozinho se o campo estiver vazio; senão, oferece o botão Usar.
    const campoHoras = form.elements.horas_trabalhadas;
    const horasNoCampo = Number(campoHoras.value) || 0;
    if (s.horas > 0) {
      if (horasNoCampo === 0) {
        campoHoras.value = s.horas;
        dicaHoras.append(`Preenchido pelo cronômetro: ${textoHoras(s.horas)}.`);
        dicaHoras.hidden = false;
      } else if (Math.abs(horasNoCampo - s.horas) >= 0.005) {
        dicaHoras.append(
          `O cronômetro registrou ${textoHoras(s.horas)} nesta data.`,
          el('button', {
            type: 'button',
            texto: 'Usar',
            onclick: () => {
              campoHoras.value = s.horas;
              dicaHoras.hidden = true;
            },
          })
        );
        dicaHoras.hidden = false;
      }
    }

    // Buscados, separados e abordados do sistema.
    const campos = [
      ['leads_buscados', s.buscados, 'buscados'],
      ['leads_separados', s.separados, 'separados'],
      ['leads_abordados', s.abordados, 'abordados'],
    ];
    const diferentes = campos.filter(([campo, n]) => n > 0 && String(n) !== form.elements[campo].value);
    if (diferentes.length === 0) return;

    const partes = campos.map(([, n, rotulo]) => `${n} ${rotulo}`).join(', ');
    dica.append(
      `O sistema registrou nesta data: ${partes}.`,
      el('button', {
        type: 'button',
        texto: 'Usar',
        onclick: () => {
          for (const [campo, n] of campos) if (n > 0) form.elements[campo].value = n;
          dica.hidden = true;
        },
      })
    );
    dica.hidden = false;
  } catch {
    /* a sugestão é opcional */
  }
}

async function carregarDia(data) {
  erro.textContent = '';
  status.textContent = '';
  try {
    preencher(await api(`/fechamentos/${data}`));
    await atualizarSugestao(data);
  } catch (e) {
    erro.textContent = e.message;
  }
}

// ---------- Histórico e resumo ----------
function cartaoResumo(rotulo, valor, classe = '') {
  return el('div', { class: 'resumo-item' }, el('span', { class: 'resumo-rotulo', texto: rotulo }), el('strong', { class: `resumo-numero ${classe}`, texto: valor }));
}

function desenharResumo(lista) {
  const inicio = dataLocal(6);
  const semana = lista.filter((f) => f.data >= inicio);
  const soma = (campo) => semana.reduce((total, f) => total + f[campo], 0);
  const abordados = soma('leads_abordados');
  const respostas = soma('respostas');
  const taxa = abordados > 0 ? `${Math.round((respostas / abordados) * 100)}%` : '—';
  resumo.replaceChildren(
    cartaoResumo('Abordados (7 dias)', String(abordados)),
    cartaoResumo('Respostas (7 dias)', `${respostas} · ${taxa}`),
    cartaoResumo('Projetos (7 dias)', String(soma('projetos_aceitos'))),
    cartaoResumo('Valor ganho (7 dias)', moeda.format(soma('valor_ganho')), 'bom')
  );
}

function desenharTabela(lista) {
  if (lista.length === 0) {
    corpoTabela.replaceChildren(el('tr', {}, el('td', { class: 'tabela-vazia', colspan: '8', texto: 'Nenhum fechamento salvo ainda.' })));
    return;
  }
  corpoTabela.replaceChildren(
    ...lista.map((f) =>
      el(
        'tr',
        {},
        el(
          'td',
          {},
          el('button', {
            type: 'button',
            class: 'link-linha',
            texto: mostrarDia(f.data),
            onclick: () => {
              form.elements.data.value = f.data;
              carregarDia(f.data);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            },
          })
        ),
        el('td', { texto: String(f.leads_buscados) }),
        el('td', { texto: String(f.leads_separados) }),
        el('td', { texto: String(f.leads_abordados) }),
        el('td', { texto: String(f.respostas) }),
        el('td', { texto: String(f.projetos_aceitos) }),
        el('td', { texto: moeda.format(f.valor_ganho) }),
        el('td', { texto: String(f.horas_trabalhadas) })
      )
    )
  );
}

async function carregarLista() {
  try {
    const lista = await api('/fechamentos?limite=14');
    desenharResumo(lista);
    desenharTabela(lista);
  } catch (e) {
    erro.textContent = e.message;
  }
}

// ---------- Salvar ----------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  erro.textContent = '';
  status.textContent = '';
  const data = form.elements.data.value;
  try {
    const corpo = { valor_ganho: lerValor(form.elements.valor.value) };
    for (const campo of CAMPOS_INTEIROS) {
      corpo[campo] = form.elements[campo].value === '' ? 0 : Number(form.elements[campo].value);
    }
    corpo.horas_trabalhadas = form.elements.horas_trabalhadas.value === '' ? 0 : Number(form.elements.horas_trabalhadas.value);
    corpo.metodo_pagamento = form.elements.metodo_pagamento.value.trim() || null;
    corpo.observacoes = form.elements.observacoes.value.trim() || null;

    await api(`/fechamentos/${data}`, { metodo: 'PUT', corpo });
    status.textContent = 'Salvo ✓';
    await carregarLista();
  } catch (err) {
    erro.textContent = err.message;
  }
});

form.elements.data.addEventListener('change', () => {
  if (form.elements.data.value) carregarDia(form.elements.data.value);
});

// Ao voltar para esta tela, atualiza só a sugestão e o histórico (sem apagar o que você digitou).
window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#/fechamento')) {
    atualizarSugestao(form.elements.data.value);
    carregarLista();
  }
});

form.elements.data.max = hoje();
form.elements.data.value = hoje();
carregarDia(hoje());
carregarLista();
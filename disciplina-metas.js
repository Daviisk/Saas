import { api } from './api.js';
import { el } from './dom.js';

const dlg = document.getElementById('dlg-metas');
const lista = document.getElementById('metas-lista');
const avisoErro = document.getElementById('metas-erro');
const status = document.getElementById('metas-status');
const formNova = document.getElementById('form-meta-nova');

let mudou = false;

function mostrarErro(mensagem) {
  avisoErro.textContent = mensagem;
  avisoErro.hidden = !mensagem;
}

async function salvar(meta, corpo) {
  try {
    await api(`/disciplina/metas/${meta.id}`, { metodo: 'PATCH', corpo });
    mostrarErro('');
    status.textContent = 'Salvo ✓';
    mudou = true;
  } catch (e) {
    mostrarErro(e.message);
    status.textContent = '';
  }
  await carregar();
}

function criarLinha(meta) {
  const ativa = el('input', { type: 'checkbox', 'aria-label': `Meta ativa: ${meta.rotulo}` });
  ativa.checked = meta.ativa;
  ativa.addEventListener('change', () => salvar(meta, { ativa: ativa.checked }));

  let campo;
  if (meta.tipo === 'manual') {
    const nome = el('input', { type: 'text', maxlength: '80', 'aria-label': 'Nome da meta' });
    nome.value = meta.nome;
    nome.addEventListener('change', () => salvar(meta, { nome: nome.value }));
    campo = el('div', { class: 'campo' }, nome);
  } else if (meta.tipo === 'abordados' || meta.tipo === 'horas') {
    const horas = meta.tipo === 'horas';
    const numero = el('input', {
      type: 'number',
      min: horas ? '0.25' : '1',
      max: horas ? '24' : '500',
      step: horas ? '0.25' : '1',
      'aria-label': horas ? 'Horas da meta' : 'Quantidade de leads da meta',
    });
    numero.value = meta.alvo;
    numero.addEventListener('change', () => salvar(meta, { alvo: Number(numero.value) }));
    campo = el(
      'div',
      { class: 'campo meta-alvo' },
      el('span', { texto: horas ? 'Trabalhar pelo menos' : 'Abordar' }),
      numero,
      el('span', { texto: horas ? 'horas' : 'leads' })
    );
  } else {
    campo = el('span', { texto: meta.rotulo });
  }

  return el(
    'div',
    { class: 'meta-linha' },
    el('label', { class: 'selecionar-todos' }, ativa, ' Ativa'),
    campo,
    el('span', { class: 'selo', texto: meta.automatica ? 'automática' : 'manual' })
  );
}

async function carregar() {
  try {
    const metas = await api('/disciplina/metas');
    lista.replaceChildren(...metas.map(criarLinha));
  } catch (e) {
    mostrarErro(e.message);
  }
}

formNova.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/disciplina/metas', { metodo: 'POST', corpo: { nome: formNova.elements.nome.value } });
    formNova.reset();
    mostrarErro('');
    status.textContent = 'Meta criada ✓';
    mudou = true;
    await carregar();
  } catch (err) {
    mostrarErro(err.message);
  }
});

document.getElementById('disc-editar-metas').addEventListener('click', async () => {
  mostrarErro('');
  status.textContent = '';
  await carregar();
  dlg.showModal();
});
document.getElementById('metas-fechar').addEventListener('click', () => dlg.close());

// Ao fechar, se algo mudou, a tela da disciplina e o resumo se refazem.
dlg.addEventListener('close', () => {
  if (!mudou) return;
  mudou = false;
  window.dispatchEvent(new Event('disciplina:metas'));
});
import { api } from './api.js';
import { el } from './dom.js';

const form = document.getElementById('form-backup');
const campoPasta = document.getElementById('backup-pasta');
const campoAuto = document.getElementById('backup-auto');
const status = document.getElementById('backup-status');
const botaoAgora = document.getElementById('backup-agora');
const linhaPasta = document.getElementById('backup-pasta-atual');
const linhaUltimo = document.getElementById('backup-ultimo');
const erroBackup = document.getElementById('backup-erro');
const lista = document.getElementById('backup-lista');
const restaurar = document.getElementById('backup-restaurar');
const avisoErro = document.getElementById('dados-erro');

const formatoData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function tamanho(bytes) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function mostrarErro(mensagem) {
  avisoErro.textContent = mensagem;
  avisoErro.hidden = !mensagem;
}

function desenhar(e) {
  campoPasta.value = e.usando_padrao ? '' : e.pasta;
  campoPasta.placeholder = `Padrão: ${e.pasta_padrao}`;
  campoAuto.checked = e.automatico;
  linhaPasta.textContent = `Pasta em uso: ${e.pasta} (mantém os ${e.manter} backups mais recentes)`;
  linhaUltimo.textContent = e.ultimo
    ? `Último backup: ${formatoData.format(new Date(e.ultimo.quando))} (${e.ultimo.arquivo}, ${tamanho(e.ultimo.tamanho)})`
    : 'Nenhum backup feito ainda.';
  erroBackup.textContent = e.erro
    ? `O último backup falhou em ${formatoData.format(new Date(e.erro.quando))}: ${e.erro.mensagem}`
    : '';
  lista.replaceChildren(
    ...(e.backups.length
      ? e.backups.map((b) => el('li', { texto: `${b.arquivo} · ${formatoData.format(new Date(b.modificado))} · ${tamanho(b.tamanho)}` }))
      : [el('li', { texto: 'Nenhum arquivo na pasta ainda.' })])
  );
  restaurar.textContent = `Para restaurar: feche o programa (Ctrl + C no terminal), copie o arquivo do backup para ${e.pasta_dados}, renomeie para leads.db e apague os arquivos leads.db-wal e leads.db-shm, se existirem. Depois abra o programa de novo.`;
}

async function carregar() {
  try {
    desenhar(await api('/backup'));
    mostrarErro('');
  } catch (e) {
    mostrarErro(`Não foi possível carregar os dados do backup: ${e.message}`);
  }
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  status.textContent = '';
  try {
    desenhar(await api('/backup', { metodo: 'PUT', corpo: { pasta: campoPasta.value, automatico: campoAuto.checked } }));
    mostrarErro('');
    status.textContent = 'Configuração salva ✓';
  } catch (e) {
    mostrarErro(e.message);
  }
});

botaoAgora.addEventListener('click', async () => {
  botaoAgora.disabled = true;
  status.textContent = 'Fazendo o backup…';
  try {
    desenhar(await api('/backup/agora', { metodo: 'POST', corpo: {} }));
    mostrarErro('');
    status.textContent = 'Backup feito ✓';
  } catch (e) {
    status.textContent = '';
    mostrarErro(e.message);
    await carregar();
  } finally {
    botaoAgora.disabled = false;
  }
});

window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#/dados')) carregar();
});
carregar();
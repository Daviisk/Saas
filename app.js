// ---------- Navegação entre telas (#/crm, #/buscar, #/fechamento) ----------
const telas = [...document.querySelectorAll('[data-tela]')];
const links = [...document.querySelectorAll('[data-rota]')];
const TELA_PADRAO = 'crm';

function rotaAtual() {
  const rota = location.hash.match(/^#\/(\w+)/)?.[1];
  return telas.some((t) => t.dataset.tela === rota) ? rota : TELA_PADRAO;
}

function mostrarTela() {
  const rota = rotaAtual();
  for (const tela of telas) tela.hidden = tela.dataset.tela !== rota;
  for (const link of links) {
    if (link.dataset.rota === rota) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

window.addEventListener('hashchange', mostrarTela);
mostrarTela();

// ---------- Tema escuro / claro ----------
document.getElementById('botao-tema').addEventListener('click', () => {
  const novo = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = novo;
  try {
    localStorage.setItem('tema', novo);
  } catch (e) {
    /* sem armazenamento: o tema só vale até recarregar */
  }
});
// ---------- Menu do celular (hambúrguer) ----------
const botaoMenu = document.getElementById('botao-menu');
const fundoMenu = document.getElementById('fundo-menu');
const lateral = document.getElementById('lateral');
const mobile = window.matchMedia('(max-width: 820px)');

function definirMenu(aberto) {
  const estavaAberto = document.body.classList.contains('menu-aberto');
  document.body.classList.toggle('menu-aberto', aberto);
  botaoMenu.setAttribute('aria-expanded', String(aberto));
  botaoMenu.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
  lateral.inert = mobile.matches && !aberto;
  if (aberto) lateral.querySelector('[aria-current="page"], a, button')?.focus();
  else if (estavaAberto && lateral.contains(document.activeElement)) botaoMenu.focus();
}

botaoMenu.addEventListener('click', () => definirMenu(!document.body.classList.contains('menu-aberto')));
fundoMenu.addEventListener('click', () => definirMenu(false));
links.forEach((link) => link.addEventListener('click', () => definirMenu(false)));
window.addEventListener('hashchange', () => definirMenu(false));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') definirMenu(false);
  if (e.key === 'Tab' && document.body.classList.contains('menu-aberto')) {
    const itens = [...lateral.querySelectorAll('a, button, input, select, summary')]
      .filter((item) => !item.disabled && item.getClientRects().length);
    const primeiro = itens[0], ultimo = itens.at(-1);
    if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo?.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro?.focus(); }
  }
});
// Se a tela for alargada (girar o celular, por exemplo), fecha a gaveta.
window.matchMedia('(min-width: 821px)').addEventListener('change', (e) => {
  if (e.matches) definirMenu(false);
});
mobile.addEventListener('change', () => definirMenu(false));
definirMenu(false);

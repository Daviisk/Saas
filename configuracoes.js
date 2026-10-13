import { db } from './db.js';
import { ErroHttp } from './validar.js';

const MODOS = ['fila', 'mesclar'];
const ABORDAGENS = ['copy', 'resumo'];
const FILTROS_SITE = ['sem_site', 'todos', 'so_com_site'];
const PADRAO = { modo_busca: 'fila', limite_busca: 50, modo_abordagem: 'copy', filtro_site: 'sem_site' };

const ler = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?');
const gravar = db.prepare(
  'INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor'
);

export function obterConfiguracoes() {
  const modo = ler.get('modo_busca')?.valor;
  const limite = Number(ler.get('limite_busca')?.valor);
  const abordagem = ler.get('modo_abordagem')?.valor;
  const filtroSite = ler.get('filtro_site')?.valor;
  return {
    modo_busca: MODOS.includes(modo) ? modo : PADRAO.modo_busca,
    limite_busca: Number.isInteger(limite) && limite >= 5 && limite <= 50 ? limite : PADRAO.limite_busca,
    modo_abordagem: ABORDAGENS.includes(abordagem) ? abordagem : PADRAO.modo_abordagem,
    filtro_site: FILTROS_SITE.includes(filtroSite) ? filtroSite : PADRAO.filtro_site,
  };
}

export function salvarConfiguracoes(corpo) {
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroHttp(400, 'Envie um objeto JSON');
  }
  const novo = {};

  if (corpo.modo_busca !== undefined) {
    if (!MODOS.includes(corpo.modo_busca)) {
      throw new ErroHttp(400, `Campo "modo_busca" deve ser: ${MODOS.join(', ')}`);
    }
    novo.modo_busca = corpo.modo_busca;
  }
  if (corpo.limite_busca !== undefined) {
    const n = Number(corpo.limite_busca);
    if (!Number.isInteger(n) || n < 5 || n > 50) {
      throw new ErroHttp(400, 'Campo "limite_busca" deve ser um número inteiro entre 5 e 50');
    }
    novo.limite_busca = n;
  }
  if (corpo.modo_abordagem !== undefined) {
    if (!ABORDAGENS.includes(corpo.modo_abordagem)) {
      throw new ErroHttp(400, `Campo "modo_abordagem" deve ser: ${ABORDAGENS.join(', ')}`);
    }
    novo.modo_abordagem = corpo.modo_abordagem;
  }
  if (corpo.filtro_site !== undefined) {
    if (!FILTROS_SITE.includes(corpo.filtro_site)) {
      throw new ErroHttp(400, `Campo "filtro_site" deve ser: ${FILTROS_SITE.join(', ')}`);
    }
    novo.filtro_site = corpo.filtro_site;
  }
  if (Object.keys(novo).length === 0) throw new ErroHttp(400, 'Nenhum campo válido enviado');

  // Só grava depois de validar tudo.
  for (const [chave, valor] of Object.entries(novo)) gravar.run(chave, String(valor));
  return obterConfiguracoes();
}
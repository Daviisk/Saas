import fs from 'node:fs';
import path from 'node:path';
import { db } from './db.js';
import { config } from './config.js';
import { ErroHttp } from './validar.js';

const MANTER = 14; // quantos backups ficam na pasta
const ARQUIVO = /^leads-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/;
const PASTA_PADRAO = path.join(config.dataDir, '..', 'backups');

const ler = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?');
const gravar = db.prepare(
  'INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor'
);
const apagar = db.prepare('DELETE FROM configuracoes WHERE chave = ?');

const valor = (chave) => ler.get(chave)?.valor ?? null;
const pad = (n) => String(n).padStart(2, '0');
const dataLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const carimbo = () => {
  const d = new Date();
  return `${dataLocal(d)}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
};

function lerJson(chave) {
  try {
    return JSON.parse(valor(chave) ?? 'null');
  } catch {
    return null;
  }
}

const pastaAtual = () => valor('backup_pasta') || PASTA_PADRAO;
const automatico = () => valor('backup_auto') !== '0'; // ligado por padrão

function validarPasta(bruto) {
  if (typeof bruto !== 'string') throw new ErroHttp(400, 'Campo "pasta" deve ser texto');
  const s = bruto.trim().replace(/^"+|"+$/g, ''); // aceita o caminho colado com aspas
  if (s === '') return null; // volta para a pasta padrão
  if (/[\u0000-\u001f]/.test(s)) throw new ErroHttp(400, 'Caminho inválido');
  if (!path.isAbsolute(s)) {
    throw new ErroHttp(400, 'Informe o caminho completo da pasta, por exemplo C:\\Backups\\Leads');
  }
  return path.normalize(s);
}

function listarBackups(pasta) {
  try {
    return fs
      .readdirSync(pasta)
      .filter((n) => ARQUIVO.test(n))
      .sort()
      .reverse()
      .slice(0, 10)
      .map((arquivo) => {
        const st = fs.statSync(path.join(pasta, arquivo));
        return { arquivo, tamanho: st.size, modificado: st.mtime.toISOString() };
      });
  } catch {
    return [];
  }
}

// Só mexe em arquivos com o nome exato dos nossos backups.
function limparAntigos(pasta) {
  try {
    const nomes = fs.readdirSync(pasta).filter((n) => ARQUIVO.test(n)).sort();
    for (const n of nomes.slice(0, Math.max(0, nomes.length - MANTER))) fs.unlinkSync(path.join(pasta, n));
  } catch (e) {
    console.error('[backup] não consegui limpar os antigos:', e.message);
  }
}

export function estado() {
  const pasta = pastaAtual();
  return {
    pasta,
    pasta_padrao: PASTA_PADRAO,
    usando_padrao: !valor('backup_pasta'),
    pasta_dados: config.dataDir,
    automatico: automatico(),
    manter: MANTER,
    ultimo: lerJson('backup_ultimo'),
    erro: lerJson('backup_erro'),
    backups: listarBackups(pasta),
  };
}

export function salvarConfig(corpo) {
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroHttp(400, 'Envie um objeto JSON');
  }
  let mexeu = false;

  if (corpo.pasta !== undefined) {
    const pasta = validarPasta(corpo.pasta);
    if (pasta === null) {
      apagar.run('backup_pasta');
    } else {
      try {
        fs.mkdirSync(pasta, { recursive: true });
        fs.accessSync(pasta, fs.constants.W_OK);
      } catch (e) {
        throw new ErroHttp(400, `Não consegui usar esta pasta: ${e.message}`);
      }
      gravar.run('backup_pasta', pasta);
    }
    mexeu = true;
  }
  if (corpo.automatico !== undefined) {
    if (![true, false, 1, 0, '1', '0'].includes(corpo.automatico)) {
      throw new ErroHttp(400, 'Campo "automatico" deve ser verdadeiro ou falso');
    }
    gravar.run('backup_auto', [true, 1, '1'].includes(corpo.automatico) ? '1' : '0');
    mexeu = true;
  }
  if (!mexeu) throw new ErroHttp(400, 'Nenhum campo válido enviado');
  return estado();
}

// Copia o banco inteiro para a pasta de backups (VACUUM INTO gera uma cópia consistente).
export function fazerBackup(motivo = 'manual') {
  const pasta = pastaAtual();
  try {
    fs.mkdirSync(pasta, { recursive: true });
    const arquivo = `leads-${carimbo()}.db`;
    const destino = path.join(pasta, arquivo);
    db.prepare('VACUUM INTO ?').run(destino);
    const tamanho = fs.statSync(destino).size;
    gravar.run('backup_ultimo', JSON.stringify({ quando: new Date().toISOString(), arquivo, tamanho, motivo }));
    apagar.run('backup_erro');
    limparAntigos(pasta);
    return { arquivo, tamanho };
  } catch (e) {
    gravar.run('backup_erro', JSON.stringify({ quando: new Date().toISOString(), mensagem: e.message }));
    throw new ErroHttp(424, `Não foi possível fazer o backup: ${e.message}`);
  }
}

function haBackupHoje() {
  const ultimo = lerJson('backup_ultimo');
  return Boolean(ultimo) && dataLocal(new Date(ultimo.quando)) === dataLocal(new Date());
}

// Um backup por dia, feito na primeira conferência depois que o programa abre (e tenta de hora em hora).
export function iniciarBackupAutomatico() {
  const tentar = () => {
    if (!automatico() || haBackupHoje()) return;
    try {
      const r = fazerBackup('automatico');
      console.log(`[backup] feito: ${r.arquivo}`);
    } catch (e) {
      console.error('[backup]', e.message);
    }
  };
  setTimeout(tentar, 10_000).unref();
  setInterval(tentar, 60 * 60 * 1000).unref();
}
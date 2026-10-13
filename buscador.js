import { db } from './db.js';
import { buscarNicho } from './nichos.js';
import { buscarOverpass } from './provedores/overpass.js';
import { buscarTomtom } from './provedores/tomtom.js';
import { enriquecer } from './pontuacao.js';
import { status as statusCota } from './cotas.js';
import { ErroHttp, validarLead } from './validar.js';
import { obterConfiguracoes } from './configuracoes.js';
import { registrarBusca } from './buscas.js';

const LIMITE_MAXIMO = 50;

// Modo fila: tenta um provedor de cada vez, na ordem, e só passa para o próximo
// se ainda faltar lead para chegar no limite.
const FILA = [
  { id: 'overpass', nome: 'OpenStreetMap', buscar: buscarOverpass },
  { id: 'tomtom', nome: 'TomTom', buscar: buscarTomtom },
];

const MOTIVO_COTA = {
  sem_chave: 'sem chave',
  limite_diario: 'limite do dia atingido',
  trava_mensal: 'travado até o mês virar',
};

const TEXTO_ERRO = {
  cota_esgotada: 'cota esgotada',
  nicho_sem_suporte: 'sem cobertura para este nicho',
  cidade_nao_encontrada: 'cidade não encontrada',
};

function textoErro(codigo) {
  return TEXTO_ERRO[codigo] || `falhou (${codigo})`;
}

const jaTemFonte = db.prepare('SELECT 1 FROM leads WHERE fonte = ? AND fonte_id = ?');
const jaTemTelefone = db.prepare('SELECT 1 FROM leads WHERE telefone = ?');
const jaTemInstagram = db.prepare('SELECT 1 FROM leads WHERE lower(instagram) = lower(?)');
const naoContatar = db.prepare('SELECT 1 FROM nao_contatar WHERE telefone = ?');

function validarEntrada({ nicho, cidade, uf, limite }, limitePadrao) {
  if (typeof nicho !== 'string' || !buscarNicho(nicho)) {
    throw new ErroHttp(400, 'Nicho inválido');
  }
  const c = typeof cidade === 'string' ? cidade.trim() : '';
  // Só letras, números, espaço, ponto, apóstrofo e hífen (nada de aspas ou barras).
  if (!/^[\p{L}0-9 .'-]{2,80}$/u.test(c)) {
    throw new ErroHttp(400, 'Cidade inválida');
  }
  const u = typeof uf === 'string' ? uf.trim().toUpperCase() : '';
  if (!/^[A-Z]{2}$/.test(u)) {
    throw new ErroHttp(400, 'UF inválida');
  }
  const lim = Math.min(Math.max(Number(limite) || limitePadrao, 1), LIMITE_MAXIMO);
  return { nicho, cidade: c, uf: u, limite: lim };
}

export async function buscar(entrada) {
  const cfg = obterConfiguracoes();
  const modo = cfg.modo_busca;
  const filtroSite = cfg.filtro_site;
  const { nicho, cidade, uf, limite } = validarEntrada(entrada, cfg.limite_busca);

  const resumo = {
    encontrados: 0,
    semContato: 0,
    comSite: 0,
    semSite: 0,
    jaNoCrm: 0,
    repetidos: 0,
    naoContatar: 0,
    invalidos: 0,
  };
  const vistos = new Set();
  const candidatos = [];
  const provedores = [];

  for (const provedor of FILA) {
    const base = { id: provedor.id, nome: provedor.nome };

    if (modo === 'fila' && candidatos.length >= limite) {
      provedores.push({ ...base, estado: 'dispensado' });
      continue;
    }

    const cota = statusCota(provedor.id);
    if (!cota.disponivel) {
      provedores.push({ ...base, estado: 'pulado', motivo: MOTIVO_COTA[cota.motivo] || 'indisponível' });
      continue;
    }

    const bruto = await provedor.buscar(nicho, cidade, uf);
    if (bruto.erro) {
      provedores.push({ ...base, estado: 'pulado', motivo: textoErro(bruto.erro) });
      continue;
    }

    const antes = candidatos.length;
    resumo.encontrados += bruto.leads.length + (bruto.semContato || 0);
    resumo.semContato += bruto.semContato || 0;

    for (const cru of bruto.leads) {
      if (cru.site_tipo === 'site') {
        if (filtroSite === 'sem_site') {
          resumo.comSite++;
          continue;
        }
      } else if (filtroSite === 'so_com_site') {
        resumo.semSite++;
        continue;
      }

      let lead;
      try {
        lead = validarLead(enriquecer(cru, nicho, cidade, uf));
      } catch {
        resumo.invalidos++;
        continue;
      }

      if (!lead.telefone && !lead.instagram) {
        resumo.semContato++;
        continue;
      }
      if (lead.telefone && naoContatar.get(lead.telefone)) {
        resumo.naoContatar++;
        continue;
      }

      // Identidade do lead: o telefone, quando tem; senão o Instagram.
      const chave = lead.telefone ? `tel:${lead.telefone}` : `ig:${lead.instagram.toLowerCase()}`;
      if (vistos.has(chave)) {
        resumo.repetidos++;
        continue;
      }
      vistos.add(chave);

      const noCrm =
        jaTemFonte.get(lead.fonte, lead.fonte_id) ||
        (lead.telefone && jaTemTelefone.get(lead.telefone)) ||
        (!lead.telefone && jaTemInstagram.get(lead.instagram));
      if (noCrm) {
        resumo.jaNoCrm++;
        continue;
      }

      candidatos.push(lead);
    }

    provedores.push({ ...base, estado: 'ok', novos: candidatos.length - antes });
  }

  if (!provedores.some((p) => p.estado === 'ok')) {
    const motivos = provedores.map((p) => `${p.nome}: ${p.motivo}`).join(' | ');
    throw new ErroHttp(424, `Nenhum provedor respondeu. ${motivos}`);
  }

  candidatos.sort((a, b) => b.pontuacao - a.pontuacao);
  const leads = candidatos.slice(0, limite);

  const resumoFinal = { ...resumo, retornados: leads.length };
  registrarBusca({ nicho, cidade, uf, modo, resumo: resumoFinal, provedores, leads });
  return { nicho, cidade, uf, modo, provedores, resumo: resumoFinal, leads };
}
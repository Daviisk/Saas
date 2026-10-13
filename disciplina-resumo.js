import { api } from './api.js';
import { el } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';

const abas = document.querySelectorAll('#disc-resumo-abas [data-resumo]');
const info = document.getElementById('disc-resumo-info');
const boxDias = document.getElementById('disc-rosca-dias');
const boxMetas = document.getElementById('disc-rosca-metas');
const boxPorMeta = document.getElementById('disc-por-meta');

let periodo = 'semana';

const diaMes = (data) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

function svg(tag, atributos = {}, ...filhos) {
  const no = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(atributos)) no.setAttribute(k, String(v));
  no.append(...filhos);
  return no;
}

// Rosca de circunferência 100 (raio 15,9155): cada fatia é uma porcentagem do círculo.
function rosca(partes, centro, descricao) {
  const R = 15.9155;
  const total = partes.reduce((soma, p) => soma + p.valor, 0);
  const filhos = [svg('circle', { class: 'rosca-fundo', cx: 21, cy: 21, r: R, fill: 'none', 'stroke-width': 5 })];

  if (total > 0) {
    let acumulado = 0;
    for (const p of partes) {
      if (p.valor === 0) continue;
      const pct = (p.valor / total) * 100;
      filhos.push(
        svg(
          'circle',
          {
            class: `rosca-parte ${p.classe}`,
            cx: 21,
            cy: 21,
            r: R,
            fill: 'none',
            'stroke-width': 5,
            'stroke-dasharray': `${pct} ${100 - pct}`,
            'stroke-dashoffset': 25 - acumulado,
          },
          svg('title', {}, `${p.rotulo}: ${p.valor}`)
        )
      );
      acumulado += pct;
    }
  }
  filhos.push(svg('text', { class: 'rosca-centro', x: 21, y: 23.5, 'text-anchor': 'middle' }, centro));
  return svg('svg', { viewBox: '0 0 42 42', role: 'img', 'aria-label': descricao }, ...filhos);
}

function legenda(partes) {
  return el(
    'ul',
    { class: 'rosca-legenda' },
    ...partes.map((p) => el('li', {}, el('i', { class: `disc-amostra ${p.amostra}` }), `${p.rotulo}: ${p.valor}`))
  );
}

function desenhar(d) {
  info.textContent = `Período: ${diaMes(d.inicio)} a ${diaMes(d.fim)}`;

  const totalDias = Object.values(d.dias).reduce((a, b) => a + b, 0);
  const partesDias = [
    { rotulo: 'Dias bons', valor: d.dias.verde, classe: 'verde', amostra: 'disc-verde' },
    { rotulo: 'Dias médios', valor: d.dias.amarelo, classe: 'amarelo', amostra: 'disc-amarelo' },
    { rotulo: 'Dias ruins', valor: d.dias.vermelho, classe: 'vermelho', amostra: 'disc-vermelho' },
    { rotulo: 'Folgas', valor: d.dias.folga, classe: 'folga', amostra: 'disc-folga' },
    { rotulo: 'Sem registro', valor: d.dias.vazio, classe: 'vazio', amostra: '' },
  ];
  boxDias.replaceChildren(rosca(partesDias, String(totalDias), 'Dias do período por cor'), legenda(partesDias));

  const totalMetas = d.metas.cumpridas + d.metas.nao_cumpridas;
  const partesMetas = [
    { rotulo: 'Cumpridas', valor: d.metas.cumpridas, classe: 'verde', amostra: 'disc-verde' },
    { rotulo: 'Não cumpridas', valor: d.metas.nao_cumpridas, classe: 'vermelho', amostra: 'disc-vermelho' },
  ];
  const centroMetas = totalMetas ? `${Math.round((d.metas.cumpridas / totalMetas) * 100)}%` : '—';
  boxMetas.replaceChildren(rosca(partesMetas, centroMetas, 'Metas cumpridas e não cumpridas'), legenda(partesMetas));

  boxPorMeta.replaceChildren(
    ...(d.por_meta.length
      ? d.por_meta.map((m) =>
          el(
            'div',
            { class: 'por-meta-linha' },
            el('span', { texto: m.rotulo }),
            el('progress', {
              max: String(m.dias),
              value: String(m.cumpridas),
              'aria-label': `${m.rotulo}: ${m.cumpridas} de ${m.dias} dias`,
            }),
            el('span', { texto: `${m.cumpridas} de ${m.dias} dias` })
          )
        )
      : [el('p', { class: 'subtitulo', texto: 'Sem dias com registro neste período.' })])
  );
}

function marcarAbas() {
  abas.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.resumo === periodo)));
}

async function carregar() {
  marcarAbas();
  try {
    desenhar(await api(`/disciplina/resumo/${periodo}`));
  } catch (e) {
    info.textContent = `Não foi possível carregar o resumo: ${e.message}`;
  }
}

abas.forEach((botao) =>
  botao.addEventListener('click', () => {
    periodo = botao.dataset.resumo;
    carregar();
  })
);

// A tela da disciplina avisa quando algo muda (meta marcada, metas editadas).
window.addEventListener('disciplina:mudou', carregar);
window.addEventListener('disciplina:metas', carregar);
window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#/disciplina')) carregar();
});

carregar();
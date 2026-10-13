import { Router } from 'express';
import * as disciplina from './disciplina.js';
import { ErroHttp } from './validar.js';

export const rotasDisciplina = Router();

function inteiroDaRota(valor, nome) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new ErroHttp(400, `${nome} inválido`);
  return n;
}

// Metas
rotasDisciplina.get('/disciplina/metas', (_req, res) => res.json(disciplina.listarMetas()));
rotasDisciplina.post('/disciplina/metas', (req, res) => res.status(201).json(disciplina.criarMeta(req.body)));
rotasDisciplina.patch('/disciplina/metas/:id', (req, res) => {
  res.json(disciplina.atualizarMeta(inteiroDaRota(req.params.id, 'Id'), req.body));
});

// Calendário e resumos
rotasDisciplina.get('/disciplina/calendario', (req, res) => res.json(disciplina.calendario(req.query.ano)));
rotasDisciplina.get('/disciplina/resumo/:periodo', (req, res) => res.json(disciplina.resumo(req.params.periodo)));

// Um dia
rotasDisciplina.get('/disciplina/dia/:data', (req, res) => {
  res.json(disciplina.obterDia(disciplina.dataDaRota(req.params.data)));
});
rotasDisciplina.put('/disciplina/dia/:data', (req, res) => {
  res.json(disciplina.salvarDia(disciplina.dataDaRota(req.params.data), req.body));
});
rotasDisciplina.put('/disciplina/dia/:data/metas/:metaId', (req, res) => {
  const data = disciplina.dataDaRota(req.params.data);
  const metaId = inteiroDaRota(req.params.metaId, 'Id da meta');
  res.json(disciplina.marcarMeta(data, metaId, req.body?.feito));
});
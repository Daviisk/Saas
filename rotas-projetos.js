import { Router } from 'express';
import * as projetos from './projetos.js';
import { ErroHttp } from './validar.js';

export const rotasProjetos = Router();

function idDaRota(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ErroHttp(400, 'Id inválido');
  return id;
}

rotasProjetos.get('/projetos/kanban', (_req, res) => res.json(projetos.kanban()));

rotasProjetos.post('/projetos', (req, res) => {
  res.status(201).json(projetos.criar(req.body));
});

rotasProjetos.patch('/projetos/:id', (req, res) => {
  res.json(projetos.atualizar(idDaRota(req), req.body));
});

rotasProjetos.patch('/projetos/:id/etapa', (req, res) => {
  res.json(projetos.moverEtapa(idDaRota(req), req.body?.etapa));
});

rotasProjetos.delete('/projetos/:id', (req, res) => {
  projetos.remover(idDaRota(req));
  res.status(204).end();
});
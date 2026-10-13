import { Router } from 'express';
import * as copies from './copies.js';
import { ErroHttp } from './validar.js';
import { resumoDoLead } from './resumo.js';
import { ritmoDeAbordagem } from './ritmo.js';

export const rotasCopies = Router();

function idDaRota(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ErroHttp(400, 'Id inválido');
  return id;
}

rotasCopies.get('/copies', (req, res) => res.json(copies.listar(req.query)));
rotasCopies.post('/copies', (req, res) => res.status(201).json(copies.criar(req.body)));
rotasCopies.get('/copies/:id', (req, res) => res.json(copies.obter(idDaRota(req))));
rotasCopies.patch('/copies/:id', (req, res) => res.json(copies.atualizar(idDaRota(req), req.body)));
rotasCopies.delete('/copies/:id', (req, res) => {
  copies.excluir(idDaRota(req));
  res.status(204).end();
});

// Copies do nicho do lead, com a mensagem já montada e o link do WhatsApp.
rotasCopies.get('/leads/:id/copies', (req, res) => res.json(copies.copiesParaLead(idDaRota(req))));
rotasCopies.get('/leads/:id/resumo', (req, res) => res.json(resumoDoLead(idDaRota(req))));
rotasCopies.get('/abordagem/ritmo', (_req, res) => res.json(ritmoDeAbordagem()));
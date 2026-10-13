import { Router } from 'express';
import * as financeiro from './financeiro.js';
import { ErroHttp } from './validar.js';

export const rotasFinanceiro = Router();

function idDaRota(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ErroHttp(400, 'Id inválido');
  return id;
}

rotasFinanceiro.get('/financeiro', (req, res) => {
  res.json(financeiro.resumo(financeiro.validarMes(req.query.mes)));
});

rotasFinanceiro.post('/gastos', (req, res) => {
  res.status(201).json(financeiro.criarGasto(req.body));
});

rotasFinanceiro.patch('/gastos/:id', (req, res) => {
  res.json(financeiro.atualizarGasto(idDaRota(req), req.body));
});

rotasFinanceiro.delete('/gastos/:id', (req, res) => {
  financeiro.removerGasto(idDaRota(req));
  res.status(204).end();
});
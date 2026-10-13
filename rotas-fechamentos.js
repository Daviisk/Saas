import { Router } from 'express';
import * as fechamentos from './fechamentos.js';

export const rotasFechamentos = Router();

rotasFechamentos.get('/fechamentos', (req, res) => {
  res.json(fechamentos.listar(req.query.limite));
});

rotasFechamentos.get('/fechamentos/sugestao/:data', (req, res) => {
  res.json(fechamentos.sugestao(fechamentos.dataDaRota(req.params.data)));
});

// Devolve o fechamento do dia, ou null se ainda não existir.
rotasFechamentos.get('/fechamentos/:data', (req, res) => {
  res.json(fechamentos.obter(fechamentos.dataDaRota(req.params.data)));
});

rotasFechamentos.put('/fechamentos/:data', (req, res) => {
  res.json(fechamentos.salvar(fechamentos.dataDaRota(req.params.data), req.body));
});

rotasFechamentos.delete('/fechamentos/:data', (req, res) => {
  fechamentos.remover(fechamentos.dataDaRota(req.params.data));
  res.status(204).end();
});
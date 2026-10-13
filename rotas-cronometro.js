import { Router } from 'express';
import * as cronometro from './cronometro.js';
import { dataDaRota } from './fechamentos.js';

export const rotasCronometro = Router();

rotasCronometro.get('/cronometro', (_req, res) => res.json(cronometro.estado()));
rotasCronometro.post('/cronometro/iniciar', (_req, res) => res.json(cronometro.iniciar()));
rotasCronometro.post('/cronometro/pausar', (_req, res) => res.json(cronometro.pausar()));
rotasCronometro.post('/cronometro/finalizar', (req, res) => res.json(cronometro.finalizar(req.body)));
rotasCronometro.post('/cronometro/descartar', (_req, res) => res.json(cronometro.descartar()));

rotasCronometro.delete('/cronometro/sessoes/:data', (req, res) => {
  cronometro.apagarSessoes(dataDaRota(req.params.data));
  res.status(204).end();
});
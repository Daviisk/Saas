import { Router } from 'express';
import * as backup from './backup.js';
import { exportar } from './exportar.js';

export const rotasDados = Router();

rotasDados.get('/backup', (_req, res) => res.json(backup.estado()));
rotasDados.put('/backup', (req, res) => res.json(backup.salvarConfig(req.body)));
rotasDados.post('/backup/agora', (_req, res) => {
  backup.fazerBackup('manual');
  res.json(backup.estado());
});

rotasDados.get('/exportar/:tipo', (req, res) => {
  const { nome, conteudo } = exportar(req.params.tipo);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
  res.send(conteudo);
});
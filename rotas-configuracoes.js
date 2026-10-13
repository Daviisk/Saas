import { Router } from 'express';
import { obterConfiguracoes, salvarConfiguracoes } from './configuracoes.js';

export const rotasConfiguracoes = Router();

rotasConfiguracoes.get('/configuracoes', (_req, res) => res.json(obterConfiguracoes()));
rotasConfiguracoes.put('/configuracoes', (req, res) => res.json(salvarConfiguracoes(req.body)));
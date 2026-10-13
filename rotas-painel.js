import { Router } from 'express';
import { painel } from './painel.js';

export const rotasPainel = Router();

rotasPainel.get('/painel', (_req, res) => res.json(painel()));
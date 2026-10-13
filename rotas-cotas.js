import { Router } from 'express';
import { statusTodos } from './cotas.js';

export const rotasCotas = Router();

// Usado pelo front para mostrar os avisos de cota.
rotasCotas.get('/cotas', (_req, res) => {
  res.json(statusTodos());
});
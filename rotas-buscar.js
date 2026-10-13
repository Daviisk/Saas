import { Router } from 'express';
import { buscar } from './buscador.js';
import { listarBuscas } from './buscas.js';

export const rotasBuscar = Router();

// POST (e não GET) porque cada busca gasta cota do provedor.
rotasBuscar.post('/buscar', async (req, res, next) => {
  try {
    res.json(await buscar(req.body ?? {}));
  } catch (e) {
    next(e);
  }
});
rotasBuscar.get('/buscas', (req, res) => res.json(listarBuscas(req.query.limite)));
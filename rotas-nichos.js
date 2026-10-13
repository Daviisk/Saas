import { Router } from 'express';
import { CATEGORIAS } from './nichos.js';

export const rotasNichos = Router();

// Entrega para o front só o que ele precisa (chave e nome).
// Os termos de busca e as tags do OSM ficam só no servidor.
rotasNichos.get('/nichos', (_req, res) => {
  res.json(
    CATEGORIAS.map((cat) => ({
      chave: cat.chave,
      nome: cat.nome,
      nichos: cat.nichos.map((n) => ({ chave: n.chave, nome: n.nome })),
    }))
  );
});
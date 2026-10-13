import 'dotenv/config';
import os from 'node:os';
import path from 'node:path';

// O banco fica FORA da pasta do projeto, para nunca ir parar no GitHub por engano.
const pastaPadrao = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'),
  'LeadsApp',
  'data'
);

export const config = {
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '127.0.0.1',
  dataDir: process.env.DATA_DIR?.trim() || pastaPadrao,
  // Chaves: lidas só aqui, no backend. O frontend nunca as recebe.
  chaves: {
    geoapify: process.env.GEOAPIFY_KEY?.trim() || '',
    tomtom: process.env.TOMTOM_KEY?.trim() || '',
    here: process.env.HERE_KEY?.trim() || '',
  },
};

import { db } from './db.js';

// Limites conservadores do próprio sistema. O WhatsApp não divulga os números dele,
// então ajuste aqui se quiser.
const LIMITE_DIA = 30;
const LIMITE_HORA = 10;

export function ritmoDeAbordagem() {
  const hoje = db
    .prepare("SELECT COUNT(*) AS n FROM leads WHERE date(abordado_em, 'localtime') = date('now', 'localtime')")
    .get().n;
  const hora = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE abordado_em >= datetime('now', '-1 hour')").get().n;

  let aviso = null;
  if (hoje >= LIMITE_DIA) {
    aviso = `Você já abordou ${hoje} leads hoje. Que tal parar por aqui e esperar as respostas?`;
  } else if (hora >= LIMITE_HORA) {
    aviso = `${hora} abordagens na última hora. Dê um intervalo para não parecer envio em massa.`;
  }
  return { hoje, ultima_hora: hora, limite_dia: LIMITE_DIA, limite_hora: LIMITE_HORA, aviso };
}
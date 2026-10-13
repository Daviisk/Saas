import { db } from './db.js';
import { ErroHttp } from './validar.js';
import { transacao } from './leads.js';

const pad = (n) => String(n).padStart(2, '0');

function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Existe uma única linha de cronômetro (id 1).
db.prepare("INSERT OR IGNORE INTO cronometro (id, estado, acumulado_seg) VALUES (1, 'parado', 0)").run();

const ler = () => db.prepare('SELECT * FROM cronometro WHERE id = 1').get();

function segundosDe(c) {
  if (c.estado !== 'rodando') return c.acumulado_seg;
  return c.acumulado_seg + Math.max(0, Math.floor((Date.now() - c.retomado_ms) / 1000));
}

function resposta() {
  const c = ler();
  return { estado: c.estado, segundos: segundosDe(c), data: c.data };
}

const zerar = () =>
  db
    .prepare("UPDATE cronometro SET estado = 'parado', acumulado_seg = 0, retomado_ms = NULL, data = NULL WHERE id = 1")
    .run();

export function estado() {
  return resposta();
}

// Começa ou retoma. A data do trabalho é o dia em que ele começou.
export function iniciar() {
  const c = ler();
  if (c.estado === 'rodando') return resposta();
  db.prepare("UPDATE cronometro SET estado = 'rodando', retomado_ms = ?, data = COALESCE(data, ?) WHERE id = 1").run(
    Date.now(),
    hojeLocal()
  );
  return resposta();
}

export function pausar() {
  const c = ler();
  if (c.estado !== 'rodando') return resposta();
  db.prepare("UPDATE cronometro SET estado = 'pausado', acumulado_seg = ?, retomado_ms = NULL WHERE id = 1").run(
    segundosDe(c)
  );
  return resposta();
}

// Horas do dia, somando todos os períodos finalizados (arredondado em 2 casas).
export function horasDoDia(data) {
  const { s } = db.prepare('SELECT COALESCE(SUM(segundos), 0) AS s FROM cronometro_sessoes WHERE data = ?').get(data);
  return Math.round((s / 3600) * 100) / 100;
}

// Registra o tempo no dia e zera. Se vier "minutos", registra esse valor (só pode diminuir).
export function finalizar(corpo) {
  const c = ler();
  if (c.estado === 'parado') throw new ErroHttp(400, 'O cronômetro não está em andamento');

  const total = segundosDe(c);
  let segundos = total;
  if (corpo && corpo.minutos !== undefined) {
    const min = Number(corpo.minutos);
    if (!Number.isFinite(min) || min < 0 || min > 24 * 60) {
      throw new ErroHttp(400, 'Campo "minutos" deve ser um número entre 0 e 1440');
    }
    const pedido = Math.round(min * 60);
    if (pedido > total + 60) throw new ErroHttp(400, 'O tempo a registrar não pode passar do tempo contado');
    segundos = Math.min(pedido, total);
  }

  transacao(() => {
    if (segundos > 0) db.prepare('INSERT INTO cronometro_sessoes (data, segundos) VALUES (?, ?)').run(c.data, segundos);
    zerar();
  });
  return { ...resposta(), registrado_seg: segundos, data: c.data, horas_do_dia: horasDoDia(c.data) };
}

// Joga fora o tempo contado, sem registrar.
export function descartar() {
  zerar();
  return resposta();
}

// Apaga o tempo registrado de um dia (para corrigir erro ou limpar teste).
export function apagarSessoes(data) {
  db.prepare('DELETE FROM cronometro_sessoes WHERE data = ?').run(data);
}
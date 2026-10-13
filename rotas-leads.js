import { Router } from 'express';
import * as leads from './leads.js';
import { ErroHttp, validarLead } from './validar.js';
import { resumoDoLead } from './resumo.js';

export const rotasLeads = Router();
leads.iniciarFollowupAuto();

function idDaRota(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ErroHttp(400, 'Id inválido');
  return id;
}

// Rotas fixas primeiro (antes de /:id)
rotasLeads.get('/leads/kanban', (_req, res) => res.json(leads.kanban()));
rotasLeads.get('/leads/followups', (_req, res) => res.json(leads.listarFollowups()));
rotasLeads.get('/leads/descartados', (_req, res) => res.json(leads.listarDescartados()));
rotasLeads.get('/nao-contatar', (_req, res) => res.json(leads.listarNaoContatar()));
rotasLeads.delete('/nao-contatar/:id', (req, res) => {
  res.json(leads.removerNaoContatar(idDaRota(req)));
});
rotasLeads.post('/nao-contatar', (req, res) => {
  res.status(201).json(leads.adicionarNaoContatar(req.body?.telefone, req.body?.motivo));
});

rotasLeads.get('/leads', (req, res) => {
  const { etapa, q, limite, deslocamento } = req.query;
  res.json(leads.listar({ etapa, q, limite, deslocamento }));
});

rotasLeads.post('/leads', (req, res) => {
  const lead = leads.criar(validarLead(req.body));
  res.status(201).json(lead);
});

rotasLeads.get('/leads/:id', (req, res) => res.json(leads.obterComNotas(idDaRota(req))));

rotasLeads.patch('/leads/:id/etapa', (req, res) => {
  res.json(leads.moverEtapa(idDaRota(req), req.body?.etapa, req.body?.motivo, req.body?.projeto));
});

rotasLeads.post('/leads/:id/notas', (req, res) => {
  res.status(201).json(leads.criarNota(idDaRota(req), req.body?.texto));
});
rotasLeads.post('/leads/:id/followup', (req, res) => {
  res.status(201).json(leads.agendarFollowup(idDaRota(req), req.body ?? {}));
});

rotasLeads.post('/leads/:id/followup/concluir', (req, res) => {
  res.json(leads.concluirFollowup(idDaRota(req)));
});

rotasLeads.patch('/leads/:id/followup', (req, res) => {
  res.json(leads.reagendarFollowup(idDaRota(req), req.body ?? {}));
});

rotasLeads.post('/leads/followup-em-massa', (req, res) => {
  res.json(leads.agendarFollowupEmMassa(req.body ?? {}));
});

rotasLeads.patch('/leads/:id/verificacao', (req, res) => {
  res.json(leads.salvarVerificacao(idDaRota(req), req.body?.itens));
});

rotasLeads.patch('/leads/:id/instagram', (req, res) => {
  res.json(leads.atualizarInstagram(idDaRota(req), req.body?.instagram));
});

rotasLeads.get('/leads/:id/resumo-claude', (req, res) => {
  const id = idDaRota(req);
  const base = leads.resumoParaClaude(id);
  const r = resumoDoLead(id);
  const extra = [
    '',
    `OPORTUNIDADE: ${r.oportunidade}`,
    '',
    'PERGUNTAS PARA PUXAR CONVERSA:',
    ...r.ganchos.map((g) => `- ${g}`),
  ];
  res.json({ texto: [base, ...extra].join('\n') });
});

rotasLeads.delete('/leads/:id', (req, res) => {
  leads.excluir(idDaRota(req));
  res.status(204).end();
});

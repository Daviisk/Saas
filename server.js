import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { ETAPAS, ETAPA_DESCARTADO } from './constants.js';

const raiz = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable('x-powered-by');

// Cabeçalhos de segurança + CSP: só carrega recursos do próprio site.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        styleSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);

app.use(express.json({ limit: '1mb' }));

// SQLite local precisa de disco persistente; a Vercel publica a interface até o banco ser conectado.
let db, dbPath, fechar;
if (process.env.VERCEL) {
  app.use('/api', (_req, res) => res.status(503).json({
    erro: 'Banco persistente ainda não configurado para esta hospedagem.',
  }));
} else {
  ({ db, dbPath, fechar } = await import('./db.js'));
  const { rotasLeads } = await import('./rotas-leads.js');
  const { rotasFechamentos } = await import('./rotas-fechamentos.js');
  const { rotasNichos } = await import('./rotas-nichos.js');
  const { rotasCotas } = await import('./rotas-cotas.js');
  const { rotasBuscar } = await import('./rotas-buscar.js');
  const { rotasConfiguracoes } = await import('./rotas-configuracoes.js');
  const { rotasCopies } = await import('./rotas-copies.js');
  const { rotasPainel } = await import('./rotas-painel.js');
  const { rotasDisciplina } = await import('./rotas-disciplina.js');
  const { rotasCronometro } = await import('./rotas-cronometro.js');
  const { rotasDados } = await import('./rotas-dados.js');
  const { rotasFinanceiro } = await import('./rotas-financeiro.js');
  const { rotasProjetos } = await import('./rotas-projetos.js');
  const { iniciarBackupAutomatico } = await import('./backup.js');
  iniciarBackupAutomatico();


app.get('/api/saude', (_req, res) => {
  const tabelas = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((t) => t.name);
  res.json({
    ok: true,
    banco: path.basename(dbPath),
    tabelas,
    etapas: [...ETAPAS, ETAPA_DESCARTADO],
    chavesConfiguradas: {
      geoapify: Boolean(config.chaves.geoapify),
      tomtom: Boolean(config.chaves.tomtom),
      here: Boolean(config.chaves.here),
    },
  });
});

app.use('/api', rotasLeads);
app.use('/api', rotasFechamentos);
app.use('/api', rotasNichos);
app.use('/api', rotasCotas);
app.use('/api', rotasBuscar);
app.use('/api', rotasConfiguracoes);
app.use('/api', rotasCopies);
app.use('/api', rotasPainel);
app.use('/api', rotasDisciplina);
app.use('/api', rotasCronometro);
app.use('/api', rotasDados);
app.use('/api', rotasFinanceiro);
app.use('/api', rotasProjetos);
}
if (process.env.VERCEL) app.use(express.static(path.join(raiz, 'public')));

// Somente arquivos da interface são públicos; o backend permanece privado.
const arquivosPublicos = new Set([
  'index.html', 'app.js', 'api.js', 'dom.js', 'tema.js', 'destaque.js',
  'crm.js', 'abordagem.js', 'lead-detalhe.js', 'mapa.js', 'buscar.js',
  'fechamento.js', 'dados.js', 'descartados.js',
  'disciplina-resumo.js', 'disciplina-metas.js',
]);
app.get(/^\/(?:[^/]+)?$/, (req, res, next) => {
  const arquivo = req.path.slice(1) || 'index.html';
  if (!arquivosPublicos.has(arquivo) && !/^[a-z-]+\.css$/.test(arquivo)) return next();
  res.sendFile(path.join(raiz, arquivo));
});

app.use('/api', (_req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // Erros de validação (400/404/409) e JSON malformado mostram a mensagem; o resto fica genérico.
  const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno' });
  }
  res.status(status).json({ erro: err instanceof SyntaxError ? 'JSON inválido' : err.message });
});

export default app;

if (!process.env.VERCEL) {
const servidor = app.listen(config.port, config.host, () => {
  console.log(`Servidor em http://${config.host}:${config.port}`);
  console.log(`Banco de dados: ${dbPath}`);
});

function encerrar() {
  servidor.close(() => {
    fechar();
    process.exit(0);
  });
}
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);

}

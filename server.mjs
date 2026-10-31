// Servidor local do Nosso Cantinho — sem dependências (Node 18+).
//
// O que ele faz:
//   1. Serve os arquivos estáticos do site.
//   2. Gera /config.js a partir do .env, expondo APENAS dados públicos
//      (URL e chave anon do Supabase) e se o proxy do TMDB está ativo.
//   3. Faz proxy da pesquisa do TMDB em /api/tmdb/search, para que a chave
//      da API fique no servidor e nunca apareça no navegador.
//
// Uso:  npm start   (ou: node server.mjs)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buscarTmdb, tmdbAtivo } from './lib/tmdb.mjs';
import { configPublicaJs } from './lib/config-publica.mjs';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)));

// ---------- .env (parser simples: CHAVE=valor, # comentários, aspas opcionais) ----------
function carregarEnv(caminho) {
  if (!existsSync(caminho)) return;
  for (const linha of readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m || linha.trim().startsWith('#')) continue;
    let valor = m[2];
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = valor;
  }
}
carregarEnv(join(RAIZ, '.env'));

const PORTA = Number(process.env.PORT) || 5173;
const TMDB_ATIVO = tmdbAtivo();
const SUPABASE_ATIVO = Boolean((process.env.SUPABASE_URL || '').trim() && (process.env.SUPABASE_ANON_KEY || '').trim());

try { configPublicaJs(); } catch (e) {
  console.error(`\n[ERRO] ${e.message}\n`);
  process.exit(1);
}

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

// Arquivos que nunca devem ser servidos
const BLOQUEADOS = [/^\/\.env/i, /^\/server\.mjs$/i, /^\/package(-lock)?\.json$/i, /^\/\.git/i, /^\/node_modules/i, /^\/supabase\//i, /^\/lib\//i, /^\/api\//i];

function enviar(res, status, corpo, cabecalhos = {}) {
  res.writeHead(status, {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...cabecalhos,
  });
  res.end(corpo);
}

async function proxyTmdb(url, res) {
  const { status, corpo } = await buscarTmdb({ query: url.searchParams.get('query'), page: url.searchParams.get('page') });
  return enviar(res, status, corpo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': status === 200 ? 'private, max-age=300' : 'no-store' });
}

const servidor = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let caminho = decodeURIComponent(url.pathname);

    if (req.method !== 'GET' && req.method !== 'HEAD') return enviar(res, 405, 'Método não permitido');

    if (caminho === '/config.js') {
      return enviar(res, 200, configPublicaJs(), { 'Content-Type': TIPOS['.js'], 'Cache-Control': 'no-store' });
    }
    if (caminho === '/api/tmdb/search') return proxyTmdb(url, res);
    if (caminho.startsWith('/api/')) return enviar(res, 404, JSON.stringify({ erro: 'Rota não encontrada' }), { 'Content-Type': 'application/json; charset=utf-8' });

    if (BLOQUEADOS.some((r) => r.test(caminho))) return enviar(res, 404, 'Não encontrado');
    if (caminho.endsWith('/')) caminho += 'index.html';

    const arquivo = normalize(join(RAIZ, caminho));
    if (!arquivo.startsWith(RAIZ + sep)) return enviar(res, 403, 'Proibido');

    let info;
    try { info = await stat(arquivo); } catch { info = null; }
    if (!info || !info.isFile()) return enviar(res, 404, 'Não encontrado');

    const corpo = await readFile(arquivo);
    const tipo = TIPOS[extname(arquivo).toLowerCase()] || 'application/octet-stream';
    return enviar(res, 200, req.method === 'HEAD' ? undefined : corpo, { 'Content-Type': tipo, 'Cache-Control': 'no-cache' });
  } catch (e) {
    console.error(e);
    return enviar(res, 500, 'Erro interno');
  }
});

servidor.listen(PORTA, () => {
  console.log(`\n  Nosso Cantinho rodando em  http://localhost:${PORTA}\n`);
  console.log(`  Supabase: ${SUPABASE_ATIVO ? 'configurado' : 'não configurado (modo demonstração)'}`);
  console.log(`  TMDB:     ${TMDB_ATIVO ? 'proxy ativo em /api/tmdb/search' : 'não configurado (cadastro manual disponível)'}\n`);
});

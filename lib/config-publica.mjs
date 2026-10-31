// Gera o conteúdo de /config.js com dados PÚBLICOS apenas.
// Usada pelo servidor-local.mjs (local) e por api/config.js (Vercel).
import { tmdbAtivo } from './tmdb.mjs';

export function configPublicaJs(env = process.env) {
  const anon = (env.SUPABASE_ANON_KEY || '').trim();
  if (/service_role|^sb_secret_/i.test(anon)) throw new Error('SUPABASE_ANON_KEY parece ser uma chave SECRETA (service_role/sb_secret_). Use a chave "publishable" (sb_publishable_...) ou "anon public".');
  const cfg = {
    supabaseUrl: (env.SUPABASE_URL || '').trim(),
    supabaseAnonKey: anon,
    tmdbProxy: tmdbAtivo(env),
    loginDominio: (env.LOGIN_DOMINIO || 'nossocantinho.app').trim().replace(/^@/, ''),
  };
  return `/* Gerado automaticamente a partir das variáveis de ambiente (apenas dados públicos). */\nwindow.NOSSO_CANTINHO_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`;
}

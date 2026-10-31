// Lê a configuração pública carregada por /config.js (gerada a partir do .env pelo server.mjs).
const bruto = window.NOSSO_CANTINHO_CONFIG || {};

export const config = Object.freeze({
  supabaseUrl: String(bruto.supabaseUrl || '').trim(),
  supabaseAnonKey: String(bruto.supabaseAnonKey || '').trim(),
  tmdbProxy: bruto.tmdbProxy === true,
  loginDominio: String(bruto.loginDominio || 'nossocantinho.app').trim().replace(/^@/, ''),
  tmdbProxyUrl: String(bruto.tmdbProxyUrl || 'api/tmdb/search'),
  tmdbImagens: 'https://image.tmdb.org/t/p/',
});

export const supabaseConfigurado = Boolean(config.supabaseUrl && config.supabaseAnonKey);

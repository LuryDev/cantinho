/*
 * Configuração PÚBLICA do Nosso Cantinho.
 *
 * Com `npm start` (server.mjs) ou na Vercel (api/config.js + vercel.json), este arquivo é
 * gerado automaticamente a partir das variáveis de ambiente — você não precisa editá-lo.
 *
 * Só em outra hospedagem puramente estática, preencha aqui:
 *   - supabaseUrl e supabaseAnonKey: são públicos por natureza (a segurança vem das políticas RLS).
 *   - NUNCA coloque aqui a chave service_role do Supabase nem a chave da API do TMDB.
 *   - tmdbProxy só deve ser true se existir um backend respondendo em /api/tmdb/search.
 */
window.NOSSO_CANTINHO_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  tmdbProxy: false,
  // Domínio do "e-mail interno" usado no login por nome (manu → manu@nossocantinho.app)
  loginDominio: "nossocantinho.app"
};

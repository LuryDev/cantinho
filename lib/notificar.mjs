// Envia notificações (Web Push) para os aparelhos do outro perfil.
// Usada por api/notificar.js (Vercel) e pelo servidor-local.mjs.
//
// Segurança:
//  - Quem chama precisa mandar o token de login do Supabase (Authorization: Bearer ...).
//  - As consultas ao banco usam ESSE token, então as regras de acesso (RLS) valem:
//    só dá para ler os aparelhos do próprio casal. Nenhuma chave secreta do Supabase é usada.
//  - O destinatário é sempre o outro perfil (ou você mesmo, no teste). O texto é limitado.
//  - A chave privada VAPID fica só nas variáveis de ambiente do servidor.

export function notificacoesAtivas(env = process.env) {
  return Boolean(
    (env.VAPID_PUBLIC_KEY || '').trim() && (env.VAPID_PRIVATE_KEY || '').trim()
    && (env.SUPABASE_URL || '').trim() && (env.SUPABASE_ANON_KEY || '').trim(),
  );
}

const PERFIS = ['manu', 'lury'];
const limpar = (t, max) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Normaliza o pedido vindo do navegador. */
export function prepararMensagem(dados = {}) {
  const url = typeof dados.url === 'string' && /^\/(#\/[\w\-/?=&%.]*)?$/.test(dados.url) ? dados.url : '/';
  const tag = typeof dados.tag === 'string' && /^[a-z0-9-]{1,40}$/i.test(dados.tag) ? dados.tag : undefined;
  return {
    titulo: limpar(dados.titulo, 80) || 'Nosso Cantinho',
    corpo: limpar(dados.corpo, 180),
    url,
    tag,
    paraMim: dados.paraMim === true,
  };
}

let webpushPadrao = null;
async function carregarWebPush() {
  if (!webpushPadrao) webpushPadrao = (await import('web-push')).default;
  return webpushPadrao;
}

/**
 * @returns {Promise<{status:number, corpo:object}>}
 */
export async function enviarNotificacao({ token, dados }, env = process.env, deps = {}) {
  const buscar = deps.fetch || fetch;
  if (!notificacoesAtivas(env)) return { status: 503, corpo: { erro: 'As notificações ainda não foram configuradas no servidor (chaves VAPID).' } };
  if (!token) return { status: 401, corpo: { erro: 'Entre na sua conta para enviar notificações.' } };

  const base = env.SUPABASE_URL.trim().replace(/\/+$/, '');
  const cab = { apikey: env.SUPABASE_ANON_KEY.trim(), Authorization: `Bearer ${token}` };

  // 1. Quem está pedindo
  const rUser = await buscar(`${base}/auth/v1/user`, { headers: cab });
  if (!rUser.ok) return { status: 401, corpo: { erro: 'Sessão inválida ou expirada. Entre de novo.' } };
  const usuario = await rUser.json();
  if (!usuario?.id) return { status: 401, corpo: { erro: 'Sessão inválida.' } };

  const rPerfil = await buscar(`${base}/rest/v1/perfis?select=nome,casal_id&user_id=eq.${encodeURIComponent(usuario.id)}`, { headers: cab });
  const perfil = rPerfil.ok ? (await rPerfil.json())?.[0] : null;
  if (!perfil || !PERFIS.includes(perfil.nome)) return { status: 403, corpo: { erro: 'Esta conta não está vinculada a um perfil do casal.' } };

  // 2. Para quem vai
  const msg = prepararMensagem(dados);
  const para = msg.paraMim ? perfil.nome : PERFIS.find((p) => p !== perfil.nome);
  const rIns = await buscar(`${base}/rest/v1/push_inscricoes?select=id,endpoint,p256dh,auth&perfil=eq.${para}`, { headers: cab });
  if (!rIns.ok) {
    const texto = await rIns.text().catch(() => '');
    if (/push_inscricoes/.test(texto) && /exist|find/i.test(texto)) return { status: 500, corpo: { erro: 'Falta rodar o arquivo supabase/notificacoes.sql no Supabase.' } };
    return { status: 502, corpo: { erro: 'Não foi possível ler os aparelhos cadastrados.' } };
  }
  const inscricoes = await rIns.json();
  if (!inscricoes.length) return { status: 200, corpo: { enviadas: 0, removidas: 0, motivo: 'sem-aparelho' } };

  // 3. Envia para cada aparelho
  const webpush = deps.webpush || await carregarWebPush();
  const payload = JSON.stringify({ titulo: msg.titulo, corpo: msg.corpo, url: msg.url, tag: msg.tag, de: perfil.nome });
  const opcoes = {
    TTL: 60 * 60 * 24 * 2,
    urgency: 'high',
    vapidDetails: {
      subject: (env.VAPID_SUBJECT || '').trim() || 'https://nossocantinho.app',
      publicKey: env.VAPID_PUBLIC_KEY.trim(),
      privateKey: env.VAPID_PRIVATE_KEY.trim(),
    },
  };
  let enviadas = 0;
  const vencidas = [];
  await Promise.all(inscricoes.map(async (i) => {
    try {
      await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, payload, opcoes);
      enviadas += 1;
    } catch (e) {
      // 404/410: o aparelho desativou ou desinstalou → remove do banco
      if (e?.statusCode === 404 || e?.statusCode === 410) vencidas.push(i.id);
      else console.warn('[notificar] falha ao enviar:', e?.statusCode || '', e?.body || e?.message || e);
    }
  }));
  if (vencidas.length) {
    await buscar(`${base}/rest/v1/push_inscricoes?id=in.(${vencidas.join(',')})`, { method: 'DELETE', headers: cab }).catch(() => {});
  }
  return { status: 200, corpo: { enviadas, removidas: vencidas.length } };
}

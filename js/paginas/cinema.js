// Cinema: sala decorada + player oficial do YouTube (IFrame API)
//  - Sessão juntos: o que um perfil coloca/pausa/avança aparece na tela do outro (sala-cinema.js)
//  - Reações (risada, tristeza, pipoca, susto) que flutuam na tela dos dois
//  - Todo vídeo assistido fica salvo em "Sessões"; os preferidos ganham estrela em "Favoritos"
//  - O tempo com vídeo tocando vira Recompensas do Cinema (aba "Conquistas")
// Respeita as regras de incorporação do YouTube: nada de download nem remoção de anúncios/controles.
import { listar, salvar, remover, obterAjustes, salvarAjustes } from '../store/index.js';
import { salaAtual } from '../sala-cinema.js';
import { PERFIS } from '../auth.js';
import { icone } from '../ui/icones.js';
import { adesivo, enfeitePorTema } from '../ui/ilustracoes.js';
import { esc, toast, confirmar, abrirModal, lerFormulario, marcarErro, limparErros, formatarData } from '../ui/dom.js';
import { temaAtual, aoMudarTema } from '../tema.js';
import { somarTempoCinema, gravarTempoCinema, lerProgresso, carregarRecompensas } from '../recompensas.js';
import { montarPainelConquistas } from '../conquistas.js';

export const REACOES = {
  risada: { emoji: '😂', nome: 'Risada' },
  tristeza: { emoji: '😢', nome: 'Tristeza' },
  pipoca: { emoji: '🍿', nome: 'Pipoca' },
  susto: { emoji: '😱', nome: 'Susto' },
};

export function extrairIdYoutube(entrada) {
  const s = String(entrada || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  let url;
  try { url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch { return null; }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else id = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/)?.[1] || null;
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

const miniatura = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const linkYoutube = (id) => `https://www.youtube.com/watch?v=${id}`;
const SALA_VALIDA_MS = 4 * 60 * 60 * 1000;

// Carrega a IFrame API do YouTube uma única vez
let promessaApi = null;
function carregarApiYoutube() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (promessaApi) return promessaApi;
  promessaApi = new Promise((ok, falha) => {
    const anterior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { anterior?.(); ok(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => { promessaApi = null; falha(new Error('api')); };
    document.head.append(s);
    setTimeout(() => { if (!window.YT?.Player) { promessaApi = null; falha(new Error('tempo')); } }, 10000);
  });
  return promessaApi;
}

const ERROS_PLAYER = {
  2: 'O link parece inválido. Confira o endereço do vídeo.',
  5: 'O navegador não conseguiu reproduzir este vídeo aqui.',
  100: 'Este vídeo não foi encontrado ou é privado.',
  101: 'O dono deste vídeo não permite que ele seja reproduzido fora do YouTube.',
  150: 'O dono deste vídeo não permite que ele seja reproduzido fora do YouTube.',
  153: 'O YouTube recusou a reprodução incorporada deste vídeo.',
};

const letreiro = (tema) => (tema === 'lury' ? 'Sessão da Meia-Noite' : tema === 'manu' ? 'Cine Girassol' : 'Sessão do Casal');

function enfeitesSala(tema) {
  if (tema === 'lury') return `<span class="sala-enfeite se-1">${adesivo('morcego')}</span><span class="sala-enfeite se-2">${adesivo('morcego')}</span><span class="sala-enfeite se-3">${adesivo('vela')}</span><span class="sala-enfeite se-4">${adesivo('vela')}</span>`;
  if (tema === 'manu') return `<span class="sala-enfeite se-1">${adesivo('girassol')}</span><span class="sala-enfeite se-2">${adesivo('girassol')}</span><span class="sala-enfeite se-3">${adesivo('folhagem')}</span><span class="sala-enfeite se-4">${adesivo('raposa')}</span>`;
  return `<span class="sala-enfeite se-1">${adesivo('coracao')}</span><span class="sala-enfeite se-2">${adesivo('brilho')}</span><span class="sala-enfeite se-3">${adesivo('laco')}</span><span class="sala-enfeite se-4">${adesivo('coracao')}</span>`;
}

function poltronas() {
  const assento = (x) => `<g transform="translate(${x} 0)"><rect x="2" y="6" width="36" height="26" rx="10" class="pol-encosto"/><rect x="0" y="26" width="40" height="14" rx="6" class="pol-assento"/></g>`;
  return `<svg class="poltronas" viewBox="0 0 520 44" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${Array.from({ length: 11 }, (_, i) => assento(6 + i * 46.5)).join('')}</svg>`;
}

const ehFavorito = (v) => v.favorito !== false; // favoritos antigos não tinham o campo
const classeModo = (modo) => (modo ? `modo-${modo}` : '');

export async function renderizar(el, ctx) {
  const eu = ctx.perfil.id;
  const outro = Object.values(PERFIS).find((p) => p.id !== eu);
  const nome = (id) => PERFIS[id]?.nome || 'Alguém';
  const sala = salaAtual();

  let videos = [];
  let aba = /[?&]conquistas\b/.test(location.hash) ? 'conquistas' : 'sessoes';
  let limparPainel = null;
  let player = null;
  let playerPronto = null;
  let usandoApi = true;
  let videoAtual = null; // { youtubeId, titulo, docId }
  let aplicandoRemotoAte = 0;
  let estadoEsperado = null; // estado que o comando remoto vai provocar (o "eco" a ignorar)
  let ultimoRemoto = null;
  let jaInteragiu = false;
  let timerPersistir = null;
  const timersReacao = new Map();
  let juntosLigado = true;
  try { juntosLigado = localStorage.getItem('nc:cinema-juntos') !== 'nao'; } catch { /* ignora */ }

  el.innerHTML = '<div class="estado"><span class="spinner pequeno" aria-hidden="true"></span> Preparando a sala…</div>';
  try {
    videos = await listar('videos');
  } catch (e) {
    el.innerHTML = `<div class="aviso erro" role="alert">${icone('alerta')}<p>${esc(e.message)}</p></div>`;
    return;
  }

  const suportaTelaCheia = Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);

  el.innerHTML = `
    <div class="cabecalho-secao">
      <div>
        <h1 class="titulo-pagina">Cinema</h1>
        <p>Apaguem as luzes, peguem a pipoca e escolham um vídeo do YouTube.</p>
      </div>
    </div>

    <section class="sala ${classeModo(lerProgresso().modoCinema)}" aria-label="Sala de cinema">
      <div class="letreiro"><span class="letreiro-texto">${letreiro(temaAtual())}</span></div>
      <div class="palco">
        <div class="cortina esquerda" aria-hidden="true"></div>
        <div class="cortina direita" aria-hidden="true"></div>
        <div class="sala-enfeites" aria-hidden="true">${enfeitesSala(temaAtual())}</div>
        <div class="tela-moldura">
          <div class="tela-cheia" id="tela-cheia">
            <div class="tela" id="tela-cinema">
              <div class="tela-vazia" id="tela-vazia">
                ${icone('cinema')}
                <p>A tela está esperando um filme.</p>
                <p class="dica">Cole um link do YouTube logo abaixo ou escolha uma sessão.</p>
              </div>
              <div id="player-youtube" hidden></div>
              <div class="reacoes-voando" aria-hidden="true"></div>
              <div class="tela-entrar" id="tela-entrar" hidden></div>
              <div class="tela-aviso" id="tela-aviso" role="alert" hidden></div>
            </div>
            <div class="barra-reacoes" role="group" aria-label="Reações">
              ${Object.entries(REACOES).map(([id, r]) => `
                <button type="button" class="botao-reacao" data-reagir="${id}" aria-label="Reagir com ${r.nome}" title="${r.nome}">
                  <span class="emoji" aria-hidden="true">${r.emoji}</span><span class="rotulo-reacao">${r.nome}</span>
                </button>`).join('')}
            </div>
          </div>
        </div>
      </div>
      ${poltronas()}
    </section>

    <section class="cartao controles-cinema" aria-labelledby="titulo-controles">
      <h2 id="titulo-controles" class="sr-only">Carregar vídeo</h2>
      <div class="sala-status" id="sala-status" aria-live="polite"></div>
      <form class="formulario" id="form-video" novalidate>
        <div class="campo">
          <label for="url-video">Link ou ID de um vídeo do YouTube</label>
          <div class="entrada-com-botao">
            <input class="entrada" id="url-video" name="url" placeholder="https://www.youtube.com/watch?v=…" autocomplete="off" inputmode="url">
            <button type="submit" class="botao">${icone('play')} Carregar</button>
          </div>
          <p class="dica">Aceita links do tipo youtube.com/watch, youtu.be, /shorts e /embed. Todo vídeo carregado fica salvo em "Sessões".</p>
        </div>
      </form>
      <div class="grupo-botoes">
        <label class="interruptor">
          <input type="checkbox" data-juntos ${juntosLigado ? 'checked' : ''}>
          <span class="interruptor-trilho" aria-hidden="true"></span>
          <span>Assistir junto com ${esc(outro.nome)}</span>
        </label>
        <button type="button" class="botao-sec" data-favoritar-atual disabled>${icone('estrela')} Favoritar</button>
        <button type="button" class="botao-sec" data-tela-cheia disabled>${icone('telacheia')} Tela cheia</button>
        ${suportaTelaCheia ? '' : '<span class="dica">Tela cheia não é suportada neste navegador.</span>'}
      </div>
    </section>

    <section class="secao-videos" aria-labelledby="titulo-videos">
      <h2 id="titulo-videos" class="sr-only">Vídeos e conquistas</h2>
      <div class="abas" role="tablist" aria-label="Vídeos e conquistas">
        <button type="button" class="aba" role="tab" id="aba-sessoes" aria-controls="painel-videos" data-aba-video="sessoes"></button>
        <button type="button" class="aba" role="tab" id="aba-favoritos" aria-controls="painel-videos" data-aba-video="favoritos"></button>
        <button type="button" class="aba" role="tab" id="aba-conquistas" aria-controls="painel-videos" data-aba-video="conquistas"></button>
      </div>
      <div id="painel-videos" role="tabpanel"></div>
    </section>`;

  const tela = el.querySelector('#tela-cinema');
  const telaCheia = el.querySelector('#tela-cheia');
  const palco = el.querySelector('.palco');
  const vazia = el.querySelector('#tela-vazia');
  const aviso = el.querySelector('#tela-aviso');
  const entrar = el.querySelector('#tela-entrar');
  const alvoPlayer = el.querySelector('#player-youtube');
  const voando = el.querySelector('.reacoes-voando');
  const botaoFavoritar = el.querySelector('[data-favoritar-atual]');
  const botaoTelaCheia = el.querySelector('[data-tela-cheia]');
  const form = el.querySelector('#form-video');
  const statusSala = el.querySelector('#sala-status');

  const pararOuvirTema = aoMudarTema((t) => {
    el.querySelector('.letreiro-texto').textContent = letreiro(t);
    el.querySelector('.sala-enfeites').innerHTML = enfeitesSala(t);
  });

  // ---------------- Status da sala compartilhada ----------------
  function desenharStatus() {
    if (!juntosLigado) {
      statusSala.innerHTML = `<span class="ponto desligado" aria-hidden="true"></span> Assistindo sozinho(a). Ligue "Assistir junto" para sincronizar com ${esc(outro.nome)}.`;
      return;
    }
    if (!sala || sala.tipo === 'nenhum') {
      statusSala.innerHTML = `<span class="ponto desligado" aria-hidden="true"></span> Sessão juntos indisponível neste navegador.`;
      return;
    }
    if (sala.status === 'conectando') { statusSala.innerHTML = '<span class="spinner pequeno" aria-hidden="true"></span> Abrindo a sala compartilhada…'; return; }
    if (sala.status === 'erro') { statusSala.innerHTML = `<span class="ponto erro" aria-hidden="true"></span> ${esc(sala.erro)}`; return; }
    const presente = sala.presentes.has(outro.id);
    const local = sala.tipo === 'local' ? ' <span class="dica">(modo demonstração: sincroniza abas deste navegador)</span>' : '';
    statusSala.innerHTML = presente
      ? `<span class="ponto ligado" aria-hidden="true"></span> <strong>${esc(outro.nome)} está na sala.</strong> O que você colocar, pausar ou avançar aparece para ${esc(outro.nome)} também.${local}`
      : `<span class="ponto" aria-hidden="true"></span> ${esc(outro.nome)} ainda não está na sala. Quando abrir o Cinema, vê o mesmo vídeo no mesmo ponto.${local}`;
  }
  const pararStatus = sala ? sala.aoMudar(desenharStatus) : (desenharStatus(), () => {});

  // ---------------- Player ----------------
  const marcarRemoto = (tocando = null) => { aplicandoRemotoAte = Date.now() + 2000; estadoEsperado = tocando; };
  const tempoAtual = () => { try { return player?.getCurrentTime?.() || 0; } catch { return 0; } };
  const tocandoAgora = () => { try { return player?.getPlayerState?.() === 1; } catch { return false; } };

  function mostrarAviso(mensagem, id) {
    aviso.hidden = false;
    aviso.innerHTML = `
      ${icone('alerta')}
      <p>${esc(mensagem)}</p>
      ${id ? `<a class="botao-sec pequeno" href="${linkYoutube(id)}" target="_blank" rel="noopener noreferrer">${icone('link')} Assistir no YouTube</a>` : ''}`;
  }

  function mostrarEntrar(texto) {
    entrar.hidden = false;
    entrar.innerHTML = `<button type="button" class="botao botao-entrar-sessao" data-entrar-sessao>${icone('play')} ${esc(texto)}</button>`;
  }

  function atualizarBotoes() {
    const doc = videoAtual && videos.find((v) => v.youtubeId === videoAtual.youtubeId);
    const fav = Boolean(doc && ehFavorito(doc));
    botaoFavoritar.disabled = !videoAtual;
    botaoFavoritar.setAttribute('aria-pressed', String(fav));
    botaoFavoritar.innerHTML = `${icone('estrela', fav ? 'cheio' : '')} ${fav ? 'Favoritado' : 'Favoritar'}`;
    if (suportaTelaCheia) botaoTelaCheia.disabled = !videoAtual;
    el.querySelectorAll('[data-yt]').forEach((c) => c.classList.toggle('tocando', c.dataset.yt === videoAtual?.youtubeId));
  }

  function usarIframeSimples(id, inicio) {
    alvoPlayer.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1&start=${Math.floor(inicio)}" title="Player do YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
  }

  function aoMudarEstado(ev) {
    const dados = player?.getVideoData?.();
    if (videoAtual && dados?.video_id === videoAtual.youtubeId) {
      aviso.hidden = true;
      if (dados.title) atualizarTituloAutomatico(dados.title);
    }
    if (ev.data === 1) { entrar.hidden = true; jaInteragiu = true; }
    marcarTocando(ev.data === 1);
    if (ev.data === 2 || ev.data === 0) salvarTempoEConferir();
    if (ev.data !== 1 && ev.data !== 2 && ev.data !== 0) return;
    const tocando = ev.data === 1;
    // Ignora só o eco do comando que veio do outro perfil; ações da própria pessoa sempre passam
    if (Date.now() < aplicandoRemotoAte && (estadoEsperado === null || estadoEsperado === tocando)) {
      estadoEsperado = null;
      aplicandoRemotoAte = 0;
      return;
    }
    enviarEstado(tocando);
  }

  /** Mostra um vídeo na tela. tocar=true tenta reproduzir (pode exigir um toque, regra dos navegadores). */
  async function mostrarVideo(id, titulo, { inicio = 0, tocar = false } = {}) {
    videoAtual = { youtubeId: id, titulo: titulo || videoAtual?.titulo || '', docId: videos.find((v) => v.youtubeId === id)?.id };
    aviso.hidden = true;
    entrar.hidden = true;
    vazia.hidden = true;
    alvoPlayer.hidden = false;
    palco.classList.add('em-sessao');
    atualizarBotoes();

    if (!usandoApi) { usarIframeSimples(id, inicio); return; }
    try {
      const YT = await carregarApiYoutube();
      if (!el.isConnected) return;
      if (player?.loadVideoById) {
        await playerPronto;
        if (tocar) player.loadVideoById({ videoId: id, startSeconds: inicio });
        else player.cueVideoById({ videoId: id, startSeconds: inicio });
        return;
      }
      alvoPlayer.innerHTML = '<div id="yt-alvo"></div>';
      playerPronto = new Promise((pronto) => {
        player = new YT.Player('yt-alvo', {
          videoId: id,
          host: 'https://www.youtube-nocookie.com',
          playerVars: { rel: 0, playsinline: 1, origin: location.origin, start: Math.floor(inicio), autoplay: tocar ? 1 : 0 },
          events: {
            onReady: () => pronto(),
            onError: (ev) => mostrarAviso(ERROS_PLAYER[ev.data] || 'Não foi possível reproduzir este vídeo aqui.', videoAtual?.youtubeId),
            onStateChange: aoMudarEstado,
          },
        });
      });
      await playerPronto;
    } catch {
      usandoApi = false;
      usarIframeSimples(id, inicio);
      statusSala.insertAdjacentHTML('beforeend', '<p class="dica">O player oficial não carregou; a sincronização fica desligada nesta tela.</p>');
    }
  }

  // ---------------- Sincronização ----------------
  const podeSincronizar = () => juntosLigado && sala && sala.status === 'ok';

  function persistirSala(dados) {
    clearTimeout(timerPersistir);
    timerPersistir = setTimeout(() => {
      salvarAjustes({ cinemaAtual: { ...dados, de: eu, em: Date.now() } }).catch(() => { /* sem conexão: tudo bem */ });
    }, 1500);
  }

  function enviarEstado(tocando) {
    if (!videoAtual || !usandoApi) return;
    const dados = { youtubeId: videoAtual.youtubeId, titulo: videoAtual.titulo, tocando, posicao: tempoAtual() };
    // não devolve o eco do que acabou de chegar do outro perfil
    if (ultimoRemoto && Date.now() - ultimoRemoto.recebidoEm < 2500 && ultimoRemoto.tocando === tocando
      && Math.abs(ultimoRemoto.posicaoEstimada() - dados.posicao) < 1.5) return;
    if (podeSincronizar()) sala.enviar('estado', dados);
    if (juntosLigado) persistirSala(dados);
  }

  function alvoDe(msg) {
    const atraso = msg.tocando ? Math.min(6, Math.max(0, (Date.now() - (msg.em || Date.now())) / 1000)) : 0;
    return (Number(msg.posicao) || 0) + atraso;
  }

  async function aplicarRemoto(msg, { carregarSeNovo = true } = {}) {
    if (!juntosLigado) return;
    const recebidoEm = Date.now();
    ultimoRemoto = { ...msg, recebidoEm, posicaoEstimada: () => alvoDe(msg) + (msg.tocando ? (Date.now() - recebidoEm) / 1000 : 0) };
    if (!videoAtual || videoAtual.youtubeId !== msg.youtubeId) {
      if (!carregarSeNovo) return;
      marcarRemoto(msg.tocando && jaInteragiu);
      await mostrarVideo(msg.youtubeId, msg.titulo, { inicio: alvoDe(msg), tocar: msg.tocando && jaInteragiu });
      if (msg.tocando && !jaInteragiu) mostrarEntrar(`Assistir junto com ${nome(msg.de)}`);
      else if (msg.tocando) conferirAutoplay(msg.de);
      setTimeout(recarregarVideos, 1500);
      return;
    }
    if (!usandoApi || !player?.seekTo) return;
    await playerPronto;
    const alvo = alvoDe(msg);
    const precisaPular = Math.abs(tempoAtual() - alvo) > 1.5;
    const precisaMudar = msg.tocando !== tocandoAgora();
    if (!precisaPular && !precisaMudar) return;
    marcarRemoto(msg.tocando);
    if (precisaPular) player.seekTo(alvo, true);
    if (msg.tocando) { player.playVideo(); conferirAutoplay(msg.de); } else player.pauseVideo();
  }

  /** Navegadores bloqueiam som automático sem um toque: se não tocou, mostra o botão. */
  function conferirAutoplay(de) {
    setTimeout(() => {
      if (!tocandoAgora() && ultimoRemoto?.tocando) mostrarEntrar(`Assistir junto com ${nome(de)}`);
    }, 1800);
  }

  const pararOuvirSala = sala ? sala.ouvir((msg) => {
    if (!juntosLigado) return;
    if (msg.tipo === 'carregar' || msg.tipo === 'estado') {
      if (msg.tipo === 'carregar') toast(`${nome(msg.de)} colocou "${msg.titulo || 'um vídeo'}" na tela.`, 'info', { duracao: 3000 });
      aplicarRemoto(msg);
    } else if (msg.tipo === 'pedir-estado') {
      if (videoAtual && usandoApi) {
        sala.enviar('estado', { youtubeId: videoAtual.youtubeId, titulo: videoAtual.titulo, tocando: tocandoAgora(), posicao: tempoAtual() });
      }
    } else if (msg.tipo === 'reacao' && REACOES[msg.reacao]) {
      if (!videoAtual || msg.youtubeId === videoAtual.youtubeId) soltarReacao(msg.reacao, msg.de);
    }
  }) : () => {};

  // ---------------- Sessões e favoritos ----------------
  async function recarregarVideos() {
    try { videos = await listar('videos'); desenharVideos(); atualizarBotoes(); } catch { /* tenta de novo depois */ }
  }

  async function registrarSessao(id, titulo) {
    if (!titulo) {
      try { const d = player?.getVideoData?.(); if (d?.video_id === id && d.title) titulo = d.title; } catch { /* ainda sem dados */ }
    }
    const existente = videos.find((v) => v.youtubeId === id);
    const vez = { em: new Date().toISOString(), por: eu, juntos: Boolean(podeSincronizar() && sala.presentes.has(outro.id)) };
    const doc = existente
      ? { ...existente, vezes: [vez, ...(existente.vezes || [])].slice(0, 50), ultimoEm: vez.em }
      : { youtubeId: id, titulo: titulo || 'Vídeo do YouTube', tituloAuto: !titulo, favorito: false, vezes: [vez], reacoes: {}, ultimoEm: vez.em };
    try {
      const salvo = await salvar('videos', doc);
      videos = [salvo, ...videos.filter((v) => v.id !== salvo.id)];
      if (videoAtual?.youtubeId === id) videoAtual.docId = salvo.id;
      desenharVideos();
      atualizarBotoes();
    } catch (e) { toast(e.message, 'erro'); }
  }

  async function atualizarTituloAutomatico(titulo) {
    if (videoAtual && !videoAtual.titulo) videoAtual.titulo = titulo;
    const doc = videos.find((v) => v.youtubeId === videoAtual?.youtubeId);
    if (!doc || !doc.tituloAuto || doc.titulo === titulo) return;
    doc.titulo = titulo;
    doc.tituloAuto = false;
    try { const salvo = await salvar('videos', doc); videos = videos.map((v) => (v.id === salvo.id ? salvo : v)); desenharVideos(); } catch { /* ignora */ }
  }

  async function carregarLocal(id, titulo = '') {
    jaInteragiu = true;
    const salvo = videos.find((v) => v.youtubeId === id);
    const t = titulo || salvo?.titulo || '';
    await mostrarVideo(id, t, { inicio: 0, tocar: true });
    if (podeSincronizar()) sala.enviar('carregar', { youtubeId: id, titulo: t, tocando: true, posicao: 0 });
    if (juntosLigado) persistirSala({ youtubeId: id, titulo: t, tocando: true, posicao: 0 });
    registrarSessao(id, t);
    tela.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function contadorReacoes(v) {
    const r = v.reacoes || {};
    const itens = Object.entries(REACOES).filter(([id]) => r[id]).map(([id, x]) => `<span class="chip-reacao" title="${x.nome}"><span aria-hidden="true">${x.emoji}</span> ${r[id]}<span class="sr-only"> ${x.nome}</span></span>`);
    return itens.length ? `<div class="reacoes-contagem">${itens.join('')}</div>` : '';
  }

  function htmlVideo(v) {
    const vezes = v.vezes?.length || 0;
    const ultima = v.vezes?.[0];
    const fav = ehFavorito(v);
    return `
      <li class="video-cartao ${videoAtual?.youtubeId === v.youtubeId ? 'tocando' : ''}" data-video="${esc(v.id)}" data-yt="${esc(v.youtubeId)}">
        <button type="button" class="video-miniatura" data-assistir aria-label="Assistir ${esc(v.titulo)}">
          <img src="${miniatura(v.youtubeId)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-mini>
          <span class="video-play" aria-hidden="true">${icone('play', 'cheio')}</span>
          ${fav ? `<span class="video-estrela" aria-hidden="true">${icone('estrela', 'cheio')}</span>` : ''}
        </button>
        <div class="video-info">
          <h3>${esc(v.titulo)}</h3>
          <p class="meta">${vezes ? `Assistido ${vezes}× · última vez ${esc(formatarData(ultima.em))}${ultima.por ? ` por ${esc(nome(ultima.por))}` : ''}${ultima.juntos ? ' · juntos' : ''}` : 'Ainda não assistido'}</p>
          ${contadorReacoes(v)}
          <div class="grupo-botoes">
            <button type="button" class="botao pequeno" data-assistir>${icone('play')} Assistir</button>
            <button type="button" class="botao-icone" data-favoritar aria-pressed="${fav}" aria-label="${fav ? 'Tirar dos favoritos' : 'Favoritar'}: ${esc(v.titulo)}" title="${fav ? 'Tirar dos favoritos' : 'Favoritar'}">${icone('estrela', fav ? 'cheio' : '')}</button>
            <button type="button" class="botao-icone" data-renomear aria-label="Editar título de ${esc(v.titulo)}" title="Editar título">${icone('editar')}</button>
            <button type="button" class="botao-icone perigo" data-remover aria-label="Remover ${esc(v.titulo)}" title="Remover">${icone('lixeira')}</button>
          </div>
        </div>
      </li>`;
  }

  function desenharAbas() {
    const ordenados = videos.length;
    const favoritos = videos.filter(ehFavorito).length;
    const prog = lerProgresso();
    const abas = {
      sessoes: `Sessões <span class="contador">${ordenados}</span>`,
      favoritos: `${icone('estrela')} Favoritos <span class="contador">${favoritos}</span>`,
      conquistas: `${icone('sparkle')} Conquistas <span class="contador">${prog.desbloqueadas.length}</span>`,
    };
    for (const [id, html] of Object.entries(abas)) {
      const b = el.querySelector(`#aba-${id}`);
      b.innerHTML = html;
      b.setAttribute('aria-selected', String(aba === id));
      b.tabIndex = aba === id ? 0 : -1;
    }
    el.querySelector('#painel-videos').setAttribute('aria-labelledby', `aba-${aba}`);
  }

  function desenharVideos(focarAba = false) {
    desenharAbas();
    if (focarAba) el.querySelector(`[data-aba-video="${aba}"]`)?.focus();
    if (aba === 'conquistas') {
      if (!limparPainel) limparPainel = montarPainelConquistas(el.querySelector('#painel-videos'), ctx.perfil);
      return;
    }
    limparPainel?.();
    limparPainel = null;
    const ordenados = [...videos].sort((a, b) => String(b.ultimoEm || b.atualizadoEm || '').localeCompare(String(a.ultimoEm || a.atualizadoEm || '')));
    const favoritos = ordenados.filter(ehFavorito);
    const lista = aba === 'favoritos' ? favoritos : ordenados;
    el.querySelector('#painel-videos').innerHTML = lista.length
      ? `<ul class="grade grade-videos" role="list">${lista.map(htmlVideo).join('')}</ul>`
      : `<div class="vazio">
          <span class="ilustracao" aria-hidden="true">${enfeitePorTema({ neutro: 'coracao', lury: 'vela', manu: 'polaroid' })}</span>
          <h3>${aba === 'favoritos' ? 'Nenhum favorito ainda' : 'Nenhuma sessão ainda'}</h3>
          <p>${aba === 'favoritos' ? 'Toque na estrela de um vídeo para guardar aqui.' : 'Todo vídeo que vocês colocarem na tela aparece aqui automaticamente.'}</p>
        </div>`;
  }

  async function alternarFavorito(v) {
    try {
      const salvo = await salvar('videos', { ...v, favorito: !ehFavorito(v) });
      videos = videos.map((x) => (x.id === salvo.id ? salvo : x));
      toast(ehFavorito(salvo) ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.', 'sucesso', { duracao: 2000 });
      desenharVideos();
      atualizarBotoes();
    } catch (e) { toast(e.message, 'erro'); }
  }

  function formularioTitulo(titulo) {
    return new Promise((resolver) => {
      let valor = null;
      const { el: modal, fechar } = abrirModal({
        titulo: 'Editar título',
        tamanho: 'pequeno',
        corpo: `<form class="formulario" id="form-titulo-video" novalidate>
            <div class="campo"><label for="titulo-video">Título</label>
            <input id="titulo-video" name="titulo" maxlength="100" value="${esc(titulo)}" required></div></form>`,
        rodape: `<button type="button" class="botao-fantasma" data-fechar>Cancelar</button>
                 <button type="submit" form="form-titulo-video" class="botao">${icone('salvar')} Salvar</button>`,
        aoFechar: () => resolver(valor),
      });
      const f = modal.querySelector('form');
      f.elements.titulo.focus();
      f.elements.titulo.select();
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        limparErros(f);
        const { titulo: t } = lerFormulario(f);
        if (!t) return marcarErro(f.elements.titulo, 'Dê um título para o vídeo.');
        valor = t;
        fechar();
      });
    });
  }

  // ---------------- Reações ----------------
  function soltarReacao(tipo, de) {
    const r = REACOES[tipo];
    const item = document.createElement('span');
    item.className = `reacao-voando ${de === eu ? 'minha' : 'do-outro'}`;
    item.style.setProperty('--x', `${10 + Math.random() * 80}%`);
    item.style.setProperty('--giro', `${(Math.random() - 0.5) * 40}deg`);
    item.innerHTML = `<span class="emoji">${r.emoji}</span>${de !== eu ? `<span class="quem">${esc(nome(de))}</span>` : ''}`;
    voando.append(item);
    setTimeout(() => item.remove(), 2600);
  }

  function contarReacao(tipo) {
    const doc = videos.find((v) => v.youtubeId === videoAtual?.youtubeId);
    if (!doc) return;
    doc.reacoes = { ...(doc.reacoes || {}), [tipo]: ((doc.reacoes || {})[tipo] || 0) + 1 };
    clearTimeout(timersReacao.get(doc.id));
    timersReacao.set(doc.id, setTimeout(async () => {
      try { const salvo = await salvar('videos', doc); videos = videos.map((v) => (v.id === salvo.id ? salvo : v)); desenharVideos(); } catch { /* ignora */ }
    }, 1500));
  }

  // ---------------- Tempo de cinema e recompensas ----------------
  // Conta só com o player oficial tocando. Assistindo juntos, cada um conta metade,
  // assim o total do casal não duplica.
  let ultimoTique = Date.now();
  const relogioCinema = setInterval(() => {
    const agora = Date.now();
    const passou = Math.min(agora - ultimoTique, 5000);
    ultimoTique = agora;
    if (!videoAtual || !usandoApi || !tocandoAgora()) return;
    const juntos = podeSincronizar() && sala.presentes.has(outro.id);
    somarTempoCinema(eu, juntos ? passou / 2 : passou);
  }, 1000);

  function marcarTocando(tocando) {
    if (tocando) document.body.dataset.cinemaTocando = 'sim';
    else delete document.body.dataset.cinemaTocando;
  }

  const pedirComemoracao = () => window.dispatchEvent(new CustomEvent('nc:verificar-conquistas'));
  async function salvarTempoEConferir() {
    await gravarTempoCinema();
    if (!tocandoAgora()) pedirComemoracao();
  }

  let desbloqueadasAntes = lerProgresso().desbloqueadas.length;
  const elSala = el.querySelector('.sala');
  function aoMudarRecompensas(e) {
    const prog = e.detail;
    elSala.className = `sala ${classeModo(prog.modoCinema)}`;
    if (aba !== 'conquistas') desenharAbas();
    if (prog.desbloqueadas.length > desbloqueadasAntes) {
      const nova = prog.desbloqueadas.at(-1);
      if (tocandoAgora()) {
        toast(`Recompensa desbloqueada: ${nova.nome}! A comemoração aparece quando pausarem.`, 'sucesso', { duracao: 5000 });
      } else pedirComemoracao();
    }
    desbloqueadasAntes = prog.desbloqueadas.length;
  }
  window.addEventListener('nc:recompensas-mudou', aoMudarRecompensas);
  carregarRecompensas().catch(() => {});
  const gravarAoSair = () => { gravarTempoCinema(); };
  window.addEventListener('pagehide', gravarAoSair);

  // ---------------- Eventos ----------------
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    limparErros(form);
    const id = extrairIdYoutube(form.elements.url.value);
    if (!id) return marcarErro(form.elements.url, 'Não reconheci esse link. Use um endereço de vídeo do YouTube.');
    form.elements.url.value = '';
    carregarLocal(id);
  });

  el.querySelector('[data-juntos]').addEventListener('change', (e) => {
    juntosLigado = e.target.checked;
    try { localStorage.setItem('nc:cinema-juntos', juntosLigado ? 'sim' : 'nao'); } catch { /* ignora */ }
    desenharStatus();
    if (juntosLigado && podeSincronizar()) {
      if (videoAtual) enviarEstado(tocandoAgora());
      else sala.enviar('pedir-estado');
    }
  });

  botaoFavoritar.addEventListener('click', () => {
    const doc = videos.find((v) => v.youtubeId === videoAtual?.youtubeId);
    if (doc) alternarFavorito(doc);
  });

  botaoTelaCheia.addEventListener('click', () => {
    const pedir = telaCheia.requestFullscreen || telaCheia.webkitRequestFullscreen;
    if (!pedir) return toast('Tela cheia não é suportada neste navegador.', 'info');
    Promise.resolve(pedir.call(telaCheia)).catch(() => toast('O navegador não permitiu a tela cheia.', 'info'));
  });

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.reagir) {
      jaInteragiu = true;
      soltarReacao(b.dataset.reagir, eu);
      if (videoAtual) {
        if (podeSincronizar()) sala.enviar('reacao', { reacao: b.dataset.reagir, youtubeId: videoAtual.youtubeId });
        contarReacao(b.dataset.reagir);
      }
      return;
    }
    if (b.hasAttribute('data-entrar-sessao')) {
      jaInteragiu = true;
      entrar.hidden = true;
      if (player?.playVideo) {
        marcarRemoto(true);
        if (ultimoRemoto) player.seekTo(ultimoRemoto.posicaoEstimada(), true);
        player.playVideo();
      }
      if (podeSincronizar()) sala.enviar('pedir-estado');
      return;
    }
    if (b.dataset.abaVideo) { aba = b.dataset.abaVideo; desenharVideos(true); return; }
    const cartao = b.closest('[data-video]');
    if (!cartao) return;
    const v = videos.find((x) => x.id === cartao.dataset.video);
    if (!v) return;
    if (b.hasAttribute('data-assistir')) carregarLocal(v.youtubeId, v.titulo);
    else if (b.hasAttribute('data-favoritar')) alternarFavorito(v);
    else if (b.hasAttribute('data-renomear')) {
      const titulo = await formularioTitulo(v.titulo);
      if (!titulo || titulo === v.titulo) return;
      try {
        const salvo = await salvar('videos', { ...v, titulo, tituloAuto: false });
        videos = videos.map((x) => (x.id === salvo.id ? salvo : x));
        if (videoAtual?.youtubeId === salvo.youtubeId) videoAtual.titulo = titulo;
        toast('Título atualizado.', 'sucesso');
        desenharVideos();
      } catch (err) { toast(err.message, 'erro'); }
    } else if (b.hasAttribute('data-remover')) {
      const ok = await confirmar({ titulo: 'Remover vídeo?', mensagem: `"${v.titulo}" sai das sessões e dos favoritos de vocês.`, textoConfirmar: 'Remover' });
      if (!ok) return;
      try {
        await remover('videos', v.id);
        videos = videos.filter((x) => x.id !== v.id);
        toast('Vídeo removido.', 'sucesso');
        desenharVideos();
        atualizarBotoes();
      } catch (err) { toast(err.message, 'erro'); }
    }
  });

  el.addEventListener('keydown', (e) => {
    const atual = e.target.closest('[data-aba-video]');
    if (!atual || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const ordem = ['sessoes', 'favoritos', 'conquistas'];
    aba = ordem[(ordem.indexOf(aba) + (e.key === 'ArrowRight' ? 1 : ordem.length - 1)) % ordem.length];
    desenharVideos(true);
  });

  el.addEventListener('error', (e) => {
    if (e.target instanceof HTMLImageElement && e.target.hasAttribute('data-mini')) e.target.classList.add('sem-imagem');
  }, true);

  desenharVideos();
  atualizarBotoes();

  // Entrou no Cinema: retoma o que estiver passando para o casal
  try {
    const ajustes = await obterAjustes();
    const atual = ajustes?.cinemaAtual;
    if (el.isConnected && !videoAtual && juntosLigado && atual?.youtubeId && Date.now() - (atual.em || 0) < SALA_VALIDA_MS) {
      // posição salva + tempo que passou desde então (se estava tocando)
      const posicaoAgora = () => (Number(atual.posicao) || 0) + (atual.tocando ? (Date.now() - atual.em) / 1000 : 0);
      ultimoRemoto = { ...atual, recebidoEm: 0, posicaoEstimada: posicaoAgora };
      marcarRemoto(false);
      await mostrarVideo(atual.youtubeId, atual.titulo, { inicio: posicaoAgora(), tocar: false });
      if (atual.tocando) mostrarEntrar(atual.de && atual.de !== eu ? `Entrar na sessão com ${nome(atual.de)}` : 'Continuar a sessão');
    }
  } catch { /* sem ajustes: começa com a tela vazia */ }
  if (podeSincronizar()) sala.enviar('pedir-estado');

  return () => {
    pararOuvirTema();
    pararOuvirSala();
    pararStatus();
    clearTimeout(timerPersistir);
    clearInterval(relogioCinema);
    window.removeEventListener('nc:recompensas-mudou', aoMudarRecompensas);
    window.removeEventListener('pagehide', gravarAoSair);
    limparPainel?.();
    marcarTocando(false);
    gravarTempoCinema();
    try { player?.destroy?.(); } catch { /* ignora */ }
    player = null;
  };
}

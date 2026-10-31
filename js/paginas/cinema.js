// Cinema: sala decorada + player oficial do YouTube (IFrame API) + favoritos.
// Respeita as regras de incorporação: se o dono do vídeo bloqueou, mostramos
// um aviso amigável e um link para assistir no YouTube. Nada de download ou
// remoção de anúncios/controles.
import { listar, salvar, remover } from '../store/index.js';
import { icone } from '../ui/icones.js';
import { adesivo, enfeitePorTema } from '../ui/ilustracoes.js';
import { esc, toast, confirmar, abrirModal, lerFormulario, marcarErro, limparErros } from '../ui/dom.js';
import { temaAtual, aoMudarTema } from '../tema.js';

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

function letreiro(tema) {
  if (tema === 'lury') return 'Sessão da Meia-Noite';
  if (tema === 'manu') return 'Cine Girassol';
  return 'Sessão do Casal';
}

function enfeitesSala(tema) {
  if (tema === 'lury') return `<span class="sala-enfeite se-1">${adesivo('morcego')}</span><span class="sala-enfeite se-2">${adesivo('morcego')}</span><span class="sala-enfeite se-3">${adesivo('vela')}</span><span class="sala-enfeite se-4">${adesivo('vela')}</span>`;
  if (tema === 'manu') return `<span class="sala-enfeite se-1">${adesivo('girassol')}</span><span class="sala-enfeite se-2">${adesivo('girassol')}</span><span class="sala-enfeite se-3">${adesivo('folhagem')}</span><span class="sala-enfeite se-4">${adesivo('raposa')}</span>`;
  return `<span class="sala-enfeite se-1">${adesivo('coracao')}</span><span class="sala-enfeite se-2">${adesivo('brilho')}</span><span class="sala-enfeite se-3">${adesivo('laco')}</span><span class="sala-enfeite se-4">${adesivo('coracao')}</span>`;
}

function poltronas() {
  const assento = (x) => `<g transform="translate(${x} 0)"><rect x="2" y="6" width="36" height="26" rx="10" class="pol-encosto"/><rect x="0" y="26" width="40" height="14" rx="6" class="pol-assento"/></g>`;
  return `<svg class="poltronas" viewBox="0 0 520 44" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${Array.from({ length: 11 }, (_, i) => assento(6 + i * 46.5)).join('')}</svg>`;
}

export async function renderizar(el) {
  let videos = [];
  let player = null;
  let usandoApi = true;
  let videoAtual = null; // { youtubeId, titulo }

  el.innerHTML = '<div class="estado"><span class="spinner pequeno" aria-hidden="true"></span> Preparando a sala…</div>';
  try {
    videos = await listar('videos');
  } catch (e) {
    el.innerHTML = `<div class="aviso erro" role="alert">${icone('alerta')}<p>${esc(e.message)}</p></div>`;
    return;
  }

  const suportaTelaCheia = Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const tema = temaAtual();

  el.innerHTML = `
    <div class="cabecalho-secao">
      <div>
        <h1 class="titulo-pagina">Cinema</h1>
        <p>Apaguem as luzes, peguem a pipoca e escolham um vídeo do YouTube.</p>
      </div>
    </div>

    <section class="sala" aria-label="Sala de cinema">
      <div class="letreiro"><span class="letreiro-texto">${letreiro(tema)}</span></div>
      <div class="palco">
        <div class="cortina esquerda" aria-hidden="true"></div>
        <div class="cortina direita" aria-hidden="true"></div>
        <div class="sala-enfeites" aria-hidden="true">${enfeitesSala(tema)}</div>
        <div class="tela-moldura">
          <div class="tela" id="tela-cinema">
            <div class="tela-vazia" id="tela-vazia">
              ${icone('cinema')}
              <p>A tela está esperando um filme.</p>
              <p class="dica">Cole um link do YouTube logo abaixo ou escolha um favorito.</p>
            </div>
            <div id="player-youtube" hidden></div>
            <div class="tela-aviso" id="tela-aviso" role="alert" hidden></div>
          </div>
        </div>
      </div>
      ${poltronas()}
    </section>

    <section class="cartao controles-cinema" aria-labelledby="titulo-controles">
      <h2 id="titulo-controles" class="sr-only">Carregar vídeo</h2>
      <form class="formulario" id="form-video" novalidate>
        <div class="campo">
          <label for="url-video">Link ou ID de um vídeo do YouTube</label>
          <div class="entrada-com-botao">
            <input class="entrada" id="url-video" name="url" placeholder="https://www.youtube.com/watch?v=…" autocomplete="off" inputmode="url">
            <button type="submit" class="botao">${icone('play')} Carregar</button>
          </div>
          <p class="dica">Aceita links do tipo youtube.com/watch, youtu.be, /shorts e /embed.</p>
        </div>
      </form>
      <div class="grupo-botoes">
        <button type="button" class="botao-sec" data-salvar-atual disabled>${icone('estrela')} Salvar nos favoritos</button>
        <button type="button" class="botao-sec" data-tela-cheia ${suportaTelaCheia ? '' : 'disabled'} disabled>${icone('telacheia')} Tela cheia</button>
        ${suportaTelaCheia ? '' : '<span class="dica">Tela cheia não é suportada neste navegador.</span>'}
      </div>
    </section>

    <section class="secao-favoritos" aria-labelledby="titulo-favoritos">
      <h2 id="titulo-favoritos">Favoritos</h2>
      <div id="lista-favoritos"></div>
    </section>`;

  const tela = el.querySelector('#tela-cinema');
  const palco = el.querySelector('.palco');
  const vazia = el.querySelector('#tela-vazia');
  const aviso = el.querySelector('#tela-aviso');
  const alvoPlayer = el.querySelector('#player-youtube');
  const botaoSalvar = el.querySelector('[data-salvar-atual]');
  const botaoTelaCheia = el.querySelector('[data-tela-cheia]');
  const form = el.querySelector('#form-video');

  // A decoração da sala acompanha a troca de tema sem recarregar
  const pararOuvirTema = aoMudarTema((t) => {
    el.querySelector('.letreiro-texto').textContent = letreiro(t);
    el.querySelector('.sala-enfeites').innerHTML = enfeitesSala(t);
  });

  function mostrarAviso(mensagem, id) {
    aviso.hidden = false;
    aviso.innerHTML = `
      ${icone('alerta')}
      <p>${esc(mensagem)}</p>
      ${id ? `<a class="botao-sec pequeno" href="${linkYoutube(id)}" target="_blank" rel="noopener noreferrer">${icone('link')} Assistir no YouTube</a>` : ''}`;
  }

  function atualizarBotoes() {
    const salvo = videoAtual && videos.some((v) => v.youtubeId === videoAtual.youtubeId);
    botaoSalvar.disabled = !videoAtual || salvo;
    botaoSalvar.innerHTML = `${icone(salvo ? 'check' : 'estrela')} ${salvo ? 'Já está nos favoritos' : 'Salvar nos favoritos'}`;
    if (suportaTelaCheia) botaoTelaCheia.disabled = !videoAtual;
    el.querySelectorAll('[data-video]').forEach((c) => c.classList.toggle('tocando', c.dataset.yt === videoAtual?.youtubeId));
  }

  function usarIframeSimples(id) {
    // Alternativa caso a IFrame API não carregue: incorporação padrão do YouTube
    alvoPlayer.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1" title="Player do YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
  }

  async function carregarVideo(id, titulo = '') {
    videoAtual = { youtubeId: id, titulo };
    aviso.hidden = true;
    vazia.hidden = true;
    alvoPlayer.hidden = false;
    palco.classList.add('em-sessao');
    atualizarBotoes();

    if (!usandoApi) { usarIframeSimples(id); return; }
    try {
      const YT = await carregarApiYoutube();
      if (!el.isConnected) return;
      if (player?.loadVideoById) {
        player.loadVideoById(id);
        return;
      }
      alvoPlayer.innerHTML = '<div id="yt-alvo"></div>';
      player = new YT.Player('yt-alvo', {
        videoId: id,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { rel: 0, playsinline: 1, origin: location.origin },
        events: {
          onError: (ev) => {
            const atualId = videoAtual?.youtubeId;
            mostrarAviso(ERROS_PLAYER[ev.data] || 'Não foi possível reproduzir este vídeo aqui.', atualId);
          },
          onStateChange: () => {
            const dados = player?.getVideoData?.();
            if (dados?.title && videoAtual && dados.video_id === videoAtual.youtubeId && !videoAtual.titulo) videoAtual.titulo = dados.title;
            if (dados?.video_id === videoAtual?.youtubeId) aviso.hidden = true;
          },
        },
      });
    } catch {
      usandoApi = false;
      usarIframeSimples(id);
    }
  }

  // ---------- Favoritos ----------
  function desenharFavoritos() {
    const area = el.querySelector('#lista-favoritos');
    if (!videos.length) {
      area.innerHTML = `
        <div class="vazio">
          <span class="ilustracao" aria-hidden="true">${enfeitePorTema({ neutro: 'coracao', lury: 'vela', manu: 'polaroid' })}</span>
          <h3>Nenhum vídeo salvo ainda</h3>
          <p>Carregue um vídeo na tela e toque em "Salvar nos favoritos" para guardar aqui.</p>
        </div>`;
      return;
    }
    area.innerHTML = `
      <ul class="grade grade-videos" role="list">
        ${videos.map((v) => `
          <li class="video-cartao ${videoAtual?.youtubeId === v.youtubeId ? 'tocando' : ''}" data-video="${esc(v.id)}" data-yt="${esc(v.youtubeId)}">
            <button type="button" class="video-miniatura" data-assistir aria-label="Assistir ${esc(v.titulo)}">
              <img src="${miniatura(v.youtubeId)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-mini>
              <span class="video-play" aria-hidden="true">${icone('play', 'cheio')}</span>
            </button>
            <div class="video-info">
              <h3>${esc(v.titulo)}</h3>
              <div class="grupo-botoes">
                <button type="button" class="botao pequeno" data-assistir>${icone('play')} Assistir</button>
                <button type="button" class="botao-icone" data-renomear aria-label="Editar título de ${esc(v.titulo)}" title="Editar título">${icone('editar')}</button>
                <button type="button" class="botao-icone perigo" data-remover aria-label="Remover ${esc(v.titulo)} dos favoritos" title="Remover">${icone('lixeira')}</button>
              </div>
            </div>
          </li>`).join('')}
      </ul>`;
  }

  function formularioTitulo({ titulo, tituloModal, textoBotao }) {
    return new Promise((resolver) => {
      let valor = null;
      const { el: modal, fechar } = abrirModal({
        titulo: tituloModal,
        tamanho: 'pequeno',
        corpo: `<form class="formulario" id="form-titulo-video" novalidate>
            <div class="campo"><label for="titulo-video">Título</label>
            <input id="titulo-video" name="titulo" maxlength="100" value="${esc(titulo)}" required></div></form>`,
        rodape: `<button type="button" class="botao-fantasma" data-fechar>Cancelar</button>
                 <button type="submit" form="form-titulo-video" class="botao">${icone('salvar')} ${textoBotao}</button>`,
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

  // ---------- Eventos ----------
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    limparErros(form);
    const id = extrairIdYoutube(form.elements.url.value);
    if (!id) return marcarErro(form.elements.url, 'Não reconheci esse link. Use um endereço de vídeo do YouTube.');
    const salvo = videos.find((v) => v.youtubeId === id);
    carregarVideo(id, salvo?.titulo || '');
    tela.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  botaoSalvar.addEventListener('click', async () => {
    if (!videoAtual) return;
    const titulo = await formularioTitulo({ titulo: videoAtual.titulo || 'Vídeo do YouTube', tituloModal: 'Salvar nos favoritos', textoBotao: 'Salvar' });
    if (!titulo) return;
    try {
      const salvo = await salvar('videos', { youtubeId: videoAtual.youtubeId, titulo });
      videos.unshift(salvo);
      videoAtual.titulo = titulo;
      toast('Vídeo salvo nos favoritos!', 'sucesso');
      desenharFavoritos();
      atualizarBotoes();
    } catch (e) { toast(e.message, 'erro'); }
  });

  botaoTelaCheia.addEventListener('click', () => {
    const pedir = tela.requestFullscreen || tela.webkitRequestFullscreen;
    if (!pedir) return toast('Tela cheia não é suportada neste navegador.', 'info');
    Promise.resolve(pedir.call(tela)).catch(() => toast('O navegador não permitiu a tela cheia.', 'info'));
  });

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    const cartao = b?.closest('[data-video]');
    if (!cartao) return;
    const v = videos.find((x) => x.id === cartao.dataset.video);
    if (!v) return;
    if (b.hasAttribute('data-assistir')) {
      carregarVideo(v.youtubeId, v.titulo);
      tela.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (b.hasAttribute('data-renomear')) {
      const titulo = await formularioTitulo({ titulo: v.titulo, tituloModal: 'Editar título', textoBotao: 'Salvar' });
      if (!titulo || titulo === v.titulo) return;
      try {
        const salvo = await salvar('videos', { ...v, titulo });
        videos = videos.map((x) => (x.id === salvo.id ? salvo : x));
        if (videoAtual?.youtubeId === salvo.youtubeId) videoAtual.titulo = titulo;
        toast('Título atualizado.', 'sucesso');
        desenharFavoritos();
      } catch (err) { toast(err.message, 'erro'); }
    } else if (b.hasAttribute('data-remover')) {
      const ok = await confirmar({ titulo: 'Remover dos favoritos?', mensagem: `"${v.titulo}" sairá da lista de favoritos.`, textoConfirmar: 'Remover' });
      if (!ok) return;
      try {
        await remover('videos', v.id);
        videos = videos.filter((x) => x.id !== v.id);
        toast('Vídeo removido dos favoritos.', 'sucesso');
        desenharFavoritos();
        atualizarBotoes();
        el.querySelector('#titulo-favoritos').focus?.();
      } catch (err) { toast(err.message, 'erro'); }
    }
  });

  // Miniatura indisponível → fundo neutro
  el.addEventListener('error', (e) => {
    if (e.target instanceof HTMLImageElement && e.target.hasAttribute('data-mini')) e.target.classList.add('sem-imagem');
  }, true);

  desenharFavoritos();

  return () => {
    pararOuvirTema();
    try { player?.destroy?.(); } catch { /* ignora */ }
    player = null;
  };
}

// Início: boas-vindas, foto/ilustração, contador de tempo juntos, atalhos e destaques.
import { listar, obterAjustes, salvarAjustes, enviarImagem } from '../store/index.js';
import { icone } from '../ui/icones.js';
import { adesivo, cenaCasal } from '../ui/ilustracoes.js';
import { esc, toast, confirmar, formatarData, seloExemplo, hojeISO } from '../ui/dom.js';
import { temaAtual, aoMudarTema } from '../tema.js';
import { htmlCarta } from './carta-visual.js';

const FRASES = {
  neutro: 'Um cantinho só nosso, para guardar tudo o que faz o coração sorrir.',
  lury: 'Sob a luz da lua, cada lembrança nossa ganha um lugar para sempre.',
  manu: 'Como os girassóis, a gente sempre encontra a luz — e guarda tudo aqui.',
};

/** Diferença de calendário entre duas datas (anos, meses, dias) + total de dias. */
export function tempoJuntos(inicioISO, hoje = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicioISO || '')) return null;
  const [a, m, d] = inicioISO.split('-').map(Number);
  const ini = new Date(a, m - 1, d);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (Number.isNaN(ini.getTime()) || ini > fim) return null;
  let anos = fim.getFullYear() - ini.getFullYear();
  let meses = fim.getMonth() - ini.getMonth();
  let dias = fim.getDate() - ini.getDate();
  if (dias < 0) {
    meses -= 1;
    dias += new Date(fim.getFullYear(), fim.getMonth(), 0).getDate();
  }
  if (meses < 0) { anos -= 1; meses += 12; }
  const total = Math.round((Date.UTC(fim.getFullYear(), fim.getMonth(), fim.getDate()) - Date.UTC(a, m - 1, d)) / 86400000);
  return { anos, meses, dias, total };
}

export async function renderizar(el, ctx) {
  let ajustes = {};
  let dados = { cartas: [], listas: [], filmes: [], videos: [], memorias: [] };

  el.innerHTML = '<div class="estado"><span class="spinner pequeno" aria-hidden="true"></span> Arrumando o cantinho…</div>';
  try {
    const [aj, cartas, listas, filmes, videos, memorias] = await Promise.all([
      obterAjustes(), listar('cartas'), listar('listas'), listar('filmes'), listar('videos'), listar('memorias'),
    ]);
    ajustes = aj || {};
    dados = { cartas, listas, filmes, videos, memorias };
  } catch (e) {
    el.innerHTML = `<div class="aviso erro" role="alert">${icone('alerta')}<p>${esc(e.message)}</p></div>`;
    return;
  }

  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  function htmlFoto() {
    const tema = temaAtual();
    return ajustes.fotoCasal
      ? `<img src="${esc(ajustes.fotoCasal)}" alt="Foto do casal" class="foto-casal">`
      : `<div class="cena-casal" role="img" aria-label="Ilustração decorativa do tema ${tema}">${cenaCasal(tema)}</div>`;
  }

  function htmlContador() {
    const t = tempoJuntos(ajustes.dataInicio);
    const exemplo = ajustes.dataInicioExemplo;
    if (!ajustes.dataInicio) {
      return `
        <div class="contador-vazio">
          <p>Defina a data em que a história de vocês começou para ver o contador.</p>
          <button type="button" class="botao" data-editar-data>${icone('calendario')} Definir data</button>
        </div>`;
    }
    if (!t) {
      return `<p>A data definida (${esc(formatarData(ajustes.dataInicio))}) ainda não chegou.</p>
              <button type="button" class="botao-sec pequeno" data-editar-data>${icone('editar')} Alterar data</button>`;
    }
    return `
      <div class="contador-numeros" role="group" aria-label="Tempo juntos: ${plural(t.anos, 'ano', 'anos')}, ${plural(t.meses, 'mês', 'meses')} e ${plural(t.dias, 'dia', 'dias')}">
        <div class="numero"><strong>${t.anos}</strong><span>${t.anos === 1 ? 'ano' : 'anos'}</span></div>
        <div class="numero"><strong>${t.meses}</strong><span>${t.meses === 1 ? 'mês' : 'meses'}</span></div>
        <div class="numero"><strong>${t.dias}</strong><span>${t.dias === 1 ? 'dia' : 'dias'}</span></div>
      </div>
      <p class="contador-rodape">
        Desde ${esc(formatarData(ajustes.dataInicio, { day: 'numeric', month: 'long', year: 'numeric' }))} · ${t.total.toLocaleString('pt-BR')} dias
        ${exemplo ? seloExemplo('Data de exemplo') : ''}
      </p>
      <button type="button" class="botao-sec pequeno" data-editar-data>${icone('editar')} ${exemplo ? 'Definir a data real' : 'Alterar data'}</button>`;
  }

  function desenhar() {
    const tema = temaAtual();
    const memoriasRecentes = [...dados.memorias].sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''))).slice(0, 3);
    const cartaDestaque = [...dados.cartas].sort((a, b) => String(b.atualizadoEm || '').localeCompare(String(a.atualizadoEm || '')))[0];
    const itensPendentes = dados.listas.reduce((s, l) => s + (l.itens || []).filter((i) => !i.feito).length, 0);
    const atalhos = [
      { rota: 'cartinhas', titulo: 'Cartinhas', icone: 'carta', texto: plural(dados.cartas.length, 'cartinha guardada', 'cartinhas guardadas'), enfeite: { neutro: 'laco', lury: 'vela', manu: 'selo' } },
      { rota: 'listas', titulo: 'Listas', icone: 'lista', texto: `${plural(dados.listas.length, 'lista', 'listas')} · ${plural(itensPendentes, 'item pendente', 'itens pendentes')}`, enfeite: { neutro: 'flor', lury: 'aranha', manu: 'folhagem' } },
      { rota: 'cinemateca', titulo: 'Cinemateca', icone: 'filme', texto: plural(dados.filmes.length, 'filme na coleção', 'filmes na coleção'), enfeite: { neutro: 'brilho', lury: 'lua', manu: 'polaroid' } },
      { rota: 'cinema', titulo: 'Cinema', icone: 'cinema', texto: plural(dados.videos.length, 'vídeo favorito', 'vídeos favoritos'), enfeite: { neutro: 'coracao', lury: 'morcego', manu: 'girassol' } },
    ];

    el.innerHTML = `
      <section class="hero cartao" aria-labelledby="hero-titulo">
        <div class="hero-texto">
          <p class="hero-saudacao">Olá, ${esc(ctx.perfil.nome)}!</p>
          <h1 id="hero-titulo">${FRASES[tema]}</h1>
          <p class="hero-resumo">Aqui ficam as cartinhas, as listas, os filmes, os vídeos e as memórias de vocês — tudo num lugar só.</p>
          <div class="grupo-botoes">
            <a class="botao" href="#/cartinhas?nova">${icone('carta')} Escrever cartinha</a>
            <a class="botao-sec" href="#/memorias">${icone('imagem')} Ver memórias</a>
          </div>
        </div>
        <figure class="hero-foto">
          <div class="moldura-foto">${htmlFoto()}</div>
          <figcaption>
            ${ajustes.fotoCasal ? '' : '<span class="dica">Ilustração do tema — adicione uma foto de vocês.</span>'}
            <span class="grupo-botoes">
              <label class="botao-sec pequeno botao-arquivo">
                ${icone('upload')} ${ajustes.fotoCasal ? 'Trocar foto' : 'Adicionar foto'}
                <input type="file" accept="image/*" data-foto class="sr-only">
              </label>
              ${ajustes.fotoCasal ? `<button type="button" class="botao-fantasma pequeno" data-remover-foto>${icone('lixeira')} Remover</button>` : ''}
            </span>
          </figcaption>
        </figure>
      </section>

      <section class="contador cartao" aria-labelledby="titulo-contador">
        <span class="contador-enfeite" aria-hidden="true">${adesivo(tema === 'lury' ? 'lua' : tema === 'manu' ? 'girassol' : 'coracao')}</span>
        <h2 id="titulo-contador">Tempo juntos</h2>
        <div id="contador-corpo">${htmlContador()}</div>
      </section>

      <section aria-labelledby="titulo-atalhos" class="secao-atalhos">
        <h2 id="titulo-atalhos">Atalhos</h2>
        <ul class="atalhos" role="list">
          ${atalhos.map((a) => `
            <li>
              <a class="atalho cartao" href="#/${a.rota}">
                <span class="atalho-enfeite" aria-hidden="true">${adesivo(a.enfeite[tema])}</span>
                <span class="atalho-icone" aria-hidden="true">${icone(a.icone)}</span>
                <span class="atalho-titulo">${a.titulo}</span>
                <span class="atalho-texto">${a.texto}</span>
              </a>
            </li>`).join('')}
        </ul>
      </section>

      <div class="inicio-destaques">
        <section class="cartao" aria-labelledby="titulo-memorias-recentes">
          <div class="cabecalho-secao compacto">
            <h2 id="titulo-memorias-recentes">Memórias recentes</h2>
            <a href="#/memorias" class="botao-fantasma pequeno">Ver todas ${icone('direita')}</a>
          </div>
          ${memoriasRecentes.length ? `
            <ul class="mini-galeria" role="list">
              ${memoriasRecentes.map((m) => `
                <li class="memoria mini">
                  <figure>
                    <a href="#/memorias" class="memoria-foto">${m.src ? `<img src="${esc(m.src)}" alt="${esc(m.legenda || 'Memória')}" loading="lazy">` : `<span class="foto-indisponivel">${icone('imagem')}</span>`}</a>
                    <figcaption><span class="memoria-legenda">${esc(m.legenda || 'Sem legenda')}</span>${m.exemplo ? seloExemplo() : ''}</figcaption>
                  </figure>
                </li>`).join('')}
            </ul>` : `<p class="meta">Nenhuma memória ainda. <a href="#/memorias">Adicionar a primeira</a>.</p>`}
        </section>

        <section class="cartao carta-destaque" aria-labelledby="titulo-carta-destaque">
          <div class="cabecalho-secao compacto">
            <h2 id="titulo-carta-destaque">Cartinha em destaque</h2>
            ${cartaDestaque?.exemplo ? seloExemplo() : ''}
          </div>
          ${cartaDestaque ? `
            <a href="#/cartinhas" class="carta-link" aria-label="Abrir cartinhas: ${esc(cartaDestaque.titulo)}">${htmlCarta(cartaDestaque, { compacta: true })}</a>` : `
            <p class="meta">Nenhuma cartinha ainda.</p>
            <a class="botao pequeno" href="#/cartinhas?nova">${icone('carta')} Escrever a primeira</a>`}
        </section>
      </div>`;
  }

  function editarData() {
    const corpo = el.querySelector('#contador-corpo');
    const atual = ajustes.dataInicioExemplo ? '' : (ajustes.dataInicio || '');
    corpo.innerHTML = `
      <form class="form-data" novalidate>
        <div class="campo">
          <label for="data-inicio">Data de início do relacionamento</label>
          <input id="data-inicio" name="data" type="date" max="${hojeISO()}" value="${esc(atual)}" required>
          <p class="dica">Fica salva para vocês dois. Pode alterar quando quiser.</p>
        </div>
        <div class="grupo-botoes">
          <button type="submit" class="botao pequeno">${icone('salvar')} Salvar data</button>
          <button type="button" class="botao-fantasma pequeno" data-cancelar-data>Cancelar</button>
          ${ajustes.dataInicio ? `<button type="button" class="botao-fantasma pequeno" data-limpar-data>${icone('lixeira')} Limpar</button>` : ''}
        </div>
      </form>`;
    const form = corpo.querySelector('form');
    form.elements.data.focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const valor = form.elements.data.value;
      if (!valor) { form.elements.data.setAttribute('aria-invalid', 'true'); form.elements.data.focus(); return; }
      if (valor > hojeISO()) { toast('Escolha uma data que já passou.', 'info'); return; }
      try {
        ajustes = await salvarAjustes({ dataInicio: valor, dataInicioExemplo: false });
        toast('Data salva!', 'sucesso');
        reDesenharContador(true);
      } catch (err) { toast(err.message, 'erro'); }
    });
    form.querySelector('[data-cancelar-data]').addEventListener('click', () => reDesenharContador(true));
    form.querySelector('[data-limpar-data]')?.addEventListener('click', async () => {
      try {
        ajustes = await salvarAjustes({ dataInicio: null, dataInicioExemplo: false });
        reDesenharContador(true);
      } catch (err) { toast(err.message, 'erro'); }
    });
  }

  function reDesenharContador(focar) {
    el.querySelector('#contador-corpo').innerHTML = htmlContador();
    if (focar) el.querySelector('#contador-corpo [data-editar-data]')?.focus();
  }

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-editar-data')) editarData();
    if (b.hasAttribute('data-remover-foto')) {
      const ok = await confirmar({ titulo: 'Remover foto?', mensagem: 'A foto do casal sai da página inicial e volta a ilustração do tema.', textoConfirmar: 'Remover' });
      if (!ok) return;
      try {
        ajustes = await salvarAjustes({ fotoCasal: null, fotoCasalPath: null });
        desenhar();
      } catch (err) { toast(err.message, 'erro'); }
    }
  });

  el.addEventListener('change', async (e) => {
    if (!e.target.matches('[data-foto]')) return;
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    const moldura = el.querySelector('.moldura-foto');
    moldura.classList.add('carregando-foto');
    try {
      const img = await enviarImagem(arquivo);
      ajustes = await salvarAjustes({ fotoCasal: img.src, fotoCasalPath: img.path || null });
      toast('Foto atualizada!', 'sucesso');
      desenhar();
    } catch (err) {
      toast(err.message, 'erro');
      moldura.classList.remove('carregando-foto');
    }
  });

  const pararOuvir = aoMudarTema(() => desenhar());
  desenhar();
  return () => pararOuvir();
}

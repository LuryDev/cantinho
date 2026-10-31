// Cartinhas: coleção + editor livre com decoração e pré-visualização.
import { listar, salvar, remover } from '../store/index.js';
import { icone } from '../ui/icones.js';
import { adesivo, enfeitePorTema, ADESIVOS, PACOTES } from '../ui/ilustracoes.js';
import { esc, toast, abrirModal, confirmar, formatarData, hojeISO, seloExemplo, marcarErro, limparErros } from '../ui/dom.js';
import { temaAtual } from '../tema.js';
import {
  htmlCarta, estiloPadrao, PAPEIS, FONTES, ALINHAMENTOS, MOLDURAS, CORES_PAPEL, CORES_TINTA, MAX_ADESIVOS,
} from './carta-visual.js';

export async function renderizar(el, ctx) {
  let cartas = [];
  let modo = 'colecao';

  async function carregar() {
    el.innerHTML = '<div class="estado"><span class="spinner pequeno" aria-hidden="true"></span> Carregando cartinhas…</div>';
    try {
      cartas = await listar('cartas');
    } catch (e) {
      el.innerHTML = `<div class="aviso erro" role="alert">${icone('alerta')}<p>${esc(e.message)}</p></div>`;
      return false;
    }
    return true;
  }

  // ---------------- Coleção ----------------
  function mostrarColecao({ focar = false } = {}) {
    modo = 'colecao';
    const ordenadas = [...cartas].sort((a, b) => String(b.atualizadoEm || '').localeCompare(String(a.atualizadoEm || '')));
    el.innerHTML = `
      <div class="cabecalho-secao">
        <div>
          <h1 class="titulo-pagina"><span class="enfeite-titulo" aria-hidden="true">${enfeitePorTema({ neutro: 'laco', lury: 'vela', manu: 'selo' })}</span>Cartinhas</h1>
          <p>Escreva, enfeite e guarde as cartinhas de vocês.</p>
        </div>
        <button type="button" class="botao" data-nova>${icone('mais')} Nova cartinha</button>
      </div>
      ${ctx.armazenamento.tipo === 'local' ? `<div class="aviso aviso-compacto">${icone('info')}<p>${esc(ctx.armazenamento.descricao)}</p></div>` : ''}
      ${ordenadas.length ? `
        <ul class="grade colecao-cartas" role="list">
          ${ordenadas.map((c) => `
            <li class="cartao-carta">
              <button type="button" class="carta-miniatura" data-abrir="${esc(c.id)}" aria-label="Abrir a cartinha ${esc(c.titulo)}">
                ${htmlCarta(c, { compacta: true })}
              </button>
              <div class="cartao-carta-info">
                <div>
                  <h2 class="cartao-carta-titulo">${esc(c.titulo)} ${c.exemplo ? seloExemplo() : ''}</h2>
                  <p class="meta">${c.data ? esc(formatarData(c.data)) : 'Sem data'}${c.autor ? ` · por ${esc(c.autor)}` : ''}</p>
                </div>
                <div class="grupo-botoes acoes-carta">
                  <button type="button" class="botao-icone" data-abrir="${esc(c.id)}" aria-label="Abrir ${esc(c.titulo)}" title="Abrir">${icone('olho')}</button>
                  <button type="button" class="botao-icone" data-editar="${esc(c.id)}" aria-label="Editar ${esc(c.titulo)}" title="Editar">${icone('editar')}</button>
                  <button type="button" class="botao-icone perigo" data-excluir="${esc(c.id)}" aria-label="Excluir ${esc(c.titulo)}" title="Excluir">${icone('lixeira')}</button>
                </div>
              </div>
            </li>`).join('')}
        </ul>` : `
        <div class="vazio">
          <span class="ilustracao" aria-hidden="true">${adesivo('coracao')}</span>
          <h3>Nenhuma cartinha ainda</h3>
          <p>Que tal escrever a primeira? Escolha um papel bonito, uma fonte e alguns enfeites.</p>
          <button type="button" class="botao" data-nova>${icone('carta')} Escrever a primeira cartinha</button>
        </div>`}`;
    if (focar) el.querySelector('h1')?.focus();
  }

  function abrirCarta(id) {
    const carta = cartas.find((c) => c.id === id);
    if (!carta) return;
    const { el: modal, fechar } = abrirModal({
      titulo: carta.titulo,
      tamanho: 'largo',
      corpo: `<div class="carta-leitura">${htmlCarta(carta)}</div>`,
      rodape: `
        <button type="button" class="botao-fantasma" data-fechar>Fechar</button>
        <button type="button" class="botao-sec" data-editar-modal>${icone('editar')} Editar</button>`,
    });
    modal.querySelector('[data-editar-modal]').addEventListener('click', () => { fechar(); mostrarEditor(carta); });
  }

  async function excluirCarta(id) {
    const carta = cartas.find((c) => c.id === id);
    if (!carta) return;
    const ok = await confirmar({ titulo: 'Excluir cartinha?', mensagem: `"${carta.titulo}" será excluída e não poderá ser recuperada.` });
    if (!ok) return;
    try {
      await remover('cartas', id);
      cartas = cartas.filter((c) => c.id !== id);
      toast('Cartinha excluída.', 'sucesso');
      mostrarColecao();
      el.querySelector('h1')?.focus();
    } catch (e) {
      toast(e.message, 'erro');
    }
  }

  // ---------------- Editor ----------------
  function mostrarEditor(original = null) {
    modo = 'editor';
    const base = original
      ? structuredClone(original)
      : { titulo: '', destinatario: '', mensagem: '', data: hojeISO(), estilo: estiloPadrao(temaAtual()) };
    base.estilo = { ...estiloPadrao(temaAtual()), ...(base.estilo || {}) };
    let adesivosSel = [...(base.estilo.adesivos || [])];
    let alterado = false;

    const corPersonalizada = !CORES_PAPEL.includes(base.estilo.cor);
    const pacotesOrdenados = [temaAtual(), ...Object.keys(PACOTES).filter((p) => p !== temaAtual())];

    el.innerHTML = `
      <div class="cabecalho-secao">
        <div>
          <h1 class="titulo-pagina">${original ? 'Editar cartinha' : 'Nova cartinha'}</h1>
          <p>${original ? 'Ajuste o texto e a decoração e salve de novo.' : 'Escreva com calma. A pré-visualização mostra como vai ficar.'}</p>
        </div>
        <button type="button" class="botao-fantasma" data-voltar>${icone('esquerda')} Voltar para a coleção</button>
      </div>

      <form class="editor-carta" id="form-carta" novalidate>
        <div class="editor-campos">
          <section class="cartao formulario" aria-labelledby="sec-conteudo">
            <h2 id="sec-conteudo" class="subtitulo">Conteúdo</h2>
            <div class="campo">
              <label for="carta-titulo">Título <span aria-hidden="true">*</span></label>
              <input id="carta-titulo" name="titulo" maxlength="80" required value="${esc(base.titulo)}" placeholder="Ex.: Para ler num dia difícil">
            </div>
            <div class="linha-campos">
              <div class="campo">
                <label for="carta-para">Destinatário <span class="dica">(opcional)</span></label>
                <input id="carta-para" name="destinatario" maxlength="40" value="${esc(base.destinatario || '')}">
              </div>
              <div class="campo">
                <label for="carta-data">Data</label>
                <input id="carta-data" name="data" type="date" value="${esc(base.data || '')}">
              </div>
            </div>
            <div class="campo">
              <label for="carta-mensagem">Mensagem <span aria-hidden="true">*</span></label>
              <textarea id="carta-mensagem" name="mensagem" maxlength="5000" required rows="9" aria-describedby="carta-contador">${esc(base.mensagem)}</textarea>
              <p class="dica" id="carta-contador"></p>
            </div>
          </section>

          <section class="cartao formulario" aria-labelledby="sec-estilo">
            <h2 id="sec-estilo" class="subtitulo">Papel e escrita</h2>
            <fieldset>
              <legend>Papel</legend>
              <div class="opcoes">
                ${Object.entries(PAPEIS).map(([id, nome]) => `
                  <label class="opcao"><input type="radio" name="papel" value="${id}" ${base.estilo.papel === id ? 'checked' : ''}><span><i class="amostra-papel papel-${id}" aria-hidden="true"></i>${nome}</span></label>`).join('')}
              </div>
            </fieldset>
            <fieldset>
              <legend>Cor do papel</legend>
              <div class="opcoes cores">
                ${CORES_PAPEL.map((c) => `
                  <label class="opcao cor"><input type="radio" name="cor" value="${c}" ${base.estilo.cor === c ? 'checked' : ''} aria-label="Cor ${c}"><span style="--c:${c}"></span></label>`).join('')}
                <label class="opcao cor-livre">
                  <input type="radio" name="cor" value="personalizada" ${corPersonalizada ? 'checked' : ''}>
                  <span>Outra cor</span>
                </label>
                <input type="color" name="corLivre" value="${corPersonalizada ? esc(base.estilo.cor) : '#fff7e8'}" aria-label="Escolher outra cor de papel" class="seletor-cor">
              </div>
            </fieldset>
            <div class="linha-campos">
              <div class="campo">
                <label for="carta-fonte">Fonte</label>
                <select id="carta-fonte" name="fonte">
                  ${Object.entries(FONTES).map(([id, f]) => `<option value="${id}" ${base.estilo.fonte === id ? 'selected' : ''}>${f.nome}</option>`).join('')}
                </select>
              </div>
              <div class="campo">
                <label for="carta-tinta">Cor da tinta</label>
                <select id="carta-tinta" name="tinta">
                  ${Object.entries(CORES_TINTA).map(([v, n]) => `<option value="${v}" ${base.estilo.tinta === v ? 'selected' : ''}>${n}</option>`).join('')}
                </select>
              </div>
            </div>
            <fieldset>
              <legend>Alinhamento</legend>
              <div class="opcoes">
                ${Object.entries(ALINHAMENTOS).map(([id, a]) => `
                  <label class="opcao"><input type="radio" name="alinhamento" value="${id}" ${base.estilo.alinhamento === id ? 'checked' : ''}><span>${icone(a.icone)}${a.nome}</span></label>`).join('')}
              </div>
            </fieldset>
            <fieldset>
              <legend>Moldura</legend>
              <div class="opcoes">
                ${Object.entries(MOLDURAS).map(([id, nome]) => `
                  <label class="opcao"><input type="radio" name="moldura" value="${id}" ${base.estilo.moldura === id ? 'checked' : ''}><span>${nome}</span></label>`).join('')}
              </div>
            </fieldset>
          </section>

          <section class="cartao formulario" aria-labelledby="sec-enfeites">
            <h2 id="sec-enfeites" class="subtitulo">Enfeites <span class="dica" id="contador-enfeites"></span></h2>
            ${pacotesOrdenados.map((p) => `
              <fieldset class="pacote-enfeites">
                <legend>${PACOTES[p].nome}</legend>
                <div class="enfeites">
                  ${PACOTES[p].itens.map((id) => `
                    <label class="enfeite-opcao" title="${ADESIVOS[id].nome}">
                      <input type="checkbox" name="adesivo" value="${id}" ${adesivosSel.includes(id) ? 'checked' : ''}>
                      <span>${adesivo(id)}<span class="sr-only">${ADESIVOS[id].nome}</span></span>
                    </label>`).join('')}
                </div>
              </fieldset>`).join('')}
          </section>
        </div>

        <aside class="editor-previa" aria-labelledby="titulo-previa">
          <div class="previa-topo">
            <h2 id="titulo-previa" class="subtitulo">Pré-visualização</h2>
            <button type="button" class="botao-sec pequeno" data-previa-cheia>${icone('olho')} Ver em tamanho grande</button>
          </div>
          <div class="previa-carta" id="previa-carta"></div>
          <div class="grupo-botoes acoes-editor">
            <button type="submit" class="botao">${icone('salvar')} ${original ? 'Salvar alterações' : 'Salvar cartinha'}</button>
            <button type="button" class="botao-fantasma" data-voltar>Cancelar</button>
          </div>
        </aside>
      </form>`;

    const form = el.querySelector('#form-carta');
    const previa = el.querySelector('#previa-carta');
    const contador = el.querySelector('#carta-contador');
    const contadorEnfeites = el.querySelector('#contador-enfeites');

    function estadoAtual() {
      const f = form.elements;
      const corRadio = form.querySelector('input[name="cor"]:checked')?.value;
      return {
        ...(original || {}),
        titulo: f.titulo.value.trim(),
        destinatario: f.destinatario.value.trim(),
        data: f.data.value,
        mensagem: f.mensagem.value.replace(/\s+$/, ''),
        estilo: {
          papel: form.querySelector('input[name="papel"]:checked')?.value || 'liso',
          cor: corRadio === 'personalizada' ? f.corLivre.value : (corRadio || '#ffffff'),
          tinta: f.tinta.value,
          fonte: f.fonte.value,
          alinhamento: form.querySelector('input[name="alinhamento"]:checked')?.value || 'esquerda',
          moldura: form.querySelector('input[name="moldura"]:checked')?.value || 'nenhuma',
          adesivos: [...adesivosSel],
        },
      };
    }

    function atualizarPrevia() {
      const atual = estadoAtual();
      previa.innerHTML = htmlCarta({ ...atual, titulo: atual.titulo || 'Título da cartinha' });
      contador.textContent = `${form.elements.mensagem.value.length} de 5000 caracteres`;
      contadorEnfeites.textContent = `(${adesivosSel.length} de ${MAX_ADESIVOS})`;
    }

    form.addEventListener('input', () => { alterado = true; atualizarPrevia(); });
    form.addEventListener('change', (e) => {
      alterado = true;
      if (e.target.name === 'adesivo') {
        const id = e.target.value;
        if (e.target.checked) {
          if (adesivosSel.length >= MAX_ADESIVOS) {
            e.target.checked = false;
            toast(`Use no máximo ${MAX_ADESIVOS} enfeites por cartinha.`, 'info');
          } else adesivosSel.push(id);
        } else adesivosSel = adesivosSel.filter((x) => x !== id);
      }
      if (e.target.name === 'corLivre') form.querySelector('input[name="cor"][value="personalizada"]').checked = true;
      atualizarPrevia();
    });

    el.querySelector('[data-previa-cheia]').addEventListener('click', () => {
      const atual = estadoAtual();
      abrirModal({
        titulo: 'Pré-visualização',
        tamanho: 'largo',
        corpo: `<div class="carta-leitura">${htmlCarta({ ...atual, titulo: atual.titulo || 'Título da cartinha' })}</div>`,
        rodape: '<button type="button" class="botao" data-fechar>Voltar a editar</button>',
      });
    });

    el.querySelectorAll('[data-voltar]').forEach((b) => b.addEventListener('click', async () => {
      if (alterado) {
        const descartar = await confirmar({ titulo: 'Descartar alterações?', mensagem: 'O que você escreveu ainda não foi salvo.', textoConfirmar: 'Descartar' });
        if (!descartar) return;
      }
      if (location.hash.includes('?')) history.replaceState(null, '', '#/cartinhas');
      mostrarColecao({ focar: true });
    }));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      limparErros(form);
      const doc = estadoAtual();
      if (!doc.titulo) return marcarErro(form.elements.titulo, 'Dê um título para a cartinha.');
      if (!doc.mensagem.trim()) return marcarErro(form.elements.mensagem, 'Escreva a mensagem.');
      if (!original) doc.autor = ctx.perfil.nome;
      doc.exemplo = false;
      const botao = form.querySelector('button[type="submit"]');
      botao.disabled = true;
      try {
        const salvo = await salvar('cartas', doc);
        const i = cartas.findIndex((c) => c.id === salvo.id);
        if (i >= 0) cartas[i] = salvo; else cartas.unshift(salvo);
        toast(original ? 'Cartinha atualizada!' : 'Cartinha salva!', 'sucesso');
        if (location.hash.includes('?')) history.replaceState(null, '', '#/cartinhas');
        mostrarColecao({ focar: true });
      } catch (err) {
        toast(err.message, 'erro');
        botao.disabled = false;
      }
    });

    atualizarPrevia();
    el.querySelector('h1').setAttribute('tabindex', '-1');
    el.querySelector('h1').focus();
  }

  // ---------------- Eventos da coleção ----------------
  el.addEventListener('click', (e) => {
    if (modo !== 'colecao') return;
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-nova')) mostrarEditor();
    else if (b.dataset.abrir) abrirCarta(b.dataset.abrir);
    else if (b.dataset.editar) mostrarEditor(cartas.find((c) => c.id === b.dataset.editar));
    else if (b.dataset.excluir) excluirCarta(b.dataset.excluir);
  });

  if (!(await carregar())) return;
  if (/[?&]nova\b/.test(location.hash)) mostrarEditor();
  else mostrarColecao();
}

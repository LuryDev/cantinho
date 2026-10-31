# Nosso Cantinho — versão beta

Site privado e responsivo para um casal guardar **cartinhas, listas, filmes, vídeos e memórias**, com três temas visuais (Neutro, Lury e Manu), entrada por perfil e animação de boas-vindas personalizada.

Feito em **HTML, CSS e JavaScript puro** (módulos ES), sem framework e sem dependências para instalar.

---

## 1. Como rodar localmente

**Pré-requisito:** Node.js 18 ou mais recente (`node --version`).

```bash
cd nosso-cantinho
npm start          # ou: node servidor-local.mjs
```

Abra **http://localhost:5173**. Não há nada para instalar (`npm install` não é necessário).

Sem Node, também dá para servir os arquivos estáticos (a pesquisa do TMDB fica desativada):

```bash
python3 -m http.server 5173
```

> Abrir o `index.html` direto com duplo clique (`file://`) **não funciona**: navegadores bloqueiam módulos JavaScript nesse modo.

---

## 2. Estrutura do projeto

```
nosso-cantinho/
├── index.html              # Página única; carrega CSS, config.js e js/app.js
├── config.exemplo.js       # Modelo da config pública (o /config.js real é gerado pelo servidor/Vercel)
├── servidor-local.mjs              # Servidor local sem dependências + proxy do TMDB
├── api/                    # Funções da Vercel: config.js e tmdb/search.js
├── lib/                    # Lógica compartilhada (config pública e TMDB) entre servidor-local.mjs e api/
├── vercel.json             # Vercel: /config.js → função api/config
├── package.json            # Só o script "start"
├── .env.example            # Modelo do arquivo de ambiente
├── css/
│   ├── temas.css           # Variáveis dos 3 temas (cores, fontes, sombras, cinema)
│   ├── base.css            # Reset, layout, menu lateral, navegação no celular
│   ├── componentes.css     # Botões, campos, cartões, modais, avisos, abas…
│   ├── paginas.css         # Estilos de cada área + cartinhas, cinema, galeria
│   ├── boas-vindas.css     # Animações da Manu (girassóis) e do Lury (morcegos)
│   └── recompensas.css     # Estilos de nome, modos da sala, conquistas e comemoração
├── js/
│   ├── app.js              # Inicialização, estrutura, menu e rotas (#/inicio…)
│   ├── auth.js             # Sessão: modo demonstração ou Supabase Auth
│   ├── login.js            # Tela de entrada
│   ├── boas-vindas.js      # Animação de boas-vindas (pulável, respeita movimento reduzido)
│   ├── tema.js             # Troca de tema e preferências visuais
│   ├── config.js           # Lê a config pública
│   ├── recompensas.js      # As 14 recompensas do cinema + contagem do tempo (dados)
│   ├── conquistas.js       # Painel de conquistas, comemoração e colecionáveis (tela)
│   ├── foto-recordacao.js  # Desenha as fotos de recordação (canvas 1080×1350)
│   ├── store/              # CAMADA DE DADOS (separada da interface)
│   │   ├── index.js        # Interface única usada pelas páginas
│   │   ├── local.js        # localStorage (modo demonstração)
│   │   ├── supabase.js     # Supabase (tabelas + Storage)
│   │   ├── exemplos.js     # Conteúdo demonstrativo
│   │   └── imagens.js      # Redução de imagens no navegador
│   ├── paginas/            # Uma página por arquivo
│   │   ├── inicio.js  cartinhas.js  carta-visual.js  listas.js
│   │   └── cinemateca.js  cinema.js  memorias.js  aparencia.js
│   └── ui/                 # Ícones, ilustrações SVG, toasts, modais, utilitários
├── assets/                 # Favicon e ilustrações de exemplo da galeria
└── supabase/schema.sql     # Tabelas, políticas RLS e bucket de fotos
```

---

## 3. Funcionalidades

| Área | O que faz |
|---|---|
| **Entrada** | Perfis Manu e Lury. Sessão mantida ao atualizar; botão **Sair** em todo o app. |
| **Boas-vindas** | Manu: "Bem-vinda, Manu!" com girassóis crescendo, pétalas e raposa. Lury: "Bem-vindo, Lury!" com lua, castelo e morcegos voando. Dura ~4 s, tem botão **Pular animação** (ou Esc) e vira cena estática com movimento reduzido. Depois entra com o tema do perfil. |
| **Temas** | Neutro, Lury e Manu. Troca imediata pelo topo ou por **Aparência**; muda cores, fontes, fundos, ilustrações, molduras, galeria e a sala de cinema. Salvo por perfil. |
| **Início** | Frase do tema, foto do casal (ou ilustração), aviso de cartinha nova, **"Estamos juntos?"**, contador de anos/meses/dias com data editável, atalhos, memórias recentes e cartinha em destaque. |
| **Animação de início** | Na **primeira vez que a Manu entra**, a tela escurece, aparece "Feito pelo seu amorzinho, Lury!" com fogos de artifício e confetes (desenhados em `<canvas>`, sem bibliotecas) e termina numa tela de girassóis com "O nosso cantinho está pronto, amor!". A marca de "já viu" fica nos ajustes do casal (vale em todos os aparelhos). O botão **Animação de início** no login mostra de novo quando quiserem. |
| **Estamos juntos?** | Um botão liga um cronômetro compartilhado: os dois perfis veem o mesmo tempo correndo (também no topo de todas as páginas). Ao encerrar, dá para anotar "como foi" e corrigir o horário de término. Guarda o total juntos, número de encontros, o maior encontro e o histórico (com exclusão). Embaixo aparece uma **curiosidade** comparando o tempo com recordes e fatos (ex.: "Nossa! Vocês ficaram 30 minutos juntos — praticamente o mesmo tempo que o recorde de alguém que ficou embaixo d’água sem respirar"), com a fonte. Os fatos foram pesquisados na web e ficam em `js/curiosidades.js` (fácil de atualizar). |
| **Cartinhas** | **Enviar para o outro perfil** ou guardar como rascunho. Abas Recebidas / Enviadas / Rascunhos; cartinha nova chega num envelope fechado com selo de cera que se abre ao clicar, contador de novas no menu, "lida em…" para quem enviou e botão **Responder**. Rascunhos não aparecem para o outro perfil. Editor com título, como chamar (opcional), data e mensagem; papel (6), cor do papel, cor da tinta, fonte (6), alinhamento, moldura (4) e até 6 enfeites dos três temas. Prévia ao vivo e em tamanho grande. Coleção com abrir, editar e excluir (com confirmação). |
| **Listas** | Compartilhadas entre os dois, mostrando quem criou a lista, quem adicionou cada item e quem concluiu. Estilo por lista: cor (8), papel (simples, caderno, post-it, quadriculado, kraft) e adesivo. Criar/renomear/excluir listas com descrição e categoria (6 sugeridas + personalizada); adicionar, editar, concluir e excluir itens (com "Desfazer"); barra de progresso; filtro por categoria. |
| **Cinemateca** | Pesquisa no TMDB com pôsteres (quando configurado), cadastro manual sempre disponível, abas Queremos assistir / Assistindo / Assistidos, detalhes com observações, mudança de status, remoção e bloqueio de duplicatas. |
| **Cinema** | Sala com letreiro, cortinas, moldura e poltronas (muda com o tema). **Assistir junto:** quem coloca um vídeo, dá play, pausa ou avança faz o mesmo acontecer na tela do outro, sem colar link (Realtime do Supabase; no modo demonstração, entre abas do mesmo navegador). Mostra se o outro está na sala; quem está fora do Cinema recebe aviso "Assistir junto". **Reações** 😂 😢 🍿 😱 que sobem na tela dos dois (inclusive em tela cheia) e ficam contadas por vídeo. Todo vídeo carregado é salvo em **Sessões** (quantas vezes, quando, por quem, se foi junto) e pode ganhar estrela em **Favoritos**. Vídeos que não permitem incorporação mostram aviso + link para o YouTube. |
| **Recompensas do Cinema** | O tempo com vídeo tocando no Cinema é somado para o casal (assistindo juntos, conta uma vez só) e libera **14 recompensas** em ciclos de uma hora: aos **15 min** uma pequena (**colecionável**), aos **30 min** uma média (**visual do site**: estilo de nome ou modo da sala) e na **hora cheia** uma grande (**foto de recordação**). Colecionáveis: ingresso dourado, balde de pipoca, claquete, rolo de filme e troféu. Visuais: nome cromado, nome neon e nome em letreiro (cada um escolhe o seu, aparece no topo e na saudação) e os modos **noir** e **Sala VIP** da sala (valem para os dois). Fotos: polaroid, cartaz do casal, tira de cabine e estrela de cinema, geradas no próprio navegador com o tempo, os vídeos mais vistos, as reações e a foto do casal, prontas para **baixar** ou **compartilhar**. Ao desbloquear aparece uma comemoração (se o vídeo estiver tocando, ela espera a pausa); quem não estava junto vê a comemoração quando entrar. Tudo fica na aba **Conquistas** do Cinema. Os limites ficam em `js/recompensas.js`. |
| **Memórias** | Galeria (polaroid no tema Manu, moldura gótica no Lury), visualização ampliada com setas, envio de foto ou URL, legenda e data opcionais. |
| **Aparência** | Cartões de tema com prévia, "ao entrar usar o tema do perfil / o último escolhido", reduzir movimento, decoração discreta, texto maior e (no modo local) restaurar exemplos ou apagar dados. |

**Acessibilidade:** link "Pular para o conteúdo", foco visível, rótulos em todos os campos, botões com nome acessível, `aria-current` no menu, abas navegáveis por setas, modais com `<dialog>` nativo (Esc fecha e o foco volta), avisos em região `aria-live`, ícones SVG + texto (sem depender de emojis), `prefers-reduced-motion` respeitado.

---

## 4. Modo demonstração (padrão)

Enquanto o Supabase **não** estiver configurado:

- A tela de entrada mostra o aviso **"Modo demonstração"** e dois botões: *Entrar como Manu* / *Entrar como Lury*.
- **Não há senha nem autenticação real** — é só a escolha do perfil neste navegador. Nenhuma senha é guardada.
- Os dados ficam no `localStorage`: **não sincronizam entre dispositivos** e **somem se os dados do navegador forem limpos**.
- Manu e Lury compartilham os mesmos dados (é o espaço do casal); o tema é guardado por perfil.
- Há conteúdo de exemplo marcado com o selo **EXEMPLO**: 3 cartinhas, 2 listas, 3 filmes (cadastros manuais, não resultados de pesquisa), 4 ilustrações na galeria e uma **data de exemplo** no contador (1º/01/2024). Nada disso é informação real do casal. Pode editar, excluir ou apagar tudo em **Aparência**.

---

## 5. Configurar o Supabase (login real e sincronização)

1. Crie um projeto em https://supabase.com.
2. **SQL Editor → New query**: cole `supabase/schema.sql` e rode. Isso cria as tabelas `casais`, `perfis`, `cartas`, `listas`, `filmes`, `videos`, `memorias`, as políticas **RLS** e o bucket **privado** `memorias`.
3. **Authentication → Users → Add user → Create new user**: crie as duas contas com estes **e-mails internos** e a senha que cada um vai usar (marque *Auto Confirm User*):
   - `manu@nossocantinho.app`
   - `lury@nossocantinho.app`

   O login no site é só por **nome + senha**: quem digita "Manu" entra com `manu@nossocantinho.app`. Nenhum e-mail é enviado para esses endereços. Para usar outro domínio, defina `LOGIN_DOMINIO` no `.env`/Vercel e crie as contas com ele.
4. **Authentication → Sign In / Providers → Email**: desligue *Allow new users to sign up*, para ninguém mais criar conta.
5. *(Para "Assistir junto" no Cinema)* No **SQL Editor**, rode também `supabase/cinema-juntos.sql`. Quem rodou o `schema.sql` depois de 31/10/2026 já tem isso.
6. No **SQL Editor**, abra uma query nova, cole `supabase/vincular-contas.sql` e rode. Ele já vem com os e-mails internos acima (só mude se trocou o domínio). Pode rodar de novo sem duplicar nada; no fim ele lista as duas contas vinculadas.
7. **Project Settings → API**: copie a *Project URL* e a chave **anon public**.
8. Copie `.env.example` para `.env` e preencha:
   - `.env` linha 10 → `SUPABASE_URL=https://xxxx.supabase.co`
   - `.env` linha 11 → `SUPABASE_ANON_KEY=eyJ...` (a **anon**; o servidor se recusa a iniciar se detectar uma `service_role`)
9. `npm start` de novo. A tela de entrada passa a pedir **nome e senha**.

**Na Vercel**, use as variáveis de ambiente (seção 6.1). **Em outra hospedagem só estática**, copie `config.exemplo.js` para `config.js` e preencha `supabaseUrl` e `supabaseAnonKey`. Essas duas são públicas por natureza — quem protege os dados são as políticas RLS. **Nunca** coloque a `service_role` em nenhum arquivo do front-end.

Como funciona a segurança: a função `meu_casal()` descobre o casal do usuário logado; todas as políticas comparam `casal_id = meu_casal()`, então o banco só devolve dados do próprio casal, mesmo que alguém altere o JavaScript. Usuários não conseguem criar perfis nem trocar de casal; só alteram `perfis.tema_preferido` e `casais.ajustes`. Fotos ficam em `memorias/<id-do-casal>/…` e são exibidas por URLs assinadas temporárias.

---

## 6. Configurar a API do TMDB (pesquisa de filmes)

1. Crie uma conta em https://www.themoviedb.org e peça uma chave em **Configurações → API**.
2. No `.env`, preencha **uma** das duas:
   - linha 16 → `TMDB_READ_TOKEN=` (token de leitura v4 — recomendado), ou
   - linha 17 → `TMDB_API_KEY=` (chave v3).
3. `npm start`. A Cinemateca passa a mostrar o campo de pesquisa.

A chave fica **só no servidor** (`servidor-local.mjs`, rota `/api/tmdb/search`); o navegador nunca a recebe. Sem chave, a Cinemateca mostra um aviso de configuração e o **cadastro manual continua funcionando**. Na Vercel isso é feito pela função `api/tmdb/search.js` (veja a seção 6.1). Em outra hospedagem só estática, crie um backend equivalente e defina `tmdbProxy: true` nesse `config.js`.

---

## 6.1 Publicar no GitHub e na Vercel

O projeto já vem pronto para a Vercel: o `/config.js` é gerado pela função `api/config.js` e a pesquisa do TMDB roda em `api/tmdb/search.js`. As variáveis de ambiente têm os **mesmos nomes** do `.env`.

**GitHub**
```bash
cd nosso-cantinho
git init
git add .
git commit -m "Nosso Cantinho - beta"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/nosso-cantinho.git
git push -u origin main
```
O `.gitignore` já impede o envio do `.env`. Confira com `git status` antes do primeiro commit: o `.env` **não** pode aparecer na lista.

**Vercel**
1. vercel.com → **Add New → Project** → importe o repositório.
2. *Framework Preset*: **Other**. Deixe *Build Command* e *Output Directory* vazios.
3. Em **Environment Variables**, adicione as que for usar: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TMDB_READ_TOKEN` (ou `TMDB_API_KEY`).
4. **Deploy**. Se adicionar ou mudar variáveis depois, faça **Redeploy**: elas só valem a partir do deploy seguinte.
5. Com Supabase: em *Authentication → URL Configuration*, coloque o endereço da Vercel como *Site URL*.

**Importante:** sem o Supabase, o site publicado fica em **modo demonstração**: qualquer pessoa com o link pode "entrar como Manu ou Lury". Os dados não vazam (cada visitante só vê o que está no próprio navegador), mas o espaço **não é privado**. Configure o Supabase antes de guardar coisas pessoais no site publicado.

---

## 7. O que funciona, o que é simulado e o que depende de fora

- **Funciona de verdade, sem configurar nada:** navegação, temas, preferências, animações, cartinhas, listas, cadastro manual de filmes, cinema com favoritos, galeria com upload, contador — tudo salvo neste navegador.
- **Simulado (claramente sinalizado):** a entrada no modo demonstração (escolha de perfil, sem senha) e o conteúdo com selo EXEMPLO.
- **Depende de serviços externos:**
  - Login real e sincronização → Supabase (código pronto em `js/auth.js` e `js/store/supabase.js`; **não testado contra um projeto real nesta beta**, porque nenhuma credencial foi fornecida).
  - Pesquisa e pôsteres → TMDB (via `servidor-local.mjs`).
  - Reprodução de vídeos e miniaturas → YouTube (player oficial; sem download nem remoção de anúncios/controles).
  - Fontes → Google Fonts (sem internet, o site usa fontes do sistema).

---

## 8. Limitações da beta

- Modo local: espaço limitado do navegador (~5 MB). As fotos são reduzidas, mas cabem algumas dezenas.
- No Supabase, os campos de cada item ficam numa coluna `dados` (jsonb) e os itens das listas ficam dentro da própria lista. É simples e seguro, mas deve ser normalizado depois (ex.: tabela `itens_lista`).
- No modo Supabase, a foto é enviada assim que é escolhida; se a pessoa cancelar o formulário, o arquivo fica no bucket.
- Não há Realtime: o contador de cartinhas novas e o cronômetro "juntos" se atualizam a cada 30–45 s; o resto, ao abrir a página.
- Rascunhos de cartinhas ficam escondidos na interface do outro perfil, mas no banco o casal inteiro tem acesso às linhas (RLS por casal). Para sigilo total, criar uma política que esconda rascunhos de quem não é o autor.
- O título do vídeo é preenchido automaticamente quando o player do YouTube informa; senão, a pessoa digita.
- Sem modo offline/PWA.
- "Assistir junto": navegadores só tocam vídeo com som depois de um toque na página; por isso, ao receber um vídeo, pode aparecer o botão "Assistir junto com …". A sincronização tolera ~1,5 s de diferença.

### Decisões tomadas sem perguntar (fáceis de mudar)

- A animação aparece logo após entrar e uma vez por aba/sessão do navegador; não se repete ao atualizar.
- Ao entrar, aplica-se o tema do perfil (Manu → Manu, Lury → Lury). Em **Aparência** dá para trocar para "o último tema escolhido".
- A tela de entrada usa sempre o tema Neutro.
- Excluir cartinhas, listas, filmes, vídeos e memórias pede confirmação; excluir um **item** de lista é imediato, com botão **Desfazer**.
- Ao mudar o status de um filme, a coleção acompanha o filme até a aba nova.
- Recompensas: o ritmo pedido (15 min / 30 min / 1 h) se repete a cada hora, então as 14 recompensas terminam em 4 h 30 min de cinema. Para espaçar mais, basta mudar os minutos em `js/recompensas.js`.
- Recompensas valem para o casal; o estilo de nome é escolhido por cada um, e o modo da sala é um só para os dois.
- Nenhum vídeo de exemplo foi incluído (não foi possível confirmar links públicos válidos); o campo fica pronto para colar um link.

---

## 9. Testes manuais

Marque cada item depois de testar (use uma janela anônima para começar do zero):

- [ ] `npm start` abre http://localhost:5173 sem erros no console (F12).
- [ ] A tela de entrada mostra o aviso **Modo demonstração**.
- [ ] **Entrar como Manu** → aparece exatamente "Bem-vinda, Manu!" com girassóis e pétalas → entra no tema Manu.
- [ ] Atualizar a página → não pede entrada de novo e não repete a animação.
- [ ] Trocar o tema no topo para Neutro e Lury → tudo muda na hora; atualizar → o tema continua.
- [ ] **Sair** → volta para a entrada. **Entrar como Lury** → "Bem-vindo, Lury!" com morcegos e lua → tema Lury.
- [ ] Na animação, **Pular animação** (ou Esc) encerra na hora.
- [ ] Ativar "reduzir movimento" no sistema (ou em Aparência) → animação estática e curta.
- [ ] Menu lateral: todas as 7 áreas abrem e a atual fica destacada.
- [ ] Celular (ou DevTools em 390 px): barra inferior, botão **Mais** abre o menu, sem rolagem lateral.
- [ ] **Início:** definir a data real no contador; adicionar e remover a foto do casal.
- [ ] **Cartinhas:** criar com papel/fonte/moldura/enfeites, ver a prévia grande, salvar, abrir, editar e excluir.
- [ ] **Listas:** criar lista com categoria personalizada, adicionar 3 itens, concluir 1 (progresso 1 de 3), editar um item, excluir e desfazer, renomear e excluir a lista.
- [ ] **Cinemateca sem chave:** aparece o aviso de configuração; cadastrar filme manual; tentar duplicar (bloqueia); mudar status; observações; remover.
- [ ] **Cinemateca com chave:** pesquisar "Amélie" → resultados reais com pôster → adicionar → aparece "Na coleção".
- [ ] **Cinema:** colar um link do YouTube → toca na tela; salvar nos favoritos; renomear; tocar pelo favorito; tela cheia. Testar um vídeo com incorporação bloqueada → aviso amigável com link.
- [ ] **Recompensas:** tocar um vídeo por alguns segundos e pausar → a aba **Conquistas** mostra o tempo. Para testar rápido no modo demonstração, no console: `a=JSON.parse(localStorage['nc:v1:ajustes']); a.cinemaMs_lury=65*60000; localStorage['nc:v1:ajustes']=JSON.stringify(a)` e atualizar → comemoração da Polaroid; gerar e baixar a foto; usar o nome cromado; ativar o modo noir quando chegar a 1 h 30.
- [ ] **Memórias:** abrir a visualização ampliada, navegar com as setas, enviar uma foto com legenda e data, editar e excluir.
- [ ] **Aparência:** trocar tema pelos cartões; decoração discreta; texto maior; restaurar exemplos.
- [ ] Navegar só com teclado (Tab/Enter/Esc): o foco é sempre visível.
- [ ] Buscar no código: nenhuma chave privada (`service_role`, chave do TMDB) em arquivos do front-end.

---

## 10. Próximos passos sugeridos

1. Criar o projeto Supabase e validar o login real com as duas contas.
2. Normalizar `listas.dados.itens` numa tabela própria e adicionar Supabase Realtime.
3. Trocar a data de exemplo e a ilustração por dados e fotos reais.
4. Publicar na Vercel (seção 6.1) com o Supabase já configurado.

# Prompt: app de compartilhamento de tela por link ("Telinha")

> Cole tudo abaixo da linha no Claude Code (VS Code), em uma pasta vazia para o novo repositório.
> O nome "Telinha" é provisório; troque à vontade.

---

## 1. Contexto e objetivo

Você é um engenheiro sênior full-stack. Construa do zero o **Telinha**, um jeito **simples** de eu mostrar minha tela para meus amigos:

1. Eu abro o app, clico em **"Compartilhar tela"** e escolho a tela ou janela.
2. O app gera um **link** (ex.: `https://telinha.meudominio.com/s/k7Qm2xPa9L`) e copia para a área de transferência.
3. Mando o link para um ou vários amigos. Eles abrem **no navegador**, digitam só um apelido (opcional) e já estão assistindo com áudio.
4. Quando eu paro de compartilhar ou fecho o app, a sessão acaba e o link deixa de funcionar.
5. Além do link aleatório, posso ter um **link fixo pessoal** (ex.: `https://telinha.meudominio.com/luan`) que meus amigos salvam nos favoritos e que sempre aponta para a minha transmissão atual.
6. Um amigo que está assistindo pode **pedir para compartilhar a tela dele** na mesma sessão; eu aprovo com um clique e todo mundo passa a ver a tela dele (revezamento).

Regras que já decidi. Siga-as; se alguma parecer errada, aponte antes de mudar:

- **Sem login, sem contas, sem cadastro, sem banco de dados.** O link é o único "convite". Nada de e-mail, senha ou OAuth.
- **Quem assiste não instala nada:** só abre o link em qualquer navegador moderno (desktop ou celular).
- **Quem compartilha** usa o app desktop (para ter seletor bonito e áudio do sistema). Como plano B, a mesma página web também permite compartilhar pelo `getDisplayMedia` do navegador.
- **Público:** eu e amigos; até ~10 pessoas assistindo uma sessão.
- **Transporte:** WebRTC via **SFU LiveKit** (auto-hospedado ou LiveKit Cloud free tier), para que o meu upload não se multiplique a cada amigo que entra.
- **Idioma da UI:** português do Brasil.

## 2. Stack (fixa, versões estáveis mais recentes)

### Monorepo
- **pnpm workspaces + Turborepo**, **TypeScript** estrito, **Biome** para lint e format.
- Estrutura:
  ```
  apps/
    desktop/   # Electron: quem compartilha
    web/       # página que abre pelo link: quem assiste (e plano B para compartilhar)
    server/    # API mínima: cria sessão e emite tokens LiveKit
  packages/
    ui/        # componentes React e design system compartilhados
    core/      # hooks LiveKit, estado, tipos compartilhados
  infra/       # docker-compose, livekit.yaml, Caddyfile
  ```

### Desktop (quem compartilha)
- **Electron** com **electron-vite** (dev/build) e **electron-builder** (NSIS no Windows, DMG no macOS, AppImage no Linux) + **electron-updater**.
- Captura via `desktopCapturer` + `session.setDisplayMediaRequestHandler` com **seletor próprio** (grade de miniaturas de telas e janelas).
- **Áudio do sistema:** `audio: 'loopback'` no Windows; no macOS 13+ usar `electron-audio-loopback`. Documentar a limitação no Linux.
- Segurança: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, IPC tipado só via preload.
- Tray icon e atalho global para parar o compartilhamento.

> **Por que Electron e não Tauri:** o WebView do Tauri no macOS e no Linux tem `getDisplayMedia` instável e não captura áudio do sistema. Electron traz o Chromium com WebRTC completo.

### Front-end (web e desktop)
- **React 19** + **Vite**, **Tailwind CSS v4** + **shadcn/ui**, **Motion** para animações, **Zustand** para estado.
- **livekit-client** + **@livekit/components-react** (hooks), com componentes visuais próprios.
- Ícones **Lucide**, fontes **Geist Sans** e **Geist Mono**.
- Roteamento mínimo: `/` (início) e `/s/:id` (assistir). Pode ser **TanStack Router** ou só `react-router`; escolha o mais simples.

### Back-end (apps/server), mínimo de verdade
- **Hono** em **Node 22+**, validação com **Zod**.
- **Sem banco.** O estado da sessão vive no próprio LiveKit (a sala e seus metadados) e num `Map` em memória. A única coisa persistida é a reserva dos links fixos, num arquivo `data/links.json` (slug → hash do segredo do dono), gravado de forma atômica.
- Endpoints:
  - `POST /sessions` → cria uma sala LiveKit com id aleatório de 10+ caracteres (`nanoid`, impossível de adivinhar), retorna `{ id, url, hostToken }`. O `hostToken` pode publicar tela e áudio.
  - `POST /sessions/:id/join` com `{ apelido? }` → retorna um token de **espectador**: `canSubscribe: true`, `canPublish: false`, `canPublishData: true` (para chat e reações). 404 se a sessão não existe mais.
  - `DELETE /sessions/:id` (só com o `hostToken`) → encerra a sala para todos.
  - `PUT /links/:slug` com `{ segredo }` → reserva um link fixo (slug de 3 a 20 caracteres, letras minúsculas, números e hífen; lista de slugs proibidos como `s`, `api`, `admin`). O segredo é gerado pelo app desktop na primeira vez e guardado só lá; o server guarda apenas o hash (argon2 ou scrypt). 409 se o slug já tem outro dono.
  - `POST /links/:slug/live` com `{ segredo, sessionId }` → aponta o link fixo para a sessão atual; `DELETE /links/:slug/live` desaponta.
  - `GET /links/:slug` → `{ aoVivo: boolean, sessionId? }`, e `GET /links/:slug/events` (SSE) para a página de espera saber na hora que o dono começou.
  - `POST /sessions/:id/presenter` (só com o `hostToken`) com `{ identity | null }` → passa ou devolve a vez de compartilhar (ver revezamento).
- Tokens com validade curta. Sala configurada com `emptyTimeout` para sumir sozinha se o host cair e não voltar em ~60s.
- Rate limit simples por IP no `POST /sessions` para ninguém abusar do servidor.

### Infra
- **Docker Compose** com `livekit-server`, `server` (Hono servindo também o build de `apps/web`) e **Caddy** (HTTPS automático).
- `livekit.yaml` com TURN/TLS na 443 para amigos em redes restritas.
- Guia de deploy em uma VPS barata, e alternativa usando LiveKit Cloud (aí só o `server` precisa ser hospedado, por exemplo na Fly.io ou Railway).

### Qualidade
- **Vitest** (unidade) e **Playwright** (E2E com duas abas e mídia falsa `--use-fake-device-for-media-stream`).
- GitHub Actions: lint, typecheck, testes; build dos instaladores em tags `v*`.

## 3. Funcionalidades

### MVP
1. **Compartilhar:** botão grande "Compartilhar tela" → **tela de configurações de transmissão** (detalhada na seção 3.1) → "Iniciar" → link gerado.
2. **Link:** assim que começa, mostra o link grande com botão "Copiar" (já copia sozinho) e um QR code para abrir no celular.
3. **Painel do host:** quantas pessoas estão assistindo e os apelidos delas, botão "Parar", botão "Trocar tela/janela" sem mudar o link, botão "Remover" ao lado de cada espectador, e **"Trancar sessão"** para ninguém novo entrar.
4. **Assistir (web):** abre o link → campo de apelido (opcional, com um apelido aleatório tipo "Capivara Azul" pré-preenchido) → botão "Assistir". Vídeo ocupa a tela toda com letterbox, controles de volume, tela cheia e picture-in-picture. Clique para ativar o áudio (política de autoplay dos navegadores).
5. **Chat leve e reações** por data channel: mensagens efêmeras em um painel recolhível, emojis que sobem por cima do vídeo. Nada é salvo.
6. **Link fixo pessoal:** em Configurações do app, campo "Meu link fixo" (ex.: `luan`) com verificação de disponibilidade. Ao começar a transmitir, o link fixo passa a apontar para a sessão (além do link aleatório, que continua valendo). Quem abre o link fixo com o dono offline vê "Luan não está ao vivo agora" e **entra sozinho** quando ele começar, sem recarregar (SSE). O painel do host mostra os dois links, com o fixo em destaque. Toggle "Usar link fixo nesta transmissão" para quando eu quiser algo só com o link aleatório.
7. **Revezamento de quem compartilha:**
   - Espectador vê o botão **"Pedir para compartilhar"**. O pedido vai por data channel e aparece no painel do host como notificação com **Aprovar** / **Recusar** (e som discreto).
   - Ao aprovar, o server dá ao amigo permissão de publicar só tela e áudio de tela (`updateParticipant` com `canPublish: true` e `canPublishSources: [SCREEN_SHARE, SCREEN_SHARE_AUDIO]`). O amigo compartilha pelo `getDisplayMedia` do navegador (ou pelo app desktop, se tiver) e usa uma versão reduzida das configurações da seção 3.1 (presets + áudio sim/não).
   - **Só uma tela por vez:** quando o amigo começa, a minha transmissão pausa; todos os espectadores trocam para a tela dele automaticamente, com um aviso "Agora: tela de Capivara Azul".
   - O host pode **"Retomar minha tela"** a qualquer momento (revoga a permissão do amigo) e o amigo pode **"Devolver"**. Se o amigo cair, a vez volta para o host sozinha.
   - O host continua sendo o dono da sessão: só ele tranca, remove pessoas e encerra.
8. **Estados claros:** "Aguardando o host começar", "O host pausou o compartilhamento", "Sessão encerrada", "Link inválido ou expirado", e indicador de conexão (bitrate, fps, perda de pacotes no tooltip).

### 3.1 Configurações de transmissão (quem compartilha)

Quem compartilha precisa ter controle total do que manda e com qual qualidade. A tela tem **presets no topo** (um clique resolve para a maioria) e **controles manuais** logo abaixo, organizados em abas ou seções recolhíveis: **Fonte**, **Vídeo**, **Áudio**. Mexer em qualquer controle manual muda o preset para "Personalizado". As últimas escolhas ficam salvas (`electron-store` no desktop, `localStorage` na web) e vêm pré-selecionadas na próxima vez.

**Presets**

| Preset | Resolução | FPS | Bitrate máx. | Otimizar para | Áudio |
|---|---|---|---|---|---|
| Texto/código | 1080p | 15 | 2,5 Mbps | Nitidez | Voz |
| Jogo | 1080p | 60 | 8 Mbps | Fluidez | Música |
| Filme/vídeo | 1080p | 30 | 6 Mbps | Equilíbrio | Alta fidelidade |
| Economia | 720p | 30 | 1,5 Mbps | Equilíbrio | Voz |
| Personalizado | escolhido à mão | | | | |

**Fonte**
- Grade de miniaturas ao vivo (atualizam a cada ~1s) separadas em **Telas** (um card por monitor, com nome e resolução) e **Janelas** (com ícone do app e título).
- Busca por nome de janela quando houver muitas.
- **Mostrar cursor:** sim/não.
- Na versão web (plano B), mostrar as opções que o navegador permitir (tela, janela, aba) e explicar que o seletor final é o do navegador.

**Vídeo**
- **Resolução:** Nativa, 4K (2160p), 1440p, 1080p, 720p, 480p. Nunca faz upscale: se a fonte for menor, usa a da fonte e mostra um aviso discreto.
- **Taxa de quadros:** 5, 15, 30, 60 fps (e 120 como "experimental", se o monitor e o codec suportarem).
- **Bitrate máximo:** "Automático" ou slider de 0,5 a 20 Mbps, com texto dizendo quanto de upload isso exige.
- **Otimizar para:** Nitidez (`contentHint = 'detail'`, `degradationPreference = 'maintain-resolution'`), Fluidez (`'motion'`, `'maintain-framerate'`) ou Equilíbrio (`'balanced'`).
- **Codec:** Automático (padrão), AV1, VP9, H.264, VP8. No automático, tentar AV1 → VP9 → H.264 conforme suporte do host e dos espectadores; mostrar qual está em uso de fato.
- **Várias qualidades para quem assiste (simulcast):** ligado por padrão, explicando que ajuda amigos com internet fraca; permitir desligar para economizar CPU.

**Áudio**
- **Compartilhar áudio do sistema:** sim/não. Aviso claro no Linux, onde pode não funcionar.
- **Volume do áudio compartilhado:** slider de 0 a 150% com medidor de nível ao vivo.
- **Qualidade do áudio** (Opus):
  - *Voz:* 32 kbps mono, DTX ligado
  - *Música:* 128 kbps estéreo
  - *Alta fidelidade:* 256 kbps estéreo, DTX desligado, RED ligado contra perda de pacotes
- No áudio do sistema, **desligar** cancelamento de eco, supressão de ruído e ganho automático (eles estragam música e jogo).
- **Microfone junto** (opcional, desligado por padrão): escolha do dispositivo, medidor de nível, e os toggles de cancelamento de eco, supressão de ruído e ganho automático (ligados por padrão só para o mic).

**Antes de iniciar**
- Uma **prévia** pequena do que vai ser transmitido.
- Um resumo em uma linha: "1080p · 60 fps · até 8 Mbps · áudio Música".
- **Teste de conexão** rápido (conexão ao LiveKit e estimativa de upload). Se o upload não aguentar as escolhas, sugerir o preset que cabe, sem bloquear.

**Durante a transmissão**
- Botão **"Ajustes"** no painel do host abre as mesmas opções num painel lateral. Mudanças de resolução, fps, bitrate, volume e áudio aplicam **sem derrubar ninguém** (`applyConstraints` e parâmetros do sender). Trocar codec ou fonte republica a trilha mantendo o mesmo link.
- **Painel de estatísticas** do que está saindo de verdade: resolução, fps, bitrate de vídeo e áudio, codec, perda de pacotes, uso de CPU. Aviso amarelo quando o LiveKit estiver reduzindo a qualidade por falta de banda ou CPU.
- Atalhos: pausar vídeo (mantém a sessão e mostra "Pausado" para quem assiste), mutar áudio do sistema, mutar mic.

**Do lado de quem assiste**
- Seletor de qualidade: **Automático** (padrão), Alta, Média, Baixa, usando as camadas do simulcast (`setVideoQuality`). Mostra a resolução e fps recebidos no tooltip de conexão.

### Depois (deixe a arquitetura pronta, não implemente agora)
- Compartilhar só uma região da tela (recorte) ou o áudio de um único app.
- Espectador falar por voz (push-to-talk) com permissão do host.
- Mais de uma tela ao mesmo tempo na mesma sessão (lado a lado).
- Ponteiro/desenho do espectador sobre a tela.
- Senha opcional no link.

### Fora de escopo
Contas, login, perfis, histórico, banco de dados, amigos/contatos, mobile nativo, controle remoto.

## 4. Direção visual: moderno e clean

O visual é **moderno, limpo e calmo**: muito espaço em branco (ou "preto"), poucos elementos por tela, tipografia fazendo o trabalho pesado e cor usada só onde importa. A tela compartilhada é o conteúdo; a interface quase some.

**Antes de desenhar, pesquise.** Na Fase 4, antes de qualquer tela, faça uma busca na web por referências atuais de interfaces clean (sites e apps abaixo, mais o que achar de novo), abra as páginas, e registre em `docs/design.md` o que vai aproveitar de cada uma (espaçamento, tipografia, como mostram estados, como tratam o vídeo). Só então use `frontend-design` para definir a direção.

Referências para estudar:
- **Vercel / Geist** (tipografia, neutros, densidade, estados): https://vercel.com/geist/introduction
- **Linear** (hierarquia, contraste sutil, atalhos, microinterações discretas): https://linear.app
- **Cap**, alternativa open source ao Loom (fluxo gravar → link, janela compacta do host): https://cap.so e https://github.com/CapSoftware/Cap
- **Loom** (página de assistir por link, simplicidade do "um clique e pronto")
- **Raycast** (paleta de comandos, janela pequena e precisa)
- **Discord**, só para o fluxo de compartilhar tela (não o visual): https://mobbin.com/explore/flows/3590eaef-9a3a-4a4b-b9c0-dc47b948a3c1
- Galerias para pesquisar mais: https://mobbin.com/explore/web/screens/call, https://dribbble.com/tags/screen-sharing, https://vp0.com/blogs/minimalist-app-design-inspiration

Linguagem visual:
- **Tema escuro padrão e tema claro de mesmo nível** (não um "claro" improvisado). Neutros quase puros, sem azulado forte: fundo `#0A0A0A` / `#FFFFFF`, superfícies em 1 ou 2 degraus, bordas de 1px bem sutis em vez de sombras.
- **Tipografia:** **Geist Sans** para a UI e **Geist Mono** para links, números e estatísticas (números tabulares). Hierarquia por tamanho e peso, não por cor.
- **Cor:** interface em tons neutros; **um único destaque** para a ação principal, definido na etapa de `frontend-design` (não use o roxo/índigo padrão de apps feitos por IA). Verde só para "AO VIVO", vermelho só para "Parar".
- **Espaço:** grid de 4px, margens generosas, no máximo uma ação primária por tela.
- **Vídeo protagonista:** fundo preto em volta do vídeo, controles numa barra inferior discreta que some após 3s sem mexer o mouse. Nada de blur exagerado nem brilho.
- Cantos de 8 a 12px, consistentes. Animações curtas (150 a 250ms), só para dar contexto (entrar, sair, trocar de tela), nunca decorativas.
- Ícones Lucide finos (stroke 1.5), sempre com rótulo ou tooltip.
- Acessibilidade: contraste AA, navegável por teclado, foco visível bonito, `aria-live` para "Sessão encerrada".
- A página de assistir funciona bem no celular (vídeo em paisagem, controles grandes).

Telas a entregar:
1. **Início do host (desktop):** botão "Compartilhar tela" gigante e nada mais.
2. **Configurações de transmissão:** presets no topo, seções Fonte / Vídeo / Áudio, prévia, resumo em uma linha e botão "Iniciar" (seção 3.1). Tem muitas opções, então use divulgação progressiva: presets visíveis, controles manuais em seções recolhidas.
3. **Compartilhando (host):** link + copiar + QR, contador e lista de quem assiste, trancar, parar, botão "Ajustes" com painel lateral e painel de estatísticas. Janela compacta que pode ficar pequena num canto.
4. **Entrar (web):** apelido + "Assistir", com prévia de quem está compartilhando.
5. **Assistindo (web):** vídeo em tela cheia, barra flutuante, chat recolhível, reações, botão "Pedir para compartilhar" e selo com o nome de quem está compartilhando agora.
6. **Estados** de espera (incluindo "Luan não está ao vivo agora" do link fixo), encerrada e link inválido.
7. **Pedido de revezamento:** notificação no painel do host com Aprovar/Recusar, e no lado do amigo a tela "Você foi aprovado, escolha o que compartilhar".

## 5. Requisitos não funcionais
- Latência alvo abaixo de 300 ms na mesma região.
- Do clique em "Compartilhar" até o link estar copiado: menos de 3 segundos.
- Reconexão automática do espectador se a rede cair por até 30s.
- Nenhum segredo no cliente: só o server conhece a API key do LiveKit.
- Pedir a permissão de Gravação de Tela no macOS com uma tela explicativa.

## 6. Sem cara de IA

Este projeto não pode parecer "gerado por IA", nem na interface, nem no código, nem nos textos. Trate isso como requisito, com o mesmo peso de um teste falhando.

**Interface**
- Nada de: gradiente roxo→azul, glassmorphism em tudo, cards idênticos em grade com ícone + título + frase, hero centralizado com "✨", emojis decorando botões e títulos, sombras coloridas brilhando, cantos todos iguais, ilustrações 3D genéricas, texto cinza-claro em fundo cinza.
- Tenha uma **identidade**: escolha uma direção estética clara (moderna e clean, conforme a seção 4, com personalidade em poucos detalhes) e siga-a em todas as telas. Tipografia com hierarquia de verdade, espaçamento com ritmo, um ou dois detalhes memoráveis em vez de enfeite em todo lugar.
- Use shadcn/ui como base, mas **customize** tokens, raios, estados e densidade. Se parecer o exemplo da documentação do shadcn, não está pronto.
- Estados vazios, de erro e de carregamento desenhados de propósito, não um spinner centralizado com "Carregando...".

**Código**
- Nada de: comentário explicando o óbvio (`// incrementa o contador`), comentários de "passo 1, passo 2", abstrações para um uso só, wrappers que só repassam parâmetros, `try/catch` que engole erro e loga "Error:", `any`, código morto "para o futuro", funções duplicadas com nomes diferentes, arquivos `utils.ts` gigantes.
- Comentário só para explicar **por quê** (uma decisão não óbvia, um bug de navegador contornado), com link quando houver.
- Nomes específicos do domínio (`viewerToken`, `presenterIdentity`), não genéricos (`data`, `handleStuff`, `manager`).
- Menos código é melhor: se dá para apagar sem perder comportamento, apague.

**Textos (UI, README, commits, PRs)**
- Português brasileiro natural e direto, como um amigo falaria. Nada de "Desbloqueie o poder de...", "Experiência perfeita", "Mergulhe", "Revolucione", "Seamless", excesso de exclamações ou emoji.
- Mensagens de erro dizem o que aconteceu e o que fazer ("Seu amigo saiu da sessão. A tela voltou para você."), não "Oops! Algo deu errado 😅".
- Commits e PRs descrevem a mudança em uma frase simples; sem listas infladas de "melhorias".
- README curto e prático: como rodar, como fazer deploy, limitações. Sem seção de "Features ✨" com emoji em cada linha.

**Skills para isso** (use sempre, além das da tabela da seção 7)
- `frontend-design` antes de desenhar **qualquer** tela: é a skill feita para sair do visual genérico de IA. Defina a direção estética no começo da Fase 4 e registre em `docs/design.md`.
- `design-auditor` ao terminar cada tela: além de acessibilidade, peça para apontar padrões genéricos e dark patterns.
- `simplify` e `code-review` no fim de cada fase, pedindo explicitamente para caçar os padrões da lista **Código** acima.
- `finding-duplicate-functions` (superpowers-lab) no fim das Fases 2, 3b e 5, para achar funções repetidas.
- `receiving-code-review` ao aplicar as revisões: corrija de verdade, sem concordar no automático.
- Antes de cada commit de fim de fase, releia o diff e os textos novos da UI procurando os padrões desta seção; se achar, corrija antes do commit.

## 7. Como trabalhar (fases executáveis)

Antes de escrever código, mostre um plano curto da Fase 0 e espere meu ok. Trabalhe **uma fase por vez**; ao terminar cada uma, rode `pnpm lint && pnpm typecheck && pnpm test`, faça commit, abra o PR da branch `fase-N`, espere o CI verde, faça o merge e me diga como testar à mão antes de seguir.

### Skills que você deve usar

Estas skills estão instaladas neste Claude Code. Invoque cada uma no momento indicado, sem esperar eu pedir:

| Quando | Skill |
|---|---|
| Antes da Fase 0, para fechar dúvidas do escopo | `brainstorming` |
| No início de cada fase, para escrever e depois seguir o plano | `writing-plans`, depois `executing-plans` |
| Ao criar o repositório (Fase 0) | `init` (gera o `CLAUDE.md`) |
| Ao escrever lógica em `core` e `server` | `test-driven-development` |
| Quando algo quebrar (WebRTC, captura, IPC) | `systematic-debugging` |
| Tarefas independentes dentro de uma fase | `subagent-driven-development` / `dispatching-parallel-agents`, com `using-git-worktrees` |
| Início da Fase 4, para pesquisar referências de design na web | `deep-research` (ou busca na web direta) |
| Fases 3 e 4, para todas as telas | `frontend-design` |
| Fim da Fase 4, para contraste, WCAG e acessibilidade | `design-auditor` |
| Fases 1, 3 e 3b, para os testes E2E no navegador | `webapp-testing` |
| Para abrir o app e confirmar que uma mudança funciona | `run` |
| Fases 1, 2, 3b e 5 (tokens, Electron, link fixo, deploy) | `vibesec` durante a escrita, `security-review` ao fechar a fase |
| Antes de cada commit de fim de fase | `simplify`, depois `code-review` |
| Antes de dizer que uma fase está pronta | `verification-before-completion` |
| Ao fechar a fase e juntar a branch | `finishing-a-development-branch` |
| Fase 5, para o changelog dos releases | `changelog-generator` |
| Se aparecerem muitos pedidos de permissão | `fewer-permission-prompts` |

Não use as skills `caveman*` neste projeto: quero explicações completas em português.

**Fase 0: repositório, configuração e esqueleto**

*Repositório (antes de tudo):*
- Confira se `git`, `gh` (GitHub CLI), Node 22+ e `pnpm` estão instalados e se o `gh auth status` está logado. Se faltar algo, me diga o comando para instalar no meu sistema e espere.
- `git init` com branch `main`, e crie o repositório **privado** no GitHub com `gh repo create telinha --private --source . --remote origin`. Antes de rodar, confirme comigo o nome do repositório.
- Primeiro commit só com a configuração, e `git push -u origin main`.

*Configuração do projeto:*
- `package.json` raiz com `"packageManager"` (pnpm fixado) e `"engines"`; `.nvmrc` com a versão do Node.
- `.gitignore` (node_modules, dist, out, release, `.env*` exceto `.env.example`, `data/`), `.editorconfig`, `.gitattributes` (`* text=auto eol=lf`).
- `.env.example` documentado: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `PUBLIC_BASE_URL`, `PORT`. O `.env` real nunca vai para o Git.
- Biome, tsconfig base em `packages/config`, Turborepo com as tarefas `dev`, `build`, `lint`, `typecheck`, `test`.
- **Lefthook** com pre-commit rodando `biome check --staged` e commit-msg validando **Conventional Commits** (commitlint).
- `.vscode/settings.json` (Biome como formatador, format on save) e `.vscode/extensions.json` recomendando Biome, Tailwind CSS IntelliSense, Playwright Test e GitHub Actions.
- `.github/`: workflow `ci.yml` (install com cache do pnpm, lint, typecheck, test em todo push e PR), template de PR, templates de issue (bug e ideia) e `dependabot.yml` semanal para npm e GitHub Actions.
- Proteção da branch `main` via `gh api`: exigir o CI verde antes de merge. Daqui em diante, cada fase é feita numa branch `fase-N` e entra na `main` por PR (`gh pr create`) com o CI verde.
- `CLAUDE.md` (via `init`) com a stack, os comandos e as convenções deste prompt; `README.md` inicial com "como rodar".
- `infra/docker-compose.dev.yml` com LiveKit em modo `--dev` (API key e secret de dev já no `.env.example`).
- Pronto quando: o repositório existe no GitHub, `pnpm install && pnpm dev` sobe server e web sem erros, o hook recusa um commit fora do padrão e o CI passa verde no primeiro PR.

**Fase 1: link funcionando no navegador**
- `POST /sessions`, `POST /sessions/:id/join`, `DELETE /sessions/:id`.
- Página web que compartilha pelo `getDisplayMedia` e gera o link; página `/s/:id` que assiste.
- Pronto quando: uma aba compartilha, duas outras abertas pelo link assistem com áudio, e ao parar as duas veem "Sessão encerrada". Teste Playwright cobrindo isso.

**Fase 2: app desktop do host**
- Electron carregando `packages/ui`, áudio do sistema (Windows, depois macOS), tray, atalho global para parar.
- **Configurações de transmissão completas (seção 3.1):** fonte, presets, vídeo, áudio, prévia, teste de conexão, ajustes ao vivo e painel de estatísticas. Coloque a lógica (mapear preset → constraints, encodings e opções de publicação do LiveKit) em `packages/core` com testes unitários.
- Pronto quando: o desktop compartilha uma janela com áudio em cada preset; ao trocar resolução, fps, bitrate ou fonte durante a transmissão, o navegador continua assistindo pelo mesmo link; e as estatísticas batem com o que foi escolhido.

**Fase 3: experiência de assistir**
- Tela cheia, PiP, volume, seletor de qualidade do espectador, apelidos, chat e reações, estados de espera/encerrada/inválido, indicador de conexão, layout de celular.
- Painel do host com lista de espectadores, remover e trancar.

**Fase 3b: link fixo e revezamento**
- Endpoints `/links/*` e `/sessions/:id/presenter`, configuração "Meu link fixo" no desktop, página de espera com SSE, fluxo completo de pedir, aprovar, retomar e devolver a vez.
- Testes unitários das regras (slug válido, segredo errado, só uma tela por vez, vez volta ao host se o amigo cair) e um E2E Playwright: host compartilha, espectador pede, host aprova, uma terceira aba passa a ver a tela do espectador.
- Use `vibesec` e `security-review`: um estranho não pode tomar um link fixo nem se dar permissão de publicar.
- Pronto quando: abrir `/luan` com o host offline espera e entra sozinho quando ele começa; e o revezamento funciona com três abas.

**Fase 4: visual e polimento**
- As 7 telas da seção 4 seguindo a seção 6 (sem cara de IA), animações, QR code, textos em pt-BR revisados, tela de permissão do macOS.

**Fase 5: distribuição e deploy**
- `infra/docker-compose.yml` de produção com Caddy, rate limit, electron-builder + auto-update, GitHub Actions gerando instaladores em tags `v*` e publicando no GitHub Releases.
- Cadastre os segredos de produção no repositório com `gh secret set` (me peça os valores, nunca invente nem commite). Assinatura de código do Windows/macOS fica documentada como opcional.
- `README.md` com dev, deploy (VPS e LiveKit Cloud), geração de instaladores e tabela de limitações por sistema operacional.

Regras gerais:
- Commits pequenos e com mensagens claras.
- Não pule fases nem adiante itens do "Depois".
- Tudo que for entregue segue a seção 6 (sem cara de IA).
- Na dúvida entre duas opções, escolha a mais simples e registre a decisão em `docs/decisoes.md`.

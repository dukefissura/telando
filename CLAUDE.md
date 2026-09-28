# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Telando: compartilhar a tela com amigos por um link. Tudo acontece no app desktop (Electron, só Windows): quem compartilha e quem assiste. O link `https://…` abre uma página que chama `telando://` e abre o app (ou oferece o download). O transporte é WebRTC pelo SFU LiveKit.

Fontes da verdade, nesta ordem: `docs/superpowers/specs/2026-09-27-telando-design.md` (desenho e cortes de escopo), `docs/prompt-original.md` (produto completo, escrito com o nome antigo "Telinha") e `docs/decisoes.md` (por que cada escolha). Na dúvida entre duas opções, escolha a mais simples e registre em `docs/decisoes.md`.

## Comandos

```bash
pnpm install
cp .env.example .env          # credenciais do LiveKit --dev já vêm preenchidas
pnpm dev:livekit              # baixa e roda livekit-server --dev (porta 7880), sem Docker
pnpm dev                      # server (8787) + página do site (5173)
pnpm dev:desktop              # app Electron (renderer em 5174); rode fora do VS Code ou sem ELECTRON_RUN_AS_NODE
# Um segundo app para assistir: TELANDO_PERFIL=<pasta> pnpm --filter @telando/desktop exec electron .

pnpm lint                     # biome check .   (pnpm format corrige)
pnpm typecheck                # tsc em todos os pacotes via turbo
pnpm test                     # vitest em todos os pacotes via turbo
pnpm e2e                      # builda o desktop e roda o Playwright; sobe LiveKit, server e web sozinho

pnpm --filter @telando/core test                       # um pacote
pnpm --filter @telando/core exec vitest run src/sessao.test.ts -t "aceita"   # um teste
```

## Arquitetura

- `apps/server`: Hono em Node. Todas as rotas ficam sob `/api` porque o mesmo server serve o site, que tem rotas `/:slug`. `criarApp()` em `app.ts` monta o app (testado com `app.request()`); `main.ts` carrega o `.env` da raiz e sobe.
- `apps/web`: React 19 + Vite + Tailwind v4. Só a página "Abrir no Telando": lê o link com `destinoDoLink`, tenta `telando://` e oferece o instalador.
- `e2e/`: Playwright. Os testes abrem apps Electron de verdade, um por pessoa, cada um com o próprio perfil (`TELANDO_PERFIL`), capturando a tela real. A página do site roda no Chromium comum.
- `apps/desktop`: Electron (só Windows). O main faz só o que exige Node/Electron: seletor de fontes (`desktopCapturer` + `setDisplayMediaRequestHandler` com áudio `loopback`), bandeja, atalho global, `electron-store`, links `telando://` (argv e `second-instance`) e a janela maximizada. IPC tipado em `src/compartilhado/ipc.ts`, validado no main (`exigirOrigem`). O protocolo só é registrado pelo instalador.
- `packages/ui`: todas as telas do app. `App` alterna entre o painel de quem compartilha (`host/`) e a tela de assistir (`assistir/`), aberta por link. O que vem do Electron entra pela interface `Plataforma`.
- `packages/core`: regras puras compartilhadas (esquemas Zod, presets → constraints/encodings, estatísticas). O subpath `@telando/core/cliente` tem o que depende de navegador (LiveKit, React): `TransmissaoAoVivo`, que faz ajustes ao vivo numa fila, e `useTransmissao`. O server nunca importa esse subpath.
- `packages/config`: `tsconfig.base.json`.

Pacotes internos exportam `.ts` direto (`"exports": { ".": "./src/index.ts" }`), sem build. Imports relativos usam a extensão `.ts`.

Estado compartilhado de uma sessão (quem apresenta, se está trancada) vive nos **metadados da sala do LiveKit**, escritos só pelo server. Mensagens de data channel são avisos e nunca mudam permissão: qualquer espectador pode enviá-las. Não há banco; só `data/links.json` para os links fixos.

## Fluxo de trabalho

- Uma fase por vez, cada uma numa branch `fase-N`, entrando na `main` por PR. Não há GitHub Actions: o hook `pre-push` roda lint, typecheck e testes e faz o papel do CI; nunca use `--no-verify`. Os commits usam o e-mail noreply do GitHub (configurado no repositório).
- Antes de fechar uma fase: `pnpm lint && pnpm typecheck && pnpm test`, depois as skills `simplify` e `code-review`.
- Commits em Conventional Commits com descrição em pt-BR (commitlint no hook `commit-msg`; Biome no `pre-commit`).
- pnpm 12 bloqueia scripts de instalação: dependências que precisam deles entram em `allowBuilds` no `pnpm-workspace.yaml` (`pnpm approve-builds <pacote>`).
- Não use as skills `caveman*` neste projeto.

## Convenções (requisito, não preferência)

- Nada de cara de IA: sem gradiente roxo, glassmorphism, emoji em botões ou títulos, cards idênticos em grade, "Oops! Algo deu errado".
- Textos em pt-BR direto, como um amigo falaria. Erros dizem o que aconteceu e o que fazer.
- Código: sem `any`, sem comentário que repete o código, sem abstração de um uso só, sem wrapper que só repassa parâmetros, sem `catch` que engole erro, sem código "para o futuro". Comentário só para explicar um porquê não óbvio.
- Movimento segue `docs/design.md` e o handoff de movimento (1a–1j): controles em 150–200ms, só transform/opacity/clip-path/filter; o `MotionConfig reducedMotion="user"` e `useReducedMotion()` desligam o resto. Texto que anima fica também em `sr-only`, porque os testes leem o DOM.
- Nomes do domínio em português (`hostToken`, `presenterIdentity`, `lerSessaoMetadata`), nada de `data`, `manager`, `handleStuff`.
- Visual: tema escuro padrão (`#0A0A0A`) e claro de mesmo nível, Geist Sans/Mono, um único destaque de cor. Verde só para "AO VIVO", vermelho só para "Parar".

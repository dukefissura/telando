# Fase 1: link funcionando no navegador

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma aba compartilha a tela pelo navegador e gera um link; outras abas abertas pelo link assistem com áudio; ao parar, todas veem "Sessão encerrada". Coberto por um E2E do Playwright.

**Architecture:** O server cria salas no LiveKit e emite tokens; guarda as sessões num `Map` e as remove quando o LiveKit avisa `room_finished` pelo webhook. O cliente web usa `livekit-client` direto para publicar e `@livekit/components-react` (hooks) para assistir. O contrato da API (esquemas Zod de resposta e o cliente `fetch` tipado) fica em `packages/core`, porque o desktop vai usar o mesmo na Fase 2.

**Tech Stack:** Hono 4, livekit-server-sdk 2.19, nanoid 6, Zod 4; React 19, react-router 8, livekit-client 2.22, @livekit/components-react 2.9; Playwright 1.63.

## Global Constraints

- Rotas sob `/api`. Erros sempre `{ erro: 'codigo', mensagem: 'texto pt-BR' }`.
- `hostToken` é segredo opaco (32 bytes base64url); o server guarda só o SHA-256 e compara com `timingSafeEqual`.
- `livekitToken` com TTL de 10 minutos. Espectador: `canSubscribe`, `canPublishData`, sem `canPublish`.
- Id de sessão: `nanoid` de 12 caracteres, alfabeto sem ambíguos (`0 O 1 l I`).
- LiveKit com `room.auto_create: false`: um token para sala apagada não recria a sala.
- `POST /sessions` limitado a 10 por minuto por IP; `join` a 30.
- Sem `any`, textos em pt-BR direto, sem código para fases futuras.

---

### Task 1: Contrato da API em `core`

**Files:** Create `packages/core/src/api.ts`, `packages/core/src/api.test.ts`, `packages/core/src/apelidos.ts`, `packages/core/src/apelidos.test.ts`; Modify `packages/core/src/index.ts`

**Produces:**
- `sessaoCriadaSchema` → `{ id, url, livekitUrl, hostToken, livekitToken }`; `entradaSchema` → `{ livekitUrl, livekitToken, identity }`; `erroApiSchema` → `{ erro, mensagem }`.
- `class ErroApi extends Error { status: number; codigo: string }`.
- `criarClienteApi(base: string, fetcher = fetch)` → `{ criarSessao(nome?), entrarNaSessao(id, apelido?), encerrarSessao(id, hostToken) }`, cada um validando a resposta com Zod e lançando `ErroApi` em status ≥ 400.
- `apelidoAleatorio(sortear = Math.random): string` → "Capivara Azul" (bicho + cor, concordância de gênero).

Testes: cliente com `fetcher` falso cobre sucesso, erro 404 virando `ErroApi` com `codigo`, resposta fora do esquema virando erro; apelido com `sortear` fixo devolve combinação esperada e concordância ("Onça Amarela", "Tatu Amarelo").

### Task 2: Sessões no server (TDD)

**Files:** Create `apps/server/src/salas.ts` (gateway LiveKit), `apps/server/src/sessoes.ts` (registro + rotas), `apps/server/src/sessoes.test.ts`, `apps/server/src/limite.ts`, `apps/server/src/limite.test.ts`, `apps/server/src/erros.ts`; Modify `app.ts`, `main.ts`, `env.ts`

**Interfaces:**
- `interface SalaGateway { criar(id: string, metadata: SessaoMetadata): Promise<void>; apagar(id: string): Promise<void>; apagarTodas(): Promise<void> }` e `criarSalaGateway(env)` com `RoomServiceClient` (`emptyTimeout: 60`, `maxParticipants: 16`).
- `criarApp(deps: { env: Env; salas: SalaGateway; ipDoCliente: (c: Context) => string; agora?: () => number })`.
- `limitePorJanela({ limite, janelaMs, agora })` → `(chave) => boolean` e middleware `limitarPorIp`.

Testes (Vitest, gateway falso gravando chamadas, `TokenVerifier` para ler os JWTs):
1. `POST /sessions` → 201, id de 12 chars, `url` = `${PUBLIC_BASE_URL}/s/${id}`, sala criada com metadados `v:1`, JWT do host com `canPublish` e `room = id`.
2. `POST /sessions/:id/join` → 200, JWT com `canPublish: false`, `canSubscribe`, `canPublishData`, `name` = apelido aparado; apelido vazio vira apelido aleatório; apelido > 32 chars → 400.
3. `join` em sessão inexistente → 404 `sessao_nao_encontrada`.
4. `DELETE` sem token → 401; token errado → 403; certo → 204, sala apagada, `join` passa a dar 404.
5. 11º `POST /sessions` do mesmo IP no mesmo minuto → 429 `muitas_sessoes`; outro IP passa.
6. Corpo que não é JSON → 400 `corpo_invalido`.

### Task 3: Webhook do LiveKit

**Files:** Create `apps/server/src/webhook.ts`, `apps/server/src/webhook.test.ts`; Modify `app.ts`, `infra/livekit.dev.yaml` (`room.auto_create: false`)

`POST /api/livekit/webhook` valida com `WebhookReceiver` (header `Authorization`); `room_finished` remove a sessão do registro. Teste: evento assinado com `AccessToken`/`sha256` do corpo remove a sessão; assinatura inválida → 401.

### Task 4: Compartilhar pelo navegador (`/`)

**Files:** Create `apps/web/src/api.ts` (instância do cliente), `apps/web/src/compartilhar/pagina-compartilhar.tsx`, `apps/web/src/compartilhar/use-transmissao.ts`; Modify `main.tsx` (router), remove `inicio.tsx`

- Clique em "Compartilhar tela" chama `getDisplayMedia({ video: true, audio: true })` e `criarSessao()` em paralelo (o picker do navegador e a criação da sala correm juntos). Cancelou o picker → encerra a sessão criada.
- Conecta no LiveKit, publica vídeo (`Track.Source.ScreenShare`) e áudio se houver (`ScreenShareAudio`), copia o link.
- Tela "Compartilhando": link em fonte mono, "Copiar", aviso se o navegador não deu áudio, "Parar". O botão "Parar compartilhamento" do próprio navegador (evento `ended`) também encerra.
- `hostToken` em `sessionStorage` para o F5 não perder o poder de encerrar.

### Task 5: Assistir (`/s/:id`)

**Files:** Create `apps/web/src/assistir/pagina-assistir.tsx`, `apps/web/src/assistir/use-sala-espectador.ts`, `apps/web/src/assistir/palco.tsx`

Estados: `formulario` → `entrando` → `aguardando` ("Aguardando o host começar") / `assistindo` → `encerrada` ("Sessão encerrada", com `aria-live`) ou `invalida` ("Link inválido ou expirado"). Apelido pré-preenchido com `apelidoAleatorio()`. O clique em "Assistir" é o gesto que libera o áudio (`room.startAudio()`). Vídeo com letterbox em fundo preto; áudio pelo `RoomAudioRenderer`.

### Task 6: E2E com Playwright

**Files:** Create `e2e/playwright.config.ts`, `e2e/link.spec.ts`, `e2e/package.json`

- `webServer`: `pnpm dev:livekit`, server e web.
- Chromium com `--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream`, `--auto-select-desktop-capture-source=Entire screen`, `--autoplay-policy=no-user-gesture-required`.
- Cenário: aba A compartilha e lê o link; abas B e C abrem, entram, veem `<video>` com `videoWidth > 0` e uma trilha de áudio inscrita (se o Chromium de teste fornecer áudio de captura; senão o teste cobre a publicação de áudio pelo lado do host com um `MediaStreamTrack` de `AudioContext` injetado via `page.addInitScript`). A clica "Parar"; B e C mostram "Sessão encerrada".

### Task 7: Fechamento

`vibesec` durante as Tasks 2 e 3, depois `security-review`, `simplify`, `code-review`, `finding-duplicate-functions` não se aplica (fase 2+). `pnpm lint && pnpm typecheck && pnpm test` e E2E, PR, merge.

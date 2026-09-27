# Telando: desenho

A especificação completa do produto está em [`docs/prompt-original.md`](../../prompt-original.md) (escrita com o nome provisório "Telinha"). Este documento registra o que mudou em relação a ela e como as peças conversam. Onde os dois divergem, vale este.

## 1. Mudanças de escopo

| Tema | Prompt original | Decidido |
|---|---|---|
| Nome | Telinha | **Telando**, repositório público `dukefissura/telando` ; sem GitHub Actions: lint, typecheck e testes rodam no hook `pre-push`, e os instaladores são gerados localmente e publicados com `gh release` |
| Plataformas | Windows, macOS, Linux; assistir também no celular | **Só PC.** Desktop só Windows (NSIS). Página de assistir pensada para navegador de computador |
| Removido por isso | | macOS (permissão, `electron-audio-loopback`, DMG), Linux (AppImage, avisos), layout de celular, QR code, tabela de limitações por SO |
| LiveKit no dev | `docker-compose.dev.yml` | Binário `livekit-server.exe --dev` baixado por `pnpm dev:livekit`. O compose continua no repo como alternativa |
| Produção | VPS ou LiveKit Cloud | Em aberto; as duas documentadas, nada no código depende da escolha |
| Rotas da API | `/sessions`, `/links` | Tudo sob `/api/*`, porque o mesmo server serve o site e o site tem `/:slug` |

## 2. Arquitetura

```
apps/desktop    Electron (Windows). Seletor próprio de fontes, áudio loopback, tray, atalho global.
                Renderer em React usando packages/ui e packages/core.
apps/web        React. Rotas: / (compartilhar pelo navegador), /s/:id (assistir), /:slug (link fixo).
apps/server     Hono em Node. Sessões, tokens LiveKit, links fixos, presenter, webhooks do LiveKit.
                Em produção serve também o build de apps/web.
packages/core   Regras sem UI: preset → constraints/encodings/publishOptions, esquemas Zod do protocolo
                (metadados da sala, mensagens de data channel, respostas da API), hooks LiveKit, stores Zustand.
packages/ui     Design system (tokens, shadcn customizado) e telas compartilhadas entre web e desktop.
packages/config tsconfig base.
infra/          livekit.yaml, Caddyfile, docker-compose.dev.yml e docker-compose.yml.
scripts/        dev-livekit.mjs: baixa o livekit-server da versão fixada e roda em --dev.
```

Portas no dev: server `8787`, web `5173` (Vite com proxy de `/api` para o server), LiveKit `7880`.

## 3. Estado

A fonte da verdade de quem está na sala é o próprio LiveKit. O que todos precisam ver fica nos **metadados da sala**, escritos só pelo server (`updateRoomMetadata`) e recebidos por todos no evento `RoomMetadataChanged`:

```ts
type SessaoMetadata = {
  v: 1
  hostIdentity: string
  hostNome: string
  presenterIdentity: string | null // null = a tela é do host
  trancada: boolean
}
```

- **Pausar** não é metadado: o host muta a trilha de vídeo e os espectadores reagem ao evento `TrackMuted`.
- O server guarda em memória (`Map`) só o que é interno: `sessionId → { hostTokenHash, hostIdentity, criadaEm, slug? }`, os contadores de rate limit e `slug → sessionId` dos links fixos ao vivo.
- Em disco, só `data/links.json` (`slug → { nome, salt, hash }`), gravado em arquivo temporário + `rename`.
- **Reinício do server** derruba todas as sessões: no boot ele apaga as salas que sobraram no LiveKit (instância dedicada). Aceitável para o público do app.

## 4. Autenticação e tokens

Dois tipos de credencial, com nomes distintos para não confundir:

- **`hostToken`**: segredo opaco (32 bytes, base64url) devolvido só para quem criou a sessão. O server guarda o SHA-256 e compara com `timingSafeEqual`. Vai no header `Authorization: Bearer` das rotas do host. Vale enquanto a sessão existir.
- **`livekitToken`**: JWT do LiveKit, validade de 10 minutos (só precisa valer na conexão; o LiveKit renova para quem está conectado).

Permissões no LiveKit:

| Quem | canSubscribe | canPublish | canPublishSources | canPublishData |
|---|---|---|---|---|
| Host | sim | sim | todas | sim |
| Espectador | sim | não | | sim |
| Espectador com a vez | sim | sim | `SCREEN_SHARE`, `SCREEN_SHARE_AUDIO` | sim |

Identidades: host `h_<nanoid>`, espectador `v_<nanoid>`. O apelido vai em `name` (1 a 32 caracteres após trim; vazio vira apelido aleatório tipo "Capivara Azul").

## 5. API (`/api`)

| Rota | Auth | Faz |
|---|---|---|
| `POST /sessions` `{ nome? }` | rate limit por IP | Cria a sala (id `nanoid` de 12 caracteres, alfabeto sem ambíguos). Devolve `{ id, url, livekitUrl, hostToken, livekitToken }` |
| `POST /sessions/:id/join` `{ apelido? }` | rate limit | Token de espectador. 404 se não existe, 423 se trancada |
| `DELETE /sessions/:id` | hostToken | `deleteRoom`: todos recebem `ROOM_DELETED` e veem "Sessão encerrada" |
| `PUT /sessions/:id/trancada` `{ trancada }` | hostToken | Atualiza metadados; join passa a responder 423 |
| `DELETE /sessions/:id/participantes/:identity` | hostToken | `removeParticipant` |
| `POST /sessions/:id/presenter` `{ identity \| null }` | hostToken | Passa ou devolve a vez (seção 6) |
| `PUT /links/:slug` `{ segredo, nome }` | rate limit | Reserva. 409 se o slug é de outro dono; 200 se o mesmo segredo (idempotente) |
| `GET /links/:slug` | | `{ nome, aoVivo, sessionId? }`; 404 se não reservado |
| `GET /links/:slug/events` | | SSE com evento `status` a cada mudança e ping a cada 25s |
| `POST /links/:slug/live` `{ segredo, sessionId }` | hostToken da sessão | Aponta o link para a sessão |
| `DELETE /links/:slug/live` `{ segredo }` | | Desaponta |
| `POST /livekit/webhook` | assinatura do LiveKit | `participant_left`, `room_finished` |

- **Slug:** `^[a-z0-9](?:[a-z0-9-]{1,18}[a-z0-9])$` (3 a 20), proibidos `s`, `api`, `admin`, `assets`, `updates`, `health`, `livekit`, `app`, `static`.
- **Segredo do link fixo:** 32 bytes gerados pelo desktop, guardados com `safeStorage` no `electron-store`. O server guarda `scrypt` com salt.
- **Erros:** sempre `{ erro: 'codigo_estavel', mensagem: 'texto em pt-BR' }`. O cliente decide a tela pelo código, nunca pelo texto.
- **Rate limit:** janela deslizante em memória. `POST /sessions` 10/min, join e links 30/min por IP. Atrás do Caddy, o IP vem de `X-Forwarded-For` só quando `TRUST_PROXY=1`.

## 6. Fluxos

**Compartilhar.** Configurações (seção 3.1 do prompt) → `POST /sessions` → conecta no LiveKit → publica tela (+ áudio) com as opções vindas de `core` → copia o link. Se o link fixo estiver ligado, `POST /links/:slug/live`. Meta: link copiado em menos de 3s, então a criação da sessão começa em paralelo enquanto o usuário escolhe a fonte.

**Assistir.** `/s/:id` → apelido → `POST /join` → conecta → mostra a trilha `SCREEN_SHARE` de `presenterIdentity ?? hostIdentity`. Áudio só depois de um clique (autoplay). Reconexão automática do `livekit-client` cobre quedas de até 30s.

**Link fixo.** `/:slug` → `GET /links/:slug`. Se ao vivo, segue para o fluxo de assistir com o `sessionId`. Se não, mostra "Luan não está ao vivo agora" e abre o SSE; quando chega `aoVivo: true`, entra sozinho.

**Revezamento.**
1. Espectador manda `pedido-tela` por data channel para o host.
2. Host aprova → `POST /presenter { identity }`. O server confere que a pessoa está na sala, revoga a vez de quem tinha, dá `canPublish` só de tela ao escolhido e grava `presenterIdentity`.
3. Todos recebem os metadados. O host pausa a própria trilha; o amigo vê "Você foi aprovado, escolha o que compartilhar" e usa `getDisplayMedia`; os espectadores trocam para a trilha dele com o aviso "Agora: tela de Capivara Azul".
4. Host "Retomar minha tela" → `POST /presenter { identity: null }`. Amigo "Devolver" → manda `devolver-tela` ao host, cujo cliente chama a mesma rota. Recusa → host manda `pedido-recusado`.
5. Amigo caiu → webhook `participant_left` com `identity === presenterIdentity` → o server volta a vez para o host.

Decisões de autoridade só passam pelo server. Mensagens de data channel são avisos; qualquer espectador pode mandar qualquer coisa, então nenhuma delas muda permissão.

**Host caiu.** O `emptyTimeout` não resolve, porque os espectadores continuam na sala. No `participant_left` do host o server agenda `deleteRoom` para 60s depois; se o host volta (`participant_joined`), cancela. Enquanto isso, quem assiste vê "O host perdeu a conexão. Esperando ele voltar."

## 7. Protocolo de data channel

Tópico `telando`, JSON validado com Zod em `core`. O remetente vem do LiveKit (`participant.identity`), nunca do corpo.

```ts
type MensagemSala =
  | { t: 'chat'; texto: string }          // 1..500 caracteres
  | { t: 'reacao'; emoji: Reacao }        // lista fechada
  | { t: 'pedido-tela' }
  | { t: 'pedido-cancelado' }
  | { t: 'pedido-recusado' }              // host → espectador
  | { t: 'devolver-tela' }                // presenter → host
```

## 8. Mídia

`core/transmissao` recebe `ConfigTransmissao` (preset ou valores manuais) e o tamanho real da fonte e devolve:

- `constraints` para `getDisplayMedia`/`applyConstraints` (sem upscale: limita à fonte e sinaliza `limitadoPelaFonte`);
- `contentHint` e `degradationPreference`;
- `TrackPublishOptions` do LiveKit: `videoCodec`, `backupCodec` (ligado quando o codec é AV1 ou VP9, para quem não decodifica receber VP8/H.264), `videoEncoding`, `screenShareSimulcastLayers`, `simulcast`, `dtx`, `red`, `audioPreset`;
- constraints de áudio do sistema (eco, ruído e ganho desligados) e do mic (ligados por padrão);
- o resumo "1080p · 60 fps · até 8 Mbps · áudio Música".

Ajustes ao vivo: resolução e fps por `applyConstraints`; bitrate por `sender.setParameters`; codec e fonte republicam a trilha na mesma sala.

## 9. Desktop

- `session.setDisplayMediaRequestHandler`: o renderer lista fontes por IPC (`desktopCapturer.getSources` com miniaturas a cada ~1s), o usuário escolhe, o renderer avisa o main da fonte escolhida e chama `getDisplayMedia`; o handler responde com a fonte e `audio: 'loopback'`.
- `contextIsolation`, `sandbox`, sem `nodeIntegration`; preload expõe uma API tipada mínima.
- Tray com "Parar compartilhamento" e atalho global `Ctrl+Alt+Shift+S`, registrado só durante a transmissão.
- Configurações persistidas com `electron-store`.

## 10. Testes

- **core:** Vitest para preset → opções, limite de upscale, resumo, parsing do protocolo e dos metadados.
- **server:** Vitest com um `SalaGateway` falso no lugar do `RoomServiceClient` (a única fronteira abstraída, porque o teste precisa dela). Cobre slug, segredo errado, trancar, rate limit, uma tela por vez, vez volta ao host, timer de queda do host.
- **E2E:** Playwright com Chromium (`--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`, `--auto-select-desktop-capture-source`) contra `livekit-server --dev` real. No CI o workflow baixa o binário Linux da mesma versão.

## 11. Fases

Seguem a seção 7 do prompt, com os cortes da seção 1 acima. Cada fase numa branch `fase-N`, PR, merge depois do `pre-push` verde.

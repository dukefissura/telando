# Fase 2: app desktop do host

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App Electron (Windows) que compartilha tela ou janela com áudio do sistema, com as configurações de transmissão da seção 3.1 do prompt, ajustes ao vivo sem derrubar ninguém e painel de estatísticas.

**Architecture:**
- `packages/core` ganha `transmissao.ts` (puro, sem LiveKit em runtime): config → constraints, encodings, camadas, áudio, resumo. Testado com Vitest.
- `packages/core/cliente` (subpath `@telando/core/cliente`, importa `livekit-client` e React): conversão para `TrackPublishOptions`, o hook `useTransmissao` (hoje em `apps/web`), volume e medidor de áudio, leitura de estatísticas. O server nunca importa esse subpath.
- `packages/ui`: telas do host (início, configurações, compartilhando, ajustes, estatísticas), usadas pelo web e pelo desktop. O que muda entre os dois entra por uma interface `Plataforma` (listar fontes, uso de CPU, onde guardar as preferências, atalho).
- `apps/desktop`: electron-vite. O main só faz o que exige Node/Electron: `desktopCapturer`, `setDisplayMediaRequestHandler` com `audio: 'loopback'`, tray, atalho global, `electron-store`, CPU. O renderer usa `packages/ui`.
- Server: CORS aberto em `/api` (não há cookie; a autorização é o `hostToken` no header) e `POST /api/teste-upload` para o teste de conexão.

**Tech Stack:** Electron 44, electron-vite 5, electron-store 11, livekit-client 2.22, React 19, Zustand 5.

## Global Constraints

- Presets exatamente como na tabela do prompt (Texto/código, Jogo, Filme/vídeo, Economia).
- Nunca faz upscale: alvo limitado à resolução da fonte, com aviso.
- Codec automático: AV1 → VP9 → H.264 conforme o encoder do host; `backupCodec` VP8 quando o escolhido for AV1 ou VP9.
- Áudio do sistema sempre com eco, ruído e ganho automático desligados. Microfone com os três ligados por padrão.
- "Personalizado" é derivado (nenhum preset bate com os valores), não guardado.
- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; IPC tipado só pelo preload; navegação e janelas novas bloqueadas.

---

### Task 1: `core/transmissao.ts` (TDD)

**Produces:**
```ts
type Resolucao = 'nativa' | '2160p' | '1440p' | '1080p' | '720p' | '480p'
type Fps = 5 | 15 | 30 | 60 | 120
type Otimizacao = 'nitidez' | 'fluidez' | 'equilibrio'
type Codec = 'auto' | 'av1' | 'vp9' | 'h264' | 'vp8'
type QualidadeAudio = 'voz' | 'musica' | 'alta'
type PresetId = 'texto' | 'jogo' | 'filme' | 'economia'
type ConfigTransmissao = { resolucao; fps; bitrateMaxKbps: number | 'auto'; otimizacao; codec; simulcast: boolean;
  mostrarCursor: boolean; audioSistema: boolean; volumeAudio: number; qualidadeAudio;
  microfone: { ativo: boolean; deviceId: string | null; cancelamentoEco: boolean; supressaoRuido: boolean; ganhoAutomatico: boolean } }
const PRESETS: Record<PresetId, { nome; resolucao; fps; bitrateMaxKbps; otimizacao; qualidadeAudio }>
configPadrao(): ConfigTransmissao                      // preset Texto/código, áudio do sistema ligado, simulcast ligado
aplicarPreset(config, id): ConfigTransmissao
presetAtual(config): PresetId | 'personalizado'
resolverTransmissao(config, fonte: { largura; altura }, codecsDoHost: string[]): TransmissaoResolvida
```
`TransmissaoResolvida`: `alvo {largura, altura}`, `limitadoPelaFonte`, `constraintsVideo`, `contentHint`, `degradacao`, `codec`, `backupCodec`, `bitrateKbps`, `camadas` (simulcast), `audio { bitrateKbps, estereo, dtx, red }`, `constraintsAudioSistema`, `constraintsMicrofone | null`, `resumo`.

Testes: cada preset gera o resumo da tabela ("1080p · 60 fps · até 8 Mbps · áudio Música"); fonte 1280×720 com 1080p pedido → alvo 1280×720 e `limitadoPelaFonte`; largura segue a proporção da fonte (ultrawide 3440×1440 em 1080p → 2580×1080, par); bitrate automático cresce com pixels e fps e fica entre 500 e 20000 kbps; codec automático escolhe o primeiro suportado entre av1, vp9, h264, cai para vp8; backup só para av1/vp9; mexer em fps tira do preset; otimização mapeia para contentHint/degradação; áudio do sistema nunca tem processamento; microfone desligado → `null`.

### Task 2: `@telando/core/cliente`

Move `use-transmissao.ts` de `apps/web` para cá e passa a receber `config` e `plataforma`. Adiciona:
- `opcoesDePublicacao(resolvida)` → `{ video: TrackPublishOptions, audio: TrackPublishOptions }` com `VideoPreset` para as camadas.
- `criarAudioComVolume(trilha)` → `{ trilha, definirGanho(0..1.5), nivel(): number, parar() }` com Web Audio.
- `lerEstatisticas(room)` → resolução, fps, bitrate de vídeo e áudio, codec em uso, perda, `limitacao` ('cpu' | 'banda' | null).
- Ajustes ao vivo: `aplicarAjustes(nova)`; resolução/fps por `applyConstraints`, bitrate por `setParameters` no sender; codec, fonte ou áudio sim/não republicam a trilha na mesma sala.

### Task 3: `packages/ui` e o web usando

Telas do host em `packages/ui/src/host/`: `TelaInicio`, `TelaConfiguracoes` (presets no topo, seções Fonte/Vídeo/Áudio recolhidas, prévia, resumo, teste de conexão, "Iniciar"), `TelaCompartilhando` (link, espectadores, "Ajustes" com painel lateral, estatísticas, "Parar"). `Plataforma` define `listarFontes?`, `escolherFonte?`, `usoDeCpu?`, `preferencias` (get/set). O web usa `localStorage`; sem `listarFontes`, a seção Fonte explica que o seletor final é o do navegador.

### Task 4: Server — CORS e teste de upload

`cors({ origin: '*' })` em `/api/*`. `POST /api/teste-upload` aceita até 2 MB, limite de 6 por minuto por IP, responde `{ bytes }`; o cliente mede o tempo. Testes: CORS responde ao preflight com `Authorization`; teste-upload conta os bytes; acima de 2 MB → 413.

### Task 5: `apps/desktop`

electron-vite com `src/main`, `src/preload`, `src/renderer`. Main: janela 420×640 redimensionável, CSP, bloqueio de navegação; IPC `fontes:listar` (miniaturas 320×180, ícones de janela, resolução do monitor via `screen`), `fontes:escolher`, `cpu:uso`, `preferencias:*` (`electron-store`); `setDisplayMediaRequestHandler` entregando a fonte escolhida e `audio: 'loopback'` quando pedido; tray com "Parar compartilhamento" e "Sair"; atalho global `Ctrl+Shift+S` que manda `atalho:parar` ao renderer. `VITE_TELANDO_SERVER` define o server (dev `http://localhost:8787`).

### Task 6: Verificação

- E2E web: configurações → preset Jogo → iniciar; espectador recebe; trocar fps ao vivo mantém o espectador recebendo.
- E2E desktop com `_electron.launch` do Playwright: escolher a primeira tela, iniciar, espectador no Chromium recebe vídeo; trocar resolução ao vivo; estatísticas batem com o alvo.
- `vibesec`/`security-review` (IPC e Electron), `simplify`, `code-review`, `finding-duplicate-functions`.

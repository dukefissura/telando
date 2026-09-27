# Fase 3: experiência de assistir

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quem assiste tem tela cheia, PiP, volume, qualidade, chat e reações, estados claros e indicador de conexão; o host vê quem está assistindo, remove pessoas e tranca a sessão.

**Architecture:**
- `core`: protocolo do data channel (`protocolo.ts`, Zod) e resumo das estatísticas de recebimento (`resumirRecebimento`), ambos puros e testados.
- `core/cliente`: `useChatSala(room)` (mensagens e reações efêmeras, só em memória) e `useQualidadeRecebida(publicacao)`.
- `server`: `PUT /sessions/:id/trancada`, `DELETE /sessions/:id/participantes/:identity`, e o timer de queda do host no webhook (`participant_left` do host agenda o fim em 60s; `participant_joined` cancela). O registro passa a guardar os metadados para atualizar a sala.
- `ui`: `PainelChat` e `ChuvaDeReacoes` usados pelo host e por quem assiste; lista de espectadores com "Remover" e "Trancar sessão" no host.
- `web`: `Palco` refeito (barra que some em 3s, volume, qualidade, PiP, tela cheia, indicador de conexão) e os estados: aguardando o host, host pausou, host caiu, reconectando, encerrada, removido, trancada, link inválido.

## Global Constraints

- Mensagens nunca são salvas: nada em disco, nada em `localStorage`.
- O remetente vem de `participant.identity` do LiveKit, nunca do corpo da mensagem.
- Chat: 1 a 500 caracteres. Reações: lista fechada.
- Remover e trancar exigem o `hostToken`; mensagens de data channel não mudam nada no server.
- Só PC (sem layout de celular).

---

### Task 1: Protocolo e estatísticas de recebimento (core, TDD)
`codificarMensagem(m) → Uint8Array`, `lerMensagem(bytes) → MensagemSala | null` com `{ t: 'chat', texto } | { t: 'reacao', emoji }`. `REACOES`. `resumirRecebimento(relatorio, anterior, agoraMs)` → `{ largura, altura, fps, kbps, perdaPct }` a partir do `inbound-rtp` de vídeo.

### Task 2: Server — trancar, remover, queda do host (TDD)
`SalaGateway` ganha `atualizarMetadata(id, metadata)` e `remover(id, identity)`. Trancada → join responde 423 `sessao_trancada`. Remover exige host e não aceita remover o próprio host. Webhook: `participant_left` com a identity do host agenda `apagar` em 60s (relógio injetável); `participant_joined` do host cancela; `room_finished` limpa o timer.

### Task 3: Cliente — chat e qualidade
`useChatSala(room)`: `mensagens` (máx. 100 em memória), `reacoes` recentes, `enviarChat`, `reagir`. API do core: `trancarSessao`, `removerParticipante`.

### Task 4: Telas
Host: lista de espectadores com "Remover", alternador "Trancar sessão", chat. Assistir: palco novo, chat recolhível, reações flutuando, estados.

### Task 5: Verificação
E2E: chat vai e volta entre host e espectador; host remove um espectador (ele vê "Você foi removido"); com a sessão trancada, um novo espectador vê "Sessão trancada"; host pausa e o espectador vê "O host pausou o compartilhamento". `design-auditor` nas telas, `simplify`, `code-review`.

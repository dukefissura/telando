# Fase 3b: link fixo e revezamento

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/luan` sempre leva à transmissão atual do Luan (e espera por ela se ele estiver offline); um espectador pede para compartilhar, o host aprova e todo mundo passa a ver a tela do amigo.

**Architecture:**
- `server/links.ts`: registro dos links fixos em `data/links.json` (`slug → { nome, salt, hash }`, scrypt), gravado em arquivo temporário + `rename`. O "ao vivo" (`slug → sessionId`) fica em memória, com ouvintes SSE. Quando a sessão acaba (DELETE, `room_finished`, queda do host), o link volta a offline.
- `server/presenter`: `POST /sessions/:id/presenter` troca permissões no LiveKit (`updateParticipant`) e grava `presenterIdentity` nos metadados. `participant_left` do apresentador devolve a vez ao host.
- `core/protocolo`: mensagens `pedido-tela`, `pedido-cancelado`, `pedido-recusado`, `devolver-tela`. Avisos apenas; quem muda permissão é o server.
- Desktop: segredo do link gerado no main, guardado com `safeStorage`; tela "Meu link fixo" (nome e slug); alternador "Usar link fixo nesta transmissão".
- Web: rota `/:slug` com espera por SSE e entrada automática; no palco, "Pedir para compartilhar", painel "Você foi aprovado" com presets reduzidos, "Devolver".
- Host: pedidos com Aprovar/Recusar e som discreto; a própria tela pausa enquanto outro apresenta; "Retomar minha tela".

## Global Constraints

- Slug: 3 a 20 caracteres, `a-z 0-9 -`, sem hífen nas pontas; proibidos `s api admin assets updates health livekit app static`.
- Segredo do link: 43+ caracteres (32 bytes base64url); o server guarda só scrypt com salt e compara em tempo constante.
- Apontar o link exige o segredo **e** o `hostToken` da sessão apontada.
- Só o host passa a vez; a vez só vai para alguém que está na sala e não é o host; uma tela por vez.
- Apresentador pode publicar só `SCREEN_SHARE` e `SCREEN_SHARE_AUDIO`.

---

### Task 1: Links no server (TDD)
Testes: slug inválido → 400; proibido → 400; reservar → 201, arquivo não contém o segredo; mesmo segredo → 200 e atualiza o nome; outro segredo → 409; GET → `{ nome, aoVivo: false }`; 404 para livre; apontar com segredo errado → 403, com hostToken de outra sessão → 403, certo → 204 e GET mostra `aoVivo: true, sessionId`; DELETE live → offline; encerrar a sessão → offline; SSE manda `status` ao apontar; o registro sobrevive a reiniciar o server (lê o arquivo).

### Task 2: Presenter no server (TDD)
Testes: só host; identity fora da sala → 404 `participante_nao_encontrado`; o próprio host → 400; aprovar A depois B revoga A; `null` revoga e limpa; `participant_left` do apresentador → vez volta ao host; metadados refletem `presenterIdentity`.

### Task 3: Protocolo e cliente (core)
Mensagens novas com teste. API: `reservarLink`, `estadoDoLink`, `apontarLink`, `desapontarLink`, `passarVez`.

### Task 4: Desktop e host
Link fixo: IPC `link:segredo`, `link:ler`, `link:gravar`; tela "Meu link fixo"; alternador na configuração; o painel mostra o link fixo em destaque. Revezamento: pedidos, aprovar/recusar, pausa automática, "Retomar minha tela", devolução automática quando o amigo manda `devolver-tela`.

### Task 5: Web
`/:slug` com espera e entrada automática; palco escolhe a tela de `presenterIdentity ?? hostIdentity`, avisa "Agora: tela de X"; pedir/cancelar; aprovado → escolhe preset e áudio → compartilha; "Devolver".

### Task 6: Verificação
E2E: `/:slug` com host offline espera e entra sozinho; revezamento com três abas (host, amigo que pede, terceira que passa a ver a tela do amigo); devolver; amigo cai e a vez volta. `vibesec` + `security-review`, `simplify`, `code-review`, `finding-duplicate-functions`.

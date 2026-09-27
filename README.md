# Telando

Mostra a sua tela para os amigos por um link. Eles abrem no navegador do computador e assistem, sem instalar nada.

Em construção. O plano completo está em [`docs/superpowers/specs`](docs/superpowers/specs).

## Rodar localmente

Precisa de Node 22 ou mais novo e pnpm (`npm i -g pnpm`).

```bash
pnpm install
cp .env.example .env
pnpm dev:livekit   # num terminal: baixa e roda o LiveKit em modo dev
pnpm dev           # em outro: server em :8787 e site em http://localhost:5173
```

O `pnpm dev:livekit` baixa o binário oficial do LiveKit na primeira vez, para `.livekit/`. Se você preferir Docker: `docker compose -f infra/docker-compose.dev.yml up`.

Para o app desktop (Windows), com o LiveKit e o server rodando: `pnpm dev:desktop`. O atalho `Ctrl+Alt+Shift+S` para a transmissão de qualquer lugar.

## Testes

O hook `pre-push` roda os três antes de cada push.

```bash
pnpm lint
pnpm typecheck
pnpm test
```

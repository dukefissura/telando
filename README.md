# Telando

Mostra a sua tela para os amigos por um link. Eles abrem no navegador do computador e assistem, sem instalar nada.

Quem compartilha usa o app para Windows ou o próprio navegador. O vídeo passa por um servidor [LiveKit](https://livekit.io). O que mudou em cada versão está no [CHANGELOG](CHANGELOG.md), e o porquê das escolhas em [`docs/decisoes.md`](docs/decisoes.md).

## Rodar localmente

Precisa de Node 22 ou mais novo e pnpm (`npm i -g pnpm`).

```bash
pnpm install
cp .env.example .env
pnpm dev:livekit   # num terminal: baixa e roda o LiveKit em modo dev
pnpm dev           # em outro: server em :8787 e site em http://localhost:5173
```

O `pnpm dev:livekit` baixa o binário oficial do LiveKit na primeira vez, para `.livekit/`. Se você preferir Docker: `docker compose -f infra/docker-compose.dev.yml up`.

Para o app desktop, com o LiveKit e o server rodando: `pnpm dev:desktop`. O atalho `Ctrl+Alt+Shift+S` para a transmissão de qualquer lugar.

### Como fica em produção, na sua máquina

Um processo só entrega a API e o site, com os cabeçalhos de segurança de produção:

```bash
pnpm --filter @telando/web build
cd apps/server
WEB_DIST=../web/dist PUBLIC_BASE_URL=http://localhost:8787 node src/main.ts
```

O site fica em http://localhost:8787.

## Testes

O hook `pre-push` roda os três antes de cada push.

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Os testes de ponta a ponta abrem o Chromium e o app desktop com tela e microfone falsos. Eles sobem o LiveKit, o server e o site sozinhos (ou usam os que já estiverem rodando):

```bash
pnpm e2e
```

Para rodar contra o modo produção, suba o server como acima e use `E2E_BASE_URL=http://localhost:8787 pnpm e2e`.

## Instalador do Windows

```bash
cd apps/desktop
pnpm instalador
```

O instalador sai em `apps/desktop/release/Telando-Setup-<versão>.exe`. Sem configurar nada, o app aponta para `http://localhost:8787`; serve para testar na própria máquina.

Para publicar uma versão:

1. Suba a `version` em `apps/desktop/package.json`.
2. Rode, apontando para o servidor de produção:

   ```bash
   VITE_TELANDO_SERVER=https://telando.exemplo.com GH_TOKEN=$(gh auth token) pnpm publicar
   ```

   O script recusa rodar sem um endereço `https://`, para nenhuma versão sair apontando para localhost.
3. O electron-builder cria um rascunho de release no GitHub com o instalador. Confira e publique: `gh release edit v<versão> --draft=false`.

O app instalado procura atualização ao abrir, nos releases públicos deste repositório, e se atualiza sozinho.

O instalador não é assinado, então o Windows SmartScreen avisa na primeira execução ("Mais informações" → "Executar assim mesmo"). Um certificado de assinatura de código resolve isso.

## Colocar no ar

### Numa VPS com Docker

Os arquivos estão em [`infra/producao`](infra/producao). Eles sobem o LiveKit, o server (que também entrega o site) e o Caddy, que cuida do HTTPS. **Ainda não foram testados num servidor de verdade**: a instalação das dependências da imagem foi conferida, mas o Docker em si não.

Você precisa de:

- uma VPS Linux com IP público (2 vCPU e 2 GB dão conta de algumas transmissões ao mesmo tempo);
- dois domínios apontando para ela, um para o site e outro para o LiveKit (por exemplo `telando.exemplo.com` e `livekit.telando.exemplo.com`);
- o firewall liberando só estas portas (o LiveKit escuta também na 7880, que precisa ficar fechada: ela passa pelo Caddy):

  | Porta | Para quê |
  | --- | --- |
  | 80 e 443/TCP | site, API e sinalização do LiveKit (Caddy) |
  | 7881/TCP | vídeo por TCP, quando o UDP está bloqueado |
  | 3478/UDP | TURN, para quem está atrás de NAT difícil |
  | 50000–60000/UDP | vídeo |

Depois:

```bash
cd infra/producao
cp .env.example .env   # preencha os domínios e gere a chave e o segredo do LiveKit
docker compose up -d --build
```

Os links fixos ficam no volume `dados`. Todo o resto vive na memória: reiniciar o server encerra as transmissões em andamento.

### Com o LiveKit Cloud

Em vez de rodar o LiveKit, dá para usar o [LiveKit Cloud](https://cloud.livekit.io), que já tem TURN na porta 443 e servidores em várias regiões.

1. Crie um projeto e gere uma chave de API.
2. No `.env`, use a chave e o segredo do projeto. No `docker-compose.yml`, troque `LIVEKIT_URL` pelo endereço `wss://` do projeto e apague a linha `LIVEKIT_API_URL`.
3. Apague o bloco do `LIVEKIT_DOMINIO` no `Caddyfile` e suba só o server e o Caddy: `docker compose up -d --build server caddy`.
4. No painel do projeto, cadastre o webhook `https://telando.exemplo.com/api/livekit/webhook`.

O server apaga todas as salas do LiveKit ao iniciar, então o projeto do Cloud precisa ser só do Telando.

## Limitações

- **Só computador.** O app de compartilhar é só para Windows; a página de assistir é feita para o navegador do computador.
- **Som do computador pelo navegador** só no Chrome e no Edge.
- **Sem TURN na porta 443** no compose da VPS. Redes que só liberam a porta 443 (algumas empresas e faculdades) podem não conseguir assistir. O LiveKit Cloud resolve isso.
- **Sem contas.** Quem é removido de uma sessão pode voltar pelo link; trancar a sessão impede.
- **Um servidor só.** As sessões vivem na memória do processo, então não dá para ter duas instâncias do server lado a lado.

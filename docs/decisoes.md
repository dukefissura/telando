# Decisões

Quando havia duas opções razoáveis, ficou a mais simples. Cada linha diz o que foi escolhido e por quê.

## Escopo (2026-09-27, com o Luan)

- **Nome Telando**, repositório público `dukefissura/telando`. Começou privado, mas o GitHub Actions não roda nos repositórios privados da conta; no público ele é gratuito e a proteção de branch funciona.
- **Só PC.** App desktop só para Windows (instalador NSIS). A página de assistir é pensada para navegador de computador. Saem macOS, Linux, layout de celular e QR code.
- **Auto-update pelo GitHub Releases**, como no prompt original: com o repositório público não precisa de token dentro do app.
- **LiveKit no dev sem Docker.** `pnpm dev:livekit` baixa o binário oficial e roda em `--dev`. O `docker-compose.dev.yml` continua para quem tem Docker.
- **Produção em aberto** entre VPS e LiveKit Cloud. O código não depende da escolha.

## Técnicas

- **Rotas da API sob `/api`.** O mesmo server serve o site, que tem rotas `/:slug` para os links fixos.
- **Estado compartilhado nos metadados da sala do LiveKit**, escritos só pelo server. Evita uma segunda conexão (SSE) para quem já está na sala e impede que um espectador forje "fui aprovado" pelo data channel.
- **`hostToken` é um segredo opaco, separado do JWT do LiveKit.** O JWT expira em minutos; o host precisa encerrar a sessão horas depois.
- **Queda do host:** o `emptyTimeout` do LiveKit não dispara porque os espectadores continuam na sala. O server agenda o fim da sessão 60s depois do `participant_left` do host.
- **`backupCodec` no codec automático.** O LiveKit não converte codec; sem isso, quem não decodifica AV1 não veria nada.
- **Pacotes internos exportam TypeScript direto.** Vite, tsx e Vitest compilam; não há passo de build só para o monorepo.
- **TypeScript 7** (compilador nativo), porque é a versão estável atual e só usamos o `tsc` para checar tipos.
- **`react-router`** em vez de TanStack Router: três rotas não justificam roteamento tipado.

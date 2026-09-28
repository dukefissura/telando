# Telando

Mostre a sua tela para os amigos por um link. Você compartilha pelo app, manda o link, e o Telando deles abre direto na sua transmissão.

- Escolha a tela ou a janela pela miniatura, com o som do computador junto.
- Um link fixo seu (`/seu-nome`) que os amigos salvam e que entra sozinho quando você fica ao vivo.
- Quem assiste pode pedir a vez e mostrar a própria tela.
- Fica na bandeja do Windows enquanto transmite.

Só para Windows. As novidades de cada versão estão no [CHANGELOG](CHANGELOG.md).

## Baixar

Baixe o instalador na [página de releases](https://github.com/dukefissura/telando/releases/latest). Como ele ainda não é assinado, o Windows pode avisar na primeira vez: clique em "Mais informações" e depois em "Executar assim mesmo".

## Desenvolver

Precisa de Node 22 ou mais novo e pnpm (`npm i -g pnpm`).

```bash
pnpm install
cp .env.example .env
pnpm dev:livekit   # num terminal: baixa e roda o LiveKit em modo de desenvolvimento
pnpm dev           # em outro: o server e a página do site
pnpm dev:desktop   # e o app
```

Para testar quem assiste na mesma máquina, abra um segundo app com outro perfil e cole o link em "Entrar com um link":

```bash
pnpm --filter @telando/desktop build
TELANDO_PERFIL=/tmp/telando-amigo pnpm --filter @telando/desktop exec electron .
```

Testes (o hook `pre-push` roda os três primeiros):

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm e2e   # abre apps de verdade e captura a tela
```

# Assistir no app (Fase 6)

Decisão do usuário em 2026-09-28: tudo acontece no app desktop. Quem compartilha e quem assiste usam o Telando para Windows; o navegador deixa de ser um jeito de assistir ou de compartilhar. Isso substitui, na spec original, a página de assistir no navegador e o plano B de compartilhar pelo navegador.

## O que muda para quem usa

- Você compartilha no app e manda o link de sempre (`https://<domínio>/s/<id>` ou o link fixo `https://<domínio>/<slug>`).
- Seu amigo clica no link. A página tenta abrir o Telando (`telando://…`); o Windows abre o app direto na tela de assistir. Se ele ainda não tem o app, a mesma página mostra o botão de baixar o instalador.
- Dentro do app também dá para colar o link num campo "Entrar com um link".
- Assistir fica igual ao que era no navegador: apelido, vídeo, volume, qualidade, tela cheia, picture-in-picture, indicador de conexão, chat, reações, pedir a vez. O som toca sem clique.
- Pedir a vez usa o seletor de telas e janelas do app, com miniaturas e som do computador.
- O app abre grande, maximizado, e as telas usam o espaço; acabou a janela estreita.

Por que o link continua `https://`: WhatsApp, Discord e afins não transformam `telando://` em link clicável.

## Arquitetura

### Pacotes

- **`packages/ui/src/assistir/`** recebe o que hoje está em `apps/web/src/assistir/` (`Assistir`, página do link fixo, `Palco`, barra de controles, revezamento, indicador de conexão, avisos, `useSalaEspectador`). O acesso à API passa a vir da `Plataforma` (hoje os arquivos importam `apps/web/src/api.ts`).
- **`Plataforma`** deixa de ter campos opcionais que só existiam por causa do navegador: `fontes`, `usoDeCpu`, `linkFixo`, `aoMudarTransmissao` e `aoAtalhoParar` passam a ser obrigatórios.
- **`packages/core`** ganha:
  - `destinoDoLink(texto)`: lê um link colado ou recebido pelo protocolo e devolve `{ tipo: 'sessao', id }`, `{ tipo: 'linkFixo', slug }` ou `null`. Aceita `https://<qualquer domínio>/s/<id>`, `https://<qualquer domínio>/<slug>`, `telando://s/<id>` e `telando://<slug>`. Valida o formato do id e do slug (mesmas regras do server); o domínio é ignorado, porque o app só fala com o próprio server.
  - No cliente da API, o endereço do SSE do link fixo (`/api/links/:slug/events`), que hoje é relativo à página.

### App desktop

- **Telas** (estado no renderer, sem roteador; são três):
  1. `Início`: o `AppHost` de hoje, com o campo "Entrar com um link".
  2. `Assistindo`: `Assistir` com o id da sessão.
  3. `Esperando`: a página do link fixo, que entra sozinha quando o dono fica ao vivo.

  Voltar de uma sessão encerrada ou de um link inválido leva ao `Início`.
- **Protocolo `telando://`**:
  - Só o instalador registra o protocolo no Windows (`protocols` no `electron-builder.yml`). No dev, o app não mexe no registro, para não roubar o protocolo do app instalado; os testes entregam o link pelos argumentos.
  - O main lê o link no `process.argv` ao abrir e no evento `second-instance` quando o app já está aberto. Ele manda o texto ao renderer por um canal de IPC novo (`link:abrir`), que só aceita strings curtas; quem interpreta é `destinoDoLink`.
  - Links que chegam antes de a janela carregar ficam guardados e são entregues quando o renderer pede (`link:pendente`).
- **Enquanto você transmite**, um link recebido não derruba a transmissão: aparece "Pare a sua transmissão para assistir" e nada muda.
- **Janela grande, sempre** (pedido do usuário: nada do formato estreito de hoje). O app abre maximizado, com tamanho mínimo de 960×600; ao restaurar, a janela fica em 1280×800 centralizada. O main guarda se a janela estava maximizada e o tamanho dela (`electron-store`) e reabre igual.
- **Telas de quem compartilha usam a largura.** Hoje elas são uma coluna de ~33rem pensada para a janela de 460px. Passam a ter um layout para janela grande, seguindo `docs/design.md`:
  - Configurações: fonte à esquerda, com a grade de miniaturas em mais colunas; vídeo, áudio e o resumo numa coluna à direita.
  - Compartilhando: link, estado ao vivo e controles numa coluna; espectadores, pedidos e chat em outra.
  - Início: centralizado, sem esticar.
  - Abaixo de ~1100px de largura, tudo volta a ser uma coluna só.
- **Som sem clique:** `autoplayPolicy: 'no-user-gesture-required'` na janela. Sai o aviso "Clique para ativar o som".
- **SSE e LiveKit:** a CSP do renderer já libera `https:`/`wss:` e localhost; nada muda.
- **Revezamento:** quem foi aprovado vê a grade de fontes (o `PainelFonte` do host), o tipo de conteúdo e "Compartilhar o áudio". A fonte é escolhida por `plataforma.fontes.escolher` antes do `getDisplayMedia`, como no host.

### Site (`apps/web`)

Encolhe para uma página. Em `/`, `/s/:id` e `/:slug`, ela mostra o nome Telando, uma frase do que é, "Abrir no Telando" e "Baixar para Windows". Nas rotas de link, ao carregar, ela tenta `telando://s/<id>` ou `telando://<slug>` uma vez; o botão repete a tentativa. Sem livekit-client, sem chamadas à API. O download aponta para `https://github.com/dukefissura/telando/releases/latest/download/Telando-Setup.exe`, e o `artifactName` do instalador passa a ser fixo (`Telando-Setup.exe`).

Saem do site: `plataforma-web.ts`, a tela de compartilhar (`AppHost`) e toda a pasta `assistir/`.

### Server

- A API não muda.
- `criarSite` perde o parâmetro `livekitUrl`: a página não fala mais com o LiveKit, então a CSP fica com `connect-src 'self'`.
- Os links continuam montados com `PUBLIC_BASE_URL`.

## Erros

- Link colado que não é do Telando: "Esse link não é de uma transmissão do Telando."
- Sessão encerrada, inválida, trancada, removido, queda: os mesmos avisos de hoje, agora com um botão "Voltar ao início".
- App sem conexão com o server ao abrir um link: a mensagem de sempre do cliente da API ("Não consegui falar com o servidor…"), com "Tentar de novo".

## Testes

- **Visual:** capturas das telas de quem compartilha e de quem assiste em janela maximizada (1920×1080) e em 1100px, nos dois temas, conferidas antes do PR.
- **Unitários:** `destinoDoLink` (formatos aceitos, lixo, slug e id inválidos) no core; `criarSite` sem LiveKit na CSP no server.
- **E2E:** as specs que usam o navegador como host e como espectador passam a abrir dois apps Electron, cada um com o próprio perfil.
  - O perfil vem de uma variável `TELANDO_PERFIL`, que o main aplica com `app.setPath('userData', …)` antes do `requestSingleInstanceLock`. Sem ela, nada muda. É o único jeito de ter duas instâncias na mesma máquina.
  - A captura é a da tela real, como já é hoje no teste do desktop.
  - Cenários que continuam: compartilhar e assistir com vídeo e áudio, ajustes ao vivo, chat e reações, trancar e remover, pausa, revezamento (aceitar, recusar, quem apresenta sai), link fixo que espera o dono.
  - Cenários novos: um link `telando://` entregue a um app já aberto (segunda instância com o mesmo perfil) abre a tela de assistir; a página do site aponta para o protocolo e para o download.

## Fora do escopo

- Instalar o app automaticamente a partir do link.
- macOS/Linux (continua só Windows).
- Mais de uma coisa ao mesmo tempo no mesmo app (assistir e transmitir juntos).

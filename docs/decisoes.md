# Decisões

Quando havia duas opções razoáveis, ficou a mais simples. Cada linha diz o que foi escolhido e por quê.

## Escopo (2026-09-27, com o Luan)

- **Nome Telando**, repositório público `dukefissura/telando`.
- **Sem GitHub Actions.** A conta está com o Actions travado por cobrança e o Luan preferiu não usar. O hook `pre-push` do Lefthook roda lint, typecheck e testes; os instaladores são gerados localmente e publicados com `gh release` na Fase 5. Sem CI não há proteção de branch: cada fase ainda entra por PR, mas o merge depende do `pre-push` ter passado.
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
- **No boot o server apaga todas as salas do LiveKit.** O registro de sessões vive em memória, então salas de um processo anterior ficam sem dono. Isso pressupõe um LiveKit exclusivo do Telando; se a produção usar um projeto compartilhado do LiveKit Cloud, é preciso trocar por um prefixo no nome das salas.
- **Link recarregado perde a transmissão.** Recarregar a página do host perde a captura de qualquer jeito, então o `hostToken` não é guardado no navegador; fechar a aba encerra a sessão (`pagehide` + `keepalive`).

## Fase 2

- **Sem opção "Mostrar cursor".** O Chromium (e portanto o Electron) não aceita esconder o cursor na captura de tela: a constraint `cursor` é ignorada e o `desktopCapturer` não tem essa opção. Melhor não oferecer um controle que não faz nada.
- **Teste de conexão mede só o upload até o server.** Testar a conexão com o LiveKit antes de iniciar exigiria uma sala; ela é testada de fato ao iniciar, e o erro aparece na hora.
- **Sem Zustand por enquanto.** O estado da transmissão vive num hook e numa classe; nenhuma tela distante precisa dele. Entra quando houver estado compartilhado de verdade.
- **Estatísticas mostram a camada mais alta que está saindo.** Com simulcast, o dynacast do LiveKit pausa a camada cheia quando nenhum espectador precisa dela; mostrar o que sai de verdade é o combinado.
- **`ELECTRON_RUN_AS_NODE`.** Processos filhos do VS Code herdam essa variável, que faz o Electron rodar como Node puro. O E2E do desktop remove a variável ao abrir o app.
- **O desktop fica fora do `pnpm dev`.** Abrir uma janela Electron a cada `pnpm dev` atrapalha quem só mexe no site; ele tem o próprio `pnpm dev:desktop`.

## Fase 3

- **Chat e reações por text streams do LiveKit, não por `publishData`.** O LiveKit avisa sobre participantes que só assistem com alguns segundos de atraso; com `publishData`, a mensagem chegava sem remetente e era descartada. O handler de text stream sempre traz a identity de quem mandou, e o apelido é resolvido quando o participante aparece.
- **A contagem de espectadores no host pode atrasar uns 2 segundos.** É o mesmo agrupamento do LiveKit; não vale a pena contornar.
- **Espectador sem `adaptiveStream`.** Com ele ligado, o LiveKit nunca manda mais que o tamanho do player e "Alta" não teria efeito. "Automática" faz o papel dele com um `ResizeObserver` que pede o tamanho do player; "Alta", "Média" e "Baixa" pedem a camada direto. O LiveKit ainda reduz quando falta banda.
- **Trancar e remover mudam a sessão pelo server.** Trancar grava `trancada` nos metadados da sala; o join passa a responder 423. Remover usa o `removeParticipant` do LiveKit, e quem sai vê "Você foi removido".
- **Quem é removido pode voltar pelo link.** Sem contas, não há como reconhecer a pessoa numa nova entrada. O alternador "Trancar sessão" diz isso na descrição; trancar resolve.
- **Queda do host guiada pelo `sid` da conexão.** Webhooks podem chegar fora de ordem; a saída de uma conexão antiga do host é ignorada se ele já voltou com outra.

## Fase 3b

- **Link fixo só no desktop.** O segredo que prova quem é o dono é gerado no processo principal e guardado com `safeStorage` (DPAPI do Windows). O site não oferece link fixo.
- **A página do link fixo entra sozinha.** Quem abre `/luan` com o dono offline já escolhe o apelido; quando ele começa, a página conecta sem clique. Se o navegador bloquear o som, aparece "Clique para ativar o som". Quando a transmissão acaba, a página volta a esperar a próxima.
- **Reservas de link em fila e gravação que desfaz ao falhar.** Duas pessoas pedindo o mesmo link livre ao mesmo tempo: só uma leva. Se o disco falhar, a reserva não fica valendo só na memória.
- **Espectador sai na hora ao fechar a aba** (`pagehide`). Sem isso, o LiveKit só percebe a saída uns 20 segundos depois, o que atrasava devolver a vez quando quem apresentava fechava a aba. Uma queda de rede de verdade continua levando esses 20 segundos.
- **O sid de cada conexão decide se uma saída vale.** Vale para o host (timer de queda) e para quem apresenta (a vez volta ao host).
- **Limite de sessões por IP configurável** (`SESSOES_POR_MINUTO`, padrão 10). Os testes E2E sobem o server com um valor alto.
- **Cache do Turborepo por dependência.** `typecheck` e `test` dependem das mesmas tarefas dos pacotes internos; antes, mudar o `core` não invalidava o cache da `ui` e escondia erros.

## Fase 4

- **Direção visual em `docs/design.md`**, com o que foi aproveitado de cada referência. Destaque azul-sinal (`#3B9EFF` / `#0B6BDB`), usado só na ação principal, no anel de foco e no endereço do link fixo.
- **Tema claro de verdade**, com tokens próprios e contraste conferido; o escuro continua padrão. A escolha fica no `localStorage` do navegador (e do app), e o tema aplicado na página é a fonte da verdade do botão.
- **Fontes Geist pelo Fontsource**, empacotadas com o app: nada de fonte vinda de CDN, o que também respeita a CSP do desktop.
- **Sem QR code nem tela de permissão do macOS**, pela decisão de ser só PC.
- **A página de entrar pergunta ao server antes** (`GET /api/sessions/:id`): mostra quem está compartilhando, e um link morto ou uma sessão trancada aparecem sem clique.
- **Aviso de queda de qualidade só depois de 5 segundos seguidos.** No começo de toda transmissão o WebRTC relata limitação de banda enquanto estima a conexão.

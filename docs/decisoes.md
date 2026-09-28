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

## Fase 5

- **Sem GitHub Actions.** A verificação roda no `pre-push` do Lefthook (lint, typecheck e testes), e os instaladores são gerados na máquina de quem publica. O E2E fica manual (`pnpm e2e`) porque precisa de LiveKit e abre janelas.
- **Um processo entrega API e site em produção** (`WEB_DIST`), com CSP estrita: scripts só da própria origem, conexões só para ela e para o LiveKit, sem iframe. Menos uma peça para configurar que um servidor estático separado.
- **O server roda TypeScript direto no Node 24**, sem etapa de build. Por isso o código usa só sintaxe que o Node sabe apagar (`erasableSyntaxOnly`), e a imagem Docker instala o `core` como workspace, não copiado para `node_modules` (onde o Node não remove tipos).
- **Instalador NSIS de um clique, por usuário**, sem pedir administrador. As dependências do processo principal vão dentro do bundle do electron-vite; o instalador não leva `node_modules`.
- **Atualização automática pelos releases públicos do GitHub** (`electron-updater`). Sem internet ou sem release novo, o app só registra e segue. O `publicar` exige `VITE_TELANDO_SERVER` com `https://` para nenhuma versão sair apontando para localhost.
- **Instalador sem assinatura de código.** O SmartScreen avisa na primeira execução; um certificado custa caro para um projeto pequeno. Fica anotado no README.
- **Compose de produção em `network_mode: host`.** O LiveKit precisa de uma faixa grande de portas UDP, e assim o `ufw` da máquina vale para todos os serviços (portas publicadas pelo Docker passam por fora dele). As chaves do LiveKit entram pela variável `LIVEKIT_CONFIG`, montada pelo Compose a partir do `.env`, sem arquivo de configuração com segredo.
- **Sem TURN/TLS na porta 443 no compose da VPS.** Dividir a 443 entre o Caddy e o TURN exige roteamento por SNI (Caddy com o módulo layer4) ou um IP a mais. Fica TURN por UDP na 3478 e ICE por TCP na 7881; quem precisar da 443 usa o LiveKit Cloud, e o README explica os dois caminhos.
- **Os arquivos de produção não foram testados num servidor.** A instalação das dependências da imagem foi simulada numa cópia limpa (o server subiu com 18 MB de `node_modules`), mas não havia Docker nem VPS disponíveis.

## Fase 6

- **Tudo no app** (pedido do usuário em 2026-09-28): quem assiste também usa o Telando para Windows. Saem assistir e compartilhar pelo navegador, a `plataforma-web` e o aviso "Clique para ativar o som". A `Plataforma` perde os campos opcionais que só existiam por causa do navegador.
- **O link continua `https://`.** WhatsApp, Discord e afins não transformam `telando://` em link clicável. A página do site lê o link, tenta o protocolo uma vez e oferece o instalador (`releases/latest/download/Telando-Setup.exe`, por isso o nome do instalador é fixo).
- **`destinoDoLink` ignora o domínio.** O app só fala com o próprio server, então só o caminho importa; id e slug seguem as mesmas regras do server.
- **Só o instalador registra `telando://`.** No dev, o app não mexe no registro do Windows, para não roubar o protocolo do app instalado. Os testes entregam o link pelos argumentos e pela segunda instância.
- **Um link nunca derruba uma transmissão.** Qualquer página pode abrir `telando://`; com o app ao vivo, o link só mostra "Pare a sua transmissão para assistir". Um link de sessão também nunca entra sem o clique em "Assistir"; só a espera do link fixo entra sozinha, como já era no navegador.
- **`TELANDO_PERFIL` troca a pasta de dados do app**, aplicada antes do `electron-store` e do lock de instância única. É o único jeito de ter dois apps na mesma máquina, o que os testes E2E e quem desenvolve precisam para fazer o papel de quem compartilha e de quem assiste.
- **Som sem clique** com `autoplayPolicy: 'no-user-gesture-required'` na janela do app.
- **Janela maximizada, mínimo 960×600**, lembrando o último estado. Telas de quem compartilha em duas colunas a partir de 1100px.
- **Movimento do handoff de design (1a–1j).** O texto da espera do link fixo virou "Deixe o Telando aberto: ele entra na transmissão assim que começar.", porque não há mais página. O selo do palco aparece assim que o host está na sala (antes esperava o primeiro quadro), para o endereço do canal ter para onde voar. Os testes rodam com `reducedMotion: 'reduce'`.
- **Quem entra com a tela parada vê a imagem na hora.** Suspeitei que, sem quadros novos, quem entra depois esperaria até a tela mudar. Medido na fase 7 com uma janela totalmente parada: a primeira imagem chega em uns 1,2 s. As falhas que levantaram a suspeita eram o tempo curto do teste com três apps abrindo juntos.

## Fase 7

- **Medir antes de otimizar.** `MEDIR=1 pnpm e2e -- desempenho` mede a abertura, a CPU e a memória privada do app (parado, nas configurações, transmitindo, assistindo) e o tempo até a primeira imagem de quem assiste. A memória contada é a privada: o working set repete, em cada processo, as DLLs do Chromium e fazia o app parecer ter o dobro.
- **Minificar o main e o renderer.** O electron-vite não minifica por padrão: o JS do app caiu de 2,4 MB para 1,1 MB e o main de 920 KB para 252 KB. O `electron-updater`, metade do main, só é carregado no app instalado, depois que a janela abre.
- **Só o subconjunto latino das fontes.** Cobre todo o português; os outros alfabetos iam no pacote sem uso.
- **Só as traduções pt-BR e en-US do Chromium** no instalador (`electronLanguages`): instalador de 112 para 103 MB, instalado de 371 para 323 MB.
- **Miniaturas das fontes em JPEG e ícones em cache.** A grade atualiza a cada segundo; antes eram PNGs e os ícones de todas as janelas a cada volta.
- **Preview ao vivo** da fonte escolhida, pedido na taxa do monitor. A captura de tela do Chromium entrega no máximo uns 60 quadros por segundo (medido: aceita pedidos até 120, entrega 60, com WGC e com DXGI), então num monitor de 60 Hz o preview é o nativo, e acima disso fica em 60, que também é o teto da transmissão.
- **Codificação por software.** Mesmo com a GPU liberada (fora dos testes a aceleração de vídeo está ligada), o WebRTC do Electron usou OpenH264, libaom e libvpx em compartilhamento de tela, com e sem simulcast, e com os ajustes de recurso do Chromium testados. Fica como está até haver evidência de um caminho de hardware que funcione.
- **Os testes E2E rodam sem GPU de vídeo** (o Playwright abre o Electron assim). Números de CPU de codificação dos testes não valem para o uso real; os de abertura e memória valem.

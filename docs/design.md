# Design do Telando

## O que é e para quem

Uma pessoa mostra a tela para os amigos por um link. Cada tela tem um trabalho só: no host, **começar e mandar o link**; em quem assiste, **ver a tela do amigo**. A interface quase some; a tela compartilhada é o conteúdo.

## Referências e o que aproveitamos

| Referência | O que levamos | O que deixamos |
|---|---|---|
| [Vercel Geist](https://vercel.com/geist/introduction) | Escala de cinzas por função (fundo de componente, borda, texto); Geist Sans para UI e Geist Mono para dados; raio 6px em controles e 12px em superfícies elevadas; tipografia separada em *label* (uma linha) e *copy* (várias linhas) | Sombras de elevação: no escuro usamos degraus de superfície e borda |
| [Linear](https://linear.app) | Hierarquia por peso e tamanho, não por cor; cinza suave para o secundário e contraste forte só no que se clica; estados que aparecem aos poucos em vez de trocar a tela de uma vez | O fundo claro como padrão |
| [Cap](https://cap.so) | O fluxo "gravou, o link já está na área de transferência" e o aviso "Link copiado" como confirmação principal; janela do host compacta | Gradientes de nuvem e cards de funcionalidades |
| [Raycast](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/raycast/DESIGN.md) | Superfícies quase pretas em degraus curtos; borda de 1px no lugar de sombra; **uma** ação primária sólida por tela; densidade precisa em janela pequena | Sombras multicamada estilo macOS |
| Loom (página de assistir) | O player é tudo; controles só quando se mexe o mouse | Comentários e capítulos (fora de escopo) |

## Direção

**Calma e precisa, com um detalhe de TV.** Neutros quase puros, tipografia fazendo a hierarquia, e um único elemento memorável: **o link em Geist Mono grande, com o endereço pessoal (o slug) na cor de destaque** — como o número de um canal. É ele que o app existe para produzir, então é ele que ganha palco na tela do host.

## Tokens

| Token | Escuro (padrão) | Claro | Uso |
|---|---|---|---|
| `fundo` | `#0A0A0A` | `#FFFFFF` | Fundo da página |
| `superficie` | `#131313` | `#F6F6F6` | Campos, cards, barra de controles |
| `superficie-2` | `#1C1C1C` | `#ECECEC` | Hover, item selecionado |
| `borda` | `#262626` | `#E2E2E2` | Divisórias e contornos de 1px |
| `texto` | `#EDEDED` | `#0A0A0A` | Texto principal |
| `texto-suave` | `#A1A1A1` | `#5C5C5C` | Rótulos e texto secundário (≥ 7:1 no escuro, ≥ 6:1 no claro) |
| `destaque` | `#3B9EFF` | `#0B6BDB` | Ação principal, anel de foco e o endereço do link fixo. **Nada mais.** |
| `ao-vivo` | `#22C55E` | `#15803D` | Só o selo AO VIVO |
| `parar` / `parar-fundo` | `#F87171` / `#DC2626` | `#B91C1C` / `#DC2626` | Só "Parar" e erros |
| `aviso` | `#E5A50A` | `#A16207` | Queda de qualidade, conexão instável |

Por que azul-sinal: o roxo/índigo é o padrão de interface gerada por IA (o prompt proíbe), e verde, vermelho e amarelo já têm função. O azul lembra a luz de uma tela ligada sem competir com o selo AO VIVO. Texto sobre o destaque: `#0A0A0A` no escuro (7,4:1), branco no claro (5,1:1).

**Tipografia.** Geist Sans para a interface; Geist Mono para links, números e estatísticas (sempre `tabular-nums`). Escala: 12 · 13 · 14 · 16 · 20 · 28 · 40. Hierarquia por tamanho e peso (400/500/600); cor só separa principal de secundário.

**Espaço.** Grade de 4px. Margens de 24px na janela do host, 32px nas páginas centrais. Uma ação primária por tela.

**Cantos.** 8px em controles (botões, campos, segmentos), 12px em superfícies (painéis, cards, barra do player). Pílula só no selo AO VIVO.

**Movimento.** 150–200ms, `ease-out` para entrar e `ease-in` para sair, só para dar contexto (painel abre, barra some, troca de quem apresenta). `prefers-reduced-motion` desliga tudo.

**Foco.** Anel de 2px na cor de destaque, afastado 2px do elemento, em tudo que recebe teclado.

## Telas

1. **Início do host:** o nome, uma linha dizendo o que faz, e o botão "Compartilhar tela" grande. "Meu link fixo" e o tema ficam discretos.
2. **Configurações:** presets no topo como segmentos; Fonte/Vídeo/Áudio recolhidos; prévia e resumo em mono logo acima de "Iniciar".
3. **Compartilhando:** o link em destaque (assinatura); AO VIVO e quantas pessoas numa linha; ações secundárias em fila; pedidos de revezamento aparecem acima de tudo, com Aprovar em destaque.
4. **Entrar:** quem está compartilhando, apelido e "Assistir".
5. **Assistindo:** vídeo em preto, selo de quem está na tela, barra flutuante que some, chat à direita.
6. **Estados:** título que diz o que aconteceu e uma linha que diz o que fazer. Sem spinner genérico.
7. **Revezamento:** no host, a notificação com o nome; no amigo, o painel "Você foi aprovado".

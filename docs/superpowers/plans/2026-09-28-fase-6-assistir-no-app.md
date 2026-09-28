# Fase 6: assistir e compartilhar só no app — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quem assiste também usa o app para Windows. O link `https://` abre o app pelo protocolo `telando://`. O site vira só a página que abre o app ou oferece o download. O app abre maximizado, e as telas de quem compartilha usam a largura.

**Architecture:** A página de assistir sai de `apps/web/src/assistir/` e vai para `packages/ui/src/assistir/`, recebendo a API e o seletor de fontes pela `Plataforma`. Um componente `App` novo, em `packages/ui`, alterna entre o painel de quem compartilha (`AppHost`), a tela de assistir e a espera do link fixo. O main do Electron recebe links `telando://` por `process.argv` e pelo evento `second-instance` e os entrega ao renderer por IPC. `destinoDoLink`, no core, interpreta qualquer link.

**Tech Stack:** Electron 44 + electron-vite 5, React 19, Tailwind v4, livekit-client 2.22 + @livekit/components-react, Hono 4 (server), Vitest 5, Playwright 1.63 (`_electron`).

Spec: `docs/superpowers/specs/2026-09-28-assistir-no-app-design.md`.

## Global Constraints

- Branch `fase-6`; um commit por tarefa, em Conventional Commits com descrição em pt-BR, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nunca `--no-verify`.
- Textos da interface em pt-BR direto. Erros dizem o que aconteceu e o que fazer.
- Sem `any`, sem `catch` que engole erro sem motivo, sem abstração de um uso só, sem comentário que repete o código.
- Imports relativos com extensão `.ts`/`.tsx`; pacotes internos exportam `.ts` direto.
- O protocolo é `telando`. Formatos aceitos: `https://<qualquer domínio>/s/<id>`, `https://<qualquer domínio>/<slug>`, `telando://s/<id>`, `telando://<slug>`.
- Id de sessão: 12 caracteres de `23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz` (igual a `apps/server/src/sessoes.ts`). Slug: `/^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/` (igual a `apps/server/src/rotas-links.ts`).
- Janela: abre maximizada, mínimo 960×600, tamanho restaurado 1280×800. Layout de duas colunas a partir de 1100px (`min-[1100px]:`).
- Download do instalador: `https://github.com/dukefissura/telando/releases/latest/download/Telando-Setup.exe`.
- Verificação de cada tarefa: `pnpm lint && pnpm typecheck && pnpm test` passando antes do commit (o `pre-commit` roda Biome e typecheck).

## Mapa de arquivos

| Arquivo | Papel |
| --- | --- |
| `packages/core/src/destino-link.ts` (novo) | `destinoDoLink(texto)` |
| `packages/core/src/api.ts` | `urlEventosDoLink(slug)` no cliente |
| `packages/ui/src/assistir/*` (movidos de `apps/web/src/assistir/`) | tela de assistir, palco, barra, revezamento, espera do link fixo |
| `packages/ui/src/app.tsx` (novo) | alterna entre painel, assistir e espera; recebe links |
| `packages/ui/src/plataforma.ts` | campos obrigatórios + `linkPendente`/`aoAbrirLink` |
| `packages/ui/src/host/*` | layout largo, campo "Entrar com um link", sem ramos de navegador |
| `apps/web/src/*` | vira a página "Abrir no Telando" |
| `apps/server/src/site.ts` | CSP sem LiveKit |
| `apps/desktop/src/main/index.ts` | protocolo, janela maximizada com estado salvo, perfil de teste, autoplay |
| `apps/desktop/src/compartilhado/ipc.ts`, `src/preload/index.ts` | canais `link:abrir` e `link:pendente` |
| `apps/desktop/src/renderer/main.tsx` | usa `App` |
| `apps/desktop/electron-builder.yml` | `protocols` e `artifactName` fixo |
| `e2e/*` | specs com dois apps; teste da página do site |

---

### Task 1: `destinoDoLink` e o endereço do SSE no core

**Files:**
- Create: `packages/core/src/destino-link.ts`
- Create: `packages/core/src/destino-link.test.ts`
- Modify: `packages/core/src/api.ts` (objeto devolvido por `criarClienteApi`)
- Modify: `packages/core/src/api.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `destinoDoLink(texto: string): Destino | null` e `type Destino = { tipo: 'sessao'; id: string } | { tipo: 'linkFixo'; slug: string }`, exportados de `@telando/core`. No cliente da API, `urlEventosDoLink(slug: string): string`.

- [ ] **Step 1: Teste que falha** — `packages/core/src/destino-link.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { destinoDoLink } from './destino-link.ts'

describe('destinoDoLink', () => {
  it('lê o link de uma sessão, de qualquer domínio', () => {
    expect(destinoDoLink('https://telando.app/s/k7Qm2xPa9Lzz')).toEqual({
      tipo: 'sessao',
      id: 'k7Qm2xPa9Lzz',
    })
    expect(destinoDoLink('http://localhost:8787/s/k7Qm2xPa9Lzz')).toEqual({
      tipo: 'sessao',
      id: 'k7Qm2xPa9Lzz',
    })
  })

  it('lê o link fixo', () => {
    expect(destinoDoLink('https://telando.app/luan')).toEqual({ tipo: 'linkFixo', slug: 'luan' })
  })

  it('lê os links do protocolo telando://', () => {
    expect(destinoDoLink('telando://s/k7Qm2xPa9Lzz')).toEqual({ tipo: 'sessao', id: 'k7Qm2xPa9Lzz' })
    expect(destinoDoLink('telando://luan/')).toEqual({ tipo: 'linkFixo', slug: 'luan' })
  })

  it('aceita espaços em volta, como vem de um copiar e colar', () => {
    expect(destinoDoLink('  https://telando.app/luan \n')).toEqual({ tipo: 'linkFixo', slug: 'luan' })
  })

  it('recusa o que não é link do Telando', () => {
    for (const texto of [
      '',
      'luan',
      'ftp://telando.app/luan',
      'https://telando.app/',
      'https://telando.app/s/curto',
      'https://telando.app/s/k7Qm2xPa9Lz0',
      'https://telando.app/Luan',
      'https://telando.app/luan/extra',
      'telando://s/',
      `https://telando.app/${'a'.repeat(21)}`,
    ]) {
      expect(destinoDoLink(texto), texto).toBeNull()
    }
  })
})
```

(`k7Qm2xPa9Lz0` tem `0`, que não está no alfabeto dos ids.)

- [ ] **Step 2: Rodar e ver falhar** — `pnpm --filter @telando/core exec vitest run src/destino-link.test.ts`. Esperado: falha por `destino-link.ts` não existir.

- [ ] **Step 3: Implementar** — `packages/core/src/destino-link.ts`:

```ts
// Os mesmos formatos que o server gera e aceita (sessoes.ts e rotas-links.ts).
const ID_SESSAO = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz]{12}$/
const SLUG = /^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/

export type Destino = { tipo: 'sessao'; id: string } | { tipo: 'linkFixo'; slug: string }

/**
 * Lê um link colado ou recebido pelo protocolo. O domínio não importa: o app só fala com o próprio
 * server, então só o caminho decide para onde ir.
 */
export function destinoDoLink(texto: string): Destino | null {
  let url: URL
  try {
    url = new URL(texto.trim())
  } catch {
    return null
  }
  // Em telando://s/abc o "s" vira o host da URL; em https://x/s/abc ele fica no caminho.
  const partes =
    url.protocol === 'telando:'
      ? [url.hostname, ...url.pathname.split('/')]
      : url.protocol === 'https:' || url.protocol === 'http:'
        ? url.pathname.split('/')
        : null
  if (!partes) return null
  const [primeira, segunda, ...resto] = partes.filter(Boolean)
  if (resto.length > 0) return null
  if (primeira === 's' && segunda && ID_SESSAO.test(segunda)) return { tipo: 'sessao', id: segunda }
  if (primeira && !segunda && SLUG.test(primeira)) return { tipo: 'linkFixo', slug: primeira }
  return null
}
```

Em `packages/core/src/index.ts`, acrescentar:

```ts
export { type Destino, destinoDoLink } from './destino-link.ts'
```

- [ ] **Step 4: Rodar e ver passar** — o mesmo comando do Step 2. Esperado: 5 testes passando.

- [ ] **Step 5: Teste do endereço do SSE** — em `packages/core/src/api.test.ts`, acrescentar:

```ts
it('monta o endereço dos eventos do link fixo a partir do server', () => {
  const api = criarClienteApi('http://localhost:8787')
  expect(api.urlEventosDoLink('luan')).toBe('http://localhost:8787/api/links/luan/events')
})
```

Rodar `pnpm --filter @telando/core exec vitest run src/api.test.ts`. Esperado: falha, porque `urlEventosDoLink` não existe.

- [ ] **Step 6: Implementar** — em `packages/core/src/api.ts`, dentro do objeto devolvido por `criarClienteApi`, depois de `estadoDoLink`:

```ts
    /** O EventSource não passa pelo cliente: precisa do endereço completo. */
    urlEventosDoLink(slug: string): string {
      return `${base}/api/links/${encodeURIComponent(slug)}/events`
    },
```

Rodar o teste de novo. Esperado: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core
git commit -m "feat(core): ler links do Telando e montar o endereço do SSE do link fixo"
```

---

### Task 2: a tela de assistir vai para o `ui`, e o site vira a página que abre o app

Esta tarefa move o código e troca o site no mesmo commit: sem a pasta `assistir`, o site antigo não compila.

**Files:**
- Move (`git mv`): `apps/web/src/assistir/{aviso.tsx,barra-de-controles.tsx,indicador-conexao.tsx,palco.tsx,pagina-assistir.tsx,pagina-link-fixo.tsx,revezamento.tsx,use-sala-espectador.ts}` → `packages/ui/src/assistir/` (`pagina-assistir.tsx` vira `assistir.tsx`; `pagina-link-fixo.tsx` vira `esperar-link-fixo.tsx`)
- Modify: `packages/ui/src/plataforma.ts`, `packages/ui/src/index.ts`, `packages/ui/package.json`
- Modify: `packages/ui/src/host/app-host.tsx`, `packages/ui/src/host/tela-configuracoes.tsx`, `packages/ui/src/host/tela-compartilhando.tsx`, `packages/ui/src/host/painel-fonte.tsx`
- Delete: `apps/web/src/api.ts`, `apps/web/src/plataforma-web.ts`
- Rewrite: `apps/web/src/main.tsx`
- Modify: `apps/web/package.json`, `apps/web/src/estilo.css` (se ele importar algo que sai)
- Modify: `apps/server/src/site.ts`, `apps/server/src/site.test.ts`, `apps/server/src/main.ts`
- Modify: `apps/desktop/src/renderer/main.tsx` (só o necessário para compilar com a `Plataforma` nova; o `App` entra na Task 3)

**Interfaces:**
- Consumes: `destinoDoLink`, `urlEventosDoLink` (Task 1).
- Produces:
  - `Assistir({ plataforma, id, entrarComApelido?, aoVoltar })` e `EsperarLinkFixo({ plataforma, slug, aoVoltar })`, exportados de `@telando/ui`. `plataforma: Pick<Plataforma, 'api' | 'fontes'>`, `aoVoltar: () => void`.
  - `Plataforma` com `fontes`, `usoDeCpu`, `linkFixo`, `aoMudarTransmissao` e `aoAtalhoParar` obrigatórios, e dois campos novos: `linkPendente(): Promise<string | null>` e `aoAbrirLink(callback: (texto: string) => void): () => void`.

- [ ] **Step 1: Mover os arquivos**

```bash
mkdir -p packages/ui/src/assistir
git mv apps/web/src/assistir/aviso.tsx packages/ui/src/assistir/aviso.tsx
git mv apps/web/src/assistir/barra-de-controles.tsx packages/ui/src/assistir/barra-de-controles.tsx
git mv apps/web/src/assistir/indicador-conexao.tsx packages/ui/src/assistir/indicador-conexao.tsx
git mv apps/web/src/assistir/palco.tsx packages/ui/src/assistir/palco.tsx
git mv apps/web/src/assistir/pagina-assistir.tsx packages/ui/src/assistir/assistir.tsx
git mv apps/web/src/assistir/pagina-link-fixo.tsx packages/ui/src/assistir/esperar-link-fixo.tsx
git mv apps/web/src/assistir/revezamento.tsx packages/ui/src/assistir/revezamento.tsx
git mv apps/web/src/assistir/use-sala-espectador.ts packages/ui/src/assistir/use-sala-espectador.ts
git rm apps/web/src/api.ts apps/web/src/plataforma-web.ts
```

Em `packages/ui/package.json`, acrescentar `"@livekit/components-react": "^2.9.24"` em `dependencies` e rodar `pnpm install`.

- [ ] **Step 2: `Plataforma` sem os ramos do navegador** — em `packages/ui/src/plataforma.ts`, trocar o tipo `Plataforma` por:

```ts
/** O que o app desktop entrega às telas. */
export type Plataforma = {
  api: ReturnType<typeof criarClienteApi>
  /** Seletor próprio de telas e janelas (o getDisplayMedia usa a fonte escolhida aqui). */
  fontes: {
    listar(): Promise<FonteDeCaptura[]>
    escolher(id: string): Promise<void>
  }
  usoDeCpu: () => Promise<number>
  preferencias: {
    ler(): Promise<unknown>
    gravar(config: unknown): Promise<void>
  }
  /** Link fixo pessoal. O segredo nunca sai do computador de quem é dono. */
  linkFixo: {
    segredo(): Promise<string>
    ler(): Promise<MeuLinkFixo | null>
    gravar(link: MeuLinkFixo): Promise<void>
  }
  /** Avisa quando a transmissão começa ou acaba (ícone da bandeja e atalho global). */
  aoMudarTransmissao: (aoVivo: boolean) => void
  /** Atalho global do sistema para parar; devolve a função que remove o ouvinte. */
  aoAtalhoParar: (callback: () => void) => () => void
  /** Link telando:// com que o app foi aberto, se ainda não foi lido. */
  linkPendente(): Promise<string | null>
  /** Links que chegam com o app já aberto; devolve a função que remove o ouvinte. */
  aoAbrirLink(callback: (texto: string) => void): () => void
}
```

- [ ] **Step 3: Tirar os ramos de navegador do `host`**
  - `painel-fonte.tsx`: `type Fontes = Plataforma['fontes']`; `useFontes(fontes: Fontes | undefined)` continua aceitando `undefined` (a tela compartilhando só lista com o painel aberto).
  - `tela-configuracoes.tsx`:
    - trocar a `Secao` "Fonte" por uma sempre aberta, com `PainelFonte` e o erro;
    - apagar o parágrafo sobre o seletor do navegador;
    - `precisaEscolherFonte = !fonteAtual`;
    - `await plataforma.fontes.escolher(fonte.id)`;
    - trocar o comentário de `FONTE_PRESUMIDA` por `// Janelas só revelam o tamanho depois de capturar.`
  - `tela-compartilhando.tsx`:
    - `plataforma.fontes.escolher` sem `?.`;
    - o botão "Trocar tela/janela" chama só `setPainel('fonte')`;
    - o texto de "Sem áudio" vira `Sem áudio: a captura não trouxe o som do computador. Troque para a tela inteira e tente de novo.`
  - `app-host.tsx`:
    - `useTransmissao({ api: plataforma.api, usoDeCpu: plataforma.usoDeCpu })`;
    - `plataforma.aoAtalhoParar(...)` e `plataforma.aoMudarTransmissao(aoVivo)` sem `?.`;
    - `linkFixo.ler()` sem `?.`;
    - `tela === 'link-fixo'` sem o `&& linkFixo`; `plataforma={plataforma}` direto no `TelaLinkFixo`;
    - `aoAbrirLinkFixo={() => setTela('link-fixo')}`, com o tipo da prop virando `() => void` e o `{aoAbrirLinkFixo && (` virando o bloco direto.
  - `tela-link-fixo.tsx`: se ela usa `Plataforma & { linkFixo: ... }` ou `NonNullable<...>`, trocar por `Plataforma`.

- [ ] **Step 4: Adaptar os arquivos movidos**
  - `use-sala-espectador.ts`:
    - trocar `import { api } from '../api.ts'` por `import type { Plataforma } from '../plataforma.ts'`;
    - assinatura `useSalaEspectador(api: Plataforma['api'], id: string)`, com `[api, id]` nas dependências do `useCallback`;
    - apagar `await room.startAudio()` e o comentário acima dele: a janela do app tem `autoplayPolicy: 'no-user-gesture-required'` (Task 3).
  - `aviso.tsx`: nada muda.
  - `barra-de-controles.tsx`:
    - `import { BotoesDeReacao } from '../sala/reacoes.tsx'`;
    - prop nova `aoSair: () => void`;
    - no fim da barra, depois do botão de tela cheia:

    ```tsx
          <span className="mx-1 h-5 w-px bg-borda" aria-hidden />
          <button
            type="button"
            onClick={aoSair}
            className="rounded-md px-2.5 py-1.5 text-sm text-texto-suave hover:bg-white/10"
          >
            Sair
          </button>
    ```

  - `palco.tsx`:
    - imports de `@telando/ui` viram relativos: `ColunaDeReacoes` de `../sala/reacoes.tsx`, `PainelChat` de `../sala/painel-chat.tsx`, `useAtalhosDaJanela` de `../atalhos.ts`;
    - assinatura `Palco({ fontes, aoSair }: { fontes: Plataforma['fontes']; aoSair: () => void })`;
    - `useRevezamento(room, sessao, chat.avisar, fontes)`;
    - apagar `useAudioPlayback` e o botão "Clique para ativar o som";
    - passar `aoSair={aoSair}` à `BarraDeControles`.
  - `revezamento.tsx`:
    - imports de `@telando/ui` viram `../controles.tsx`;
    - `useRevezamento(room, sessao, avisar, fontes: Plataforma['fontes'])`;
    - `compartilhar(preset, comAudio, fonte: FonteDeCaptura)` escolhe a fonte antes de capturar:

    ```ts
        async compartilhar(preset: PresetId, comAudio: boolean, fonte: FonteDeCaptura) {
          setErro(null)
          try {
            await fontes.escolher(fonte.id)
            const config = { ...aplicarPreset(configPadrao(), preset), audioSistema: comAudio }
            const compartilhamento = await compartilharComoConvidado(room, config, () => void devolver())
            if (!aindaSouApresentador.current) {
              await compartilhamento.parar()
              return
            }
            atual.current = compartilhamento
            setCompartilhando(true)
          } catch (e) {
            if (e instanceof DOMException && e.name === 'NotAllowedError') return
            setErro(mensagemDoErro(e, 'Não consegui compartilhar a sua tela.'))
          }
        },
    ```

    - `EscolherOQueCompartilhar({ revezamento, fontes })` ganha a grade de fontes, e o botão "Compartilhar" fica desligado até escolher:

    ```tsx
    export function EscolherOQueCompartilhar({
      revezamento,
      fontes,
    }: {
      revezamento: Revezamento
      fontes: Plataforma['fontes']
    }) {
      const [preset, setPreset] = useState<PresetId>('texto')
      const [comAudio, setComAudio] = useState(true)
      const [fonte, setFonte] = useState<FonteDeCaptura | null>(null)
      const lista = useFontes(fontes)

      return (
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          aria-label="Você foi aprovado"
          className="grid max-h-[calc(100dvh-8rem)] w-[44rem] max-w-[calc(100vw-2rem)] gap-5 overflow-y-auto rounded-xl border border-borda bg-fundo p-5"
        >
          <h2 className="font-semibold">Você foi aprovado, escolha o que compartilhar</h2>
          <PainelFonte lista={lista} escolhida={fonte?.id ?? null} aoEscolher={setFonte} />
          <Segmentado
            rotulo="Tipo de conteúdo"
            opcoes={(Object.keys(PRESETS) as PresetId[]).map((id) => ({
              valor: id,
              texto: PRESETS[id].nome,
            }))}
            valor={preset}
            aoMudar={setPreset}
          />
          <Alternador rotulo="Compartilhar o som do computador" ligado={comAudio} aoMudar={setComAudio} />
          <div className="flex gap-2">
            <Botao
              variante="primario"
              disabled={!fonte}
              onClick={() => fonte && void revezamento.compartilhar(preset, comAudio, fonte)}
            >
              {fonte ? 'Compartilhar' : 'Escolha uma tela ou janela'}
            </Botao>
            <Botao variante="fantasma" onClick={() => void revezamento.devolver()}>
              Agora não
            </Botao>
          </div>
          {revezamento.erro && (
            <p role="alert" className="text-parar text-sm">
              {revezamento.erro}
            </p>
          )}
        </motion.section>
      )
    }
    ```

    Imports novos: `import type { FonteDeCaptura, Plataforma } from '../plataforma.ts'` e `import { PainelFonte, useFontes } from '../host/painel-fonte.tsx'`. No `palco.tsx`, `<EscolherOQueCompartilhar revezamento={revezamento} fontes={fontes} />`.
    - Em `BotaoRevezamento`, apagar a checagem de `navigator.mediaDevices?.getDisplayMedia` e o comentário acima dela.
  - `assistir.tsx`:
    - apagar `PaginaAssistir` e o import de `useParams`;
    - `Assistir({ plataforma, id, entrarComApelido, aoVoltar }: { plataforma: Pick<Plataforma, 'api' | 'fontes'>; id: string; entrarComApelido?: string; aoVoltar: () => void })`;
    - `useSalaEspectador(plataforma.api, id)`; `usePrevia(plataforma.api, id, ...)`, com `api` como primeiro parâmetro e nas dependências do efeito;
    - `<Palco fontes={plataforma.fontes} aoSair={aoVoltar} />`;
    - os avisos "Sessão encerrada", "Você foi removido da sessão" e "Link inválido ou expirado" ganham como filho `<Botao onClick={aoVoltar}>Voltar ao início</Botao>`; nos avisos que já têm botão, ele entra ao lado, dentro de `<div className="flex gap-2">`;
    - no formulário, depois do botão "Assistir": `<Botao variante="fantasma" onClick={aoVoltar}>Voltar</Botao>`;
    - imports de `@telando/ui` viram `../controles.tsx` e `../tema.tsx`.
  - `esperar-link-fixo.tsx`:
    - trocar `PaginaLinkFixo` por `EsperarLinkFixo({ plataforma, slug, aoVoltar }: { plataforma: Pick<Plataforma, 'api' | 'fontes'>; slug: string; aoVoltar: () => void })`;
    - `useLinkFixo(plataforma.api, slug)`, com `fonte = new EventSource(api.urlEventosDoLink(slug))` e `[api, slug]` nas dependências;
    - `<Assistir key=... plataforma={plataforma} id=... entrarComApelido=... aoVoltar={aoVoltar} />`;
    - o texto "Deixe esta página aberta: ela entra na transmissão assim que começar." vira "Deixe o Telando aberto: ele entra na transmissão assim que começar.";
    - os avisos "Ninguém usa esse link" e "Não deu para abrir" ganham `<Botao onClick={aoVoltar}>Voltar ao início</Botao>`; o formulário de espera ganha `<Botao variante="fantasma" onClick={aoVoltar}>Voltar</Botao>`.
- Em `packages/ui/src/index.ts`, acrescentar:

```ts
export { Assistir } from './assistir/assistir.tsx'
export { EsperarLinkFixo } from './assistir/esperar-link-fixo.tsx'
```

- [ ] **Step 5: Site vira "Abrir no Telando"** — reescrever `apps/web/src/main.tsx`:

```tsx
import { destinoDoLink } from '@telando/core'
import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './estilo.css'

const DOWNLOAD = 'https://github.com/dukefissura/telando/releases/latest/download/Telando-Setup.exe'

function linkDoApp(): string | null {
  const destino = destinoDoLink(window.location.href)
  if (!destino) return null
  return destino.tipo === 'sessao' ? `telando://s/${destino.id}` : `telando://${destino.slug}`
}

function PaginaAbrir() {
  const link = linkDoApp()

  // Tenta abrir o app uma vez; se ele não estiver instalado, o navegador só ignora.
  useEffect(() => {
    if (link) window.location.href = link
  }, [link])

  return (
    <main className="grid min-h-dvh place-items-center px-8">
      <div className="grid w-full max-w-md gap-8">
        <div className="grid gap-3">
          <h1 className="font-semibold text-[40px] leading-[1.1] tracking-tight">Telando</h1>
          <p className="text-lg text-texto-suave">
            {link
              ? 'Essa transmissão abre no app do Telando, para Windows.'
              : 'Compartilhe a tela com os amigos pelo app do Telando, para Windows.'}
          </p>
        </div>
        <div className="grid gap-3">
          {link && (
            <a
              href={link}
              className="rounded-lg bg-destaque px-4 py-3 text-center font-medium text-sobre-destaque"
            >
              Abrir no Telando
            </a>
          )}
          <a
            href={DOWNLOAD}
            className={
              link
                ? 'rounded-lg border border-borda px-4 py-3 text-center'
                : 'rounded-lg bg-destaque px-4 py-3 text-center font-medium text-sobre-destaque'
            }
          >
            Baixar para Windows
          </a>
        </div>
        {link && (
          <p className="text-sm text-texto-suave">
            Ainda não tem o app? Baixe, instale e clique no link de novo.
          </p>
        )}
      </div>
    </main>
  )
}

const raiz = document.getElementById('root')
if (!raiz) throw new Error('index.html sem #root')

createRoot(raiz).render(
  <StrictMode>
    <PaginaAbrir />
  </StrictMode>,
)
```

Conferir `apps/web/src/estilo.css`: ele deve importar só `tailwindcss` e `@telando/ui/tema.css` (e ter o `@source` do ui, se existir). Tirar o que apontar para arquivos que saíram.

Em `apps/web/package.json`:
- `dependencies` ficam `@telando/core`, `@telando/ui`, `react` e `react-dom`;
- saem `@livekit/components-react`, `livekit-client`, `lucide-react`, `motion` e `react-router`.

Rodar `pnpm install`. Em `apps/web/vite.config.ts`, apagar o bloco `server.proxy`: a página não chama a API.

- [ ] **Step 6: CSP do site sem LiveKit (teste primeiro)** — em `apps/server/src/site.test.ts`:
  - trocar `criarSite(api, { dist, livekitUrl: 'wss://livekit.telando.test' })` por `criarSite(api, { dist })`;
  - trocar o teste da CSP por:

```ts
it('a CSP libera só o próprio site', async () => {
  const csp = (await site.request('/')).headers.get('content-security-policy') ?? ''
  expect(csp).toContain("default-src 'self'")
  expect(csp).toContain("connect-src 'self'")
  expect(csp).not.toContain('livekit')
  expect(csp).toContain("frame-ancestors 'none'")
})
```

Rodar `pnpm --filter @telando/server exec vitest run src/site.test.ts`. Esperado: falha de tipo ou de asserção. Depois, em `site.ts`:
- `type Opcoes = { /** Pasta com o build do apps/web. */ dist: string }`;
- `criarSite(api, { dist }: Opcoes)`;
- apagar `livekit`/`livekitHttp`; `connectSrc: ["'self'"]`; `mediaSrc` sai;
- o comentário do topo passa a dizer que o site é a página que abre o app.

Em `main.ts`, `criarSite(api, { dist: resolve(env.WEB_DIST) })`. Rodar de novo. Esperado: PASS.

- [ ] **Step 7: Desktop compilando com a `Plataforma` nova** — em `apps/desktop/src/renderer/main.tsx`, acrescentar ao objeto `plataformaDesktop` (a Task 3 troca por IPC de verdade):

```ts
  linkPendente: async () => null,
  aoAbrirLink: () => () => undefined,
```

- [ ] **Step 8: Verificar** — `pnpm lint && pnpm typecheck && pnpm test`. Esperado: tudo passa. `pnpm --filter @telando/web build` gera o site. As specs E2E antigas quebram aqui e são reescritas na Task 5; não rodar o E2E nesta tarefa.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: tela de assistir vai para o app e o site passa a só abrir o Telando"
```

---

### Task 3: o app recebe links, abre maximizado e alterna entre painel e assistir

**Files:**
- Create: `packages/ui/src/app.tsx`
- Modify: `packages/ui/src/host/app-host.tsx` (campo "Entrar com um link" no `TelaInicio`)
- Modify: `packages/ui/src/index.ts`
- Modify: `apps/desktop/src/compartilhado/ipc.ts`, `apps/desktop/src/preload/index.ts`, `apps/desktop/src/main/index.ts`, `apps/desktop/src/renderer/main.tsx`, `apps/desktop/electron-builder.yml`

**Interfaces:**
- Consumes: `Assistir`, `EsperarLinkFixo`, `Plataforma` (Task 2); `destinoDoLink` (Task 1).
- Produces: `App({ plataforma }: { plataforma: Plataforma })` exportado de `@telando/ui`. `AppHost` ganha as props `aoEntrarComLink: (texto: string) => void` e `avisoLink: string | null`. Canais IPC `link:abrir` (main → renderer) e `link:pendente` (invoke).

- [ ] **Step 1: `App` no ui** — `packages/ui/src/app.tsx`:

```tsx
import { type Destino, destinoDoLink } from '@telando/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Assistir } from './assistir/assistir.tsx'
import { EsperarLinkFixo } from './assistir/esperar-link-fixo.tsx'
import { AppHost } from './host/app-host.tsx'
import type { Plataforma } from './plataforma.ts'

/** Painel de quem compartilha, ou a transmissão de alguém aberta por um link. */
export function App({ plataforma }: { plataforma: Plataforma }) {
  const [destino, setDestino] = useState<Destino | null>(null)
  const [avisoLink, setAvisoLink] = useState<string | null>(null)
  const aoVivo = useRef(false)

  // O painel avisa quando entra e sai do ar; aqui isso decide se um link pode abrir.
  const plataformaDoPainel = useMemo<Plataforma>(
    () => ({
      ...plataforma,
      aoMudarTransmissao: (agora) => {
        aoVivo.current = agora
        plataforma.aoMudarTransmissao(agora)
      },
    }),
    [plataforma],
  )

  const abrir = useCallback((texto: string) => {
    const lido = destinoDoLink(texto)
    if (!lido) {
      setAvisoLink('Esse link não é de uma transmissão do Telando.')
      return
    }
    if (aoVivo.current) {
      setAvisoLink('Pare a sua transmissão para assistir.')
      return
    }
    setAvisoLink(null)
    setDestino(lido)
  }, [])

  useEffect(() => {
    void plataforma.linkPendente().then((texto) => texto && abrir(texto))
    return plataforma.aoAbrirLink(abrir)
  }, [plataforma, abrir])

  const voltar = () => setDestino(null)
  if (destino?.tipo === 'sessao') {
    return <Assistir key={destino.id} plataforma={plataforma} id={destino.id} aoVoltar={voltar} />
  }
  if (destino?.tipo === 'linkFixo') {
    return (
      <EsperarLinkFixo
        key={destino.slug}
        plataforma={plataforma}
        slug={destino.slug}
        aoVoltar={voltar}
      />
    )
  }
  return <AppHost plataforma={plataformaDoPainel} aoEntrarComLink={abrir} avisoLink={avisoLink} />
}
```

Em `packages/ui/src/index.ts`, trocar a linha do `AppHost` por `export { App } from './app.tsx'`. O desktop passa a usar `App`, e nada mais importa `AppHost` de fora do ui.

- [ ] **Step 2: Campo "Entrar com um link"** — em `app-host.tsx`:
  - `AppHost` ganha as props e as repassa ao `TelaInicio`;
  - no `TelaInicio`, depois do bloco do link fixo:

```tsx
        <form
          className="grid gap-2 border-borda border-t pt-5"
          onSubmit={(evento) => {
            evento.preventDefault()
            const campo = new FormData(evento.currentTarget).get('link')
            if (typeof campo === 'string') aoEntrarComLink(campo)
          }}
        >
          <label htmlFor="entrar-link" className="text-sm text-texto-suave">
            Entrar com um link
          </label>
          <div className="flex gap-2">
            <input
              id="entrar-link"
              name="link"
              placeholder="Cole aqui o link que te mandaram"
              className={`${classeCampo} min-w-0 flex-1`}
            />
            <Botao type="submit">Entrar</Botao>
          </div>
          {avisoLink && (
            <p role="alert" className="text-parar text-sm">
              {avisoLink}
            </p>
          )}
        </form>
```

`classeCampo` vem de `../controles.tsx`. O `TelaInicio` recebe `aoEntrarComLink: (texto: string) => void` e `avisoLink: string | null`.

"Pare a sua transmissão para assistir" aparece com o painel na tela compartilhando. O `TelaCompartilhando` recebe `avisoLink` e o mostra acima dos controles, no mesmo estilo de alerta de `aviso` (`rounded-lg border border-parar/40 px-3 py-2 text-parar text-sm`). No `AppHost`, passar `avisoLink={avisoLink}` ao `TelaCompartilhando`.

- [ ] **Step 3: IPC dos links** — em `apps/desktop/src/compartilhado/ipc.ts`:
  - no tipo `TelandoDesktop`, acrescentar `linkPendente(): Promise<string | null>` e `aoAbrirLink(callback: (texto: string) => void): () => void`;
  - em `CANAIS`, acrescentar `linkPendente: 'link:pendente'` e `abrirLink: 'link:abrir'`.

Em `preload/index.ts`:

```ts
  linkPendente: () => ipcRenderer.invoke(CANAIS.linkPendente),
  aoAbrirLink: (callback) => {
    const ouvinte = (_evento: Electron.IpcRendererEvent, texto: unknown) => {
      if (typeof texto === 'string') callback(texto)
    }
    ipcRenderer.on(CANAIS.abrirLink, ouvinte)
    return () => ipcRenderer.off(CANAIS.abrirLink, ouvinte)
  },
```

Em `renderer/main.tsx`:
- trocar os dois stubs da Task 2 por `linkPendente: telando.linkPendente` e `aoAbrirLink: telando.aoAbrirLink`;
- trocar `AppHost` por `App` no import e no render.

- [ ] **Step 4: Main — perfil de teste, protocolo, janela** — em `apps/desktop/src/main/index.ts`:

(a) Antes do `app.requestSingleInstanceLock()`, logo depois das constantes:

```ts
// Os testes E2E abrem dois apps na mesma máquina; cada um precisa do próprio perfil (e do próprio lock).
if (process.env.TELANDO_PERFIL) app.setPath('userData', process.env.TELANDO_PERFIL)
```

(b) Links do protocolo:

```ts
const LIMITE_LINK = 300
const linkNosArgumentos = (argv: string[]) =>
  argv.find((arg) => arg.startsWith('telando://') && arg.length <= LIMITE_LINK) ?? null

// O link que abriu o app fica aqui até o renderer carregar e pedir.
let linkPendente = linkNosArgumentos(process.argv)

function abrirLink(argv: string[]) {
  const link = linkNosArgumentos(argv)
  mostrarJanela()
  if (link) janela?.webContents.send(CANAIS.abrirLink, link)
}
```

`app.on('second-instance', mostrarJanela)` vira `app.on('second-instance', (_evento, argv) => abrirLink(argv))`. Em `registrarIpc()`:

```ts
  ipcMain.handle(CANAIS.linkPendente, (evento) => {
    exigirOrigem(evento)
    const link = linkPendente
    linkPendente = null
    return link
  })
```

(c) Janela grande, com o último estado lembrado. O tipo do `Store` ganha `janela: { maximizada: boolean; largura: number; altura: number } | null`, com `janela: null` nos `defaults`. Em `criarJanela()`:

```ts
  const salva = preferencias.get('janela')
  janela = new BrowserWindow({
    width: salva?.largura ?? 1280,
    height: salva?.altura ?? 800,
    minWidth: 960,
    minHeight: 600,
    title: 'Telando',
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // Quem assiste não clica em nada para ouvir: o som da transmissão toca ao entrar.
      autoplayPolicy: 'no-user-gesture-required',
    },
  })
  janela.once('ready-to-show', () => {
    if (salva?.maximizada ?? true) janela?.maximize()
    janela?.show()
  })
  janela.on('close', () => {
    if (!janela) return
    const { width, height } = janela.getNormalBounds()
    preferencias.set('janela', { maximizada: janela.isMaximized(), largura: width, altura: height })
  })
```

O resto do `criarJanela` fica como está.

(d) `apps/desktop/electron-builder.yml`:
- `artifactName: Telando-Setup.${ext}` no bloco `nsis`;
- no topo:

```yaml
# O instalador registra telando:// no Windows; é por ele que o link da página abre o app.
protocols:
  - name: Telando
    schemes:
      - telando
```

O app não chama `setAsDefaultProtocolClient`: quem registra é o instalador. Em dev isso não mexeria no registro do app instalado; os testes entregam o link pelos argumentos.

- [ ] **Step 5: Verificar e ver funcionando**

```bash
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter @telando/desktop build
```

Com `pnpm dev:livekit` e o server rodando, abrir o app. Ele deve abrir maximizado.

Colar num campo "Entrar com um link" o link de uma transmissão feita num segundo app:

```bash
TELANDO_PERFIL=$TEMP/telando-b pnpm --filter @telando/desktop exec electron .
```

A tela de assistir deve abrir.

Com o app aberto, rodar de novo com `telando://s/<id>` no fim do comando, usando o mesmo perfil. A janela existente deve ir para a tela de assistir, sem abrir uma segunda.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(desktop): links telando:// abrem a transmissão no app, que abre maximizado"
```

---

### Task 4: telas de quem compartilha em duas colunas

**Files:**
- Modify: `packages/ui/src/host/tela-configuracoes.tsx`, `packages/ui/src/host/tela-compartilhando.tsx`, `packages/ui/src/host/painel-fonte.tsx`

**Interfaces:** só layout; nenhuma prop muda.

- [ ] **Step 1: Configurações** — em `tela-configuracoes.tsx`, o `<main>` vira:

```tsx
    <main className="mx-auto grid w-full max-w-6xl gap-6 p-6 min-[1100px]:p-10">
      <header className="flex items-center justify-between">
        <h1 className="font-semibold text-lg">Configurar transmissão</h1>
        <Botao variante="fantasma" onClick={aoVoltar}>
          Voltar
        </Botao>
      </header>

      <div className="grid gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_24rem] min-[1100px]:items-start">
        <section aria-label="O que compartilhar" className="grid gap-3">
          {/* PainelFonte + erroFonte, que antes ficavam na Secao "Fonte" */}
        </section>
        <div className="grid gap-5">
          {/* Segmentado de preset, Secao Vídeo, Secao Áudio, prévia da fonte, resumo + testar, link fixo + Iniciar + erro, na ordem de hoje */}
        </div>
      </div>
    </main>
```

A seção "O que compartilhar" ganha um `<h2 className="font-medium">O que compartilhar</h2>` no lugar do título da `Secao`. A prévia (`<img>` da fonte escolhida) passa para a coluna da direita, logo acima do resumo. O conteúdo de cada bloco é o de hoje, só mudado de lugar.

- [ ] **Step 2: Grade de fontes** — em `painel-fonte.tsx`, as duas grades viram `grid grid-cols-2 gap-2 min-[1100px]:grid-cols-3`.

- [ ] **Step 3: Compartilhando** — em `tela-compartilhando.tsx`, o `<main>` vira `mx-auto grid w-full max-w-6xl gap-6 p-6 min-[1100px]:grid-cols-[minmax(0,1fr)_24rem] min-[1100px]:items-start min-[1100px]:p-10`, com dois filhos:
  1. Coluna principal, `<div className="grid content-start gap-5">`, com o conteúdo de hoje até o bloco de ajustes, na mesma ordem:
     - a linha AO VIVO;
     - os pedidos;
     - o aviso de apresentador;
     - os links e o resumo;
     - os avisos (`avisoLink`, `aviso`, limitação);
     - os botões e as estatísticas;
     - o painel de fonte e o de ajustes;
     - o botão "Parar".
  2. Coluna lateral, `<aside aria-label="Sala" className="grid content-start gap-5">`, com as `Secao`s "Quem está assistindo" e "Chat". O chat passa de `h-64` para `h-96`.

`<ColunaDeReacoes>` continua como último filho do `<main>`.

- [ ] **Step 4: Ver nas duas larguras** — com o app rodando e transmitindo, capturar as telas de configurações e de compartilhando: maximizada (1920×1080) e com a janela em 1100px e em 960px, nos temas escuro e claro. O Step 3 da Task 5 inclui um script de capturas; aqui dá para fazer à mão. Conferir:
  - nada estoura a largura;
  - em 960px vira uma coluna;
  - o botão "Iniciar" fica visível sem rolar em 1080p.

- [ ] **Step 5: Verificar e commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "feat(ui): telas de quem compartilha aproveitam a janela grande"
```

---

### Task 5: E2E com dois apps e a página do site

**Files:**
- Rewrite: `e2e/apoio.ts`
- Modify: `e2e/link.spec.ts`, `e2e/sala.spec.ts`, `e2e/revezamento.spec.ts`, `e2e/desktop.spec.ts`
- Create: `e2e/pagina.spec.ts`, `e2e/capturas.spec.ts`
- Modify: `e2e/playwright.config.ts`

**Interfaces:**
- Consumes: todo o app das Tasks 2–4.
- Produces (em `e2e/apoio.ts`):
  - `abrirApp(opcoes?: { args?: string[] }): Promise<AppAberto>`, com `type AppAberto = { app: ElectronApplication; janela: Page; perfil: string }`;
  - `transmitir(host?: AppAberto): Promise<{ host: Page; hostApp: AppAberto; link: string; sessao: { id: string; hostToken: string } }>`;
  - `assistir(link: string, apelido: string): Promise<Page>`;
  - `recebeVideoEAudio(pagina: Page)` e `lerLink(host: Page)`, como hoje;
  - `fecharTodos(): Promise<void>`, chamado num `test.afterEach`.

- [ ] **Step 1: Apoio com Electron** — `e2e/apoio.ts`:

```ts
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron, type ElectronApplication, expect, type Page } from '@playwright/test'

export const pastaDesktop = fileURLToPath(new URL('../apps/desktop', import.meta.url))
export const executavel = fileURLToPath(
  new URL('../apps/desktop/node_modules/electron/dist/electron.exe', import.meta.url),
)

// Processos filhos do VS Code herdam ELECTRON_RUN_AS_NODE=1, que faz o Electron rodar como Node puro.
const { ELECTRON_RUN_AS_NODE: _, ...ambiente } = process.env

export type AppAberto = { app: ElectronApplication; janela: Page; perfil: string }
const abertos: AppAberto[] = []

/** Cada app tem o próprio perfil: é assim que dois rodam juntos na mesma máquina. */
export async function abrirApp(opcoes: { args?: string[]; perfil?: string } = {}): Promise<AppAberto> {
  const perfil = opcoes.perfil ?? (await mkdtemp(join(tmpdir(), 'telando-e2e-')))
  const app = await electron.launch({
    executablePath: executavel,
    args: [pastaDesktop, ...(opcoes.args ?? [])],
    env: { ...ambiente, TELANDO_PERFIL: perfil } as Record<string, string>,
  })
  const aberto = { app, janela: await app.firstWindow(), perfil }
  abertos.push(aberto)
  return aberto
}

export async function fecharTodos() {
  await Promise.all(abertos.splice(0).map(({ app }) => app.close().catch(() => undefined)))
}

/** O espectador está vendo o vídeo e recebendo uma trilha de áudio ativa. */
export async function recebeVideoEAudio(espectador: Page) {
  await expect
    .poll(() => espectador.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth))
    .toBeGreaterThan(0)
  await expect
    .poll(() =>
      espectador.locator('audio').evaluateAll((audios) =>
        audios.some((a) => {
          const fluxo = (a as HTMLAudioElement).srcObject
          return fluxo instanceof MediaStream && fluxo.getAudioTracks()[0]?.readyState === 'live'
        }),
      ),
    )
    .toBe(true)
}

/** Abre um app, compartilha a Tela 1 e devolve o link e a sessão criada (com o hostToken). */
export async function transmitir(hostApp?: AppAberto) {
  const aberto = hostApp ?? (await abrirApp())
  const host = aberto.janela
  await host.getByRole('button', { name: 'Compartilhar tela' }).click()
  await host.getByRole('button', { name: /^Tela 1/ }).click()
  const resposta = host.waitForResponse(
    (r) => r.url().endsWith('/api/sessions') && r.request().method() === 'POST',
  )
  await host.getByRole('button', { name: 'Iniciar' }).click()
  const sessao = (await (await resposta).json()) as { id: string; hostToken: string }
  return { host, hostApp: aberto, link: await lerLink(host), sessao }
}

/** Abre outro app, cola o link e entra com o apelido. */
export async function assistir(link: string, apelido: string) {
  const { janela } = await abrirApp()
  await janela.getByLabel('Entrar com um link').fill(link)
  await janela.getByRole('button', { name: 'Entrar', exact: true }).click()
  await janela.getByLabel('Seu apelido').fill(apelido)
  await janela.getByRole('button', { name: 'Assistir' }).click()
  return janela
}

/** O link que o host mostra (e copia) na tela "Compartilhando". */
export async function lerLink(host: Page): Promise<string> {
  const url = await host.locator('#link').getAttribute('data-url')
  if (!url) throw new Error('A tela do host não mostrou o link da transmissão.')
  return url
}
```

Se `waitForResponse` não enxergar os pedidos do renderer do Electron, trocar por `host.evaluate` lendo a sessão de outro jeito não é permitido (não há como expor o hostToken). Nesse caso, a alternativa é o teste do link fixo criar a sessão pela API (`request.post('/api/sessions')`) em vez de ler a resposta do app. Anotar a escolha em `docs/decisoes.md`.

- [ ] **Step 2: Portar as specs**
  - Em todas: tirar o fixture `browser` e `novaAba`; `transmitir(browser)` vira `transmitir()`; `assistir(browser, link, x)` vira `assistir(link, x)`; acrescentar `test.afterEach(fecharTodos)` e `test.skip(process.platform !== 'win32', 'O app só existe para Windows')`.
  - `revezamento.spec.ts`:
    - o link fixo, em vez de `espectador.goto('/slug')`, abre com `const { janela: espectador } = await abrirApp({ args: [\`telando://${slug}\`] })`;
    - o amigo aprovado escolhe a fonte antes de compartilhar: `await amigo.getByRole('button', { name: /^Tela 1/ }).click()`, e depois `Compartilhar`;
    - "se o amigo fecha a aba" vira "se o amigo fecha o app": trocar `amigo.close({ runBeforeUnload: true })` pelo `app.close()` do app do amigo (guardar o `AppAberto` que `assistir` abriu; mudar `assistir` para devolver também o app, se precisar, como `{ janela, app }`, e ajustar os usos).
  - `desktop.spec.ts`: usar `abrirApp()`/`assistir()` do apoio; o espectador passa a ser outro app.
  - `link.spec.ts` e `sala.spec.ts`: mesmas trocas. Os testes que dependiam da câmera falsa (padrão colorido) passam a usar a tela real, como o `desktop.spec.ts`.
  - O teste novo "link telando:// chega ao app já aberto" vai no `link.spec.ts`:

```ts
test('link telando:// entregue com o app aberto vai para a tela de assistir', async () => {
  const { sessao } = await transmitir()
  const amigo = await abrirApp()
  // Uma segunda instância com o mesmo perfil entrega o link à primeira e fecha sozinha.
  const segunda = spawn(executavel, [pastaDesktop, `telando://s/${sessao.id}`], {
    env: { ...ambienteSemRunAsNode, TELANDO_PERFIL: amigo.perfil },
  })
  await once(segunda, 'exit')
  await expect(amigo.janela.getByRole('heading', { name: 'Entrar para assistir' })).toBeVisible()
})
```

`spawn` vem de `node:child_process` e `once` de `node:events`. `ambienteSemRunAsNode` é o `ambiente` de `apoio.ts`, exportado.

  - O teste "enquanto transmite, um link não derruba a transmissão": o host recebe `telando://s/<outro id>` pela segunda instância e mostra "Pare a sua transmissão para assistir", continuando AO VIVO.

- [ ] **Step 3: Página do site e capturas** — `e2e/pagina.spec.ts` (navegador, sem Electron):

```ts
import { expect, test } from '@playwright/test'

test('o link de uma sessão oferece abrir no app e baixar', async ({ page }) => {
  await page.goto('/s/k7Qm2xPa9Lzz')
  await expect(page.getByRole('link', { name: 'Abrir no Telando' })).toHaveAttribute(
    'href',
    'telando://s/k7Qm2xPa9Lzz',
  )
  await expect(page.getByRole('link', { name: 'Baixar para Windows' })).toHaveAttribute(
    'href',
    /releases\/latest\/download\/Telando-Setup\.exe$/,
  )
})

test('o link fixo abre telando://slug', async ({ page }) => {
  await page.goto('/luan')
  await expect(page.getByRole('link', { name: 'Abrir no Telando' })).toHaveAttribute(
    'href',
    'telando://luan',
  )
})

test('a página inicial só oferece o download', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Abrir no Telando' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Baixar para Windows' })).toBeVisible()
})
```

`e2e/capturas.spec.ts`: um teste marcado com `test.skip(!process.env.CAPTURAS, ...)`. Com `CAPTURAS=1`, ele abre o host e um espectador e salva em `test-results/capturas/` as telas configurações, compartilhando e assistindo. Em cada uma: `janela.setViewportSize` não vale para Electron, então usar `app.evaluate(({ BrowserWindow }, [w, h]) => { const j = BrowserWindow.getAllWindows()[0]; j?.unmaximize(); j?.setSize(w, h) }, [1100, 800])` para 1100px, e `maximize()` para cheia; nos dois temas, clicando no `BotaoTema`.

Em `playwright.config.ts`:
- o `--use-fake-*` e o `launchOptions` servem só ao `pagina.spec.ts`; manter;
- `timeout: 90_000`, porque abrir dois ou três Electron por teste é mais lento.

- [ ] **Step 4: Rodar**

```bash
pnpm e2e
```

Esperado: tudo verde. Rodar duas vezes: a captura da tela real é sensível a uma tela parada (ver `desktop.spec.ts`). Depois, `CAPTURAS=1 pnpm e2e -- capturas.spec.ts` e conferir as imagens com o Read, como pede o Step 4 da Task 4.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(e2e): quem assiste também usa o app; testes da página que abre o Telando"
```

---

### Task 7: ideias de movimento do handoff de design

Pedido do usuário durante a fase: implementar o pacote `design_handoff_telando_movimento` (na área de trabalho dele). O README do pacote é a especificação; durações, curvas e textos são finais. Os caminhos que ele cita em `apps/web/src/assistir/` agora ficam em `packages/ui/src/assistir/`.

**Files:**
- Modify: `packages/ui/src/host/link.tsx` (1a: sintonia do final do link, troca de ícone com "estalo", borda que acende)
- Modify: `packages/ui/src/host/tela-compartilhando.tsx` (1a: crossfade do aviso; 1c: odômetro, anel no AO VIVO, lista animada; 1d: cards que abrem espaço)
- Modify: `packages/ui/src/assistir/palco.tsx` (1b: TV liga; 1d: crossfade do selo; 1e: barra que afunda; 1h: `layoutId="selo-tela"`)
- Modify: `packages/ui/src/assistir/esperar-link-fixo.tsx`, `assistir.tsx`, `app.tsx` (1h: canal com varredura, endereço que vira o selo, `LayoutGroup`)
- Modify: `packages/ui/src/tema.tsx`, `packages/ui/src/tema.css` (1i: View Transitions a partir do botão)
- Modify: `packages/ui/src/host/tela-configuracoes.tsx` (1j: régua do upload)
- Modify: `e2e/apoio.ts`, `e2e/playwright.config.ts` (testes com `reducedMotion: 'reduce'`)

Regras:
- Os textos reais continuam no DOM, com `sr-only` onde a versão visível anima (link, contador).
- `useReducedMotion()` pula a sintonia, a respiração da régua e a varredura.

**Desvios, a registrar em `docs/decisoes.md`:**
- O texto da espera do link fixo passa a ser "Deixe o Telando aberto…", porque não há mais página.
- O endereço do canal só voa até o selo se o selo existir quando a espera some; o selo aparece assim que o host está na sala, sem esperar o primeiro quadro.

- [ ] Verificar: `pnpm lint && pnpm typecheck && pnpm test`. Depois, `CAPTURAS=1 pnpm e2e -- capturas.spec.ts` sem `reducedMotion`, olhando cada momento. Commit `feat(ui): movimento do handoff de design (1a–1j)`.

---

### Task 6: docs e fechamento

**Files:**
- Modify: `README.md`, `CHANGELOG.md`, `docs/decisoes.md`, `CLAUDE.md`
- Modify: `apps/desktop/package.json` (`version` 0.2.0)

- [ ] **Step 1: Docs**
  - `docs/decisoes.md`, seção "Fase 6":
    - por que tudo no app (pedido do usuário);
    - por que o link continua `https://` (apps de chat não linkam `telando://`);
    - o protocolo registrado só pelo instalador;
    - `TELANDO_PERFIL`;
    - som sem clique (`autoplayPolicy`);
    - janela maximizada com estado salvo;
    - o que saiu (compartilhar e assistir no navegador, `plataforma-web`, "Clique para ativar o som", `react-router`, `lucide-react` e `motion` no site);
    - a escolha do Step 1 da Task 5, se houve.
  - `README.md`:
    - a primeira frase passa a dizer que quem assiste também usa o app;
    - "Rodar localmente" explica testar com dois apps (`TELANDO_PERFIL`);
    - a seção de limitações perde as linhas de navegador;
    - a de deploy diz que o site é a página que abre o app.
  - `CHANGELOG.md`: `## 0.2.0` no topo. Assistir no app; o link abre o app; janela grande; pedir a vez com o seletor do app; o site só abre o app ou baixa.
  - `CLAUDE.md`: na arquitetura:
    - `apps/web` vira a página que abre o app;
    - `packages/ui` passa a ter também a tela de assistir e o `App`;
    - o E2E passa a abrir apps Electron com `TELANDO_PERFIL`.
  - `apps/desktop/package.json`: `"version": "0.2.0"`.

- [ ] **Step 2: Revisões** — rodar as skills `simplify` e `code-review` no diff `main...fase-6`, e depois `security-review`. Atenção ao que chega de fora:
  - o texto do protocolo (limite de tamanho no main; `destinoDoLink` valida);
  - um link aberto por qualquer site não pode derrubar uma transmissão (coberto pelo `App`) nem entrar numa sessão sem clique, exceto o link fixo, que já era assim no navegador.

- [ ] **Step 3: Verificação final**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm e2e
pnpm --filter @telando/desktop instalador
```

Instalar o `Telando-Setup.exe` gerado e abrir `telando://luan` pelo Executar do Windows (Win+R). O app instalado deve abrir na espera do link fixo.

- [ ] **Step 4: Commit, PR e merge**

```bash
git add -A
git commit -m "docs: fase 6 no README, changelog 0.2.0 e decisões"
git push -u origin fase-6
gh pr create --base main --title "Fase 6: assistir e compartilhar só no app" --body-file <arquivo com o resumo e a verificação>
gh pr merge fase-6 --squash --delete-branch --subject "feat: fase 6, assistir e compartilhar só no app"
```

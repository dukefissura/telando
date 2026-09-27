# Fase 0: repositório, configuração e esqueleto

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repositório `dukefissura/telando` no GitHub com monorepo configurado, hooks de commit, CI verde e `pnpm dev` subindo server e web.

**Architecture:** pnpm workspaces + Turborepo. Nesta fase só existem `packages/config`, `packages/core`, `apps/server` e `apps/web`, cada um com o mínimo que já é código de verdade (health check, esquema dos metadados da sala, página inicial). `apps/desktop` e `packages/ui` nascem nas fases que precisam deles.

**Tech Stack:** Node 24 (engines `>=22`), pnpm 12.6.0, Turborepo 2.11, TypeScript 7, Biome 2.5, Lefthook 2 + commitlint 21, Hono 4 + @hono/node-server 2, Zod 4, Vite 8 + React 19, Vitest 5, LiveKit server 1.13.7.

## Global Constraints

- TypeScript estrito (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), sem `any`.
- Textos de UI, README e commits em pt-BR direto, sem emoji nem jargão de marketing (seção 6 do prompt).
- Commits no padrão Conventional Commits, descrição em pt-BR.
- `.env` nunca vai para o Git; só `.env.example`.
- Nada de código "para o futuro": cada arquivo criado nesta fase é usado nesta fase.
- Depois do primeiro commit na `main`, todo o resto entra pela branch `fase-0` via PR com CI verde.

---

### Task 1: Configuração raiz e repositório no GitHub

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `.npmrc`, `.gitignore`, `.gitattributes`, `.editorconfig`, `biome.json`, `turbo.json`, `.env.example`, `packages/config/package.json`, `packages/config/tsconfig.base.json`, `.vscode/settings.json`, `.vscode/extensions.json`, `docs/decisoes.md`

- [ ] **Step 1:** `package.json` raiz: `"private": true`, `"packageManager": "pnpm@12.6.0"`, `"engines": { "node": ">=22" }`, scripts `dev`, `build`, `lint` (`biome check .`), `format` (`biome check --write .`), `typecheck`, `test` via `turbo run`, e `dev:livekit` (`node scripts/dev-livekit.mjs`). devDependencies: `turbo`, `@biomejs/biome`, `typescript`.
- [ ] **Step 2:** `pnpm-workspace.yaml` com `apps/*` e `packages/*`; `.nvmrc` = `24`.
- [ ] **Step 3:** `.gitignore`: `node_modules`, `dist`, `out`, `release`, `.turbo`, `coverage`, `playwright-report`, `test-results`, `.env*` com `!.env.example`, `data/`, `.livekit/`.
- [ ] **Step 4:** `.gitattributes` (`* text=auto eol=lf`), `.editorconfig` (2 espaços, lf, utf-8, newline final).
- [ ] **Step 5:** `biome.json` com formatter (2 espaços, largura 100, aspas simples, sem ponto e vírgula), linter `recommended` com `noExplicitAny: error`, e `files.includes` ignorando `dist`, `out`, `.turbo`.
- [ ] **Step 6:** `turbo.json` com tarefas `build` (`dependsOn: ["^build"]`, outputs `dist/**`), `dev` (`persistent`, sem cache), `typecheck` (`dependsOn: ["^build"]`), `test`, `lint`.
- [ ] **Step 7:** `packages/config/tsconfig.base.json`: `target ES2023`, `module/moduleResolution: NodeNext` para Node e overrides `Bundler` nos apps Vite, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`, `skipLibCheck`.
- [ ] **Step 8:** `.env.example` comentado: `LIVEKIT_URL=ws://localhost:7880`, `LIVEKIT_API_KEY=devkey`, `LIVEKIT_API_SECRET=secret` (credenciais fixas do `--dev`), `PUBLIC_BASE_URL=http://localhost:5173`, `PORT=8787`, `TRUST_PROXY=0`.
- [ ] **Step 9:** `.vscode/settings.json` (Biome formatador padrão, format on save, `quickfix.biome` e `source.organizeImports.biome` on save) e `.vscode/extensions.json` (`biomejs.biome`, `bradlc.vscode-tailwindcss`, `ms-playwright.playwright`, `github.vscode-github-actions`).
- [ ] **Step 10:** `docs/decisoes.md` com a tabela de mudanças da spec (seção 1) e a escolha de TypeScript 7 e react-router.
- [ ] **Step 11:** `pnpm install` e `pnpm lint`. Esperado: sem erros.
- [ ] **Step 12:** Commit na `main`: `chore: configuração inicial do monorepo` (inclui `docs/`). Depois `gh repo create telando --private --source . --remote origin` e `git push -u origin main`.

### Task 2: Hooks de commit

**Files:**
- Create: `lefthook.yml`, `commitlint.config.mjs`
- Modify: `package.json` (devDependencies `lefthook`, `@commitlint/cli`, `@commitlint/config-conventional`; script `prepare: lefthook install`)

- [ ] **Step 1:** `git switch -c fase-0`.
- [ ] **Step 2:** `lefthook.yml`: `pre-commit` roda `pnpm biome check --staged --no-errors-on-unmatched --files-ignore-unknown=true`; `commit-msg` roda `pnpm commitlint --edit {1}`.
- [ ] **Step 3:** `commitlint.config.mjs` estende `@commitlint/config-conventional`, com `subject-case` desligado (pt-BR começa em minúscula mas nomes próprios não).
- [ ] **Step 4:** `pnpm install` (roda `prepare`, instala os hooks).
- [ ] **Step 5:** Teste negativo: `git commit --allow-empty -m "coisas"`. Esperado: commitlint recusa.
- [ ] **Step 6:** Commit: `chore: hooks de lint e mensagem de commit`.

### Task 3: `packages/core` com o esquema dos metadados da sala

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/sessao.ts`, `packages/core/src/sessao.test.ts`, `packages/core/src/index.ts`

**Interfaces:**
- Produces: `sessaoMetadataSchema` (Zod), `type SessaoMetadata`, `lerSessaoMetadata(raw: string | undefined): SessaoMetadata | null`. Usados pelo server (Fase 1) e pelos clientes.

- [ ] **Step 1: Teste que falha** em `sessao.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { lerSessaoMetadata } from './sessao'

const valido = { v: 1, hostIdentity: 'h_abc', hostNome: 'Luan', presenterIdentity: null, trancada: false }

describe('lerSessaoMetadata', () => {
  it('aceita metadados válidos', () => {
    expect(lerSessaoMetadata(JSON.stringify(valido))).toEqual(valido)
  })
  it('devolve null para sala sem metadados', () => {
    expect(lerSessaoMetadata(undefined)).toBeNull()
    expect(lerSessaoMetadata('')).toBeNull()
  })
  it('devolve null para JSON quebrado ou versão desconhecida', () => {
    expect(lerSessaoMetadata('{')).toBeNull()
    expect(lerSessaoMetadata(JSON.stringify({ ...valido, v: 2 }))).toBeNull()
  })
})
```

- [ ] **Step 2:** `pnpm --filter @telando/core test`. Esperado: FAIL (módulo não existe).
- [ ] **Step 3: Implementação** em `sessao.ts`:

```ts
import { z } from 'zod'

export const sessaoMetadataSchema = z.object({
  v: z.literal(1),
  hostIdentity: z.string().min(1),
  hostNome: z.string(),
  presenterIdentity: z.string().min(1).nullable(),
  trancada: z.boolean(),
})

export type SessaoMetadata = z.infer<typeof sessaoMetadataSchema>

export function lerSessaoMetadata(raw: string | undefined): SessaoMetadata | null {
  if (!raw) return null
  try {
    const parsed = sessaoMetadataSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    // Metadados escritos por outra versão do server ou por um humano no painel do LiveKit.
    return null
  }
}
```

- [ ] **Step 4:** Rodar de novo. Esperado: PASS.
- [ ] **Step 5:** Commit: `feat(core): esquema dos metadados da sessão`.

O pacote exporta TypeScript direto (`"exports": { ".": "./src/index.ts" }`); quem consome (Vite, tsx, Vitest) compila. Isso evita um passo de build só para o monorepo.

### Task 4: `apps/server` com health check

**Files:**
- Create: `apps/server/package.json`, `apps/server/tsconfig.json`, `apps/server/src/app.ts`, `apps/server/src/app.test.ts`, `apps/server/src/main.ts`, `apps/server/src/env.ts`

**Interfaces:**
- Produces: `criarApp(): Hono` montando rotas sob `/api`; `main.ts` lê `.env` da raiz (`process.loadEnvFile`) e sobe na `PORT`.

- [ ] **Step 1: Teste que falha**:

```ts
import { expect, it } from 'vitest'
import { criarApp } from './app'

it('responde ao health check', async () => {
  const res = await criarApp().request('/api/health')
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ ok: true })
})
```

- [ ] **Step 2:** Rodar; esperado FAIL.
- [ ] **Step 3:** `app.ts` com `new Hono().basePath('/api').get('/health', (c) => c.json({ ok: true }))`. `env.ts` valida `PORT`, `LIVEKIT_*`, `PUBLIC_BASE_URL` com Zod (usado já no `main.ts` para falhar cedo com mensagem clara). `main.ts` com `serve` do `@hono/node-server`. Script `dev`: `tsx watch src/main.ts`.
- [ ] **Step 4:** Rodar; esperado PASS.
- [ ] **Step 5:** Commit: `feat(server): esqueleto com health check`.

### Task 5: `apps/web` com página inicial

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/inicio.tsx`, `apps/web/src/estilo.css`

- [ ] **Step 1:** Vite + React + Tailwind v4 (`@tailwindcss/vite`), proxy `/api` → `http://localhost:8787`.
- [ ] **Step 2:** `inicio.tsx` busca `/api/health` e mostra "Telando" e o estado do server ("Servidor no ar" / "Servidor fora do ar. Rode pnpm dev."). É o que prova que web e server conversam; será trocado na Fase 1.
- [ ] **Step 3:** `pnpm dev` na raiz; abrir `http://localhost:5173`. Esperado: "Servidor no ar".
- [ ] **Step 4:** `pnpm lint && pnpm typecheck && pnpm test`. Esperado: tudo verde.
- [ ] **Step 5:** Commit: `feat(web): página inicial ligada ao server`.

### Task 6: LiveKit de desenvolvimento

**Files:**
- Create: `scripts/dev-livekit.mjs`, `infra/livekit.dev.yaml`, `infra/docker-compose.dev.yml`

- [ ] **Step 1:** `dev-livekit.mjs`: versão fixada `1.13.7`; baixa `livekit_<v>_windows_amd64.zip` (ou `linux_amd64.tar.gz` no CI) para `.livekit/<v>/` se ainda não existir, confere o SHA-256 contra `checksums.txt` do release, extrai (`tar -xf` funciona para zip no Windows 10+) e roda `livekit-server --dev --config infra/livekit.dev.yaml --bind 127.0.0.1`.
- [ ] **Step 2:** `livekit.dev.yaml`: `webhook.urls: [http://localhost:8787/api/livekit/webhook]`, `webhook.api_key: devkey`. (O endpoint nasce na Fase 1; até lá o LiveKit só loga falha de entrega.)
- [ ] **Step 3:** `docker-compose.dev.yml` com `livekit/livekit-server:v1.13.7`, `--dev --config /etc/livekit.yaml`, portas 7880, 7881, 7882/udp.
- [ ] **Step 4:** `pnpm dev:livekit`. Esperado: log "starting LiveKit server" na porta 7880.
- [ ] **Step 5:** Commit: `chore: livekit de desenvolvimento sem docker`.

### Task 7: GitHub (CI, templates, dependabot)

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/bug.yml`, `.github/ISSUE_TEMPLATE/ideia.yml`, `.github/ISSUE_TEMPLATE/config.yml`, `.github/dependabot.yml`

- [ ] **Step 1:** `ci.yml`: gatilhos `push` em `main` e `pull_request`; `pnpm/action-setup` (versão lida do `packageManager`), `actions/setup-node` com `node-version-file: .nvmrc` e `cache: pnpm`; `pnpm install --frozen-lockfile`; `pnpm lint`; `pnpm typecheck`; `pnpm test`. `concurrency` cancelando execuções antigas do mesmo PR.
- [ ] **Step 2:** Templates curtos em pt-BR. `dependabot.yml` semanal para `npm` e `github-actions`, agrupando minor/patch.
- [ ] **Step 3:** Commit: `ci: lint, typecheck e testes em todo push e PR`.

### Task 8: CLAUDE.md, README e fechamento

**Files:**
- Create: `CLAUDE.md`, `README.md`

- [ ] **Step 1:** `CLAUDE.md` (skill `init`): stack, comandos, estrutura, convenções da seção 6 do prompt, fluxo de fase/branch/PR, "sem skills caveman".
- [ ] **Step 2:** `README.md` curto: requisitos, `pnpm install`, `cp .env.example .env`, `pnpm dev:livekit` + `pnpm dev`, comandos de teste.
- [ ] **Step 3:** `simplify` e `code-review` sobre o diff da fase; `verification-before-completion`.
- [ ] **Step 4:** Commit, `git push -u origin fase-0`, `gh pr create`, esperar o CI verde (`gh pr checks --watch`), `gh pr merge --squash --delete-branch`.

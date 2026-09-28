import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'
import { criarApp } from './app.ts'
import { lerEnv } from './env.ts'
import { criarRegistroLinks } from './links.ts'
import { criarSalaGateway } from './salas.ts'

const arquivoEnv = fileURLToPath(new URL('../../../.env', import.meta.url))
if (existsSync(arquivoEnv)) process.loadEnvFile(arquivoEnv)

const env = lerEnv(process.env)
const salas = criarSalaGateway(env)
const links = await criarRegistroLinks(join(resolve(env.DATA_DIR), 'links.json'))

// Atrás do Caddy o último X-Forwarded-For é o que o próprio Caddy escreveu; os anteriores o cliente pode forjar.
function ipDoCliente(c: Context): string {
  if (env.TRUST_PROXY === '1') {
    const ultimo = c.req.header('x-forwarded-for')?.split(',').at(-1)?.trim()
    if (ultimo) return ultimo
  }
  return getConnInfo(c).remote.address ?? 'desconhecido'
}

// O registro de sessões vive em memória: salas que sobraram de um processo anterior não têm dono.
await salas.apagarTodas().catch((erro: unknown) => {
  console.warn(
    `Não consegui limpar as salas antigas no LiveKit (${env.LIVEKIT_URL}). Ele está rodando?`,
    erro,
  )
})

serve({ fetch: criarApp({ env, salas, links, ipDoCliente }).fetch, port: env.PORT }, ({ port }) => {
  console.log(`server em http://localhost:${port}`)
})

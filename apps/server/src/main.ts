import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { criarApp } from './app.ts'
import { lerEnv } from './env.ts'

const arquivoEnv = fileURLToPath(new URL('../../../.env', import.meta.url))
if (existsSync(arquivoEnv)) process.loadEnvFile(arquivoEnv)

const env = lerEnv(process.env)

serve({ fetch: criarApp().fetch, port: env.PORT }, ({ port }) => {
  console.log(`server em http://localhost:${port}`)
})

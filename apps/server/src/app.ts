import { type Context, Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import type { Env } from './env.ts'
import { erroApi } from './http.ts'
import type { SalaGateway } from './salas.ts'
import { type RegistroSessoes, rotasSessoes } from './sessoes.ts'

export type Deps = {
  env: Env
  salas: SalaGateway
  ipDoCliente: (c: Context) => string
  agora?: () => number
}

export function criarApp(deps: Deps) {
  const sessoes: RegistroSessoes = new Map()

  return new Hono()
    .basePath('/api')
    .use(
      bodyLimit({
        maxSize: 4 * 1024,
        onError: () => {
          throw erroApi(413, 'corpo_grande', 'O pedido é grande demais.')
        },
      }),
    )
    .get('/health', (c) => c.json({ ok: true }))
    .route('/sessions', rotasSessoes(deps, sessoes))
    .onError((erro, c) => {
      if (erro instanceof HTTPException) return erro.getResponse()
      console.error(erro)
      return c.json(
        { erro: 'erro_interno', mensagem: 'Algo falhou no servidor. Tente de novo.' },
        500,
      )
    })
}

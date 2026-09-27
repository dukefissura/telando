import { type Context, Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import type { Env } from './env.ts'
import { erroApi } from './http.ts'
import { limitarPorIp } from './limite.ts'
import type { SalaGateway } from './salas.ts'
import { type RegistroSessoes, rotasSessoes } from './sessoes.ts'
import { rotasWebhook } from './webhook.ts'

export type Deps = {
  env: Env
  salas: SalaGateway
  ipDoCliente: (c: Context) => string
  agora?: () => number
}

const limiteDeCorpo = (maxSize: number) =>
  bodyLimit({
    maxSize,
    onError: () => {
      throw erroApi(413, 'corpo_grande', 'O pedido é grande demais.')
    },
  })

export function criarApp(deps: Deps) {
  const sessoes: RegistroSessoes = new Map()

  return (
    new Hono()
      .basePath('/api')
      // Aberto para qualquer origem porque não há cookie: quem autoriza é o hostToken no header.
      // O app desktop chama a API de outra origem.
      .use(cors({ origin: '*', allowHeaders: ['content-type', 'authorization'] }))
      .get('/health', (c) => c.json({ ok: true }))
      .use('/sessions/*', limiteDeCorpo(4 * 1024))
      .route('/sessions', rotasSessoes(deps, sessoes))
      .use('/livekit/webhook', limiteDeCorpo(64 * 1024))
      .route('/livekit/webhook', rotasWebhook(deps, sessoes))
      .post(
        '/teste-upload',
        limiteDeCorpo(2 * 1024 * 1024),
        limitarPorIp(deps, {
          limite: 6,
          janelaMs: 60_000,
          codigo: 'muitos_testes',
          mensagem: 'Muitos testes de conexão seguidos. Espere um minuto.',
        }),
        async (c) => c.json({ bytes: (await c.req.arrayBuffer()).byteLength }),
      )
      .onError((erro, c) => {
        if (erro instanceof HTTPException) return erro.getResponse()
        console.error(erro)
        return c.json(
          { erro: 'erro_interno', mensagem: 'Algo falhou no servidor. Tente de novo.' },
          500,
        )
      })
  )
}

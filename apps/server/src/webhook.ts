import { Hono } from 'hono'
import { WebhookReceiver } from 'livekit-server-sdk'
import type { Deps } from './app.ts'
import { erroApi } from './http.ts'
import type { RegistroSessoes } from './sessoes.ts'

export function rotasWebhook({ env }: Deps, sessoes: RegistroSessoes) {
  const receptor = new WebhookReceiver(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET)

  return new Hono().post('/', async (c) => {
    const corpo = await c.req.text()
    const evento = await receptor.receive(corpo, c.req.header('authorization')).catch(() => {
      throw erroApi(401, 'webhook_invalido', 'Assinatura do webhook não confere.')
    })

    if (evento.event === 'room_finished' && evento.room) sessoes.delete(evento.room.name)
    return c.body(null, 200)
  })
}

import { Hono } from 'hono'
import { WebhookReceiver } from 'livekit-server-sdk'
import type { Deps } from './app.ts'
import { erroApi } from './http.ts'
import type { RegistroSessoes } from './sessoes.ts'

// O emptyTimeout do LiveKit não cobre este caso: com espectadores na sala ela nunca fica vazia.
const ESPERA_PELO_HOST_MS = 60_000

export function rotasWebhook({ env, salas }: Deps, sessoes: RegistroSessoes) {
  const receptor = new WebhookReceiver(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET)

  function esquecer(id: string) {
    clearTimeout(sessoes.get(id)?.quedaDoHost)
    sessoes.delete(id)
  }

  return new Hono().post('/', async (c) => {
    const corpo = await c.req.text()
    const evento = await receptor.receive(corpo, c.req.header('authorization')).catch(() => {
      throw erroApi(401, 'webhook_invalido', 'Assinatura do webhook não confere.')
    })

    const id = evento.room?.name ?? ''
    const sessao = sessoes.get(id)
    const doHost = evento.participant?.identity === sessao?.metadata.hostIdentity

    if (evento.event === 'room_finished') {
      esquecer(id)
    } else if (sessao && doHost && evento.event === 'participant_left') {
      clearTimeout(sessao.quedaDoHost)
      sessao.quedaDoHost = setTimeout(() => {
        esquecer(id)
        void salas.apagar(id).catch((erro: unknown) => {
          console.error(`Não consegui apagar a sala ${id} depois que o host caiu`, erro)
        })
      }, ESPERA_PELO_HOST_MS)
    } else if (sessao && doHost && evento.event === 'participant_joined') {
      clearTimeout(sessao.quedaDoHost)
    }
    return c.body(null, 200)
  })
}

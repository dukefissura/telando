import { Hono } from 'hono'
import { WebhookReceiver } from 'livekit-server-sdk'
import type { Deps } from './app.ts'
import { erroApi } from './http.ts'
import type { RegistroSessoes } from './registro-sessoes.ts'

// O emptyTimeout do LiveKit não cobre este caso: com espectadores na sala ela nunca fica vazia.
const ESPERA_PELO_HOST_MS = 60_000

export function rotasWebhook({ env, salas }: Deps, sessoes: RegistroSessoes) {
  const receptor = new WebhookReceiver(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET)

  return new Hono().post('/', async (c) => {
    const corpo = await c.req.text()
    const evento = await receptor.receive(corpo, c.req.header('authorization')).catch(() => {
      throw erroApi(401, 'webhook_invalido', 'Assinatura do webhook não confere.')
    })

    const id = evento.room?.name ?? ''
    if (evento.event === 'room_finished') {
      sessoes.encerrar(id)
      return c.body(null, 200)
    }

    const sessao = sessoes.obter(id)
    const identity = evento.participant?.identity
    const sid = evento.participant?.sid
    if (!sessao || !identity) return c.body(null, 200)

    if (evento.event === 'participant_joined') {
      sessao.conexoes.set(identity, sid ?? '')
      if (identity === sessao.metadata.hostIdentity) clearTimeout(sessao.quedaDoHost)
    }

    // Webhooks podem chegar fora de ordem: a saída de uma conexão antiga de alguém que já
    // reconectou com outra não conta. O sid identifica cada conexão.
    const conhecida = sessao.conexoes.get(identity)
    const saiuDeVerdade =
      evento.event === 'participant_left' && (conhecida === undefined || conhecida === sid)

    if (saiuDeVerdade && identity === sessao.metadata.presenterIdentity) {
      await sessoes.mudarMetadata(id, { presenterIdentity: null })
    }
    if (saiuDeVerdade && identity === sessao.metadata.hostIdentity) {
      clearTimeout(sessao.quedaDoHost)
      sessao.quedaDoHost = setTimeout(() => {
        sessoes.encerrar(id)
        void salas.apagar(id).catch((erro: unknown) => {
          console.error(`Não consegui apagar a sala ${id} depois que o host caiu`, erro)
        })
      }, ESPERA_PELO_HOST_MS)
    }
    return c.body(null, 200)
  })
}

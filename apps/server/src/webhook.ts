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
    const sessao = sessoes.obter(id)
    const doHost = evento.participant?.identity === sessao?.metadata.hostIdentity
    // Webhooks podem chegar fora de ordem: a saída de uma conexão antiga do host, depois que ele
    // já reconectou, não pode encerrar a sessão. O sid identifica cada conexão.
    const sid = evento.participant?.sid
    const conexaoAntiga = sessao?.hostSid !== undefined && sid !== sessao.hostSid

    const apresentadorSaiu =
      evento.event === 'participant_left' &&
      evento.participant?.identity === sessao?.metadata.presenterIdentity

    if (evento.event === 'room_finished') {
      sessoes.encerrar(id)
    } else if (apresentadorSaiu) {
      await sessoes.mudarMetadata(id, { presenterIdentity: null })
    } else if (sessao && doHost && evento.event === 'participant_joined') {
      sessao.hostSid = sid
      clearTimeout(sessao.quedaDoHost)
    } else if (sessao && doHost && evento.event === 'participant_left' && !conexaoAntiga) {
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

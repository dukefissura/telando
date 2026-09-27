import { createHash } from 'node:crypto'
import { AccessToken } from 'livekit-server-sdk'
import { beforeEach, expect, it } from 'vitest'
import { envDeTeste as env, gatewayFalso } from './apoio-testes.ts'
import { criarApp } from './app.ts'

let app: ReturnType<typeof criarApp>

beforeEach(() => {
  app = criarApp({
    env,
    salas: gatewayFalso().gateway,
    ipDoCliente: () => '10.0.0.1',
  })
})

async function assinar(corpo: string, segredo = env.LIVEKIT_API_SECRET) {
  const token = new AccessToken(env.LIVEKIT_API_KEY, segredo)
  token.sha256 = createHash('sha256').update(corpo).digest('base64')
  return token.toJwt()
}

async function enviarWebhook(corpo: string, authorization: string) {
  return app.request('/api/livekit/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/webhook+json', authorization },
    body: corpo,
  })
}

async function criarSessao() {
  const res = await app.request('/api/sessions', { method: 'POST', body: '{}' })
  return ((await res.json()) as { id: string }).id
}

const entrar = (id: string) =>
  app.request(`/api/sessions/${id}/join`, { method: 'POST', body: '{}' })

it('esquece a sessão quando o LiveKit avisa que a sala acabou', async () => {
  const id = await criarSessao()
  const corpo = JSON.stringify({ event: 'room_finished', room: { name: id } })

  expect((await enviarWebhook(corpo, await assinar(corpo))).status).toBe(200)
  expect((await entrar(id)).status).toBe(404)
})

it('ignora webhook com assinatura de outro segredo', async () => {
  const id = await criarSessao()
  const corpo = JSON.stringify({ event: 'room_finished', room: { name: id } })
  const forjado = await assinar(corpo, 'outro-segredo-com-32-caracteres-aaaa')

  expect((await enviarWebhook(corpo, forjado)).status).toBe(401)
  expect((await entrar(id)).status).toBe(200)
})

import { createHash } from 'node:crypto'
import { AccessToken } from 'livekit-server-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { envDeTeste as env, gatewayFalso } from './apoio-testes.ts'
import { criarApp } from './app.ts'

let app: ReturnType<typeof criarApp>
let falso: ReturnType<typeof gatewayFalso>

beforeEach(() => {
  falso = gatewayFalso()
  app = criarApp({
    env,
    salas: falso.gateway,
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

describe('host caiu', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  async function evento(nome: string, sala: string, identity: string, sid = 'PA_1') {
    const corpo = JSON.stringify({
      event: nome,
      room: { name: sala },
      participant: { identity, sid },
    })
    expect((await enviarWebhook(corpo, await assinar(corpo))).status).toBe(200)
  }

  it('encerra a sessão se o host não voltar em 60 segundos', async () => {
    const id = await criarSessao()
    const host = falso.salas.get(id)?.hostIdentity ?? ''

    await evento('participant_left', id, host)
    await vi.advanceTimersByTimeAsync(59_000)
    expect((await entrar(id)).status).toBe(200)

    await vi.advanceTimersByTimeAsync(1_000)
    expect((await entrar(id)).status).toBe(404)
    expect(falso.salas.has(id)).toBe(false)
  })

  it('não encerra se o host voltar a tempo', async () => {
    const id = await criarSessao()
    const host = falso.salas.get(id)?.hostIdentity ?? ''

    await evento('participant_left', id, host)
    await vi.advanceTimersByTimeAsync(30_000)
    await evento('participant_joined', id, host)
    await vi.advanceTimersByTimeAsync(60_000)
    expect((await entrar(id)).status).toBe(200)
  })

  it('ignora a saída atrasada de uma conexão antiga do host', async () => {
    const id = await criarSessao()
    const host = falso.salas.get(id)?.hostIdentity ?? ''

    await evento('participant_joined', id, host, 'PA_antiga')
    await evento('participant_joined', id, host, 'PA_nova')
    await evento('participant_left', id, host, 'PA_antiga')
    await vi.advanceTimersByTimeAsync(120_000)
    expect((await entrar(id)).status).toBe(200)
  })

  it('espectador saindo não encerra nada', async () => {
    const id = await criarSessao()

    await evento('participant_left', id, 'v_qualquer')
    await vi.advanceTimersByTimeAsync(120_000)
    expect((await entrar(id)).status).toBe(200)
  })
})

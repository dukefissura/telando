import { beforeEach, describe, expect, it } from 'vitest'
import { envDeTeste, gatewayFalso, linksDeTeste } from './apoio-testes.ts'
import { criarApp } from './app.ts'

let app: ReturnType<typeof criarApp>
let falso: ReturnType<typeof gatewayFalso>

beforeEach(async () => {
  falso = gatewayFalso()
  app = criarApp({
    links: await linksDeTeste(),
    env: envDeTeste,
    salas: falso.gateway,
    ipDoCliente: () => '10.0.0.1',
  })
})

async function criarSessao() {
  const res = await app.request('/api/sessions', { method: 'POST', body: '{}' })
  return (await res.json()) as { id: string; hostToken: string }
}

const entrar = (id: string) =>
  app.request(`/api/sessions/${id}/join`, { method: 'POST', body: '{}' })

function comoHost(hostToken: string | null, init: RequestInit): RequestInit {
  return { ...init, headers: hostToken ? { authorization: `Bearer ${hostToken}` } : {} }
}

const trancar = (id: string, hostToken: string | null, trancada: boolean) =>
  app.request(
    `/api/sessions/${id}/trancada`,
    comoHost(hostToken, { method: 'PUT', body: JSON.stringify({ trancada }) }),
  )

const remover = (id: string, hostToken: string | null, identity: string) =>
  app.request(
    `/api/sessions/${id}/participantes/${identity}`,
    comoHost(hostToken, { method: 'DELETE' }),
  )

describe('trancar a sessão', () => {
  it('só o host tranca', async () => {
    const { id } = await criarSessao()
    expect((await trancar(id, null, true)).status).toBe(401)
    expect((await trancar(id, 'chute', true)).status).toBe(403)
  })

  it('trancada, ninguém novo entra; destrancada, volta a entrar', async () => {
    const { id, hostToken } = await criarSessao()

    expect((await trancar(id, hostToken, true)).status).toBe(204)
    expect(falso.salas.get(id)?.trancada).toBe(true)
    const recusado = await entrar(id)
    expect(recusado.status).toBe(423)
    expect(await recusado.json()).toMatchObject({ erro: 'sessao_trancada' })

    expect((await trancar(id, hostToken, false)).status).toBe(204)
    expect((await entrar(id)).status).toBe(200)
  })
})

it('se o LiveKit não confirmar, a sessão continua destrancada', async () => {
  const { id, hostToken } = await criarSessao()
  falso.gateway.atualizarMetadata = async () => {
    throw new Error('LiveKit fora do ar')
  }

  expect((await trancar(id, hostToken, true)).status).toBe(500)
  expect((await entrar(id)).status).toBe(200)
})

describe('remover alguém', () => {
  it('só o host remove', async () => {
    const { id } = await criarSessao()
    expect((await remover(id, null, 'v_abc')).status).toBe(401)
    expect(falso.removidos).toEqual([])
  })

  it('tira o espectador da sala', async () => {
    const { id, hostToken } = await criarSessao()
    expect((await remover(id, hostToken, 'v_abc')).status).toBe(204)
    expect(falso.removidos).toEqual([{ sala: id, identity: 'v_abc' }])
  })

  it('o host não remove a si mesmo', async () => {
    const { id, hostToken } = await criarSessao()
    const hostIdentity = falso.salas.get(id)?.hostIdentity ?? ''
    expect((await remover(id, hostToken, hostIdentity)).status).toBe(400)
    expect(falso.removidos).toEqual([])
  })
})

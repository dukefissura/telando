import type { SessaoMetadata } from '@telando/core'
import { TokenVerifier } from 'livekit-server-sdk'
import { beforeEach, describe, expect, it } from 'vitest'
import { criarApp } from './app.ts'
import type { Env } from './env.ts'
import type { SalaGateway } from './salas.ts'

const env: Env = {
  PORT: 8787,
  PUBLIC_BASE_URL: 'https://telando.test',
  LIVEKIT_URL: 'ws://livekit.test',
  LIVEKIT_API_KEY: 'devkey',
  LIVEKIT_API_SECRET: 'segredo-de-teste-com-32-caracteres!!',
  TRUST_PROXY: '0',
}
const verificador = new TokenVerifier(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET)

function gatewayFalso() {
  const salas = new Map<string, SessaoMetadata>()
  const gateway: SalaGateway = {
    async criar(id, metadata) {
      salas.set(id, metadata)
    },
    async apagar(id) {
      salas.delete(id)
    },
    async apagarTodas() {
      salas.clear()
    },
  }
  return { salas, gateway }
}

let salas: Map<string, SessaoMetadata>
let app: ReturnType<typeof criarApp>
let ip: string

beforeEach(() => {
  const falso = gatewayFalso()
  salas = falso.salas
  ip = '10.0.0.1'
  app = criarApp({ env, salas: falso.gateway, ipDoCliente: () => ip })
})

function post(caminho: string, corpo: unknown) {
  return app.request(caminho, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  })
}

async function criarSessao(nome?: string) {
  const res = await post('/api/sessions', { nome })
  expect(res.status).toBe(201)
  return (await res.json()) as {
    id: string
    url: string
    livekitUrl: string
    hostToken: string
    livekitToken: string
  }
}

describe('POST /api/sessions', () => {
  it('cria a sala com metadados e devolve o link', async () => {
    const sessao = await criarSessao('Luan')

    expect(sessao.id).toMatch(/^[A-Za-z0-9]{12}$/)
    expect(sessao.url).toBe(`https://telando.test/s/${sessao.id}`)
    expect(sessao.livekitUrl).toBe('ws://livekit.test')
    expect(sessao.hostToken.length).toBeGreaterThanOrEqual(43)
    expect(salas.get(sessao.id)).toMatchObject({
      v: 1,
      hostNome: 'Luan',
      presenterIdentity: null,
      trancada: false,
    })
  })

  it('dá ao host um token que publica na sala da sessão', async () => {
    const sessao = await criarSessao()
    const claims = await verificador.verify(sessao.livekitToken)

    expect(claims.video).toMatchObject({ room: sessao.id, roomJoin: true, canPublish: true })
    expect(claims.sub).toBe(salas.get(sessao.id)?.hostIdentity)
  })

  it('limita a 10 sessões por minuto por IP', async () => {
    for (let i = 0; i < 10; i++) await criarSessao()

    const bloqueada = await post('/api/sessions', {})
    expect(bloqueada.status).toBe(429)
    expect(await bloqueada.json()).toMatchObject({ erro: 'muitas_sessoes' })

    ip = '10.0.0.2'
    await criarSessao()
  })

  it('recusa corpo que não é JSON', async () => {
    const res = await app.request('/api/sessions', { method: 'POST', body: 'nome=Luan' })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ erro: 'corpo_invalido' })
  })
})

describe('POST /api/sessions/:id/join', () => {
  it('dá ao espectador um token que só assiste e conversa', async () => {
    const { id } = await criarSessao()
    const res = await post(`/api/sessions/${id}/join`, { apelido: '  Capivara Azul  ' })
    expect(res.status).toBe(200)
    const entrada = (await res.json()) as { livekitToken: string; identity: string }
    const claims = await verificador.verify(entrada.livekitToken)

    expect(claims.name).toBe('Capivara Azul')
    expect(claims.sub).toBe(entrada.identity)
    expect(claims.video).toMatchObject({
      room: id,
      roomJoin: true,
      canSubscribe: true,
      canPublish: false,
      canPublishData: true,
    })
  })

  it('sorteia um apelido quando vem vazio', async () => {
    const { id } = await criarSessao()
    const res = await post(`/api/sessions/${id}/join`, { apelido: '   ' })
    const { livekitToken } = (await res.json()) as { livekitToken: string }

    expect((await verificador.verify(livekitToken)).name).toMatch(/^\S+ \S+$/)
  })

  it('recusa apelido com mais de 32 caracteres', async () => {
    const { id } = await criarSessao()
    const res = await post(`/api/sessions/${id}/join`, { apelido: 'a'.repeat(33) })
    expect(res.status).toBe(400)
  })

  it('responde 404 para sessão que não existe', async () => {
    const res = await post('/api/sessions/naoexiste123/join', {})
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ erro: 'sessao_nao_encontrada' })
  })
})

describe('DELETE /api/sessions/:id', () => {
  function encerrar(id: string, hostToken?: string) {
    return app.request(`/api/sessions/${id}`, {
      method: 'DELETE',
      headers: hostToken ? { authorization: `Bearer ${hostToken}` } : {},
    })
  }

  it('exige o hostToken', async () => {
    const { id } = await criarSessao()

    expect((await encerrar(id)).status).toBe(401)
    expect((await encerrar(id, 'chute')).status).toBe(403)
    expect(salas.has(id)).toBe(true)
  })

  it('apaga a sala e o link deixa de funcionar', async () => {
    const { id, hostToken } = await criarSessao()

    expect((await encerrar(id, hostToken)).status).toBe(204)
    expect(salas.has(id)).toBe(false)
    expect((await post(`/api/sessions/${id}/join`, {})).status).toBe(404)
  })

  it('não deixa o host de uma sessão encerrar outra', async () => {
    const primeira = await criarSessao()
    const segunda = await criarSessao()

    expect((await encerrar(segunda.id, primeira.hostToken)).status).toBe(403)
  })
})

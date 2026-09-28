import { createHash } from 'node:crypto'
import { AccessToken } from 'livekit-server-sdk'
import { beforeEach, expect, it } from 'vitest'
import { envDeTeste, gatewayFalso, linksDeTeste } from './apoio-testes.ts'
import { criarApp } from './app.ts'

let app: ReturnType<typeof criarApp>
let falso: ReturnType<typeof gatewayFalso>
let id: string
let hostToken: string

beforeEach(async () => {
  falso = gatewayFalso()
  app = criarApp({
    links: await linksDeTeste(),
    env: envDeTeste,
    salas: falso.gateway,
    ipDoCliente: () => '10.0.0.1',
  })
  const res = await app.request('/api/sessions', { method: 'POST', body: '{}' })
  ;({ id, hostToken } = (await res.json()) as { id: string; hostToken: string })
  falso.presentes.set(id, new Set(['v_a', 'v_b']))
})

const passarVez = (identity: string | null, token: string | null = hostToken) =>
  app.request(`/api/sessions/${id}/presenter`, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ identity }),
  })

const apresentador = () => falso.salas.get(id)?.presenterIdentity
const podem = () => [...(falso.podeCompartilhar.get(id) ?? [])]

it('só o host passa a vez', async () => {
  expect((await passarVez('v_a', null)).status).toBe(401)
  expect((await passarVez('v_a', 'chute')).status).toBe(403)
  expect(podem()).toEqual([])
})

it('só passa para quem está na sala e não é o host', async () => {
  const fora = await passarVez('v_fantasma')
  expect(fora.status).toBe(404)
  expect(await fora.json()).toMatchObject({ erro: 'participante_nao_encontrado' })

  const host = falso.salas.get(id)?.hostIdentity ?? ''
  falso.presentes.get(id)?.add(host)
  expect((await passarVez(host)).status).toBe(400)
})

it('uma tela por vez: aprovar outro revoga o anterior', async () => {
  expect((await passarVez('v_a')).status).toBe(204)
  expect(apresentador()).toBe('v_a')
  expect(podem()).toEqual(['v_a'])

  expect((await passarVez('v_b')).status).toBe(204)
  expect(apresentador()).toBe('v_b')
  expect(podem()).toEqual(['v_b'])
})

it('devolver a vez revoga e volta para o host', async () => {
  await passarVez('v_a')
  expect((await passarVez(null)).status).toBe(204)
  expect(apresentador()).toBeNull()
  expect(podem()).toEqual([])
})

it('a vez volta ao host se quem apresentava cair', async () => {
  await passarVez('v_a')
  await evento('participant_left', 'v_a', 'PA_a')
  expect(apresentador()).toBeNull()
})

it('a saída atrasada de uma conexão antiga de quem apresenta não tira a vez', async () => {
  await passarVez('v_a')
  await evento('participant_joined', 'v_a', 'PA_antiga')
  await evento('participant_joined', 'v_a', 'PA_nova')
  await evento('participant_left', 'v_a', 'PA_antiga')
  expect(apresentador()).toBe('v_a')
})

async function evento(nome: string, identity: string, sid: string) {
  const corpo = JSON.stringify({ event: nome, room: { name: id }, participant: { identity, sid } })
  const token = new AccessToken(envDeTeste.LIVEKIT_API_KEY, envDeTeste.LIVEKIT_API_SECRET)
  token.sha256 = createHash('sha256').update(corpo).digest('base64')
  const res = await app.request('/api/livekit/webhook', {
    method: 'POST',
    headers: { authorization: await token.toJwt() },
    body: corpo,
  })
  expect(res.status).toBe(200)
}

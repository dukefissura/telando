import { beforeEach, expect, it } from 'vitest'
import { envDeTeste, gatewayFalso, linksDeTeste } from './apoio-testes.ts'
import { criarApp } from './app.ts'

let app: ReturnType<typeof criarApp>

beforeEach(async () => {
  app = criarApp({
    links: await linksDeTeste(),
    env: envDeTeste,
    salas: gatewayFalso().gateway,
    ipDoCliente: () => '10.0.0.1',
  })
})

const enviar = (bytes: number) =>
  app.request('/api/teste-upload', { method: 'POST', body: new Uint8Array(bytes) })

it('conta os bytes recebidos para o cliente medir o upload', async () => {
  const res = await enviar(512 * 1024)
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ bytes: 512 * 1024 })
})

it('recusa mais de 2 MB', async () => {
  expect((await enviar(2 * 1024 * 1024 + 1)).status).toBe(413)
})

it('limita a 6 testes por minuto por IP', async () => {
  for (let i = 0; i < 6; i++) expect((await enviar(10)).status).toBe(200)
  expect((await enviar(10)).status).toBe(429)
})

it('responde ao preflight do app desktop com Authorization liberado', async () => {
  const res = await app.request('/api/sessions/abc', {
    method: 'OPTIONS',
    headers: {
      origin: 'http://localhost:5174',
      'access-control-request-method': 'DELETE',
      'access-control-request-headers': 'authorization',
    },
  })
  expect(res.status).toBe(204)
  expect(res.headers.get('access-control-allow-origin')).toBe('*')
  expect(res.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('authorization')
})

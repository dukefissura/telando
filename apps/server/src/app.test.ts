import { expect, it } from 'vitest'
import { envDeTeste, gatewayFalso } from './apoio-testes.ts'
import { criarApp } from './app.ts'

it('responde ao health check', async () => {
  const app = criarApp({
    env: envDeTeste,
    salas: gatewayFalso().gateway,
    ipDoCliente: () => '127.0.0.1',
  })
  const res = await app.request('/api/health')
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ ok: true })
})

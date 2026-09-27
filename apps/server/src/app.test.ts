import { expect, it } from 'vitest'
import { criarApp } from './app.ts'
import type { Env } from './env.ts'

it('responde ao health check', async () => {
  const app = criarApp({
    env: {} as Env,
    salas: { criar: async () => {}, apagar: async () => {}, apagarTodas: async () => {} },
    ipDoCliente: () => '127.0.0.1',
  })
  const res = await app.request('/api/health')
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ ok: true })
})

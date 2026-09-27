import { expect, it } from 'vitest'
import { criarApp } from './app.ts'

it('responde ao health check', async () => {
  const res = await criarApp().request('/api/health')
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ ok: true })
})

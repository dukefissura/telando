import { Hono } from 'hono'

export function criarApp() {
  return new Hono().basePath('/api').get('/health', (c) => c.json({ ok: true }))
}

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, expect, it } from 'vitest'
import { envDeTeste, gatewayFalso, linksDeTeste } from './apoio-testes.ts'
import { criarApp } from './app.ts'
import { criarSite } from './site.ts'

let site: ReturnType<typeof criarSite>

beforeEach(async () => {
  const dist = await mkdtemp(join(tmpdir(), 'telando-dist-'))
  await mkdir(join(dist, 'assets'))
  await writeFile(join(dist, 'index.html'), '<!doctype html><title>Telando</title>')
  await writeFile(join(dist, 'assets', 'app-abc123.js'), 'console.log(1)')
  const api = criarApp({
    env: envDeTeste,
    salas: gatewayFalso().gateway,
    links: await linksDeTeste(),
    ipDoCliente: () => '10.0.0.1',
  })
  site = criarSite(api, { dist })
})

it('a API continua respondendo', async () => {
  expect(await (await site.request('/api/health')).json()).toEqual({ ok: true })
})

it('rotas do site caem no index.html, que não fica em cache', async () => {
  for (const rota of ['/', '/luan', '/s/k7Qm2xPa9Lzz']) {
    const res = await site.request(rota)
    expect(res.status, rota).toBe(200)
    expect(await res.text()).toContain('<title>Telando</title>')
    expect(res.headers.get('cache-control')).toBe('no-cache')
  }
})

it('arquivos com hash no nome ficam em cache por um ano', async () => {
  const res = await site.request('/assets/app-abc123.js')
  expect(await res.text()).toBe('console.log(1)')
  expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
})

it('a CSP libera só o próprio site', async () => {
  const csp = (await site.request('/')).headers.get('content-security-policy') ?? ''
  expect(csp).toContain("default-src 'self'")
  expect(csp).toContain("connect-src 'self'")
  expect(csp).not.toContain('livekit')
  expect(csp).toContain("frame-ancestors 'none'")
})

it('rota de API que não existe não vira o site', async () => {
  expect((await site.request('/api/nada')).status).toBe(404)
})

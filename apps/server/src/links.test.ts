import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { envDeTeste, gatewayFalso } from './apoio-testes.ts'
import { criarApp } from './app.ts'
import { criarRegistroLinks } from './links.ts'

const SEGREDO = 'segredo-do-luan-com-mais-de-quarenta-e-tres-caracteres'
const OUTRO = 'segredo-de-um-estranho-com-mais-de-quarenta-e-tres-chars'

let arquivo: string
let app: ReturnType<typeof criarApp>

async function montar() {
  app = criarApp({
    env: envDeTeste,
    salas: gatewayFalso().gateway,
    links: await criarRegistroLinks(arquivo),
    ipDoCliente: () => '10.0.0.1',
  })
}

beforeEach(async () => {
  arquivo = join(await mkdtemp(join(tmpdir(), 'telando-')), 'data', 'links.json')
  await montar()
})

function json(metodo: string, caminho: string, corpo: unknown, hostToken?: string) {
  return app.request(caminho, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      ...(hostToken && { authorization: `Bearer ${hostToken}` }),
    },
    body: JSON.stringify(corpo),
  })
}

const reservar = (slug: string, segredo = SEGREDO, nome = 'Luan') =>
  json('PUT', `/api/links/${slug}`, { segredo, nome })

async function criarSessao() {
  const res = await app.request('/api/sessions', { method: 'POST', body: '{}' })
  return (await res.json()) as { id: string; hostToken: string }
}

describe('reservar', () => {
  it('recusa slug fora do formato ou proibido', async () => {
    for (const slug of ['ab', 'Luan', '-luan', 'luan-', 'lu_an', 'a'.repeat(21), 'api', 's']) {
      expect((await reservar(slug)).status, slug).toBe(400)
    }
  })

  it('trata nomes que existem em todo objeto JavaScript como slugs comuns', async () => {
    expect((await app.request('/api/links/constructor')).status).toBe(404)
    expect((await reservar('constructor')).status).toBe(201)
  })

  it('recusa segredo curto', async () => {
    expect((await reservar('luan', 'curto')).status).toBe(400)
  })

  it('reserva e guarda só o hash do segredo', async () => {
    const res = await reservar('luan')
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ url: 'https://telando.test/luan' })
    expect(await readFile(arquivo, 'utf8')).not.toContain(SEGREDO)
  })

  it('o mesmo dono pode reservar de novo e trocar o nome', async () => {
    await reservar('luan')
    expect((await reservar('luan', SEGREDO, 'Luan G.')).status).toBe(200)
    expect(await (await app.request('/api/links/luan')).json()).toMatchObject({ nome: 'Luan G.' })
  })

  it('outro segredo não toma o link', async () => {
    await reservar('luan')
    const res = await reservar('luan', OUTRO, 'Impostor')
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ erro: 'link_ocupado' })
    expect(await (await app.request('/api/links/luan')).json()).toMatchObject({ nome: 'Luan' })
  })

  it('continua reservado depois de reiniciar o server', async () => {
    await reservar('luan')
    await montar()
    expect((await reservar('luan', OUTRO)).status).toBe(409)
  })
})

describe('ao vivo', () => {
  it('link livre responde 404; reservado começa offline', async () => {
    expect((await app.request('/api/links/ninguem')).status).toBe(404)
    await reservar('luan')
    expect(await (await app.request('/api/links/luan')).json()).toEqual({
      nome: 'Luan',
      aoVivo: false,
      url: 'https://telando.test/luan',
    })
  })

  it('aponta para a sessão com o segredo e o hostToken dela', async () => {
    await reservar('luan')
    const { id, hostToken } = await criarSessao()

    expect(
      (await json('POST', '/api/links/luan/live', { segredo: OUTRO, sessionId: id }, hostToken))
        .status,
    ).toBe(403)
    const alheia = await criarSessao()
    expect(
      (
        await json(
          'POST',
          '/api/links/luan/live',
          { segredo: SEGREDO, sessionId: id },
          alheia.hostToken,
        )
      ).status,
    ).toBe(403)

    expect(
      (await json('POST', '/api/links/luan/live', { segredo: SEGREDO, sessionId: id }, hostToken))
        .status,
    ).toBe(204)
    expect(await (await app.request('/api/links/luan')).json()).toMatchObject({
      aoVivo: true,
      sessionId: id,
    })
  })

  it('volta a offline ao desapontar ou quando a sessão acaba', async () => {
    await reservar('luan')
    const primeira = await criarSessao()
    await json(
      'POST',
      '/api/links/luan/live',
      { segredo: SEGREDO, sessionId: primeira.id },
      primeira.hostToken,
    )
    expect((await json('DELETE', '/api/links/luan/live', { segredo: SEGREDO })).status).toBe(204)
    expect(await (await app.request('/api/links/luan')).json()).toMatchObject({ aoVivo: false })

    const segunda = await criarSessao()
    await json(
      'POST',
      '/api/links/luan/live',
      { segredo: SEGREDO, sessionId: segunda.id },
      segunda.hostToken,
    )
    await app.request(`/api/sessions/${segunda.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${segunda.hostToken}` },
    })
    expect(await (await app.request('/api/links/luan')).json()).toMatchObject({ aoVivo: false })
  })

  it('avisa por SSE quando o dono entra ao vivo', async () => {
    await reservar('luan')
    const res = await app.request('/api/links/luan/events')
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const leitor = res.body?.getReader()
    const decodificador = new TextDecoder()
    const proximo = async () => decodificador.decode((await leitor?.read())?.value)

    expect(await proximo()).toContain('"aoVivo":false')
    const { id, hostToken } = await criarSessao()
    await json('POST', '/api/links/luan/live', { segredo: SEGREDO, sessionId: id }, hostToken)
    expect(await proximo()).toContain(`"sessionId":"${id}"`)
    await leitor?.cancel()
  })
})

describe('registro em disco', () => {
  it('duas reservas simultâneas do mesmo link: só uma leva', async () => {
    const [a, b] = await Promise.all([reservar('corrida'), reservar('corrida', OUTRO, 'Outro')])
    expect([a.status, b.status].sort()).toEqual([201, 409])
  })

  it('uma gravação que falha não derruba as próximas nem deixa reserva fantasma', async () => {
    // Um diretório no lugar do arquivo temporário faz a gravação falhar uma vez.
    const temporario = `${arquivo}.${process.pid}.tmp`
    await mkdir(temporario, { recursive: true })
    expect((await reservar('primeiro')).status).toBe(500)
    expect((await app.request('/api/links/primeiro')).status).toBe(404)

    await rm(temporario, { recursive: true })
    expect((await reservar('segundo')).status).toBe(201)
    await montar()
    expect((await app.request('/api/links/segundo')).status).toBe(200)
  })
})

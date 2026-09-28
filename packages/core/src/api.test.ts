import { describe, expect, it } from 'vitest'
import { criarClienteApi, ErroApi, mensagemDoErro } from './api.ts'

type Chamada = { url: string; init: RequestInit | undefined }

function fetcherFalso(status: number, corpo: unknown) {
  const chamadas: Chamada[] = []
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), init })
    return new Response(corpo === undefined ? null : JSON.stringify(corpo), { status })
  }
  return { chamadas, fetcher }
}

const sessao = {
  id: 'k7Qm2xPa9Lzz',
  url: 'http://localhost:5173/s/k7Qm2xPa9Lzz',
  livekitUrl: 'ws://localhost:7880',
  hostToken: 'segredo',
  livekitToken: 'jwt',
}

describe('criarClienteApi', () => {
  it('cria a sessão enviando o nome', async () => {
    const { chamadas, fetcher } = fetcherFalso(201, sessao)
    const api = criarClienteApi('http://server', fetcher)

    expect(await api.criarSessao('Luan')).toEqual(sessao)
    expect(chamadas[0]?.url).toBe('http://server/api/sessions')
    expect(chamadas[0]?.init?.method).toBe('POST')
    expect(chamadas[0]?.init?.body).toBe(JSON.stringify({ nome: 'Luan' }))
  })

  it('entra na sessão com o apelido', async () => {
    const entrada = { livekitUrl: 'ws://x', livekitToken: 'jwt' }
    const { chamadas, fetcher } = fetcherFalso(200, entrada)

    expect(await criarClienteApi('', fetcher).entrarNaSessao('abc', 'Capivara Azul')).toEqual(
      entrada,
    )
    expect(chamadas[0]?.url).toBe('/api/sessions/abc/join')
  })

  it('encerra a sessão mandando o hostToken no Authorization', async () => {
    const { chamadas, fetcher } = fetcherFalso(204, undefined)

    await criarClienteApi('', fetcher).encerrarSessao('abc', 'segredo')
    expect(chamadas[0]?.init?.method).toBe('DELETE')
    expect(new Headers(chamadas[0]?.init?.headers).get('authorization')).toBe('Bearer segredo')
    expect(chamadas[0]?.init?.keepalive).toBe(true)
  })

  it('tranca e destranca a sessão como host', async () => {
    const { chamadas, fetcher } = fetcherFalso(204, undefined)

    await criarClienteApi('', fetcher).trancarSessao('abc', 'segredo', true)
    expect(chamadas[0]?.url).toBe('/api/sessions/abc/trancada')
    expect(chamadas[0]?.init?.method).toBe('PUT')
    expect(chamadas[0]?.init?.body).toBe(JSON.stringify({ trancada: true }))
    expect(new Headers(chamadas[0]?.init?.headers).get('authorization')).toBe('Bearer segredo')
  })

  it('remove um espectador como host', async () => {
    const { chamadas, fetcher } = fetcherFalso(204, undefined)

    await criarClienteApi('', fetcher).removerParticipante('abc', 'segredo', 'v_1')
    expect(chamadas[0]?.url).toBe('/api/sessions/abc/participantes/v_1')
    expect(chamadas[0]?.init?.method).toBe('DELETE')
    expect(new Headers(chamadas[0]?.init?.headers).get('authorization')).toBe('Bearer segredo')
  })

  it('reserva o link fixo e lê o estado dele', async () => {
    const { chamadas, fetcher } = fetcherFalso(201, { url: 'https://t.test/luan' })
    const api = criarClienteApi('', fetcher)

    expect(await api.reservarLink('luan', 'segredo', 'Luan')).toEqual({
      url: 'https://t.test/luan',
    })
    expect(chamadas[0]?.url).toBe('/api/links/luan')
    expect(chamadas[0]?.init?.method).toBe('PUT')
    expect(chamadas[0]?.init?.body).toBe(JSON.stringify({ segredo: 'segredo', nome: 'Luan' }))
  })

  it('lê se o link fixo está ao vivo', async () => {
    const estado = { nome: 'Luan', aoVivo: true, sessionId: 'abc', url: 'https://t.test/luan' }
    const { fetcher } = fetcherFalso(200, estado)
    expect(await criarClienteApi('', fetcher).estadoDoLink('luan')).toEqual(estado)
  })

  it('aponta o link fixo para a sessão com segredo e hostToken', async () => {
    const { chamadas, fetcher } = fetcherFalso(204, undefined)
    const api = criarClienteApi('', fetcher)

    await api.apontarLink('luan', 'segredo', { id: 'abc', hostToken: 'ht' })
    expect(chamadas[0]?.url).toBe('/api/links/luan/live')
    expect(chamadas[0]?.init?.body).toBe(JSON.stringify({ segredo: 'segredo', sessionId: 'abc' }))
    expect(new Headers(chamadas[0]?.init?.headers).get('authorization')).toBe('Bearer ht')

    await api.desapontarLink('luan', 'segredo')
    expect(chamadas[1]?.init?.method).toBe('DELETE')
  })

  it('passa a vez de compartilhar', async () => {
    const { chamadas, fetcher } = fetcherFalso(204, undefined)
    await criarClienteApi('', fetcher).passarVez('abc', 'ht', 'v_1')
    expect(chamadas[0]?.url).toBe('/api/sessions/abc/presenter')
    expect(chamadas[0]?.init?.body).toBe(JSON.stringify({ identity: 'v_1' }))
  })

  it('transforma a resposta de erro do server em ErroApi', async () => {
    const { fetcher } = fetcherFalso(404, {
      erro: 'sessao_nao_encontrada',
      mensagem: 'Essa sessão acabou.',
    })

    const erro = await criarClienteApi('', fetcher)
      .entrarNaSessao('abc')
      .catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ErroApi)
    expect(erro).toMatchObject({ status: 404, codigo: 'sessao_nao_encontrada' })
  })

  it('recusa resposta fora do contrato', async () => {
    const { fetcher } = fetcherFalso(201, { id: 'abc' })

    await expect(criarClienteApi('', fetcher).criarSessao()).rejects.toThrow()
  })

  it('avisa quando não há conexão com o server', async () => {
    const semRede = async () => {
      throw new TypeError('Failed to fetch')
    }

    await expect(criarClienteApi('', semRede).criarSessao()).rejects.toMatchObject({
      codigo: 'sem_conexao',
    })
  })

  it('trata erro que não segue o contrato como servidor indisponível', async () => {
    const proxyCaido = async () => new Response('<html>502</html>', { status: 502 })

    await expect(criarClienteApi('', proxyCaido).criarSessao()).rejects.toMatchObject({
      status: 502,
      codigo: 'servidor_indisponivel',
    })
  })

  it('mede o upload pelo tempo de enviar um bloco ao server', async () => {
    const { chamadas, fetcher } = fetcherFalso(200, { bytes: 1_000_000 })
    const relogio = [1000, 2000]

    const kbps = await criarClienteApi('', fetcher).medirUploadKbps(
      1_000_000,
      () => relogio.shift() ?? 0,
    )
    expect(kbps).toBe(8000)
    expect(chamadas[0]?.url).toBe('/api/teste-upload')
    expect(chamadas[0]?.init?.body).toEqual(new Uint8Array(1_000_000))
  })
})

describe('mensagemDoErro', () => {
  it('usa a mensagem do server quando o erro veio da API', () => {
    expect(mensagemDoErro(new ErroApi(404, 'x', 'Essa sessão acabou.'), 'padrão')).toBe(
      'Essa sessão acabou.',
    )
  })

  it('cai no texto padrão para qualquer outro erro', () => {
    expect(mensagemDoErro(new TypeError('boom'), 'Tente de novo.')).toBe('Tente de novo.')
  })
})

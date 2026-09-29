import { z } from 'zod'

const sessaoCriadaSchema = z.object({
  id: z.string(),
  url: z.string(),
  livekitUrl: z.string(),
  hostToken: z.string(),
  livekitToken: z.string(),
})

const entradaSchema = z.object({
  livekitUrl: z.string(),
  livekitToken: z.string(),
})

const erroApiSchema = z.object({ erro: z.string(), mensagem: z.string() })

const linkReservadoSchema = z.object({ url: z.string() })

const infoSessaoSchema = z.object({ hostNome: z.string(), trancada: z.boolean() })

export const estadoLinkSchema = z.object({
  nome: z.string(),
  aoVivo: z.boolean(),
  sessionId: z.string().optional(),
  url: z.string(),
})

export type SessaoCriada = z.infer<typeof sessaoCriadaSchema>
export type EstadoLink = z.infer<typeof estadoLinkSchema>
type Entrada = z.infer<typeof entradaSchema>

export class ErroApi extends Error {
  readonly status: number
  readonly codigo: string

  constructor(status: number, codigo: string, mensagem: string) {
    super(mensagem)
    this.name = 'ErroApi'
    this.status = status
    this.codigo = codigo
  }
}

/** Mensagem pronta para a tela: a do server, se o erro veio da API; senão, a padrão. */
export function mensagemDoErro(erro: unknown, padrao: string): string {
  return erro instanceof ErroApi ? erro.message : padrao
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

export function criarClienteApi(base: string, fetcher: Fetcher = fetch) {
  async function chamar(caminho: string, init: RequestInit): Promise<unknown> {
    let res: Response
    try {
      res = await fetcher(`${base}/api${caminho}`, init)
    } catch {
      throw new ErroApi(
        0,
        'sem_conexao',
        'Não consegui falar com o servidor. Confira sua internet.',
      )
    }
    const corpo: unknown = res.status === 204 ? undefined : await res.json().catch(() => undefined)
    if (res.ok) return corpo

    const erro = erroApiSchema.safeParse(corpo)
    if (erro.success) throw new ErroApi(res.status, erro.data.erro, erro.data.mensagem)
    throw new ErroApi(
      res.status,
      'servidor_indisponivel',
      'O servidor não respondeu direito. Tente de novo.',
    )
  }

  const json = (corpo: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  })

  return {
    async criarSessao(nome?: string): Promise<SessaoCriada> {
      return sessaoCriadaSchema.parse(await chamar('/sessions', json({ nome })))
    },
    async entrarNaSessao(id: string, apelido?: string): Promise<Entrada> {
      const caminho = `/sessions/${encodeURIComponent(id)}/join`
      return entradaSchema.parse(await chamar(caminho, json({ apelido })))
    },
    /** Envia um bloco ao server e devolve o upload estimado em kbps (inclui a latência). */
    async medirUploadKbps(bytes = 2_000_000, agora = () => performance.now()): Promise<number> {
      const inicio = agora()
      await chamar('/teste-upload', { method: 'POST', body: new Uint8Array(bytes) })
      return Math.round((bytes * 8) / (agora() - inicio))
    },
    async encerrarSessao(id: string, hostToken: string): Promise<void> {
      await chamar(`/sessions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${hostToken}` },
        // Também é chamado no pagehide, quando o host fecha a aba; sem keepalive o navegador cancela o pedido.
        keepalive: true,
      })
    },
    async trancarSessao(id: string, hostToken: string, trancada: boolean): Promise<void> {
      await chamar(`/sessions/${encodeURIComponent(id)}/trancada`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${hostToken}` },
        body: JSON.stringify({ trancada }),
      })
    },
    async removerParticipante(id: string, hostToken: string, identity: string): Promise<void> {
      const caminho = `/sessions/${encodeURIComponent(id)}/participantes/${encodeURIComponent(identity)}`
      await chamar(caminho, { method: 'DELETE', headers: { authorization: `Bearer ${hostToken}` } })
    },
    async infoDaSessao(id: string) {
      return infoSessaoSchema.parse(await chamar(`/sessions/${encodeURIComponent(id)}`, {}))
    },
    async passarVez(id: string, hostToken: string, identity: string | null): Promise<void> {
      await chamar(`/sessions/${encodeURIComponent(id)}/presenter`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${hostToken}` },
        body: JSON.stringify({ identity }),
      })
    },
    async reservarLink(slug: string, segredo: string, nome: string) {
      const caminho = `/links/${encodeURIComponent(slug)}`
      const corpo = { ...json({ segredo, nome }), method: 'PUT' }
      return linkReservadoSchema.parse(await chamar(caminho, corpo))
    },
    async estadoDoLink(slug: string): Promise<EstadoLink> {
      return estadoLinkSchema.parse(await chamar(`/links/${encodeURIComponent(slug)}`, {}))
    },
    /** O EventSource não passa pelo cliente: precisa do endereço completo. */
    urlEventosDoLink(slug: string): string {
      return `${base}/api/links/${encodeURIComponent(slug)}/events`
    },
    async apontarLink(
      slug: string,
      segredo: string,
      sessao: Pick<SessaoCriada, 'id' | 'hostToken'>,
    ): Promise<void> {
      await chamar(`/links/${encodeURIComponent(slug)}/live`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${sessao.hostToken}`,
        },
        body: JSON.stringify({ segredo, sessionId: sessao.id }),
      })
    },
    async desapontarLink(slug: string, segredo: string): Promise<void> {
      await chamar(`/links/${encodeURIComponent(slug)}/live`, {
        ...json({ segredo }),
        method: 'DELETE',
        // Também sai no pagehide, junto com o encerramento da sessão.
        keepalive: true,
      })
    },
  }
}

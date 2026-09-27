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

export type SessaoCriada = z.infer<typeof sessaoCriadaSchema>
type Entrada = z.infer<typeof entradaSchema>

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem)
    this.name = 'ErroApi'
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
    async medirUploadKbps(bytes = 1_000_000, agora = () => performance.now()): Promise<number> {
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
  }
}

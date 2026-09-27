import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { apelidoAleatorio, type SessaoMetadata } from '@telando/core'
import { Hono } from 'hono'
import { customAlphabet, nanoid } from 'nanoid'
import { z } from 'zod'
import type { Deps } from './app.ts'
import { erroApi, lerCorpo } from './http.ts'
import { limitarPorIp } from './limite.ts'
import { emitirLivekitToken } from './tokens.ts'

type Sessao = { hostTokenHash: Buffer }
export type RegistroSessoes = Map<string, Sessao>

// Sem 0/O, 1/l/I: o link às vezes é ditado ou copiado à mão.
const novoIdSessao = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz', 12)

const hash = (hostToken: string) => createHash('sha256').update(hostToken).digest()

const nomeSchema = z.string().trim().max(32)
const criarSchema = z.object({ nome: nomeSchema.optional() })
const entrarSchema = z.object({ apelido: nomeSchema.optional() })

const MINUTO = 60_000

export function rotasSessoes(deps: Deps, sessoes: RegistroSessoes) {
  const { env, salas } = deps

  function buscar(id: string): Sessao {
    const sessao = sessoes.get(id)
    if (!sessao) {
      throw erroApi(
        404,
        'sessao_nao_encontrada',
        'Esse link não leva a nenhuma sessão. Ela pode ter acabado.',
      )
    }
    return sessao
  }

  function exigirHost(sessao: Sessao, authorization: string | undefined) {
    const hostToken = authorization?.match(/^Bearer (.+)$/)?.[1]
    if (!hostToken) throw erroApi(401, 'sem_token', 'Só quem criou a sessão pode fazer isso.')
    if (!timingSafeEqual(hash(hostToken), sessao.hostTokenHash)) {
      throw erroApi(403, 'token_invalido', 'Só quem criou a sessão pode fazer isso.')
    }
  }

  return new Hono()
    .post(
      '/',
      limitarPorIp(deps, {
        limite: 10,
        janelaMs: MINUTO,
        codigo: 'muitas_sessoes',
        mensagem: 'Você criou sessões demais em pouco tempo. Espere um minuto.',
      }),
      async (c) => {
        const { nome } = await lerCorpo(c, criarSchema)
        const id = novoIdSessao()
        const hostToken = randomBytes(32).toString('base64url')
        const hostIdentity = `h_${nanoid(10)}`
        const hostNome = nome || 'Host'
        const metadata: SessaoMetadata = {
          v: 1,
          hostIdentity,
          hostNome,
          presenterIdentity: null,
          trancada: false,
        }

        await salas.criar(id, metadata)
        sessoes.set(id, { hostTokenHash: hash(hostToken) })

        return c.json(
          {
            id,
            url: `${env.PUBLIC_BASE_URL}/s/${id}`,
            livekitUrl: env.LIVEKIT_URL,
            hostToken,
            livekitToken: await emitirLivekitToken(env, {
              sala: id,
              identity: hostIdentity,
              nome: hostNome,
              papel: 'host',
            }),
          },
          201,
        )
      },
    )
    .post(
      '/:id/join',
      limitarPorIp(deps, {
        limite: 30,
        janelaMs: MINUTO,
        codigo: 'muitas_entradas',
        mensagem: 'Muitas tentativas de entrar em pouco tempo. Espere um minuto.',
      }),
      async (c) => {
        const id = c.req.param('id')
        buscar(id)
        const { apelido } = await lerCorpo(c, entrarSchema)
        const identity = `v_${nanoid(10)}`

        return c.json({
          livekitUrl: env.LIVEKIT_URL,
          livekitToken: await emitirLivekitToken(env, {
            sala: id,
            identity,
            nome: apelido || apelidoAleatorio(),
            papel: 'espectador',
          }),
        })
      },
    )
    .delete('/:id', async (c) => {
      const id = c.req.param('id')
      exigirHost(buscar(id), c.req.header('authorization'))
      await salas.apagar(id)
      sessoes.delete(id)
      return c.body(null, 204)
    })
}

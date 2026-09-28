import { randomBytes } from 'node:crypto'
import {
  ALFABETO_ID_SESSAO,
  apelidoAleatorio,
  type SessaoMetadata,
  TAMANHO_ID_SESSAO,
} from '@telando/core'
import { Hono } from 'hono'
import { customAlphabet, nanoid } from 'nanoid'
import { z } from 'zod'
import type { Deps } from './app.ts'
import { erroApi, lerCorpo } from './http.ts'
import { limitarPorIp } from './limite.ts'
import { hashDoHostToken, type RegistroSessoes } from './registro-sessoes.ts'
import { emitirLivekitToken } from './tokens.ts'

const novoIdSessao = customAlphabet(ALFABETO_ID_SESSAO, TAMANHO_ID_SESSAO)

const nomeSchema = z.string().trim().max(32)
const criarSchema = z.object({ nome: nomeSchema.optional() })
const entrarSchema = z.object({ apelido: nomeSchema.optional() })
const trancarSchema = z.object({ trancada: z.boolean() })
const presenterSchema = z.object({ identity: z.string().min(1).max(64).nullable() })

const MINUTO = 60_000

export function rotasSessoes(deps: Deps, sessoes: RegistroSessoes) {
  const { env, salas } = deps
  const { buscar, exigirHost } = sessoes

  return new Hono()
    .post(
      '/',
      limitarPorIp(deps, {
        limite: env.SESSOES_POR_MINUTO,
        janelaMs: MINUTO,
        codigo: 'muitas_sessoes',
        mensagem: 'Você criou sessões demais em pouco tempo. Espere um minuto.',
      }),
      async (c) => {
        const { nome } = await lerCorpo(c, criarSchema)
        const id = novoIdSessao()
        const hostToken = randomBytes(32).toString('base64url')
        const hostIdentity = `h_${nanoid(10)}`
        const hostNome = nome ?? ''
        const metadata: SessaoMetadata = {
          v: 1,
          hostIdentity,
          hostNome,
          presenterIdentity: null,
          trancada: false,
        }

        await salas.criar(id, metadata)
        sessoes.adicionar(id, {
          hostTokenHash: hashDoHostToken(hostToken),
          metadata,
          conexoes: new Map(),
        })

        return c.json(
          {
            id,
            url: `${env.PUBLIC_BASE_URL}/s/${id}`,
            livekitUrl: env.LIVEKIT_URL,
            hostToken,
            livekitToken: await emitirLivekitToken(env, {
              sala: id,
              identity: hostIdentity,
              nome: hostNome || 'Host',
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
        if (buscar(id).metadata.trancada) {
          throw erroApi(
            423,
            'sessao_trancada',
            'O host trancou a sessão. Peça para ele destrancar.',
          )
        }
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
    .get('/:id', (c) => {
      const { hostNome, trancada } = buscar(c.req.param('id')).metadata
      return c.json({ hostNome, trancada })
    })
    .delete('/:id', async (c) => {
      const id = c.req.param('id')
      exigirHost(buscar(id), c.req.header('authorization'))
      await salas.apagar(id)
      sessoes.encerrar(id)
      return c.body(null, 204)
    })
    .put('/:id/trancada', async (c) => {
      const id = c.req.param('id')
      const sessao = buscar(id)
      exigirHost(sessao, c.req.header('authorization'))
      const { trancada } = await lerCorpo(c, trancarSchema)
      await sessoes.mudarMetadata(id, { trancada })
      return c.body(null, 204)
    })
    .delete('/:id/participantes/:identity', async (c) => {
      const { id, identity } = c.req.param()
      const sessao = buscar(id)
      exigirHost(sessao, c.req.header('authorization'))
      if (identity === sessao.metadata.hostIdentity) {
        throw erroApi(400, 'remover_host', 'Para sair, pare a transmissão.')
      }
      await salas.remover(id, identity)
      return c.body(null, 204)
    })
    .post('/:id/presenter', async (c) => {
      const id = c.req.param('id')
      const sessao = buscar(id)
      exigirHost(sessao, c.req.header('authorization'))
      const { identity } = await lerCorpo(c, presenterSchema)
      if (identity === sessao.metadata.hostIdentity) {
        throw erroApi(
          400,
          'vez_do_host',
          'Para voltar a mostrar a sua tela, use "Retomar minha tela".',
        )
      }
      if (identity && !(await salas.participantes(id)).includes(identity)) {
        throw erroApi(404, 'participante_nao_encontrado', 'Essa pessoa não está mais na sessão.')
      }
      // Uma tela por vez: quem apresentava perde a permissão antes de a vez mudar.
      const anterior = sessao.metadata.presenterIdentity
      if (anterior && anterior !== identity) await salas.permitirTela(id, anterior, false)
      if (identity) await salas.permitirTela(id, identity, true)
      await sessoes.mudarMetadata(id, { presenterIdentity: identity })
      return c.body(null, 204)
    })
}

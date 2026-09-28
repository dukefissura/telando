import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import type { Deps } from './app.ts'
import { erroApi, lerCorpo } from './http.ts'
import { limitarPorIp } from './limite.ts'
import type { RegistroSessoes } from './registro-sessoes.ts'

// Palavras que já são rotas do site ou poderiam confundir quem recebe o link.
const PROIBIDOS = new Set([
  's',
  'api',
  'admin',
  'assets',
  'updates',
  'health',
  'livekit',
  'app',
  'static',
])

const slugSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/)
  .refine((slug) => !PROIBIDOS.has(slug))
const segredoSchema = z.string().min(43).max(200)
const reservarSchema = z.object({ segredo: segredoSchema, nome: z.string().trim().min(1).max(32) })
const apontarSchema = z.object({ segredo: segredoSchema, sessionId: z.string().min(1).max(64) })
const desapontarSchema = z.object({ segredo: segredoSchema })

const INTERVALO_PING_MS = 25_000

export function rotasLinks(deps: Deps, sessoes: RegistroSessoes) {
  const { env, links } = deps
  const urlDo = (slug: string) => `${env.PUBLIC_BASE_URL}/${slug}`

  function validarSlug(bruto: string) {
    const resultado = slugSchema.safeParse(bruto)
    if (!resultado.success) {
      throw erroApi(
        400,
        'slug_invalido',
        'Use de 3 a 20 letras minúsculas, números ou hífen, sem hífen nas pontas.',
      )
    }
    return resultado.data
  }

  async function exigirDono(slug: string, segredo: string) {
    if (!(await links.confere(slug, segredo))) {
      throw erroApi(403, 'nao_e_o_dono', 'Esse link fixo pertence a outra pessoa.')
    }
  }

  return new Hono()
    .put(
      '/:slug',
      limitarPorIp(deps, {
        limite: 10,
        janelaMs: 60_000,
        codigo: 'muitas_reservas',
        mensagem: 'Muitas tentativas seguidas. Espere um minuto.',
      }),
      async (c) => {
        const slug = validarSlug(c.req.param('slug'))
        const { segredo, nome } = await lerCorpo(c, reservarSchema)
        const resultado = await links.reservar(slug, segredo, nome)
        if (resultado === 'ocupado') {
          throw erroApi(409, 'link_ocupado', 'Esse link já tem dono. Tente outro.')
        }
        return c.json({ url: urlDo(slug) }, resultado === 'criado' ? 201 : 200)
      },
    )
    .get('/:slug', (c) => {
      const slug = validarSlug(c.req.param('slug'))
      const estado = links.estado(slug)
      if (!estado) throw erroApi(404, 'link_livre', 'Ninguém usa esse link fixo.')
      return c.json({ ...estado, url: urlDo(slug) })
    })
    .get('/:slug/events', (c) => {
      const slug = validarSlug(c.req.param('slug'))
      const inicial = links.estado(slug)
      if (!inicial) throw erroApi(404, 'link_livre', 'Ninguém usa esse link fixo.')

      return streamSSE(c, async (stream) => {
        const enviar = (estado: unknown) =>
          void stream.writeSSE({ event: 'status', data: JSON.stringify(estado) })
        enviar(inicial)
        const pararDeOuvir = links.ouvir(slug, enviar)
        // Proxies derrubam conexões ociosas; o ping mantém a espera viva.
        const ping = setInterval(
          () => void stream.writeSSE({ event: 'ping', data: '' }),
          INTERVALO_PING_MS,
        )
        await new Promise<void>((resolver) => stream.onAbort(resolver))
        clearInterval(ping)
        pararDeOuvir()
      })
    })
    .post('/:slug/live', async (c) => {
      const slug = validarSlug(c.req.param('slug'))
      const { segredo, sessionId } = await lerCorpo(c, apontarSchema)
      await exigirDono(slug, segredo)
      sessoes.exigirHost(sessoes.buscar(sessionId), c.req.header('authorization'))
      links.apontar(slug, sessionId)
      return c.body(null, 204)
    })
    .delete('/:slug/live', async (c) => {
      const slug = validarSlug(c.req.param('slug'))
      const { segredo } = await lerCorpo(c, desapontarSchema)
      await exigirDono(slug, segredo)
      links.desapontar(slug)
      return c.body(null, 204)
    })
}

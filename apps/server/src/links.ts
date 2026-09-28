import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { promisify } from 'node:util'
import { z } from 'zod'

const derivar = promisify(scrypt) as (
  segredo: string,
  salt: Buffer,
  tamanho: number,
) => Promise<Buffer>

const linkGuardadoSchema = z.object({ nome: z.string(), salt: z.string(), hash: z.string() })
const arquivoSchema = z.record(z.string(), linkGuardadoSchema)
type LinkGuardado = z.infer<typeof linkGuardadoSchema>

export type EstadoLink = { nome: string; aoVivo: boolean; sessionId?: string }
type Ouvinte = (estado: EstadoLink) => void

async function hashDe(segredo: string, salt: Buffer) {
  return derivar(segredo, salt, 32)
}

async function lerArquivo(arquivo: string): Promise<Record<string, LinkGuardado>> {
  try {
    return arquivoSchema.parse(JSON.parse(await readFile(arquivo, 'utf8')))
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw erro
  }
}

/**
 * Links fixos: a reserva (slug → dono) fica em disco; o "ao vivo" (slug → sessão) só em memória,
 * porque uma sessão não sobrevive a um reinício do server.
 */
export async function criarRegistroLinks(arquivo: string) {
  const links = await lerArquivo(arquivo)
  const aoVivo = new Map<string, string>()
  const ouvintes = new Map<string, Set<Ouvinte>>()
  let gravacao = Promise.resolve()

  // Grava num temporário e renomeia: um crash no meio nunca deixa o arquivo pela metade.
  function gravar() {
    gravacao = gravacao.then(async () => {
      await mkdir(dirname(arquivo), { recursive: true })
      const temporario = `${arquivo}.${process.pid}.tmp`
      await writeFile(temporario, JSON.stringify(links, null, 2))
      await rename(temporario, arquivo)
    })
    return gravacao
  }

  function estado(slug: string): EstadoLink | null {
    const link = links[slug]
    if (!link) return null
    const sessionId = aoVivo.get(slug)
    return sessionId
      ? { nome: link.nome, aoVivo: true, sessionId }
      : { nome: link.nome, aoVivo: false }
  }

  function avisar(slug: string) {
    const atual = estado(slug)
    if (atual) for (const ouvinte of ouvintes.get(slug) ?? []) ouvinte(atual)
  }

  async function confere(slug: string, segredo: string): Promise<boolean> {
    const link = links[slug]
    if (!link) return false
    const esperado = Buffer.from(link.hash, 'base64')
    return timingSafeEqual(await hashDe(segredo, Buffer.from(link.salt, 'base64')), esperado)
  }

  return {
    estado,

    /** 'criado' na primeira vez, 'atualizado' se o segredo é do mesmo dono, 'ocupado' se não. */
    async reservar(slug: string, segredo: string, nome: string) {
      if (links[slug]) {
        if (!(await confere(slug, segredo))) return 'ocupado' as const
        links[slug] = { ...links[slug], nome }
        await gravar()
        avisar(slug)
        return 'atualizado' as const
      }
      const salt = randomBytes(16)
      links[slug] = {
        nome,
        salt: salt.toString('base64'),
        hash: (await hashDe(segredo, salt)).toString('base64'),
      }
      await gravar()
      return 'criado' as const
    },

    confere,

    apontar(slug: string, sessionId: string) {
      aoVivo.set(slug, sessionId)
      avisar(slug)
    },

    desapontar(slug: string) {
      aoVivo.delete(slug)
      avisar(slug)
    },

    sessaoAcabou(sessionId: string) {
      for (const [slug, id] of aoVivo) {
        if (id === sessionId) {
          aoVivo.delete(slug)
          avisar(slug)
        }
      }
    },

    ouvir(slug: string, ouvinte: Ouvinte) {
      const conjunto = ouvintes.get(slug) ?? new Set()
      conjunto.add(ouvinte)
      ouvintes.set(slug, conjunto)
      return () => {
        conjunto.delete(ouvinte)
        if (conjunto.size === 0) ouvintes.delete(slug)
      }
    },
  }
}

export type RegistroLinks = Awaited<ReturnType<typeof criarRegistroLinks>>

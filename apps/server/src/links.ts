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

// Map, e não objeto: um slug como "constructor" não pode esbarrar no protótipo do JavaScript.
async function lerArquivo(arquivo: string): Promise<Map<string, LinkGuardado>> {
  try {
    return new Map(Object.entries(arquivoSchema.parse(JSON.parse(await readFile(arquivo, 'utf8')))))
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return new Map()
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
  // Reservas rodam uma por vez: duas pessoas pedindo o mesmo link livre não podem ambas levar.
  let fila: Promise<unknown> = Promise.resolve()

  // Grava num temporário e renomeia: um crash no meio nunca deixa o arquivo pela metade.
  async function gravar() {
    await mkdir(dirname(arquivo), { recursive: true })
    const temporario = `${arquivo}.${process.pid}.tmp`
    await writeFile(temporario, JSON.stringify(Object.fromEntries(links), null, 2))
    await rename(temporario, arquivo)
  }

  /** Muda a memória e grava; se a gravação falhar, a memória volta como estava. */
  async function guardar(slug: string, novo: LinkGuardado) {
    const anterior = links.get(slug)
    links.set(slug, novo)
    try {
      await gravar()
    } catch (erro) {
      if (anterior) links.set(slug, anterior)
      else links.delete(slug)
      throw erro
    }
  }

  function estado(slug: string): EstadoLink | null {
    const link = links.get(slug)
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
    const link = links.get(slug)
    if (!link) return false
    const esperado = Buffer.from(link.hash, 'base64')
    return timingSafeEqual(await derivar(segredo, Buffer.from(link.salt, 'base64'), 32), esperado)
  }

  async function reservarAgora(slug: string, segredo: string, nome: string) {
    const existente = links.get(slug)
    if (existente) {
      if (!(await confere(slug, segredo))) return 'ocupado' as const
      await guardar(slug, { ...existente, nome })
      avisar(slug)
      return 'atualizado' as const
    }
    const salt = randomBytes(16)
    const hash = await derivar(segredo, salt, 32)
    await guardar(slug, { nome, salt: salt.toString('base64'), hash: hash.toString('base64') })
    return 'criado' as const
  }

  return {
    estado,

    /** 'criado' na primeira vez, 'atualizado' se o segredo é do mesmo dono, 'ocupado' se não. */
    reservar(slug: string, segredo: string, nome: string) {
      const reserva = fila.then(() => reservarAgora(slug, segredo, nome))
      fila = reserva.catch(() => {
        // O erro já chegou a quem pediu esta reserva; a fila segue para a próxima.
      })
      return reserva
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

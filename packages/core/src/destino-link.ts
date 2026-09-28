// Os mesmos formatos que o server gera e aceita (sessoes.ts e rotas-links.ts).
const ID_SESSAO = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz]{12}$/
const SLUG = /^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/

export type Destino = { tipo: 'sessao'; id: string } | { tipo: 'linkFixo'; slug: string }

/**
 * Lê um link colado ou recebido pelo protocolo. O domínio não importa: o app só fala com o próprio
 * server, então só o caminho decide para onde ir.
 */
export function destinoDoLink(texto: string): Destino | null {
  let url: URL
  try {
    url = new URL(texto.trim())
  } catch {
    return null
  }
  // Em telando://s/abc o "s" vira o host da URL; em https://x/s/abc ele fica no caminho.
  const partes =
    url.protocol === 'telando:'
      ? [url.hostname, ...url.pathname.split('/')]
      : url.protocol === 'https:' || url.protocol === 'http:'
        ? url.pathname.split('/')
        : null
  if (!partes) return null
  const [primeira, segunda, ...resto] = partes.filter(Boolean)
  if (resto.length > 0) return null
  if (primeira === 's' && segunda && ID_SESSAO.test(segunda)) return { tipo: 'sessao', id: segunda }
  if (primeira && !segunda && SLUG.test(primeira)) return { tipo: 'linkFixo', slug: primeira }
  return null
}

// Sem 0/O, 1/l/I: o link às vezes é ditado ou copiado à mão. O server gera ids com este alfabeto.
export const ALFABETO_ID_SESSAO = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'
// 8 caracteres: 56⁸, uns 97 trilhões de códigos, para sessões que duram horas. Até a 0.4.0 eram 12,
// e esses links antigos continuam valendo.
export const TAMANHO_ID_SESSAO = 8
const TAMANHO_ID_ANTIGO = 12
const ID_SESSAO = new RegExp(
  `^(?:[${ALFABETO_ID_SESSAO}]{${TAMANHO_ID_SESSAO}}|[${ALFABETO_ID_SESSAO}]{${TAMANHO_ID_ANTIGO}})$`,
)
/** Formato do link fixo (luan, bia-2); o server recusa outros. */
export const SLUG_LINK_FIXO = /^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/

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
  if (primeira && !segunda && SLUG_LINK_FIXO.test(primeira))
    return { tipo: 'linkFixo', slug: primeira }
  return null
}

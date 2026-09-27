import type { MiddlewareHandler } from 'hono'
import type { Deps } from './app.ts'
import { erroApi } from './http.ts'

type OpcoesLimite = { limite: number; janelaMs: number; agora?: (() => number) | undefined }

// Acima disso varremos as chaves velhas, para um monte de IPs diferentes não crescer a memória sem fim.
const CHAVES_ANTES_DE_VARRER = 1000

export function limitePorJanela({ limite, janelaMs, agora = Date.now }: OpcoesLimite) {
  const tentativas = new Map<string, number[]>()

  return (chave: string): boolean => {
    const inicioDaJanela = agora() - janelaMs
    if (tentativas.size > CHAVES_ANTES_DE_VARRER) {
      for (const [outra, horarios] of tentativas) {
        if (horarios.every((t) => t <= inicioDaJanela)) tentativas.delete(outra)
      }
    }

    const recentes = (tentativas.get(chave) ?? []).filter((t) => t > inicioDaJanela)
    const permitido = recentes.length < limite
    if (permitido) recentes.push(agora())
    tentativas.set(chave, recentes)
    return permitido
  }
}

export function limitarPorIp(
  { ipDoCliente, agora }: Pick<Deps, 'ipDoCliente' | 'agora'>,
  {
    limite,
    janelaMs,
    codigo,
    mensagem,
  }: { limite: number; janelaMs: number; codigo: string; mensagem: string },
): MiddlewareHandler {
  const permitir = limitePorJanela({ limite, janelaMs, agora })
  return async (c, next) => {
    if (!permitir(ipDoCliente(c))) throw erroApi(429, codigo, mensagem)
    await next()
  }
}

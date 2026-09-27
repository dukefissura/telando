import type { MiddlewareHandler } from 'hono'
import type { Deps } from './app.ts'
import { erroApi } from './http.ts'

type OpcoesLimite = { limite: number; janelaMs: number; agora?: (() => number) | undefined }

export function limitePorJanela({ limite, janelaMs, agora = Date.now }: OpcoesLimite) {
  const tentativas = new Map<string, number[]>()
  let ultimaVarredura = agora()

  return (chave: string): boolean => {
    const inicioDaJanela = agora() - janelaMs
    // Uma vez por janela, esquece os IPs que pararam de pedir, para a memória não crescer sem fim.
    if (agora() - ultimaVarredura > janelaMs) {
      ultimaVarredura = agora()
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

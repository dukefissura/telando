import { createHash, timingSafeEqual } from 'node:crypto'
import type { SessaoMetadata } from '@telando/core'
import { erroApi } from './http.ts'
import type { SalaGateway } from './salas.ts'

export type Sessao = {
  hostTokenHash: Buffer
  metadata: SessaoMetadata
  /** Timer que encerra a sessão se o host caiu e não voltou. */
  quedaDoHost?: ReturnType<typeof setTimeout>
  /** Conexão atual do host no LiveKit, para ignorar eventos atrasados de conexões antigas. */
  hostSid?: string | undefined
}

export const hashDoHostToken = (hostToken: string) =>
  createHash('sha256').update(hostToken).digest()

/** Sessões vivas em memória. `aoEncerrar` roda sempre que uma sessão deixa de existir. */
export function criarRegistroSessoes(salas: SalaGateway, aoEncerrar: (id: string) => void) {
  const sessoes = new Map<string, Sessao>()

  return {
    adicionar(id: string, sessao: Sessao) {
      sessoes.set(id, sessao)
    },

    obter(id: string) {
      return sessoes.get(id)
    },

    buscar(id: string): Sessao {
      const sessao = sessoes.get(id)
      if (!sessao) {
        throw erroApi(
          404,
          'sessao_nao_encontrada',
          'Esse link não leva a nenhuma sessão. Ela pode ter acabado.',
        )
      }
      return sessao
    },

    exigirHost(sessao: Sessao, authorization: string | undefined) {
      const hostToken = authorization?.match(/^Bearer (.+)$/)?.[1]
      if (!hostToken) throw erroApi(401, 'sem_token', 'Só quem criou a sessão pode fazer isso.')
      if (!timingSafeEqual(hashDoHostToken(hostToken), sessao.hostTokenHash)) {
        throw erroApi(403, 'token_invalido', 'Só quem criou a sessão pode fazer isso.')
      }
    },

    /** Grava no LiveKit primeiro: se falhar, a memória não fica dizendo algo que a sala não sabe. */
    async mudarMetadata(id: string, mudanca: Partial<SessaoMetadata>) {
      const sessao = sessoes.get(id)
      if (!sessao) return
      const metadata = { ...sessao.metadata, ...mudanca }
      await salas.atualizarMetadata(id, metadata)
      sessao.metadata = metadata
    },

    encerrar(id: string) {
      const sessao = sessoes.get(id)
      if (!sessao) return
      clearTimeout(sessao.quedaDoHost)
      sessoes.delete(id)
      aoEncerrar(id)
    },
  }
}

export type RegistroSessoes = ReturnType<typeof criarRegistroSessoes>

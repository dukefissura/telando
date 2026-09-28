import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SessaoMetadata } from '@telando/core'
import type { Env } from './env.ts'
import { criarRegistroLinks } from './links.ts'
import type { SalaGateway } from './salas.ts'

export const envDeTeste: Env = {
  PORT: 8787,
  PUBLIC_BASE_URL: 'https://telando.test',
  LIVEKIT_URL: 'ws://livekit.test',
  LIVEKIT_API_KEY: 'devkey',
  LIVEKIT_API_SECRET: 'segredo-de-teste-com-32-caracteres!!',
  TRUST_PROXY: '0',
  DATA_DIR: 'data',
}

/** Registro de links num diretório temporário, um por teste. */
export async function linksDeTeste() {
  return criarRegistroLinks(join(await mkdtemp(join(tmpdir(), 'telando-')), 'links.json'))
}

export function gatewayFalso() {
  const salas = new Map<string, SessaoMetadata>()
  const removidos: Array<{ sala: string; identity: string }> = []
  const gateway: SalaGateway = {
    async criar(id, metadata) {
      salas.set(id, metadata)
    },
    async atualizarMetadata(id, metadata) {
      salas.set(id, metadata)
    },
    async remover(sala, identity) {
      removidos.push({ sala, identity })
    },
    async apagar(id) {
      salas.delete(id)
    },
    async apagarTodas() {
      salas.clear()
    },
  }
  return { salas, removidos, gateway }
}

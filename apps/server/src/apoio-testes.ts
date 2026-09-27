import type { SessaoMetadata } from '@telando/core'
import type { Env } from './env.ts'
import type { SalaGateway } from './salas.ts'

export const envDeTeste: Env = {
  PORT: 8787,
  PUBLIC_BASE_URL: 'https://telando.test',
  LIVEKIT_URL: 'ws://livekit.test',
  LIVEKIT_API_KEY: 'devkey',
  LIVEKIT_API_SECRET: 'segredo-de-teste-com-32-caracteres!!',
  TRUST_PROXY: '0',
}

export function gatewayFalso() {
  const salas = new Map<string, SessaoMetadata>()
  const gateway: SalaGateway = {
    async criar(id, metadata) {
      salas.set(id, metadata)
    },
    async apagar(id) {
      salas.delete(id)
    },
    async apagarTodas() {
      salas.clear()
    },
  }
  return { salas, gateway }
}

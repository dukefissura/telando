import type { SessaoMetadata } from '@telando/core'
import { RoomServiceClient } from 'livekit-server-sdk'
import type { Env } from './env.ts'

export interface SalaGateway {
  criar(id: string, metadata: SessaoMetadata): Promise<void>
  apagar(id: string): Promise<void>
  apagarTodas(): Promise<void>
}

export function criarSalaGateway(env: Env): SalaGateway {
  const cliente = new RoomServiceClient(
    env.LIVEKIT_URL.replace(/^ws/, 'http'),
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET,
  )

  return {
    async criar(id, metadata) {
      await cliente.createRoom({
        name: id,
        // Se o host não entrar, ou cair sem ninguém assistindo, a sala some sozinha.
        emptyTimeout: 60,
        departureTimeout: 60,
        maxParticipants: 16,
        metadata: JSON.stringify(metadata),
      })
    },
    async apagar(id) {
      await cliente.deleteRoom(id)
    },
    async apagarTodas() {
      const salas = await cliente.listRooms()
      await Promise.all(salas.map((sala) => cliente.deleteRoom(sala.name)))
    },
  }
}

import type { SessaoMetadata } from '@telando/core'
import { RoomServiceClient, ServerError, TrackSource } from 'livekit-server-sdk'
import type { Env } from './env.ts'

export interface SalaGateway {
  criar(id: string, metadata: SessaoMetadata): Promise<void>
  atualizarMetadata(id: string, metadata: SessaoMetadata): Promise<void>
  participantes(id: string): Promise<string[]>
  /** Dá (ou tira) a permissão de publicar só tela e áudio da tela. */
  permitirTela(id: string, identity: string, permitir: boolean): Promise<void>
  remover(id: string, identity: string): Promise<void>
  apagar(id: string): Promise<void>
  apagarTodas(): Promise<void>
}

// A sala ou a pessoa podem já ter saído sem o webhook ter chegado; o objetivo foi atingido.
function ignorarSeNaoExiste(erro: unknown) {
  if (erro instanceof ServerError && erro.code === 'not_found') return
  throw erro
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
    async atualizarMetadata(id, metadata) {
      await cliente.updateRoomMetadata(id, JSON.stringify(metadata))
    },
    async participantes(id) {
      return (await cliente.listParticipants(id)).map((participante) => participante.identity)
    },
    async permitirTela(id, identity, permitir) {
      await cliente
        .updateParticipant(id, identity, {
          permission: {
            canSubscribe: true,
            canPublishData: true,
            canPublish: permitir,
            canPublishSources: permitir
              ? [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO]
              : [],
          },
        })
        .catch(ignorarSeNaoExiste)
    },
    async remover(id, identity) {
      await cliente.removeParticipant(id, identity).catch(ignorarSeNaoExiste)
    },
    async apagar(id) {
      await cliente.deleteRoom(id).catch(ignorarSeNaoExiste)
    },
    async apagarTodas() {
      const salas = await cliente.listRooms()
      await Promise.all(salas.map((sala) => cliente.deleteRoom(sala.name)))
    },
  }
}

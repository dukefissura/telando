import { type RemoteParticipant, type Room, RoomEvent } from 'livekit-client'
import { useCallback, useEffect, useRef } from 'react'
import { type AvisoRevezamento, codificarAviso, lerAviso, TOPICO } from '../protocolo.ts'

export type Remetente = { identity: string; nome: string }

const ESPERA_PELO_NOME_MS = 5000

/**
 * O LiveKit avisa sobre quem só assiste com alguns segundos de atraso (agrupa essas atualizações),
 * então o aviso pode chegar antes de sabermos o apelido de quem mandou.
 */
function nomeDe(room: Room, identity: string): Promise<string> {
  const conhecido = room.getParticipantByIdentity(identity)
  if (conhecido) return Promise.resolve(conhecido.name || 'Sem apelido')
  return new Promise((resolver) => {
    const terminar = (nome: string) => {
      clearTimeout(timer)
      room.off(RoomEvent.ParticipantConnected, aoEntrar)
      resolver(nome)
    }
    const aoEntrar = (participante: RemoteParticipant) => {
      if (participante.identity === identity) terminar(participante.name || 'Sem apelido')
    }
    const timer = setTimeout(() => terminar('Alguém'), ESPERA_PELO_NOME_MS)
    room.on(RoomEvent.ParticipantConnected, aoEntrar)
  })
}

/**
 * Os avisos do revezamento (pedir, cancelar, recusar, devolver a vez) entre host e quem assiste.
 * O LiveKit aceita um só handler de text stream por tópico: este hook é o único que escuta a sala.
 */
export function useAvisosSala(
  room: Room | null,
  aoAviso: (aviso: AvisoRevezamento, de: Remetente) => void,
) {
  const aoAvisoAtual = useRef(aoAviso)
  aoAvisoAtual.current = aoAviso

  useEffect(() => {
    if (!room) return
    // Text streams dizem quem mandou mesmo quando o participante ainda não apareceu para nós.
    room.registerTextStreamHandler(TOPICO, async (leitor, { identity }) => {
      const aviso = lerAviso(await leitor.readAll())
      if (!aviso) return
      aoAvisoAtual.current(aviso, { identity, nome: await nomeDe(room, identity) })
    })
    return () => room.unregisterTextStreamHandler(TOPICO)
  }, [room])

  return useCallback(
    async (aviso: AvisoRevezamento, para: string) => {
      if (!room) return
      await room.localParticipant.sendText(codificarAviso(aviso), {
        topic: TOPICO,
        destinationIdentities: [para],
      })
    },
    [room],
  )
}

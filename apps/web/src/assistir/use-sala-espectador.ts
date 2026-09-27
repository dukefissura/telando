import { ErroApi } from '@telando/core'
import { DisconnectReason, Room, RoomEvent } from 'livekit-client'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.ts'

export type SalaEspectador =
  | { fase: 'formulario' }
  | { fase: 'entrando' }
  | { fase: 'conectado'; room: Room }
  | { fase: 'encerrada' }
  | { fase: 'invalida' }
  | { fase: 'erro'; mensagem: string }

export function useSalaEspectador(id: string) {
  const [sala, setSala] = useState<SalaEspectador>({ fase: 'formulario' })

  const entrar = useCallback(
    async (apelido: string) => {
      setSala({ fase: 'entrando' })
      const room = new Room({ adaptiveStream: true, dynacast: true })
      try {
        const entrada = await api.entrarNaSessao(id, apelido)
        room.on(RoomEvent.Disconnected, (motivo) => {
          setSala(
            motivo === DisconnectReason.ROOM_DELETED
              ? { fase: 'encerrada' }
              : { fase: 'erro', mensagem: 'A conexão caiu. Recarregue a página para voltar.' },
          )
        })
        await room.connect(entrada.livekitUrl, entrada.livekitToken)
        // Chamado dentro do clique em "Assistir": é o gesto que o navegador exige para tocar som.
        await room.startAudio()
        setSala({ fase: 'conectado', room })
      } catch (erro) {
        room.removeAllListeners()
        await room.disconnect()
        if (erro instanceof ErroApi && erro.codigo === 'sessao_nao_encontrada') {
          setSala({ fase: 'invalida' })
        } else {
          setSala({
            fase: 'erro',
            mensagem:
              erro instanceof ErroApi ? erro.message : 'Não consegui entrar. Tente de novo.',
          })
        }
      }
    },
    [id],
  )

  useEffect(() => {
    if (sala.fase !== 'conectado') return
    return () => void sala.room.disconnect()
  }, [sala])

  return { sala, entrar }
}

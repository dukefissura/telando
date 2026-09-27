import { ErroApi, mensagemDoErro } from '@telando/core'
import { DisconnectReason, Room, RoomEvent } from 'livekit-client'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.ts'

export type SalaEspectador =
  | { fase: 'formulario' }
  | { fase: 'entrando' }
  | { fase: 'conectado'; room: Room }
  | { fase: 'encerrada' }
  | { fase: 'removido' }
  | { fase: 'trancada' }
  | { fase: 'invalida' }
  /** A reconexão automática desistiu. */
  | { fase: 'caiu' }
  | { fase: 'erro'; mensagem: string }

const FASE_POR_CODIGO: Record<string, SalaEspectador> = {
  sessao_nao_encontrada: { fase: 'invalida' },
  sessao_trancada: { fase: 'trancada' },
}

function faseAoDesconectar(motivo: DisconnectReason | undefined): SalaEspectador {
  if (motivo === DisconnectReason.ROOM_DELETED) return { fase: 'encerrada' }
  if (motivo === DisconnectReason.PARTICIPANT_REMOVED) return { fase: 'removido' }
  return { fase: 'caiu' }
}

export function useSalaEspectador(id: string) {
  const [sala, setSala] = useState<SalaEspectador>({ fase: 'formulario' })

  const entrar = useCallback(
    async (apelido: string) => {
      setSala({ fase: 'entrando' })
      const room = new Room({ adaptiveStream: true, dynacast: true })
      try {
        const entrada = await api.entrarNaSessao(id, apelido)
        room.on(RoomEvent.Disconnected, (motivo) => setSala(faseAoDesconectar(motivo)))
        await room.connect(entrada.livekitUrl, entrada.livekitToken)
        // Chamado dentro do clique em "Assistir": é o gesto que o navegador exige para tocar som.
        await room.startAudio()
        setSala({ fase: 'conectado', room })
      } catch (erro) {
        room.removeAllListeners()
        await room.disconnect()
        const porCodigo = erro instanceof ErroApi ? FASE_POR_CODIGO[erro.codigo] : undefined
        setSala(
          porCodigo ?? {
            fase: 'erro',
            mensagem: mensagemDoErro(erro, 'Não consegui entrar. Tente de novo.'),
          },
        )
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

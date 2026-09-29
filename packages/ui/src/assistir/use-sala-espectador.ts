import { ErroApi, mensagemDoErro } from '@telando/core'
import { DisconnectReason, Room, RoomEvent } from 'livekit-client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DURACAO_DESLIGAR_TV_MS } from '../movimento.ts'
import type { Plataforma } from '../plataforma.ts'

export type SalaEspectador =
  | { fase: 'formulario' }
  | { fase: 'entrando' }
  | { fase: 'conectado'; room: Room }
  /** O host parou: o palco toca a TV desligando antes do aviso. */
  | { fase: 'encerrando'; room: Room }
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

export function useSalaEspectador(api: Plataforma['api'], id: string) {
  const [sala, setSala] = useState<SalaEspectador>({ fase: 'formulario' })
  // Um clique duplo (ou o StrictMode montando duas vezes) não pode abrir duas conexões.
  const entrando = useRef(false)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  const entrar = useCallback(
    async (apelido: string) => {
      if (entrando.current) return
      entrando.current = true
      setSala({ fase: 'entrando' })
      // Sem adaptiveStream: o seletor de qualidade do palco decide o tamanho pedido (ver useQualidade).
      const room = new Room()
      try {
        const entrada = await api.entrarNaSessao(id, apelido)
        room.on(RoomEvent.Disconnected, (motivo) => {
          const proxima = faseAoDesconectar(motivo)
          // Só o fim normal ganha a TV desligando; queda e remoção cortam seco, que avisa melhor.
          if (
            proxima.fase !== 'encerrada' ||
            matchMedia('(prefers-reduced-motion: reduce)').matches
          ) {
            setSala(proxima)
            return
          }
          setSala({ fase: 'encerrando', room })
          setTimeout(() => montado.current && setSala(proxima), DURACAO_DESLIGAR_TV_MS)
        })
        await room.connect(entrada.livekitUrl, entrada.livekitToken)
        // A tela pode ter fechado (ou trocado de sessão) enquanto conectava.
        if (!montado.current) {
          room.removeAllListeners()
          await room.disconnect()
          return
        }
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
      } finally {
        entrando.current = false
      }
    },
    [api, id],
  )

  useEffect(() => {
    if (sala.fase !== 'conectado') return
    const { room } = sala
    // Sair de propósito (fechar o app, voltar ao início) não é "a conexão caiu".
    const sair = () => {
      room.removeAllListeners()
      void room.disconnect()
    }
    // Avisar a saída na hora: sem isso, o LiveKit só percebe uns 20 segundos depois.
    window.addEventListener('pagehide', sair)
    return () => {
      window.removeEventListener('pagehide', sair)
      sair()
    }
  }, [sala])

  return { sala, entrar }
}

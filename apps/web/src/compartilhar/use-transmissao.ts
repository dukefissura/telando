import { ErroApi, type SessaoCriada } from '@telando/core'
import { Room, RoomEvent, Track } from 'livekit-client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api.ts'

export type Transmissao =
  | { fase: 'parada' }
  | { fase: 'iniciando' }
  | { fase: 'ao-vivo'; link: string; copiado: boolean; comAudio: boolean; espectadores: number }
  | { fase: 'erro'; mensagem: string }

type Ativa = { sessao: SessaoCriada; room: Room; captura: MediaStream }

function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ErroApi) return erro.message
  return 'Não consegui começar a transmissão. Tente de novo.'
}

function encerrar(sessao: SessaoCriada) {
  return api.encerrarSessao(sessao.id, sessao.hostToken).catch(() => {
    // Se o pedido não chegar, a sala some sozinha pelo emptyTimeout do LiveKit.
  })
}

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    // Sem foco na aba ou sem permissão: o botão "Copiar" continua lá.
    return false
  }
}

export function useTransmissao() {
  const [transmissao, setTransmissao] = useState<Transmissao>({ fase: 'parada' })
  const ativa = useRef<Ativa | null>(null)

  const parar = useCallback(async () => {
    const atual = ativa.current
    if (!atual) return
    ativa.current = null
    for (const trilha of atual.captura.getTracks()) trilha.stop()
    await atual.room.disconnect()
    setTransmissao({ fase: 'parada' })
    await encerrar(atual.sessao)
  }, [])

  const iniciar = useCallback(async () => {
    setTransmissao({ fase: 'iniciando' })

    // O seletor do navegador e a criação da sala correm juntos para o link sair mais rápido.
    const [captura, sessao] = await Promise.allSettled([
      navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true }),
      api.criarSessao(),
    ])

    if (captura.status === 'rejected') {
      if (sessao.status === 'fulfilled') await encerrar(sessao.value)
      const cancelou =
        captura.reason instanceof DOMException && captura.reason.name === 'NotAllowedError'
      setTransmissao(
        cancelou
          ? { fase: 'parada' }
          : { fase: 'erro', mensagem: 'O navegador não deixou capturar a tela.' },
      )
      return
    }
    if (sessao.status === 'rejected') {
      for (const trilha of captura.value.getTracks()) trilha.stop()
      setTransmissao({ fase: 'erro', mensagem: mensagemDeErro(sessao.reason) })
      return
    }

    const room = new Room()
    ativa.current = { sessao: sessao.value, room, captura: captura.value }
    try {
      await room.connect(sessao.value.livekitUrl, sessao.value.livekitToken)
      const [video] = captura.value.getVideoTracks()
      const [audio] = captura.value.getAudioTracks()
      if (!video) throw new Error('Captura sem trilha de vídeo')

      // O "Parar compartilhamento" do próprio navegador encerra a sessão também.
      video.addEventListener('ended', () => void parar())
      await room.localParticipant.publishTrack(video, { source: Track.Source.ScreenShare })
      if (audio) {
        await room.localParticipant.publishTrack(audio, { source: Track.Source.ScreenShareAudio })
      }

      const contarEspectadores = () =>
        setTransmissao((atual) =>
          atual.fase === 'ao-vivo'
            ? { ...atual, espectadores: room.remoteParticipants.size }
            : atual,
        )
      room.on(RoomEvent.ParticipantConnected, contarEspectadores)
      room.on(RoomEvent.ParticipantDisconnected, contarEspectadores)

      setTransmissao({
        fase: 'ao-vivo',
        link: sessao.value.url,
        copiado: await copiar(sessao.value.url),
        comAudio: Boolean(audio),
        espectadores: room.remoteParticipants.size,
      })
    } catch (erro) {
      await parar()
      setTransmissao({ fase: 'erro', mensagem: mensagemDeErro(erro) })
    }
  }, [parar])

  const copiarLink = useCallback(async () => {
    const link = ativa.current?.sessao.url
    if (!link) return
    const copiado = await copiar(link)
    setTransmissao((atual) => (atual.fase === 'ao-vivo' ? { ...atual, copiado } : atual))
  }, [])

  useEffect(() => {
    const aoSair = () => void parar()
    window.addEventListener('pagehide', aoSair)
    return () => {
      window.removeEventListener('pagehide', aoSair)
      void parar()
    }
  }, [parar])

  return { transmissao, iniciar, parar, copiarLink }
}

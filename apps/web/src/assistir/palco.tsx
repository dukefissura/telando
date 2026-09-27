import {
  RoomAudioRenderer,
  type TrackReference,
  useAudioPlayback,
  useConnectionState,
  useIsMuted,
  useRemoteParticipant,
  useRoomContext,
  useRoomInfo,
  useTracks,
  VideoTrack,
} from '@livekit/components-react'
import { lerSessaoMetadata } from '@telando/core'
import { useChatSala } from '@telando/core/cliente'
import { ColunaDeReacoes, PainelChat } from '@telando/ui'
import {
  ConnectionState,
  RemoteTrackPublication,
  RemoteVideoTrack,
  Track,
  VideoQuality,
} from 'livekit-client'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { Aviso } from './aviso.tsx'
import { BarraDeControles, type Qualidade } from './barra-de-controles.tsx'

const OCIOSO_APOS_MS = 3000

/** Fica falso depois de alguns segundos sem mexer o mouse ou o teclado. */
function useAtividade(fixar: boolean) {
  const [ativo, setAtivo] = useState(true)
  useEffect(() => {
    if (fixar) {
      setAtivo(true)
      return
    }
    let timer = setTimeout(() => setAtivo(false), OCIOSO_APOS_MS)
    const mexeu = () => {
      setAtivo(true)
      clearTimeout(timer)
      timer = setTimeout(() => setAtivo(false), OCIOSO_APOS_MS)
    }
    const eventos = ['pointermove', 'pointerdown', 'keydown'] as const
    for (const evento of eventos) window.addEventListener(evento, mexeu)
    return () => {
      clearTimeout(timer)
      for (const evento of eventos) window.removeEventListener(evento, mexeu)
    }
  }, [fixar])
  return ativo
}

function aplicarQualidade(
  publicacao: RemoteTrackPublication,
  qualidade: Qualidade,
  elemento: HTMLVideoElement | null,
) {
  if (qualidade === 'media') return publicacao.setVideoQuality(VideoQuality.MEDIUM)
  if (qualidade === 'baixa') return publicacao.setVideoQuality(VideoQuality.LOW)
  publicacao.setVideoQuality(VideoQuality.HIGH)
  // "Alta" pede a camada cheia mesmo com a janela pequena; "Automática" volta a seguir o tamanho do player.
  const alvo =
    qualidade === 'alta'
      ? publicacao.dimensions
      : elemento && {
          width: elemento.clientWidth * devicePixelRatio,
          height: elemento.clientHeight * devicePixelRatio,
        }
  if (alvo) publicacao.setVideoDimensions(alvo)
}

function VideoDaTela({
  tela,
  refVideo,
}: {
  tela: TrackReference
  refVideo: RefObject<HTMLVideoElement | null>
}) {
  const pausado = useIsMuted(tela)
  return (
    <>
      <VideoTrack trackRef={tela} ref={refVideo} className="h-full w-full object-contain" />
      {pausado && (
        <div className="absolute inset-0 grid place-items-center bg-black/80">
          <Aviso
            titulo="O host pausou o compartilhamento"
            texto="A tela volta aqui assim que ele retomar."
          />
        </div>
      )}
    </>
  )
}

export function Palco() {
  const room = useRoomContext()
  const { metadata } = useRoomInfo()
  const sessao = lerSessaoMetadata(metadata)
  const host = useRemoteParticipant(sessao?.hostIdentity ?? '')
  const [tela] = useTracks([Track.Source.ScreenShare], { onlySubscribed: true })
  const conexao = useConnectionState(room)
  const { canPlayAudio, startAudio } = useAudioPlayback(room)
  const chat = useChatSala(room)

  const [volume, setVolume] = useState(1)
  const [mudo, setMudo] = useState(false)
  const [qualidade, setQualidade] = useState<Qualidade>('auto')
  const [chatAberto, setChatAberto] = useState(false)
  const [lidas, setLidas] = useState(0)
  const [telaCheia, setTelaCheia] = useState(false)
  const [jaViuOHost, setJaViuOHost] = useState(false)
  const refPalco = useRef<HTMLDivElement>(null)
  const refVideo = useRef<HTMLVideoElement>(null)
  const ativo = useAtividade(chatAberto)

  const publicacao =
    tela?.publication instanceof RemoteTrackPublication ? tela.publication : undefined
  const trilha = publicacao?.track instanceof RemoteVideoTrack ? publicacao.track : undefined
  const naoLidas = chatAberto ? 0 : chat.mensagens.filter((m) => !m.meu).length - lidas

  useEffect(() => {
    if (host) setJaViuOHost(true)
  }, [host])

  useEffect(() => {
    if (publicacao) aplicarQualidade(publicacao, qualidade, refVideo.current)
  }, [publicacao, qualidade])

  useEffect(() => {
    const aoMudar = () => setTelaCheia(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', aoMudar)
    return () => document.removeEventListener('fullscreenchange', aoMudar)
  }, [])

  const alternarChat = useCallback(() => setChatAberto((aberto) => !aberto), [])

  const alternarTelaCheia = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void refPalco.current?.requestFullscreen()
  }, [])

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if ((evento.target as HTMLElement).tagName === 'INPUT') return
      const tecla = evento.key.toLowerCase()
      if (tecla === 'f') alternarTelaCheia()
      if (tecla === 'm') setMudo((atual) => !atual)
      if (tecla === 'c') alternarChat()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [alternarTelaCheia, alternarChat])

  // Com o chat aberto, tudo que chega já conta como lido.
  useEffect(() => {
    if (chatAberto) setLidas(chat.mensagens.filter((m) => !m.meu).length)
  }, [chatAberto, chat.mensagens])

  const alternarPip =
    document.pictureInPictureEnabled && tela
      ? () => {
          if (document.pictureInPictureElement) void document.exitPictureInPicture()
          else void refVideo.current?.requestPictureInPicture()
        }
      : null

  let conteudo = null
  if (!host) {
    conteudo = jaViuOHost ? (
      <Aviso
        titulo="O host perdeu a conexão"
        texto="Esperando ele voltar. Se não voltar em um minuto, a sessão acaba."
      />
    ) : (
      <Aviso titulo="Aguardando o host começar" texto="A tela aparece aqui sozinha." />
    )
  } else if (!tela) {
    conteudo = <Aviso titulo="Aguardando o host começar" texto="A tela aparece aqui sozinha." />
  } else {
    conteudo = <VideoDaTela tela={tela} refVideo={refVideo} />
  }

  return (
    <div ref={refPalco} className={`flex h-dvh bg-black ${ativo ? '' : 'cursor-none'}`}>
      <main className="relative grid min-w-0 flex-1 place-items-center">
        {conteudo}

        {sessao && tela && (
          <p
            className={`absolute top-4 left-4 rounded-md bg-fundo/80 px-2.5 py-1 text-sm transition-opacity duration-200 ${ativo ? 'opacity-100' : 'opacity-0'}`}
          >
            Tela de {sessao.hostNome}
          </p>
        )}

        {conexao === ConnectionState.Reconnecting && (
          <p
            role="status"
            className="absolute top-4 right-4 rounded-md bg-fundo/90 px-2.5 py-1 text-aviso text-sm"
          >
            Reconectando…
          </p>
        )}

        {!canPlayAudio && (
          <button
            type="button"
            onClick={() => void startAudio()}
            className="absolute top-14 left-1/2 -translate-x-1/2 rounded-lg bg-texto px-4 py-2 font-medium text-fundo text-sm"
          >
            Clique para ativar o som
          </button>
        )}

        <ColunaDeReacoes reacoes={chat.reacoes} />

        <div
          className={`absolute bottom-4 left-1/2 -translate-x-1/2 transition-opacity duration-200 ${ativo ? 'opacity-100' : 'opacity-0 focus-within:opacity-100 hover:opacity-100'}`}
        >
          <BarraDeControles
            volume={volume}
            mudo={mudo}
            aoMudarVolume={(novo) => {
              setVolume(novo)
              setMudo(novo === 0)
            }}
            aoAlternarMudo={() => setMudo(!mudo)}
            qualidade={qualidade}
            aoMudarQualidade={setQualidade}
            trilha={trilha}
            aoReagir={(emoji) => void chat.reagir(emoji)}
            chatAberto={chatAberto}
            naoLidas={Math.max(0, naoLidas)}
            aoAlternarChat={alternarChat}
            telaCheia={telaCheia}
            aoAlternarTelaCheia={alternarTelaCheia}
            aoAlternarPip={alternarPip}
          />
        </div>
      </main>

      {chatAberto && (
        <aside className="flex w-80 flex-col border-borda border-l bg-fundo">
          <PainelChat mensagens={chat.mensagens} aoEnviar={chat.enviarChat} className="flex-1" />
        </aside>
      )}

      <RoomAudioRenderer volume={volume} muted={mudo} />
    </div>
  )
}

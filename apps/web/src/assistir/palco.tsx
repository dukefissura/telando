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
import { type AvisoRevezamento, useChatSala } from '@telando/core/cliente'
import { ColunaDeReacoes, PainelChat, useAtalhosDaJanela } from '@telando/ui'
import {
  ConnectionState,
  RemoteTrackPublication,
  RemoteVideoTrack,
  Track,
  VideoQuality,
} from 'livekit-client'
import { AnimatePresence, motion } from 'motion/react'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { Aviso } from './aviso.tsx'
import { BarraDeControles, type Qualidade } from './barra-de-controles.tsx'
import { BotaoRevezamento, EscolherOQueCompartilhar, useRevezamento } from './revezamento.tsx'

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

const CAMADA: Record<Exclude<Qualidade, 'auto'>, VideoQuality> = {
  alta: VideoQuality.HIGH,
  media: VideoQuality.MEDIUM,
  baixa: VideoQuality.LOW,
}

/**
 * A sala é criada sem adaptiveStream porque, com ele, o LiveKit nunca manda mais que o tamanho do
 * player e "Alta" não teria efeito. "Automática" faz o papel dele: pede o tamanho do player.
 */
function useQualidade(
  publicacao: RemoteTrackPublication | undefined,
  qualidade: Qualidade,
  refVideo: RefObject<HTMLVideoElement | null>,
) {
  useEffect(() => {
    if (!publicacao) return
    if (qualidade !== 'auto') return publicacao.setVideoQuality(CAMADA[qualidade])
    const elemento = refVideo.current
    if (!elemento) return
    const pedirTamanhoDoPlayer = () => {
      if (elemento.clientWidth === 0) return
      publicacao.setVideoDimensions({
        width: Math.round(elemento.clientWidth * devicePixelRatio),
        height: Math.round(elemento.clientHeight * devicePixelRatio),
      })
    }
    pedirTamanhoDoPlayer()
    const observador = new ResizeObserver(pedirTamanhoDoPlayer)
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [publicacao, qualidade, refVideo])
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
  const apresentador = useRemoteParticipant(sessao?.presenterIdentity ?? '')
  // Quem está na tela agora: o amigo que recebeu a vez, ou o host.
  const alvo = sessao?.presenterIdentity ?? sessao?.hostIdentity
  const telas = useTracks([Track.Source.ScreenShare], { onlySubscribed: true })
  const tela = telas.find((t) => t.participant.identity === alvo)
  const conexao = useConnectionState(room)
  const { canPlayAudio, startAudio } = useAudioPlayback(room)
  // O chat entrega os avisos do revezamento; o revezamento usa o chat para avisar o host.
  const aoAvisoDoRevezamento = useRef<(aviso: AvisoRevezamento) => void>(() => undefined)
  const chat = useChatSala(room, (aviso) => aoAvisoDoRevezamento.current(aviso))
  const revezamento = useRevezamento(room, sessao, chat.avisar)
  aoAvisoDoRevezamento.current = revezamento.aoAviso
  const souEuNaTela = alvo === room.localParticipant.identity
  const nomeNaTela = sessao?.presenterIdentity
    ? (apresentador?.name ?? 'alguém da sala')
    : sessao?.hostNome

  const [volume, setVolume] = useState(1)
  const [mudo, setMudo] = useState(false)
  const [qualidade, setQualidade] = useState<Qualidade>('auto')
  const [chatAberto, setChatAberto] = useState(false)
  const [ultimaLida, setUltimaLida] = useState(-1)
  const [telaCheia, setTelaCheia] = useState(false)
  const [jaViuOHost, setJaViuOHost] = useState(false)
  const refPalco = useRef<HTMLDivElement>(null)
  const refVideo = useRef<HTMLVideoElement>(null)
  const ativo = useAtividade(chatAberto)

  const publicacao =
    tela?.publication instanceof RemoteTrackPublication ? tela.publication : undefined
  const trilha = publicacao?.track instanceof RemoteVideoTrack ? publicacao.track : undefined
  // Por id, não por contagem: a lista guarda só as últimas 100 mensagens.
  const naoLidas = chatAberto ? 0 : chat.mensagens.filter((m) => !m.meu && m.id > ultimaLida).length

  useEffect(() => {
    if (host) setJaViuOHost(true)
  }, [host])

  useQualidade(publicacao, qualidade, refVideo)

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

  useAtalhosDaJanela({
    f: alternarTelaCheia,
    m: () => setMudo((atual) => !atual),
    c: alternarChat,
  })

  // Com o chat aberto, tudo que chega já conta como lido.
  useEffect(() => {
    const ultima = chat.mensagens.at(-1)
    if (chatAberto && ultima) setUltimaLida(ultima.id)
  }, [chatAberto, chat.mensagens])

  const alternarPip =
    document.pictureInPictureEnabled && tela
      ? () => {
          if (document.pictureInPictureElement) void document.exitPictureInPicture()
          else void refVideo.current?.requestPictureInPicture()
        }
      : null

  let conteudo = null
  if (souEuNaTela) {
    conteudo =
      revezamento.fase === 'aprovado' ? (
        <EscolherOQueCompartilhar revezamento={revezamento} />
      ) : (
        <Aviso
          titulo="Você está mostrando a sua tela"
          texto="Todo mundo na sessão está vendo. Quando terminar, devolva a vez."
        />
      )
  } else if (!host) {
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
            aria-live="polite"
            className={`absolute top-4 left-4 rounded-md bg-fundo/80 px-2.5 py-1 text-sm transition-opacity duration-200 ${ativo || sessao.presenterIdentity ? 'opacity-100' : 'opacity-0'}`}
          >
            {sessao.presenterIdentity
              ? `Agora: tela de ${nomeNaTela}`
              : nomeNaTela
                ? `Tela de ${nomeNaTela}`
                : 'Tela compartilhada'}
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
            revezamento={<BotaoRevezamento revezamento={revezamento} />}
          />
        </div>
      </main>

      <AnimatePresence initial={false}>
        {chatAberto && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex shrink-0 flex-col overflow-hidden border-borda border-l bg-fundo"
          >
            <PainelChat
              mensagens={chat.mensagens}
              aoEnviar={chat.enviarChat}
              className="w-80 flex-1"
            />
          </motion.aside>
        )}
      </AnimatePresence>

      <RoomAudioRenderer volume={volume} muted={mudo} />
    </div>
  )
}

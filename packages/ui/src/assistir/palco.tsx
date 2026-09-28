import {
  RoomAudioRenderer,
  type TrackReference,
  useConnectionState,
  useIsMuted,
  useRemoteParticipant,
  useRoomContext,
  useRoomInfo,
  useTracks,
  VideoTrack,
} from '@livekit/components-react'
import { type AvisoRevezamento, lerSessaoMetadata } from '@telando/core'
import { useAvisosSala } from '@telando/core/cliente'
import {
  ConnectionState,
  RemoteTrackPublication,
  RemoteVideoTrack,
  Track,
  VideoQuality,
} from 'livekit-client'
import { AnimatePresence, motion } from 'motion/react'
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { useAtalhosDaJanela } from '../atalhos.ts'
import { ENTRADA, MOLA_SUAVE, SAIDA, TRANSICAO_SELO } from '../movimento.ts'
import type { Plataforma } from '../plataforma.ts'
import { Aviso } from './aviso.tsx'
import { BarraDeControles, type Qualidade } from './barra-de-controles.tsx'
import { BotaoRevezamento, EscolherOQueCompartilhar, useRevezamento } from './revezamento.tsx'

const OCIOSO_APOS_MS = 3000

/** Fica falso depois de alguns segundos sem mexer o mouse ou o teclado. */
function useAtividade() {
  const [ativo, setAtivo] = useState(true)
  useEffect(() => {
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
  }, [])
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

/** Cada estado do palco ocupa a área toda; assim o que sai e o que entra podem se sobrepor. */
function Camada({ children }: { children: ReactNode }) {
  return (
    <motion.div className="absolute inset-0 grid place-items-center" exit={SAIDA}>
      {children}
    </motion.div>
  )
}

/** O vídeo liga como uma TV de tubo: uma linha de luz que abre até a imagem. */
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
      <motion.div
        className="absolute inset-0 origin-center"
        initial={{ scaleX: 0, scaleY: 0.004, opacity: 0, filter: 'brightness(3)' }}
        animate={{
          scaleX: [0, 1, 1],
          scaleY: [0.004, 0.004, 1],
          opacity: [0, 1, 1],
          filter: ['brightness(3)', 'brightness(3)', 'brightness(1)'],
          // Um filter que fica no ancestral do vídeo tira ele do overlay de hardware.
          transitionEnd: { filter: 'none' },
        }}
        transition={{ duration: 0.42, times: [0, 0.43, 1], ease: MOLA_SUAVE }}
      >
        <VideoTrack trackRef={tela} ref={refVideo} className="h-full w-full object-contain" />
      </motion.div>
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

export function Palco({ fontes, aoSair }: { fontes: Plataforma['fontes']; aoSair: () => void }) {
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
  // Os avisos da sala chegam ao revezamento, e o revezamento os usa para falar com o host.
  const aoAvisoDoRevezamento = useRef<(aviso: AvisoRevezamento) => void>(() => undefined)
  const avisar = useAvisosSala(room, (aviso) => aoAvisoDoRevezamento.current(aviso))
  const revezamento = useRevezamento(room, sessao, avisar, fontes)
  aoAvisoDoRevezamento.current = revezamento.aoAviso
  const souEuNaTela = alvo === room.localParticipant.identity
  const nomeNaTela = sessao?.presenterIdentity
    ? (apresentador?.name ?? 'alguém da sala')
    : sessao?.hostNome

  const [volume, setVolume] = useState(1)
  const [mudo, setMudo] = useState(false)
  const [qualidade, setQualidade] = useState<Qualidade>('auto')
  const [telaCheia, setTelaCheia] = useState(false)
  const [jaViuOHost, setJaViuOHost] = useState(false)
  const refPalco = useRef<HTMLDivElement>(null)
  const refVideo = useRef<HTMLVideoElement>(null)
  const ativo = useAtividade()

  const publicacao =
    tela?.publication instanceof RemoteTrackPublication ? tela.publication : undefined
  const trilha = publicacao?.track instanceof RemoteVideoTrack ? publicacao.track : undefined

  useEffect(() => {
    if (host) setJaViuOHost(true)
  }, [host])

  useQualidade(publicacao, qualidade, refVideo)

  useEffect(() => {
    const aoMudar = () => setTelaCheia(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', aoMudar)
    return () => document.removeEventListener('fullscreenchange', aoMudar)
  }, [])

  const alternarTelaCheia = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void refPalco.current?.requestFullscreen()
  }, [])

  useAtalhosDaJanela({
    f: alternarTelaCheia,
    m: () => setMudo((atual) => !atual),
  })

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
        <Camada key="aprovado">
          <EscolherOQueCompartilhar revezamento={revezamento} fontes={fontes} />
        </Camada>
      ) : (
        <Camada key="mostrando">
          <Aviso
            titulo="Você está mostrando a sua tela"
            texto="Todo mundo na sessão está vendo. Quando terminar, devolva a vez."
          />
        </Camada>
      )
  } else if (!host && jaViuOHost) {
    conteudo = (
      <Camada key="host-caiu">
        <Aviso
          titulo="O host perdeu a conexão"
          texto="Esperando ele voltar. Se não voltar em um minuto, a sessão acaba."
        />
      </Camada>
    )
  } else if (!host || !tela) {
    conteudo = (
      <Camada key="aguardando">
        <Aviso titulo="Aguardando o host começar" texto="A tela aparece aqui sozinha." />
      </Camada>
    )
  } else {
    // Por quem está na tela, não pela trilha: a TV liga de novo quando a vez muda, não ao reconectar.
    conteudo = (
      <Camada key={`video-${alvo}`}>
        <VideoDaTela tela={tela} refVideo={refVideo} />
      </Camada>
    )
  }
  const textoSelo = sessao?.presenterIdentity
    ? `Agora: tela de ${nomeNaTela}`
    : nomeNaTela
      ? `Tela de ${nomeNaTela}`
      : 'Tela compartilhada'

  return (
    <div ref={refPalco} className={`flex h-dvh bg-black ${ativo ? '' : 'cursor-none'}`}>
      <main className="relative min-w-0 flex-1">
        {/* "wait": o que sai termina antes do novo entrar; os vídeos de dois apresentadores
            dividem a refVideo, e a saída atrasada do antigo apagaria a do novo. */}
        <AnimatePresence initial={false} mode="wait">
          {conteudo}
        </AnimatePresence>

        {sessao && host && (
          <div
            className={`absolute top-4 left-4 transition-opacity duration-200 ${ativo || sessao.presenterIdentity ? 'opacity-100' : 'opacity-0'}`}
          >
            {/* O mesmo layoutId do endereço na espera do link fixo: ele voa até aqui ao entrar. */}
            <motion.p
              layoutId="selo-tela"
              aria-live="polite"
              className="overflow-hidden rounded-md bg-fundo/80 px-2.5 py-1 text-sm"
              transition={TRANSICAO_SELO}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={textoSelo}
                  className="block"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={ENTRADA}
                >
                  {textoSelo}
                </motion.span>
              </AnimatePresence>
            </motion.p>
          </div>
        )}

        {conexao === ConnectionState.Reconnecting && (
          <p
            role="status"
            className="absolute top-4 right-4 rounded-md bg-fundo/90 px-2.5 py-1 text-aviso text-sm"
          >
            Reconectando…
          </p>
        )}

        {/* Ao ficar ocioso a barra afunda 8px enquanto some; volta mais rápido do que sai. */}
        <div
          className={`absolute bottom-4 left-1/2 -translate-x-1/2 transition-[opacity,translate] ${ativo ? 'translate-y-0 opacity-100 duration-150 ease-out' : 'translate-y-2 opacity-0 duration-200 ease-in focus-within:translate-y-0 focus-within:opacity-100 hover:translate-y-0 hover:opacity-100'}`}
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
            telaCheia={telaCheia}
            aoAlternarTelaCheia={alternarTelaCheia}
            aoAlternarPip={alternarPip}
            revezamento={<BotaoRevezamento revezamento={revezamento} />}
            aoSair={aoSair}
          />
        </div>
      </main>

      <RoomAudioRenderer volume={volume} muted={mudo} />
    </div>
  )
}

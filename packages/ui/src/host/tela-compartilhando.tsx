import {
  type ConfigTransmissao,
  formatarMbps,
  type TransmissaoResolvida,
  uploadNecessarioKbps,
} from '@telando/core'
import {
  codecsDoHost,
  type Estatisticas,
  type Remetente,
  useAvisosSala,
  type useTransmissao,
} from '@telando/core/cliente'
import { type Room, Track } from 'livekit-client'
import {
  AlertTriangle,
  AppWindow,
  ChevronDown,
  Eye,
  Lock,
  Mic,
  MicOff,
  Monitor,
  Pause,
  Play,
  SlidersHorizontal,
  Square,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useAtalhosDaJanela } from '../atalhos.ts'
import { BarraDoApp, Luz, Marca } from '../barra-do-app.tsx'
import {
  AbreEspaco,
  Alternador,
  Avatar,
  Botao,
  Grupo,
  LinhaDeGrupo,
  Secao,
  Separador,
} from '../controles.tsx'
import { ENTRADA, LIGAR_TV, MOLA_SUAVE, SAIDA } from '../movimento.ts'
import type { FonteDeCaptura, Plataforma } from '../plataforma.ts'
import { Link, partesDo } from './link.tsx'
import { PainelAudio, PainelVideo } from './paineis.tsx'
import { PainelFonte, useFontes } from './painel-fonte.tsx'
import { useMicrofones } from './use-microfones.ts'

type Controle = ReturnType<typeof useTransmissao>

const TEXTO_LIMITACAO = {
  banda: 'A qualidade baixou porque falta banda de upload.',
  cpu: 'A qualidade baixou porque o computador não está dando conta de codificar.',
}

function PainelEstatisticas({ estatisticas }: { estatisticas: Estatisticas | null }) {
  if (!estatisticas) return <p className="text-[13px] text-texto-suave">Medindo…</p>
  const linhas: Array<[string, string]> = [
    ['Resolução', `${estatisticas.largura}×${estatisticas.altura}`],
    ['Quadros', `${estatisticas.fps} fps`],
    ['Vídeo', formatarMbps(estatisticas.videoKbps)],
    ['Áudio', `${estatisticas.audioKbps} kbps`],
    ['Codec', estatisticas.codec ?? '—'],
    ['Perda de pacotes', `${estatisticas.perdaPct.toLocaleString('pt-BR')}%`],
  ]
  if (estatisticas.cpuPct !== null)
    linhas.push(['CPU do app', `${Math.round(estatisticas.cpuPct)}%`])

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]" data-testid="estatisticas">
      {linhas.map(([nome, valor]) => (
        <div key={nome} className="contents">
          <dt className="text-texto-suave">{nome}</dt>
          <dd className="text-right font-mono tabular-nums">{valor}</dd>
        </div>
      ))}
    </dl>
  )
}

const ALTURA_DIGITO = 20
const ALGARISMOS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

/** Cada dígito é uma janela sobre uma coluna de 0 a 9 que desliza até o valor, como um odômetro. */
function Odometro({ valor }: { valor: number }) {
  // A posição conta da direita: a unidade continua a mesma coluna quando o número ganha uma dezena.
  const digitos = String(valor)
    .split('')
    .map((caractere, i, todos) => ({ posicao: todos.length - i, digito: Number(caractere) }))
  return (
    <span className="inline-flex text-texto">
      {digitos.map(({ posicao, digito }) => (
        <span key={posicao} className="inline-block h-5 overflow-hidden">
          <motion.span
            className="flex flex-col"
            initial={false}
            animate={{ y: -digito * ALTURA_DIGITO }}
            transition={{ duration: 0.35, ease: MOLA_SUAVE }}
          >
            {ALGARISMOS.map((n) => (
              <span key={n} className="block h-5 leading-5">
                {n}
              </span>
            ))}
          </motion.span>
        </span>
      ))}
    </span>
  )
}

/** A tela de quem apresenta no lugar do host, se a sala já recebe o vídeo dela. */
function trilhaDoApresentador(sala: Room | null, identity: string): MediaStreamTrack | null {
  const publicacao = sala?.remoteParticipants
    .get(identity)
    ?.getTrackPublication(Track.Source.ScreenShare)
  return publicacao?.track?.mediaStreamTrack ?? null
}

/**
 * O que vai ao ar, visto de quem compartilha. Sempre mudo, para não fazer eco. A trilha é relida
 * a cada render (as estatísticas redesenham a tela a cada segundo): trocar a fonte troca a trilha.
 */
function MonitorDeRetorno({
  trilha,
  cartela,
  children,
}: {
  trilha: MediaStreamTrack | null
  /** No lugar do vídeo: pausado, ou a vez com outra pessoa cuja tela ainda não chegou. */
  cartela: ReactNode
  /** A faixa de baixo: quem assiste e a qualidade. */
  children: ReactNode
}) {
  const refVideo = useRef<HTMLVideoElement>(null)
  const trilhaNoVideo = useRef<MediaStreamTrack | null>(null)

  useEffect(() => {
    if (!refVideo.current || trilha === trilhaNoVideo.current) return
    trilhaNoVideo.current = trilha
    refVideo.current.srcObject = trilha ? new MediaStream([trilha]) : null
  })

  return (
    <motion.div
      {...LIGAR_TV}
      className="relative aspect-video w-full origin-center overflow-hidden rounded-[28px] bg-black shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_30px_60px_-30px_rgb(0_0_0/0.9)]"
    >
      <motion.video
        ref={refVideo}
        autoPlay
        muted
        playsInline
        aria-label="O que está indo ao ar"
        className="absolute inset-0 h-full w-full object-contain"
        animate={{ opacity: cartela ? 0 : 1 }}
        transition={ENTRADA}
      />
      <AnimatePresence initial={false}>
        {cartela && (
          <motion.div
            key="cartela"
            className="absolute inset-0 grid place-items-center p-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={SAIDA}
            transition={ENTRADA}
          >
            {cartela}
          </motion.div>
        )}
      </AnimatePresence>
      <span className="vidro-video absolute top-3.5 left-3.5 inline-flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[13px]">
        <Eye size={13} aria-hidden />O que eles veem
      </span>
      <div className="absolute inset-x-3.5 bottom-3.5 flex items-center gap-2.5 text-[13px]">
        {children}
      </div>
    </motion.div>
  )
}

const AMOSTRAS_DO_SINAL = 30
const POSICOES_DO_SINAL = Array.from({ length: AMOSTRAS_DO_SINAL }, (_, i) => i)

/**
 * O resumo da transmissão ao vivo, com um gráfico dos últimos 30s de vídeo enviado. Abre e fecha
 * as estatísticas completas dentro do próprio grupo; fica em aviso quando a qualidade cai.
 */
function FaixaDeSinal({
  estatisticas,
  resolvida,
}: {
  estatisticas: Estatisticas | null
  resolvida: TransmissaoResolvida
}) {
  const reduzir = useReducedMotion()
  const [abertas, setAbertas] = useState(false)
  const [historico, setHistorico] = useState<number[]>([])

  useEffect(() => {
    if (estatisticas)
      setHistorico((atual) => [...atual, estatisticas.videoKbps].slice(-AMOSTRAS_DO_SINAL))
  }, [estatisticas])

  const limitacao = estatisticas?.limitacao ?? null
  const resumo = estatisticas?.enviando
    ? `${estatisticas.altura}p · ${estatisticas.fps} fps · ${formatarMbps(estatisticas.videoKbps)} · perda ${estatisticas.perdaPct.toLocaleString('pt-BR')}%`
    : resolvida.resumo
  // As mais antigas à esquerda; enquanto não há 30 amostras, o começo fica como trilho apagado.
  const amostra = (posicao: number) => historico[historico.length - AMOSTRAS_DO_SINAL + posicao]
  // A escala é o pico recente, não o teto: tela parada manda bem abaixo do teto, e medidas contra
  // ele as barras viravam uma fileira de pontos.
  const pico = Math.max(1, ...historico)
  const alturaDaBarra = (kbps: number) => Math.max(2, (kbps / pico) * 22)

  return (
    <div
      className="grupo"
      // O utilitário grupo já pinta a borda; o estilo em linha é o que vence ele.
      style={
        limitacao ? { borderColor: 'color-mix(in srgb, var(--aviso) 40%, transparent)' } : undefined
      }
    >
      <button
        type="button"
        onClick={() => setAbertas(!abertas)}
        aria-expanded={abertas}
        aria-label={`Estatísticas: ${resumo}`}
        className="grid w-full gap-2 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-preenchimento"
      >
        <span className="flex items-center justify-between text-texto-suave text-xs">
          Sinal
          <ChevronDown
            size={16}
            aria-hidden
            className={`transition-transform duration-150 ${abertas ? 'rotate-180' : ''}`}
          />
        </span>
        <span className={`flex items-center gap-3 ${limitacao ? 'text-aviso' : 'text-texto'}`}>
          {/* Resolução e fps já estão no monitor; aqui fica o que é do sinal. */}
          <span className="font-mono text-xs tabular-nums">
            {!estatisticas
              ? 'Medindo…'
              : estatisticas.enviando
                ? `${formatarMbps(estatisticas.videoKbps)} · perda ${estatisticas.perdaPct.toLocaleString('pt-BR')}%`
                : 'Parado até alguém entrar'}
          </span>
          <span className="ml-auto flex h-[22px] items-end gap-0.5" aria-hidden>
            {POSICOES_DO_SINAL.map((posicao) => {
              const kbps = amostra(posicao)
              return (
                <span
                  key={posicao}
                  className={`w-[3px] rounded-[2px] ${limitacao ? 'bg-aviso' : 'bg-destaque'} ${kbps === undefined ? 'opacity-25' : 'opacity-85'} ${reduzir ? '' : 'transition-[height] duration-[400ms] ease-out'}`}
                  style={{ height: alturaDaBarra(kbps ?? 0) }}
                />
              )
            })}
          </span>
        </span>
        <AnimatePresence initial={false}>
          {limitacao && (
            <motion.span
              key="limitacao"
              className="grid"
              initial={{ gridTemplateRows: '0fr', opacity: 0 }}
              animate={{ gridTemplateRows: '1fr', opacity: 1 }}
              exit={{ ...SAIDA, gridTemplateRows: '0fr' }}
              transition={ENTRADA}
            >
              <span role="status" className="min-h-0 overflow-hidden text-aviso text-xs">
                {TEXTO_LIMITACAO[limitacao]}
              </span>
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      <AnimatePresence initial={false}>
        {abertas && (
          <AbreEspaco key="estatisticas">
            <Separador larguraTotal />
            <div className="px-4 pt-3 pb-4">
              <PainelEstatisticas estatisticas={estatisticas} />
            </div>
          </AbreEspaco>
        )}
      </AnimatePresence>
    </div>
  )
}

/** O selo da barra do app; um anel sai dele a cada pessoa que entra, como uma onda de sinal. */
function SeloAoVivo({ chegadas }: { chegadas: number }) {
  return (
    <span className="relative inline-flex items-center gap-1.5 rounded-full bg-ao-vivo/12 px-2.5 py-1 font-semibold text-[11px] text-ao-vivo tracking-[0.06em]">
      <span
        className="size-1.5 animate-pulse rounded-full bg-ao-vivo motion-reduce:animate-none"
        aria-hidden
      />
      AO VIVO
      {chegadas > 0 && (
        <motion.span
          key={chegadas}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-ao-vivo"
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 1.9, opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      )}
    </span>
  )
}

/** Um aviso da transmissão, na forma de linha de grupo. */
function Aviso({ papel, children }: { papel?: 'alert'; children: ReactNode }) {
  return (
    <div role={papel} className="grupo w-full">
      <div className="flex items-start gap-3 px-4 py-3 text-sm">
        <AlertTriangle
          size={17}
          strokeWidth={1.75}
          aria-hidden
          className="mt-px shrink-0 text-aviso"
        />
        <p>{children}</p>
      </div>
    </div>
  )
}

/** Dois bipes curtos e baixos: dá para notar sem assustar ninguém em call. */
function tocarAvisoDePedido() {
  const contexto = new AudioContext()
  const volume = contexto.createGain()
  volume.gain.value = 0.05
  volume.connect(contexto.destination)
  for (const [indice, frequencia] of [660, 880].entries()) {
    const oscilador = contexto.createOscillator()
    oscilador.frequency.value = frequencia
    oscilador.connect(volume)
    const inicio = contexto.currentTime + indice * 0.15
    oscilador.start(inicio)
    oscilador.stop(inicio + 0.1)
  }
  setTimeout(() => void contexto.close(), 500)
}

export function TelaCompartilhando({
  plataforma,
  controle,
  aoMudarConfig,
  avisoLink,
}: {
  plataforma: Plataforma
  controle: Controle
  aoMudarConfig: (config: ConfigTransmissao) => void
  /** Um link chegou enquanto transmitia: ele não abre, e isto explica por quê. */
  avisoLink: string | null
}) {
  const { estado, estatisticas } = controle
  const [painel, setPainel] = useState<'nenhum' | 'ajustes' | 'fonte'>('nenhum')
  // Os controles mostram o que o host escolheu na hora; a transmissão alcança logo depois.
  const [rascunho, setRascunho] = useState<ConfigTransmissao | null>(null)
  const [avisoFonte, setAvisoFonte] = useState<string | null>(null)
  const fontes = useFontes(painel === 'fonte' ? plataforma.fontes : undefined)
  const configAtual = rascunho ?? (estado.fase === 'ao-vivo' ? estado.config : null)
  const microfones = useMicrofones(configAtual?.microfone.ativo ?? false)
  const [pedidos, setPedidos] = useState<Remetente[]>([])
  const apresentador = estado.fase === 'ao-vivo' ? estado.apresentador : null
  const avisar = useAvisosSala(controle.sala, (aviso, de) => {
    if (aviso.t === 'pedido-tela') {
      setPedidos((atuais) =>
        atuais.some((p) => p.identity === de.identity) ? atuais : [...atuais, de],
      )
      tocarAvisoDePedido()
    } else if (aviso.t === 'pedido-cancelado') {
      setPedidos((atuais) => atuais.filter((p) => p.identity !== de.identity))
    } else if (aviso.t === 'devolver-tela' && de.identity === apresentador) {
      void controle.passarVez(null)
    }
  })

  const contagem = estado.fase === 'ao-vivo' ? estado.espectadores.length : 0
  const [chegadas, setChegadas] = useState(0)
  const contagemAnterior = useRef(contagem)
  useEffect(() => {
    if (contagem > contagemAnterior.current) setChegadas((n) => n + 1)
    contagemAnterior.current = contagem
  }, [contagem])

  useAtalhosDaJanela({
    p: controle.alternarPausa,
    m: controle.alternarAudio,
    n: controle.alternarMicrofone,
  })

  if (estado.fase !== 'ao-vivo' || !configAtual) return null
  const { resolvida } = estado
  const config = configAtual
  const aviso = estado.aviso ?? avisoFonte ?? avisoLink
  const nomeDe = (identity: string) =>
    estado.espectadores.find((e) => e.identity === identity)?.nome ?? 'Alguém'
  // Com a vez com outra pessoa, o que vai ao ar é a tela dela (se a sala já recebe).
  const trilhaNoAr = apresentador
    ? trilhaDoApresentador(controle.sala, apresentador)
    : controle.trilhaLocal()
  const canal = estado.linkFixo ? partesDo(estado.linkFixo) : null
  const cartela =
    apresentador && !trilhaNoAr ? (
      <p className="text-sm">
        Agora: tela de {nomeDe(apresentador)}. A sua está pausada para quem assiste.
      </p>
    ) : !apresentador && estado.pausado ? (
      <div className="grid gap-2">
        {canal && (
          <p className="font-mono text-base tracking-tight">
            <span className="text-texto-suave">{canal.base}</span>
            <span className="text-destaque">{canal.final}</span>
          </p>
        )}
        <p className="font-semibold">O host pausou o compartilhamento</p>
      </div>
    ) : null
  // Sem ninguém assistindo, o dynacast pausa tudo; aí vale o que vai sair quando alguém entrar.
  const qualidadeNoAr = estatisticas?.enviando
    ? `${estatisticas.altura}p · ${estatisticas.fps} fps`
    : `${resolvida.alvo.altura}p · ${resolvida.fps} fps`
  // Quem pediu e saiu da sala some da lista.
  const pedidosAtivos = pedidos.filter((p) =>
    estado.espectadores.some((e) => e.identity === p.identity),
  )

  const aprovar = async (pedido: Remetente) => {
    setPedidos((atuais) => atuais.filter((p) => p.identity !== pedido.identity))
    await controle.passarVez(pedido.identity)
  }

  const recusar = async (pedido: Remetente) => {
    setPedidos((atuais) => atuais.filter((p) => p.identity !== pedido.identity))
    await avisar({ t: 'pedido-recusado' }, pedido.identity).catch(() => {
      // Se o aviso não chegar, a pessoa só continua esperando; pode pedir de novo.
    })
  }

  const ajustar = async (nova: ConfigTransmissao) => {
    setRascunho(nova)
    if (await controle.ajustar(nova)) aoMudarConfig(nova)
    else setRascunho(null)
  }

  const trocarFonte = async (fonte: FonteDeCaptura) => {
    setPainel('nenhum')
    setAvisoFonte(null)
    try {
      await plataforma.fontes.escolher(fonte.id)
    } catch {
      setAvisoFonte('Essa janela acabou de fechar. Escolha outra.')
      return
    }
    await controle.trocarFonte()
  }

  const itemDaBarra = { variante: 'discreto', tamanho: 'barra' } as const
  const iconeDaBarra = { size: 17, strokeWidth: 1.75, 'aria-hidden': true } as const

  return (
    <main className="relative isolate flex min-h-dvh flex-col">
      <Luz posicao="45% 45% at 35% 30%" />
      <BarraDoApp>
        <Marca />
        <SeloAoVivo chegadas={chegadas} />
      </BarraDoApp>

      <div className="mx-auto grid w-full max-w-[1320px] gap-5 px-6 pt-2 pb-6 min-[1100px]:grid-cols-[minmax(0,1fr)_360px] min-[1100px]:items-start">
        <div className="grid content-start justify-items-center gap-[18px]">
          <MonitorDeRetorno trilha={trilhaNoAr} cartela={cartela}>
            <span className="vidro-video inline-flex items-center gap-2 rounded-full px-3 py-[5px] tabular-nums">
              {estado.espectadores.length > 0 && (
                <span className="flex" aria-hidden>
                  {estado.espectadores.slice(0, 3).map((espectador, i) => (
                    <Avatar
                      key={espectador.identity}
                      nome={espectador.nome}
                      indice={i}
                      className={`size-5 text-[10px] ring-2 ring-fundo ${i > 0 ? '-ml-1.5' : ''}`}
                    />
                  ))}
                </span>
              )}
              <span className="sr-only" data-testid="espectadores">
                {contagem === 1 ? '1 pessoa assistindo' : `${contagem} pessoas assistindo`}
              </span>
              <span aria-hidden className="inline-flex items-center gap-1">
                <Odometro valor={contagem} />
                {contagem === 1 ? 'pessoa assistindo' : 'pessoas assistindo'}
              </span>
            </span>
            <span className="vidro-video ml-auto rounded-full px-3 py-[5px] font-mono text-xs tabular-nums">
              {qualidadeNoAr}
            </span>
          </MonitorDeRetorno>

          {/* Os cards abrem e fecham o próprio espaço; a margem negativa anula o gap sem nenhum. */}
          <div className="-mt-[18px] w-full">
            <AnimatePresence initial={false}>
              {pedidosAtivos.map((pedido) => (
                <AbreEspaco key={pedido.identity} className="pt-[18px]">
                  <section
                    aria-label={`Pedido de ${pedido.nome}`}
                    className="grupo flex items-center justify-between gap-3 py-2 pr-2 pl-4 text-sm"
                  >
                    <span>
                      <span className="font-medium">{pedido.nome}</span> quer mostrar a tela
                    </span>
                    <span className="flex gap-1">
                      <Botao
                        variante="primario"
                        tamanho="compacto"
                        onClick={() => void aprovar(pedido)}
                      >
                        Aprovar
                      </Botao>
                      <Botao
                        variante="fantasma"
                        tamanho="compacto"
                        onClick={() => void recusar(pedido)}
                      >
                        Recusar
                      </Botao>
                    </span>
                  </section>
                </AbreEspaco>
              ))}
              {apresentador && (
                <AbreEspaco key="apresentador" className="pt-[18px]">
                  <section
                    aria-live="polite"
                    className="grupo flex items-center justify-between gap-3 py-2 pr-2 pl-4 text-sm"
                  >
                    <span>
                      Agora: tela de {nomeDe(apresentador)}. A sua está pausada para quem assiste.
                    </span>
                    <Botao tamanho="compacto" onClick={() => void controle.passarVez(null)}>
                      Retomar minha tela
                    </Botao>
                  </section>
                </AbreEspaco>
              )}
            </AnimatePresence>
          </div>

          {config.audioSistema && !estado.comAudio && (
            <Aviso>
              Sem áudio: a captura não trouxe o som do computador. Troque para a tela inteira e
              tente de novo.
            </Aviso>
          )}
          {aviso && <Aviso papel="alert">{aviso}</Aviso>}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: MOLA_SUAVE }}
            className="vidro flex w-max max-w-full flex-wrap items-center justify-center gap-1 rounded-full p-1.5"
          >
            <Botao
              {...itemDaBarra}
              onClick={controle.alternarPausa}
              aria-keyshortcuts="P"
              aria-label={estado.pausado ? 'Retomar vídeo' : 'Pausar vídeo'}
              title={estado.pausado ? 'Retomar vídeo' : 'Pausar vídeo'}
            >
              {estado.pausado ? <Play {...iconeDaBarra} /> : <Pause {...iconeDaBarra} />}
              {estado.pausado ? 'Retomar' : 'Pausar'}
            </Botao>
            {estado.comAudio && (
              <Botao
                {...itemDaBarra}
                onClick={controle.alternarAudio}
                aria-keyshortcuts="M"
                aria-label={estado.audioMudo ? 'Ligar áudio' : 'Mutar áudio'}
                title={estado.audioMudo ? 'Ligar áudio' : 'Mutar áudio'}
              >
                {estado.audioMudo ? <VolumeX {...iconeDaBarra} /> : <Volume2 {...iconeDaBarra} />}
                {estado.audioMudo ? 'Ligar' : 'Mutar'}
              </Botao>
            )}
            {config.microfone.ativo && (
              <Botao
                {...itemDaBarra}
                onClick={controle.alternarMicrofone}
                aria-keyshortcuts="N"
                title={estado.microfoneMudo ? 'Ligar microfone' : 'Mutar microfone'}
              >
                {estado.microfoneMudo ? <MicOff {...iconeDaBarra} /> : <Mic {...iconeDaBarra} />}
                {estado.microfoneMudo ? 'Ligar mic' : 'Mutar mic'}
              </Botao>
            )}
            <Botao
              {...itemDaBarra}
              onClick={() => setPainel(painel === 'fonte' ? 'nenhum' : 'fonte')}
              aria-expanded={painel === 'fonte'}
              aria-label="Trocar tela/janela"
              title="Trocar tela/janela"
            >
              <AppWindow {...iconeDaBarra} />
              Trocar
            </Botao>
            <Botao
              {...itemDaBarra}
              onClick={() => setPainel(painel === 'ajustes' ? 'nenhum' : 'ajustes')}
              aria-expanded={painel === 'ajustes'}
            >
              <SlidersHorizontal {...iconeDaBarra} />
              Ajustes
            </Botao>
            <span className="mx-1 h-[22px] w-px bg-vidro-borda" aria-hidden />
            <Botao variante="perigo" tamanho="barra" onClick={controle.parar}>
              <Square size={14} strokeWidth={2} aria-hidden />
              Parar
            </Botao>
          </motion.div>

          <div className="-mt-[18px] w-full">
            <AnimatePresence initial={false}>
              {painel === 'fonte' && (
                <AbreEspaco key="fonte" className="pt-[18px]">
                  <section
                    aria-label="Trocar o que está sendo compartilhado"
                    className="grid gap-[18px] rounded-[28px] bg-superficie p-[22px]"
                  >
                    <PainelFonte
                      titulo="Trocar tela/janela"
                      lista={fontes}
                      escolhida={null}
                      aoEscolher={(fonte) => void trocarFonte(fonte)}
                    />
                    <Botao
                      variante="fantasma"
                      className="justify-self-start"
                      onClick={() => setPainel('nenhum')}
                    >
                      Cancelar
                    </Botao>
                  </section>
                </AbreEspaco>
              )}
              {painel === 'ajustes' && (
                <AbreEspaco key="ajustes" className="pt-[18px]">
                  <aside
                    aria-label="Ajustes da transmissão"
                    className="rounded-[28px] bg-superficie p-[22px]"
                  >
                    <Grupo>
                      <Secao titulo="Vídeo" icone={Monitor} aberta>
                        <PainelVideo
                          config={config}
                          aoMudar={(nova) => void ajustar(nova)}
                          codecsDoHost={codecsDoHost()}
                          limitadoPelaFonte={resolvida.limitadoPelaFonte}
                          uploadNecessarioKbps={uploadNecessarioKbps(resolvida)}
                        />
                      </Secao>
                      <Separador />
                      <Secao titulo="Áudio" icone={Volume2} aberta>
                        <PainelAudio
                          config={config}
                          aoMudar={(nova) => void ajustar(nova)}
                          nivelAudio={controle.nivelAudio}
                          microfones={microfones}
                        />
                      </Secao>
                    </Grupo>
                  </aside>
                </AbreEspaco>
              )}
            </AnimatePresence>
          </div>
        </div>

        <aside aria-label="Sala" className="grid content-start gap-4">
          <div className="grupo">
            <div className="grid gap-2.5 p-4">
              <p className="text-texto-suave text-xs" aria-live="polite">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={estado.copiado ? 'copiado' : 'mande'}
                    className="block"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={ENTRADA}
                  >
                    {estado.copiado
                      ? 'Link copiado. É só mandar para quem vai assistir.'
                      : 'Mande o link para quem vai assistir.'}
                  </motion.span>
                </AnimatePresence>
              </p>
              <Link
                id={estado.linkFixo ? 'link-fixo' : 'link'}
                rotulo={estado.linkFixo ? 'Seu link fixo' : 'Link da transmissão'}
                url={estado.linkFixo ?? estado.link}
                variante="principal"
                destacarFinal={Boolean(estado.linkFixo)}
                aoCopiar={controle.copiarLink}
              />
            </div>
            {estado.linkFixo && (
              <>
                <Separador larguraTotal />
                <div className="py-3 pr-3 pl-4">
                  <Link
                    id="link"
                    rotulo="Link só desta transmissão"
                    url={estado.link}
                    variante="linha"
                    destacarFinal={false}
                    aoCopiar={controle.copiarLink}
                  />
                </div>
              </>
            )}
          </div>

          <FaixaDeSinal estatisticas={estatisticas} resolvida={resolvida} />

          <Grupo
            rotulo="Quem está assistindo"
            acessorio={
              <span className="rounded-full bg-preenchimento px-[7px] text-[11px] text-texto tabular-nums">
                {estado.espectadores.length}
              </span>
            }
          >
            <Alternador
              icone={Lock}
              rotulo="Trancar sessão"
              descricao="Ninguém novo entra, nem quem você removeu; quem já está continua assistindo."
              ligado={estado.trancada}
              aoMudar={(trancada) => void controle.trancar(trancada)}
            />
            {estado.espectadores.length === 0 ? (
              <>
                <Separador />
                <LinhaDeGrupo icone={Users}>
                  <p className="text-texto-suave">Ninguém entrou ainda. É só mandar o link.</p>
                </LinhaDeGrupo>
              </>
            ) : (
              <ul data-testid="lista-espectadores">
                <AnimatePresence initial={false}>
                  {estado.espectadores.map((espectador, i) => (
                    <motion.li
                      key={espectador.identity}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={SAIDA}
                      transition={ENTRADA}
                    >
                      <Separador />
                      <div className="flex min-h-12 items-center gap-3 py-2 pr-2.5 pl-4 text-sm">
                        <Avatar
                          nome={espectador.nome}
                          indice={i}
                          className="size-[26px] text-[11px]"
                        />
                        <span className="min-w-0 flex-1 truncate">{espectador.nome}</span>
                        <Botao
                          variante="fantasma"
                          tamanho="compacto"
                          onClick={() => void controle.remover(espectador.identity)}
                          aria-label={`Remover ${espectador.nome}`}
                        >
                          Remover
                        </Botao>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </Grupo>
        </aside>
      </div>
    </main>
  )
}

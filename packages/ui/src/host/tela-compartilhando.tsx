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
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useAtalhosDaJanela } from '../atalhos.ts'
import { Alternador, animacaoBotao, Botao, Secao } from '../controles.tsx'
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
  if (!estatisticas) return <p className="text-sm text-texto-suave">Medindo…</p>
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
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm" data-testid="estatisticas">
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

/** Abre e fecha o próprio espaço, para um card novo não empurrar a tela de uma vez. */
function AbreEspaco({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="grid"
      initial={{ gridTemplateRows: '0fr', opacity: 0 }}
      animate={{ gridTemplateRows: '1fr', opacity: 1 }}
      exit={{ gridTemplateRows: '0fr', opacity: 0 }}
      transition={ENTRADA}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="pt-5">{children}</div>
      </div>
    </motion.div>
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
  /** A faixa de baixo: AO VIVO, quem assiste e a qualidade. */
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
      className="relative aspect-video origin-center overflow-hidden rounded-xl border border-borda bg-black"
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
      <span className="absolute top-3 left-3 rounded-md bg-fundo/80 px-2.5 py-1 text-texto-suave text-xs">
        O que eles veem
      </span>
      <div className="absolute inset-x-3 bottom-3 flex items-center gap-2.5 text-sm">
        {children}
      </div>
    </motion.div>
  )
}

const AMOSTRAS_DO_SINAL = 30
const POSICOES_DO_SINAL = Array.from({ length: AMOSTRAS_DO_SINAL }, (_, i) => i)

/**
 * O resumo da transmissão ao vivo, com um gráfico dos últimos 30s de vídeo enviado. Abre e fecha
 * as estatísticas completas; fica em aviso quando a qualidade cai.
 */
function FaixaDeSinal({
  estatisticas,
  resolvida,
  abertas,
  aoAlternar,
}: {
  estatisticas: Estatisticas | null
  resolvida: TransmissaoResolvida
  abertas: boolean
  aoAlternar: () => void
}) {
  const reduzir = useReducedMotion()
  const [historico, setHistorico] = useState<number[]>([])

  useEffect(() => {
    if (estatisticas)
      setHistorico((atual) => [...atual, estatisticas.videoKbps].slice(-AMOSTRAS_DO_SINAL))
  }, [estatisticas])

  const limitacao = estatisticas?.limitacao ?? null
  const resumo = estatisticas
    ? `${estatisticas.altura}p · ${estatisticas.fps} fps · ${formatarMbps(estatisticas.videoKbps)} · perda ${estatisticas.perdaPct.toLocaleString('pt-BR')}%`
    : resolvida.resumo
  // As mais antigas à esquerda; enquanto não há 30 amostras, o começo fica como trilho apagado.
  const amostra = (posicao: number) => historico[historico.length - AMOSTRAS_DO_SINAL + posicao]
  // A escala é o pico recente, não o teto: tela parada manda bem abaixo do teto, e medidas contra
  // ele as barras viravam uma fileira de pontos.
  const pico = Math.max(1, ...historico)
  const alturaDaBarra = (kbps: number) => Math.max(2, (kbps / pico) * 20)

  return (
    <button
      type="button"
      onClick={aoAlternar}
      aria-expanded={abertas}
      aria-label={`Estatísticas: ${resumo}`}
      className={`grid w-full gap-2 rounded-lg border px-3 py-2.5 text-left hover:bg-superficie ${animacaoBotao} ${limitacao ? 'border-aviso/40' : 'border-borda'}`}
    >
      <span className={`flex items-center gap-3 ${limitacao ? 'text-aviso' : 'text-texto-suave'}`}>
        <span className="font-mono text-xs tabular-nums">{resumo}</span>
        <span className="ml-auto flex h-5 items-end gap-0.5" aria-hidden>
          {POSICOES_DO_SINAL.map((posicao) => {
            const kbps = amostra(posicao)
            return (
              <span
                key={posicao}
                className={`w-[3px] rounded-[1px] bg-current ${kbps === undefined ? 'opacity-25' : 'opacity-80'} ${reduzir ? '' : 'transition-[height] duration-[400ms] ease-out'}`}
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
  const [abertas, setAbertas] = useState(false)
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
  const qualidadeNoAr = estatisticas
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

  return (
    <main className="relative mx-auto grid w-full max-w-6xl gap-6 p-6 min-[1100px]:grid-cols-[minmax(0,1fr)_24rem] min-[1100px]:items-start min-[1100px]:p-10">
      <div className="grid content-start gap-5">
        <MonitorDeRetorno trilha={trilhaNoAr} cartela={cartela}>
          <span className="relative inline-flex items-center gap-1.5 rounded-full bg-fundo/80 px-2.5 py-1 font-medium text-ao-vivo text-xs tracking-wider">
            <span
              className="size-1.5 animate-pulse rounded-full bg-ao-vivo motion-reduce:animate-none"
              aria-hidden
            />
            AO VIVO
            {chegadas > 0 && (
              // Alguém entrou: um anel sai do selo, como uma onda de sinal.
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
          <span className="rounded-md bg-fundo/80 px-2 py-0.5 text-texto-suave tabular-nums">
            <span className="sr-only" data-testid="espectadores">
              {contagem === 1 ? '1 pessoa assistindo' : `${contagem} pessoas assistindo`}
            </span>
            <span aria-hidden className="inline-flex items-center gap-1">
              <Odometro valor={contagem} />
              {contagem === 1 ? 'pessoa assistindo' : 'pessoas assistindo'}
            </span>
          </span>
          <span className="ml-auto rounded-md bg-fundo/80 px-2 py-0.5 font-mono text-texto-suave text-xs tabular-nums">
            {qualidadeNoAr}
          </span>
        </MonitorDeRetorno>

        {/* Os cards abrem e fecham o próprio espaço; o -mt-5 anula o gap quando não há nenhum. */}
        <div className="-mt-5">
          <AnimatePresence initial={false}>
            {pedidosAtivos.map((pedido) => (
              <AbreEspaco key={pedido.identity}>
                <section
                  aria-label={`Pedido de ${pedido.nome}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-borda bg-superficie py-2 pr-2 pl-4 text-sm"
                >
                  <span>
                    <span className="font-medium">{pedido.nome}</span> quer mostrar a tela
                  </span>
                  <span className="flex gap-1">
                    <Botao variante="primario" onClick={() => void aprovar(pedido)}>
                      Aprovar
                    </Botao>
                    <Botao variante="fantasma" onClick={() => void recusar(pedido)}>
                      Recusar
                    </Botao>
                  </span>
                </section>
              </AbreEspaco>
            ))}
            {apresentador && (
              <AbreEspaco key="apresentador">
                <section
                  aria-live="polite"
                  className="flex items-center justify-between gap-3 rounded-lg border border-borda px-3 py-2 text-sm"
                >
                  <span>
                    Agora: tela de {nomeDe(apresentador)}. A sua está pausada para quem assiste.
                  </span>
                  <Botao onClick={() => void controle.passarVez(null)}>Retomar minha tela</Botao>
                </section>
              </AbreEspaco>
            )}
          </AnimatePresence>
        </div>

        <div className="grid gap-4">
          <p className="text-sm text-texto-suave" aria-live="polite">
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
          {estado.linkFixo && (
            <Link
              id="link-fixo"
              rotulo="Seu link fixo"
              url={estado.linkFixo}
              grande
              destacarFinal
              aoCopiar={controle.copiarLink}
            />
          )}
          <Link
            id="link"
            rotulo={estado.linkFixo ? 'Link só desta transmissão' : 'Link da transmissão'}
            url={estado.link}
            grande={!estado.linkFixo}
            destacarFinal={false}
            aoCopiar={controle.copiarLink}
          />
          <div>
            <FaixaDeSinal
              estatisticas={estatisticas}
              resolvida={resolvida}
              abertas={abertas}
              aoAlternar={() => setAbertas(!abertas)}
            />
            <AnimatePresence initial={false}>
              {abertas && (
                <AbreEspaco key="estatisticas">
                  <PainelEstatisticas estatisticas={estatisticas} />
                </AbreEspaco>
              )}
            </AnimatePresence>
          </div>
        </div>

        {config.audioSistema && !estado.comAudio && (
          <p className="text-sm text-texto-suave">
            Sem áudio: a captura não trouxe o som do computador. Troque para a tela inteira e tente
            de novo.
          </p>
        )}
        {aviso && (
          <p
            role="alert"
            className="rounded-lg border border-parar/40 px-3 py-2 text-parar text-sm"
          >
            {aviso}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Botao onClick={controle.alternarPausa} aria-keyshortcuts="P">
            {estado.pausado ? 'Retomar vídeo' : 'Pausar vídeo'}
          </Botao>
          {estado.comAudio && (
            <Botao onClick={controle.alternarAudio} aria-keyshortcuts="M">
              {estado.audioMudo ? 'Ligar áudio' : 'Mutar áudio'}
            </Botao>
          )}
          {config.microfone.ativo && (
            <Botao onClick={controle.alternarMicrofone} aria-keyshortcuts="N">
              {estado.microfoneMudo ? 'Ligar microfone' : 'Mutar microfone'}
            </Botao>
          )}
          <span className="mx-1 w-px self-stretch bg-borda" aria-hidden />
          <Botao variante="fantasma" onClick={() => setPainel('fonte')}>
            Trocar tela/janela
          </Botao>
          <Botao
            variante="fantasma"
            onClick={() => setPainel(painel === 'ajustes' ? 'nenhum' : 'ajustes')}
            aria-expanded={painel === 'ajustes'}
          >
            Ajustes
          </Botao>
          <Botao variante="perigo" className="ml-auto" onClick={controle.parar}>
            Parar
          </Botao>
        </div>

        {painel === 'fonte' && (
          <section aria-label="Trocar o que está sendo compartilhado" className="grid gap-3">
            <PainelFonte
              lista={fontes}
              escolhida={null}
              aoEscolher={(fonte) => void trocarFonte(fonte)}
            />
            <Botao variante="fantasma" onClick={() => setPainel('nenhum')}>
              Cancelar
            </Botao>
          </section>
        )}

        {painel === 'ajustes' && (
          <aside aria-label="Ajustes da transmissão">
            <Secao titulo="Vídeo" aberta>
              <PainelVideo
                config={config}
                aoMudar={(nova) => void ajustar(nova)}
                codecsDoHost={codecsDoHost()}
                limitadoPelaFonte={resolvida.limitadoPelaFonte}
                uploadNecessarioKbps={uploadNecessarioKbps(resolvida)}
              />
            </Secao>
            <Secao titulo="Áudio" aberta>
              <PainelAudio
                config={config}
                aoMudar={(nova) => void ajustar(nova)}
                nivelAudio={controle.nivelAudio}
                microfones={microfones}
              />
            </Secao>
          </aside>
        )}
      </div>

      <aside aria-label="Sala" className="grid content-start gap-5">
        <Secao titulo={`Quem está assistindo (${estado.espectadores.length})`} aberta>
          <Alternador
            rotulo="Trancar sessão"
            descricao="Ninguém novo entra, nem quem você removeu; quem já está continua assistindo."
            ligado={estado.trancada}
            aoMudar={(trancada) => void controle.trancar(trancada)}
          />
          {estado.espectadores.length === 0 ? (
            <p className="text-sm text-texto-suave">Ninguém entrou ainda. É só mandar o link.</p>
          ) : (
            <ul className="grid gap-1" data-testid="lista-espectadores">
              <AnimatePresence initial={false}>
                {estado.espectadores.map((espectador) => (
                  <motion.li
                    key={espectador.identity}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={SAIDA}
                    transition={ENTRADA}
                    className="flex items-center justify-between text-sm"
                  >
                    {espectador.nome}
                    <Botao
                      variante="fantasma"
                      className="px-2 py-1 text-xs"
                      onClick={() => void controle.remover(espectador.identity)}
                      aria-label={`Remover ${espectador.nome}`}
                    >
                      Remover
                    </Botao>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Secao>
      </aside>
    </main>
  )
}

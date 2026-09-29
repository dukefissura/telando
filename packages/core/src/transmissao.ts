export type Resolucao = 'nativa' | '2160p' | '1440p' | '1080p' | '720p' | '480p'
export type Fps = 5 | 15 | 30 | 60 | 120
export type Otimizacao = 'nitidez' | 'fluidez' | 'equilibrio'
export type Codec = 'auto' | 'av1' | 'vp9' | 'h264' | 'vp8'
export type QualidadeAudio = 'voz' | 'musica' | 'alta'
export type PresetId = 'texto' | 'jogo' | 'filme' | 'economia'

export type ConfigMicrofone = {
  ativo: boolean
  deviceId: string | null
  cancelamentoEco: boolean
  supressaoRuido: boolean
  ganhoAutomatico: boolean
}

export type ConfigTransmissao = {
  resolucao: Resolucao
  fps: Fps
  bitrateMaxKbps: number | 'auto'
  otimizacao: Otimizacao
  codec: Codec
  simulcast: boolean
  audioSistema: boolean
  /** 0 a 1,5 (150%). */
  volumeAudio: number
  qualidadeAudio: QualidadeAudio
  microfone: ConfigMicrofone
}

type CamposDoPreset = Pick<
  ConfigTransmissao,
  'resolucao' | 'fps' | 'bitrateMaxKbps' | 'otimizacao' | 'qualidadeAudio' | 'simulcast'
>

/** `nomeCurto` vai no segmentado; o `nome` fica na dica e nos textos corridos. */
export const PRESETS: Record<PresetId, CamposDoPreset & { nome: string; nomeCurto: string }> = {
  texto: {
    nome: 'Texto/código',
    nomeCurto: 'Texto',
    resolucao: '1080p',
    // 30 e não 15: rolar código e documento a 15 fps parece travado.
    fps: 30,
    bitrateMaxKbps: 6000,
    otimizacao: 'nitidez',
    qualidadeAudio: 'voz',
    simulcast: true,
  },
  jogo: {
    nome: 'Jogo',
    nomeCurto: 'Jogo',
    resolucao: '1080p',
    fps: 60,
    // H.264 em software gasta mais bits que o x264 de uma live: 8 Mbps borrava cena com movimento.
    bitrateMaxKbps: 12_000,
    otimizacao: 'fluidez',
    qualidadeAudio: 'musica',
    // Medido: com a camada extra, os dois codificadores dividem a CPU e o 1080p60 caía para ~41 fps.
    simulcast: false,
  },
  filme: {
    nome: 'Filme/vídeo',
    nomeCurto: 'Filme',
    resolucao: '1080p',
    fps: 30,
    bitrateMaxKbps: 10_000,
    otimizacao: 'equilibrio',
    qualidadeAudio: 'alta',
    simulcast: true,
  },
  economia: {
    nome: 'Economia',
    nomeCurto: 'Economia',
    resolucao: '720p',
    fps: 30,
    bitrateMaxKbps: 2500,
    otimizacao: 'equilibrio',
    qualidadeAudio: 'voz',
    simulcast: true,
  },
}

export const NOMES_QUALIDADE_AUDIO: Record<QualidadeAudio, string> = {
  voz: 'Voz',
  musica: 'Música',
  alta: 'Alta fidelidade',
}

export const AUDIO: Record<QualidadeAudio, TransmissaoResolvida['audio']> = {
  voz: { bitrateKbps: 32, estereo: false, dtx: true, red: true },
  musica: { bitrateKbps: 128, estereo: true, dtx: false, red: false },
  alta: { bitrateKbps: 256, estereo: true, dtx: false, red: true },
}

const ALTURAS: Record<Exclude<Resolucao, 'nativa'>, number> = {
  '2160p': 2160,
  '1440p': 1440,
  '1080p': 1080,
  '720p': 720,
  '480p': 480,
}

const OTIMIZACAO: Record<
  Otimizacao,
  { contentHint: string; degradacao: RTCDegradationPreference }
> = {
  nitidez: { contentHint: 'detail', degradacao: 'maintain-resolution' },
  fluidez: { contentHint: 'motion', degradacao: 'maintain-framerate' },
  equilibrio: { contentHint: '', degradacao: 'balanced' },
}

export type Dimensoes = { largura: number; altura: number }

export type CamadaSimulcast = Dimensoes & { fps: number; bitrateKbps: number }

export type TransmissaoResolvida = {
  alvo: Dimensoes
  limitadoPelaFonte: boolean
  fps: number
  constraintsVideo: MediaTrackConstraints
  contentHint: string
  degradacao: RTCDegradationPreference
  codec: Exclude<Codec, 'auto'>
  backupCodec: 'vp8' | null
  bitrateKbps: number
  camadas: CamadaSimulcast[]
  audio: { bitrateKbps: number; estereo: boolean; dtx: boolean; red: boolean }
  constraintsAudioSistema: MediaTrackConstraints | null
  constraintsMicrofone: MediaTrackConstraints | null
  resumo: string
}

export function configPadrao(): ConfigTransmissao {
  return aplicarPreset(
    {
      resolucao: '1080p',
      fps: 15,
      bitrateMaxKbps: 2500,
      otimizacao: 'nitidez',
      codec: 'auto',
      simulcast: true,
      audioSistema: true,
      volumeAudio: 1,
      qualidadeAudio: 'voz',
      microfone: {
        ativo: false,
        deviceId: null,
        cancelamentoEco: true,
        supressaoRuido: true,
        ganhoAutomatico: true,
      },
    },
    'texto',
  )
}

export function aplicarPreset(config: ConfigTransmissao, id: PresetId): ConfigTransmissao {
  const { nome: _, ...campos } = PRESETS[id]
  return { ...config, ...campos }
}

export function presetAtual(config: ConfigTransmissao): PresetId | 'personalizado' {
  const id = (Object.keys(PRESETS) as PresetId[]).find((candidato) => {
    const preset = PRESETS[candidato]
    return (
      preset.resolucao === config.resolucao &&
      preset.fps === config.fps &&
      preset.bitrateMaxKbps === config.bitrateMaxKbps &&
      preset.otimizacao === config.otimizacao &&
      preset.simulcast === config.simulcast &&
      preset.qualidadeAudio === config.qualidadeAudio
    )
  })
  return id ?? 'personalizado'
}

/** Altura que a captura já deve entregar; a nativa não limita. */
export function alturaPedida(resolucao: Resolucao): number | null {
  return resolucao === 'nativa' ? null : ALTURAS[resolucao]
}

const par = (valor: number) => Math.round(valor / 2) * 2
const arredondarCentena = (valor: number) => Math.round(valor / 100) * 100

function calcularAlvo(resolucao: Resolucao, fonte: Dimensoes) {
  const pedida = alturaPedida(resolucao) ?? fonte.altura
  const altura = Math.min(pedida, fonte.altura)
  return {
    alvo: { largura: par((fonte.largura * altura) / fonte.altura), altura },
    limitadoPelaFonte: pedida > fonte.altura,
  }
}

// 0,08 bit por pixel por quadro é a conta do LiveKit para tela: dá 2,5 Mbps em 1080p15.
function bitrateAutomatico({ largura, altura }: Dimensoes, fps: number) {
  return Math.min(20_000, Math.max(500, arredondarCentena((largura * altura * fps * 0.08) / 1000)))
}

function escolherCodec(codec: Codec, codecsDoHost: string[]): Exclude<Codec, 'auto'> {
  if (codec !== 'auto') return codec
  // AV1 e VP9 comprimem melhor no papel, mas em compartilhamento de tela o Chromium codifica por
  // software (libaom, libvpx) e, medido, a camada cheia nem decolava: quem assistia recebia 540p a
  // ~15 fps. Com H.264 a mesma transmissão chega em 1080p60. AV1 e VP9 ficam para quem escolher.
  return codecsDoHost.includes('h264') ? 'h264' : 'vp8'
}

export const formatarMbps = (kbps: number) =>
  `${(kbps / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} Mbps`

/** Processamento de voz estraga música e jogo; no áudio do sistema ele fica sempre desligado. */
export function constraintsDoAudioSistema(config: ConfigTransmissao): MediaTrackConstraints | null {
  if (!config.audioSistema) return null
  return {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: AUDIO[config.qualidadeAudio].estereo ? 2 : 1,
  }
}

// A camada menor é para quem tem internet fraca: subir o teto da cheia não pode pesar nela também.
const TETO_CAMADA_MENOR_KBPS = 1500

export function resolverTransmissao(
  config: ConfigTransmissao,
  fonte: Dimensoes,
  codecsDoHost: string[],
): TransmissaoResolvida {
  const { alvo, limitadoPelaFonte } = calcularAlvo(config.resolucao, fonte)
  const bitrateKbps =
    config.bitrateMaxKbps === 'auto' ? bitrateAutomatico(alvo, config.fps) : config.bitrateMaxKbps
  const codec = escolherCodec(config.codec, codecsDoHost)
  const audio = AUDIO[config.qualidadeAudio]
  const { microfone } = config

  const camadas: CamadaSimulcast[] = config.simulcast
    ? [
        {
          largura: par(alvo.largura / 2),
          altura: par(alvo.altura / 2),
          fps: Math.min(config.fps, 15),
          bitrateKbps: Math.min(TETO_CAMADA_MENOR_KBPS, arredondarCentena(bitrateKbps / 4)),
        },
      ]
    : []

  const partesDoResumo = [
    `${alvo.altura}p`,
    `${config.fps} fps`,
    config.bitrateMaxKbps === 'auto' ? 'bitrate automático' : `até ${formatarMbps(bitrateKbps)}`,
    config.audioSistema ? `áudio ${NOMES_QUALIDADE_AUDIO[config.qualidadeAudio]}` : 'sem áudio',
  ]

  return {
    alvo,
    limitadoPelaFonte,
    fps: config.fps,
    constraintsVideo: {
      width: { max: alvo.largura },
      height: { max: alvo.altura },
      frameRate: { max: config.fps },
    },
    ...OTIMIZACAO[config.otimizacao],
    codec,
    backupCodec: codec === 'av1' || codec === 'vp9' ? 'vp8' : null,
    bitrateKbps,
    camadas,
    audio,
    constraintsAudioSistema: constraintsDoAudioSistema(config),
    constraintsMicrofone: microfone.ativo
      ? {
          ...(microfone.deviceId && { deviceId: { exact: microfone.deviceId } }),
          echoCancellation: microfone.cancelamentoEco,
          noiseSuppression: microfone.supressaoRuido,
          autoGainControl: microfone.ganhoAutomatico,
        }
      : null,
    resumo: partesDoResumo.join(' · '),
  }
}

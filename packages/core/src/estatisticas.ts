type Registro = { id: string; type: string; [campo: string]: unknown }

export type EstatisticasEnvio = {
  largura: number
  altura: number
  fps: number
  videoKbps: number
  audioKbps: number
  /** Codec em uso de fato, ex.: "VP9". */
  codec: string | null
  perdaPct: number
  /** Por que o navegador está reduzindo a qualidade, se estiver. */
  limitacao: 'cpu' | 'banda' | null
  /** Falso quando o dynacast pausou todas as camadas: ninguém está assistindo. */
  enviando: boolean
}

export type AmostraEnvio = { em: number; bytesVideo: number; bytesAudio: number }

const numero = (valor: unknown) => (typeof valor === 'number' ? valor : 0)

const LIMITACOES: Record<string, EstatisticasEnvio['limitacao']> = {
  cpu: 'cpu',
  bandwidth: 'banda',
}

/**
 * Resume o getStats() dos senders de vídeo e áudio. Com simulcast há um outbound-rtp por camada;
 * resolução, fps e limitação vêm da camada mais alta, e o bitrate soma todas.
 */
export function resumirEnvio(
  relatorio: Iterable<Registro>,
  anterior: AmostraEnvio | null,
  agoraMs: number,
): { estatisticas: EstatisticasEnvio; amostra: AmostraEnvio } {
  const registros = [...relatorio]
  const saidas = registros.filter((r) => r.type === 'outbound-rtp')
  const video = saidas.filter((r) => r.kind === 'video')
  const bytesVideo = video.reduce((soma, r) => soma + numero(r.bytesSent), 0)
  const bytesAudio = saidas
    .filter((r) => r.kind === 'audio')
    .reduce((soma, r) => soma + numero(r.bytesSent), 0)

  // O dynacast do LiveKit pausa camadas que ninguém pediu; elas seguem no relatório com o tamanho antigo.
  const maisAlta = video
    .filter((r) => r.active !== false)
    .reduce<Registro | undefined>(
      (maior, r) => (!maior || numero(r.frameWidth) > numero(maior.frameWidth) ? r : maior),
      undefined,
    )
  const mimeType = registros.find((r) => r.type === 'codec' && r.id === maisAlta?.codecId)?.mimeType
  const perda = Math.max(
    0,
    ...registros
      .filter((r) => r.type === 'remote-inbound-rtp' && r.kind === 'video')
      .map((r) => numero(r.fractionLost)),
  )

  const segundos = anterior ? (agoraMs - anterior.em) / 1000 : 0
  // Uma trilha republicada ganha sender novo e o contador de bytes recomeça do zero.
  const kbps = (bytes: number, antes: number) =>
    segundos > 0 && bytes >= antes ? Math.round(((bytes - antes) * 8) / 1000 / segundos) : 0

  return {
    estatisticas: {
      largura: numero(maisAlta?.frameWidth),
      altura: numero(maisAlta?.frameHeight),
      fps: Math.round(numero(maisAlta?.framesPerSecond)),
      videoKbps: kbps(bytesVideo, anterior?.bytesVideo ?? 0),
      audioKbps: kbps(bytesAudio, anterior?.bytesAudio ?? 0),
      codec: typeof mimeType === 'string' ? (mimeType.split('/')[1] ?? null) : null,
      perdaPct: Math.round(perda * 1000) / 10,
      limitacao: LIMITACOES[String(maisAlta?.qualityLimitationReason)] ?? null,
      enviando: maisAlta !== undefined,
    },
    amostra: { em: agoraMs, bytesVideo, bytesAudio },
  }
}

export type Recebimento = {
  largura: number
  altura: number
  fps: number
  kbps: number
  perdaPct: number
}

export type AmostraRecebimento = { em: number; bytes: number }

export function resumirRecebimento(
  relatorio: Iterable<Registro>,
  anterior: AmostraRecebimento | null,
  agoraMs: number,
): { recebimento: Recebimento | null; amostra: AmostraRecebimento } {
  const video = [...relatorio].find((r) => r.type === 'inbound-rtp' && r.kind === 'video')
  const bytes = numero(video?.bytesReceived)
  const amostra = { em: agoraMs, bytes }
  if (!video) return { recebimento: null, amostra }

  const segundos = anterior ? (agoraMs - anterior.em) / 1000 : 0
  const recebidos = numero(video.packetsReceived)
  const perdidos = numero(video.packetsLost)
  return {
    recebimento: {
      largura: numero(video.frameWidth),
      altura: numero(video.frameHeight),
      fps: Math.round(numero(video.framesPerSecond)),
      kbps:
        anterior && segundos > 0 && bytes >= anterior.bytes
          ? Math.round(((bytes - anterior.bytes) * 8) / 1000 / segundos)
          : 0,
      perdaPct:
        recebidos + perdidos > 0 ? Math.round((perdidos / (recebidos + perdidos)) * 1000) / 10 : 0,
    },
    amostra,
  }
}

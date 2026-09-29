import { describe, expect, it } from 'vitest'
import { resumirEnvio, resumirRecebimento } from './estatisticas.ts'

function relatorio(bytesVideo: number, bytesAudio: number) {
  return [
    { id: 'c1', type: 'codec', mimeType: 'video/VP9' },
    {
      id: 'v-baixa',
      type: 'outbound-rtp',
      kind: 'video',
      bytesSent: 1000,
      frameWidth: 960,
      frameHeight: 540,
      framesPerSecond: 15,
      codecId: 'c1',
      qualityLimitationReason: 'none',
    },
    {
      id: 'v-alta',
      type: 'outbound-rtp',
      kind: 'video',
      bytesSent: bytesVideo - 1000,
      frameWidth: 1920,
      frameHeight: 1080,
      framesPerSecond: 59.6,
      codecId: 'c1',
      qualityLimitationReason: 'bandwidth',
    },
    { id: 'a', type: 'outbound-rtp', kind: 'audio', bytesSent: bytesAudio },
    { id: 'r1', type: 'remote-inbound-rtp', kind: 'video', fractionLost: 0.004 },
    { id: 'r2', type: 'remote-inbound-rtp', kind: 'video', fractionLost: 0.021 },
  ]
}

it('lê resolução, fps, codec, perda e limitação da camada mais alta', () => {
  const { estatisticas } = resumirEnvio(relatorio(0, 0), null, 0)

  expect(estatisticas).toMatchObject({
    largura: 1920,
    altura: 1080,
    fps: 60,
    codec: 'VP9',
    perdaPct: 2.1,
    limitacao: 'banda',
  })
})

it('calcula o bitrate pela diferença de bytes entre duas amostras', () => {
  const primeira = resumirEnvio(relatorio(100_000, 10_000), null, 1000)
  expect(primeira.estatisticas.videoKbps).toBe(0)

  const segunda = resumirEnvio(relatorio(1_100_000, 26_000), primeira.amostra, 2000)
  expect(segunda.estatisticas.videoKbps).toBe(8000)
  expect(segunda.estatisticas.audioKbps).toBe(128)
})

it('sem vídeo saindo devolve zeros', () => {
  const { estatisticas } = resumirEnvio([], null, 0)
  expect(estatisticas).toEqual({
    largura: 0,
    altura: 0,
    fps: 0,
    videoKbps: 0,
    audioKbps: 0,
    codec: null,
    perdaPct: 0,
    limitacao: null,
    enviando: false,
  })
})

it('com todas as camadas pausadas (ninguém assistindo), diz que não está enviando', () => {
  const pausada = { id: 'v', type: 'outbound-rtp', kind: 'video', active: false, frameWidth: 1920 }
  expect(resumirEnvio([pausada], null, 0).estatisticas.enviando).toBe(false)
  expect(resumirEnvio(relatorio(0, 0), null, 0).estatisticas.enviando).toBe(true)
})

it('ignora a camada que o LiveKit pausou porque ninguém está pedindo', () => {
  const pausada = {
    id: 'v-pausada',
    type: 'outbound-rtp',
    kind: 'video',
    active: false,
    bytesSent: 0,
    frameWidth: 3840,
    frameHeight: 2160,
  }
  const { estatisticas } = resumirEnvio([...relatorio(0, 0), pausada], null, 0)

  expect(estatisticas).toMatchObject({ largura: 1920, altura: 1080, fps: 60, codec: 'VP9' })
})

it('não mostra bitrate negativo quando a trilha é republicada e o contador recomeça', () => {
  const antes = resumirEnvio(relatorio(1_000_000, 500_000), null, 1000)
  const depois = resumirEnvio(relatorio(1_500_000, 4_000), antes.amostra, 2000)

  expect(depois.estatisticas.audioKbps).toBe(0)
  expect(depois.estatisticas.videoKbps).toBe(4000)
})

describe('resumirRecebimento', () => {
  const recebido = (bytes: number, recebidos: number, perdidos: number) => [
    {
      id: 'in',
      type: 'inbound-rtp',
      kind: 'video',
      bytesReceived: bytes,
      frameWidth: 1280,
      frameHeight: 720,
      framesPerSecond: 29.7,
      packetsReceived: recebidos,
      packetsLost: perdidos,
    },
  ]

  it('lê resolução, fps, bitrate e perda do que chega', () => {
    const primeira = resumirRecebimento(recebido(0, 0, 0), null, 0)
    const segunda = resumirRecebimento(recebido(500_000, 990, 10), primeira.amostra, 1000)

    expect(segunda.recebimento).toEqual({
      largura: 1280,
      altura: 720,
      fps: 30,
      kbps: 4000,
      perdaPct: 1,
    })
  })

  it('sem vídeo chegando devolve null', () => {
    expect(resumirRecebimento([], null, 0).recebimento).toBeNull()
  })
})

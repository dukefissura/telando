import { expect, it } from 'vitest'
import { resumirEnvio } from './estatisticas.ts'

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
  })
})

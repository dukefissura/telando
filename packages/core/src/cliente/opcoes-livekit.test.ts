import { Track } from 'livekit-client'
import { expect, it } from 'vitest'
import { aplicarPreset, configPadrao, resolverTransmissao } from '../transmissao.ts'
import { opcoesDePublicacao } from './opcoes-livekit.ts'

const FULL_HD = { largura: 1920, altura: 1080 }

it('publica a tela com codec, reserva, bitrate em bps e a camada de simulcast', () => {
  const resolvida = resolverTransmissao(aplicarPreset(configPadrao(), 'jogo'), FULL_HD, ['vp9'])
  const { video } = opcoesDePublicacao(resolvida)

  expect(video).toMatchObject({
    source: Track.Source.ScreenShare,
    videoCodec: 'vp9',
    backupCodec: { codec: 'vp8' },
    screenShareEncoding: { maxBitrate: 8_000_000, maxFramerate: 60 },
    simulcast: true,
    degradationPreference: 'maintain-framerate',
  })
  expect(video.screenShareSimulcastLayers?.map((c) => [c.width, c.height, c.encoding])).toEqual([
    [960, 540, { maxBitrate: 2_000_000, maxFramerate: 15 }],
  ])
})

it('sem codec de reserva e sem simulcast', () => {
  const config = { ...configPadrao(), codec: 'h264' as const, simulcast: false }
  const { video } = opcoesDePublicacao(resolverTransmissao(config, FULL_HD, []))

  expect(video.backupCodec).toBe(false)
  expect(video.simulcast).toBe(false)
  expect(video.screenShareSimulcastLayers).toEqual([])
})

it('publica o áudio da tela com a qualidade escolhida', () => {
  const alta = { ...configPadrao(), qualidadeAudio: 'alta' as const }
  const { audio } = opcoesDePublicacao(resolverTransmissao(alta, FULL_HD, []))

  expect(audio).toEqual({
    source: Track.Source.ScreenShareAudio,
    audioPreset: { maxBitrate: 256_000 },
    forceStereo: true,
    dtx: false,
    red: true,
  })
})

import { expect, it } from 'vitest'
import { aplicarPreset, configPadrao, resolverTransmissao } from '../transmissao.ts'
import { ajustarEncodings } from './encodings.ts'

function senderFalso(encodings: RTCRtpEncodingParameters[]) {
  let aplicados: RTCRtpSendParameters | null = null
  const sender = {
    getParameters: () => ({ encodings: structuredClone(encodings) }) as RTCRtpSendParameters,
    setParameters: async (parametros: RTCRtpSendParameters) => {
      aplicados = parametros
    },
  }
  return { sender: sender as unknown as RTCRtpSender, aplicados: () => aplicados }
}

const FULL_HD = { largura: 1920, altura: 1080 }

it('muda bitrate e fps da camada cheia e da camada menor sem republicar', async () => {
  const { sender, aplicados } = senderFalso([
    { rid: 'q', scaleResolutionDownBy: 2, maxBitrate: 1, maxFramerate: 1 },
    { rid: 'h', scaleResolutionDownBy: 1, maxBitrate: 1, maxFramerate: 1 },
  ])
  const jogo = resolverTransmissao(aplicarPreset(configPadrao(), 'jogo'), FULL_HD, [])

  await ajustarEncodings(sender, jogo)

  expect(aplicados()?.encodings).toEqual([
    { rid: 'q', scaleResolutionDownBy: 2, maxBitrate: 2_000_000, maxFramerate: 15 },
    { rid: 'h', scaleResolutionDownBy: 1, maxBitrate: 8_000_000, maxFramerate: 60 },
  ])
})

it('sem simulcast há um encoding só, que recebe o bitrate cheio', async () => {
  const { sender, aplicados } = senderFalso([{ maxBitrate: 1 }])
  const texto = resolverTransmissao({ ...configPadrao(), simulcast: false }, FULL_HD, [])

  await ajustarEncodings(sender, texto)

  expect(aplicados()?.encodings).toEqual([{ maxBitrate: 2_500_000, maxFramerate: 15 }])
})

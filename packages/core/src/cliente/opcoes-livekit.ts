import { Track, type TrackPublishOptions, VideoPreset } from 'livekit-client'
import type { TransmissaoResolvida } from '../transmissao.ts'

export function opcoesDePublicacao(resolvida: TransmissaoResolvida): {
  video: TrackPublishOptions
  audio: TrackPublishOptions
} {
  const { audio } = resolvida
  return {
    video: {
      source: Track.Source.ScreenShare,
      videoCodec: resolvida.codec,
      backupCodec: resolvida.backupCodec ? { codec: resolvida.backupCodec } : false,
      screenShareEncoding: {
        maxBitrate: resolvida.bitrateKbps * 1000,
        maxFramerate: resolvida.fps,
      },
      simulcast: resolvida.camadas.length > 0,
      screenShareSimulcastLayers: resolvida.camadas.map(
        (camada) =>
          new VideoPreset(camada.largura, camada.altura, camada.bitrateKbps * 1000, camada.fps),
      ),
      degradationPreference: resolvida.degradacao,
    },
    audio: {
      source: Track.Source.ScreenShareAudio,
      audioPreset: { maxBitrate: audio.bitrateKbps * 1000 },
      forceStereo: audio.estereo,
      dtx: audio.dtx,
      red: audio.red,
    },
  }
}

import { z } from 'zod'
import {
  AUDIO,
  type ConfigTransmissao,
  configPadrao,
  PRESETS,
  type PresetId,
  type TransmissaoResolvida,
} from './transmissao.ts'

// Preferências de uma versão anterior podem faltar campos: o que faltar vem do padrão.
// Um campo com valor inválido descarta tudo, para não misturar escolhas pela metade.
function schemaComPadrao(padrao: ConfigTransmissao) {
  const { microfone } = padrao
  return z.object({
    resolucao: z
      .enum(['nativa', '2160p', '1440p', '1080p', '720p', '480p'])
      .default(padrao.resolucao),
    fps: z
      .union([z.literal(5), z.literal(15), z.literal(30), z.literal(60), z.literal(120)])
      .default(padrao.fps),
    bitrateMaxKbps: z
      .union([z.number().min(500).max(20_000), z.literal('auto')])
      .default(padrao.bitrateMaxKbps),
    otimizacao: z.enum(['nitidez', 'fluidez', 'equilibrio']).default(padrao.otimizacao),
    codec: z.enum(['auto', 'av1', 'vp9', 'h264', 'vp8']).default(padrao.codec),
    simulcast: z.boolean().default(padrao.simulcast),
    audioSistema: z.boolean().default(padrao.audioSistema),
    volumeAudio: z.number().min(0).max(1.5).default(padrao.volumeAudio),
    qualidadeAudio: z.enum(['voz', 'musica', 'alta']).default(padrao.qualidadeAudio),
    microfone: z
      .object({
        ativo: z.boolean().default(microfone.ativo),
        deviceId: z.string().nullable().default(microfone.deviceId),
        cancelamentoEco: z.boolean().default(microfone.cancelamentoEco),
        supressaoRuido: z.boolean().default(microfone.supressaoRuido),
        ganhoAutomatico: z.boolean().default(microfone.ganhoAutomatico),
      })
      .default(microfone),
  })
}

export function lerConfigSalva(salva: unknown): ConfigTransmissao {
  const padrao = configPadrao()
  const resultado = schemaComPadrao(padrao).safeParse(salva)
  return resultado.success ? resultado.data : padrao
}

const FOLGA = 1.2

export function uploadNecessarioKbps(resolvida: TransmissaoResolvida): number {
  const audio = resolvida.constraintsAudioSistema ? resolvida.audio.bitrateKbps : 0
  return Math.round((resolvida.bitrateKbps + audio) * FOLGA)
}

export function presetQueCabe(uploadKbps: number): PresetId | null {
  const cabem = (Object.keys(PRESETS) as PresetId[])
    .map((id) => {
      const preset = PRESETS[id]
      const bitrate = preset.bitrateMaxKbps === 'auto' ? 0 : preset.bitrateMaxKbps
      return { id, necessario: (bitrate + AUDIO[preset.qualidadeAudio].bitrateKbps) * FOLGA }
    })
    .filter(({ necessario }) => necessario <= uploadKbps)
    .sort((a, b) => b.necessario - a.necessario)
  return cabem[0]?.id ?? null
}

import { z } from 'zod'
import {
  AUDIO,
  aplicarPreset,
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

// Os presets até a 0.4: quem escolheu um deles ganha os valores de hoje, em vez de ficar preso no
// "Personalizado" com o 8 Mbps e o simulcast que derrubavam o Jogo.
const PRESETS_ATE_0_4: Record<
  PresetId,
  Omit<(typeof PRESETS)[PresetId], 'nome' | 'nomeCurto' | 'simulcast'>
> = {
  texto: {
    resolucao: '1080p',
    fps: 15,
    bitrateMaxKbps: 2500,
    otimizacao: 'nitidez',
    qualidadeAudio: 'voz',
  },
  jogo: {
    resolucao: '1080p',
    fps: 60,
    bitrateMaxKbps: 8000,
    otimizacao: 'fluidez',
    qualidadeAudio: 'musica',
  },
  filme: {
    resolucao: '1080p',
    fps: 30,
    bitrateMaxKbps: 6000,
    otimizacao: 'equilibrio',
    qualidadeAudio: 'alta',
  },
  economia: {
    resolucao: '720p',
    fps: 30,
    bitrateMaxKbps: 1500,
    otimizacao: 'equilibrio',
    qualidadeAudio: 'voz',
  },
}

export function lerConfigSalva(salva: unknown): ConfigTransmissao {
  const padrao = configPadrao()
  const resultado = schemaComPadrao(padrao).safeParse(salva)
  if (!resultado.success) return padrao
  const config = resultado.data
  const antigo = (Object.keys(PRESETS_ATE_0_4) as PresetId[]).find((id) =>
    Object.entries(PRESETS_ATE_0_4[id]).every(
      ([campo, valor]) => config[campo as keyof typeof config] === valor,
    ),
  )
  return antigo ? aplicarPreset(config, antigo) : config
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

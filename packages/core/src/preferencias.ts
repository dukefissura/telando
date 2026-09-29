import { z } from 'zod'
import {
  aplicarPreset,
  type CamposDoPreset,
  type ConfigTransmissao,
  configPadrao,
  PRESETS,
  type PresetId,
  resolverTransmissao,
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

type ValoresDoPreset = Partial<CamposDoPreset>

// Valores que um preset já teve: quem escolheu um deles ganha os de hoje, em vez de ficar preso no
// "Personalizado" com números velhos. Só os campos listados precisam bater.
const PRESETS_ANTIGOS: Array<[PresetId, ValoresDoPreset]> = [
  // Até a 0.4.
  [
    'texto',
    {
      resolucao: '1080p',
      fps: 15,
      bitrateMaxKbps: 2500,
      otimizacao: 'nitidez',
      qualidadeAudio: 'voz',
    },
  ],
  [
    'jogo',
    {
      resolucao: '1080p',
      fps: 60,
      bitrateMaxKbps: 8000,
      otimizacao: 'fluidez',
      qualidadeAudio: 'musica',
    },
  ],
  [
    'filme',
    {
      resolucao: '1080p',
      fps: 30,
      bitrateMaxKbps: 6000,
      otimizacao: 'equilibrio',
      qualidadeAudio: 'alta',
    },
  ],
  [
    'economia',
    {
      resolucao: '720p',
      fps: 30,
      bitrateMaxKbps: 1500,
      otimizacao: 'equilibrio',
      qualidadeAudio: 'voz',
    },
  ],
  // 0.4.1 e 0.4.2: o Jogo ia sem a versão menor e com 12 Mbps.
  [
    'jogo',
    {
      resolucao: '1080p',
      fps: 60,
      bitrateMaxKbps: 12_000,
      otimizacao: 'fluidez',
      qualidadeAudio: 'musica',
      simulcast: false,
    },
  ],
]

// Sobe quando os valores dos presets mudam. A migração só vale para o que foi gravado antes: um
// ajuste feito hoje, igual por acaso a um preset antigo, fica como a pessoa deixou.
const REVISAO_DOS_PRESETS = 2

/** A config como vai para o disco, marcada com a revisão dos presets de agora. */
export function paraGravar(config: ConfigTransmissao) {
  return { ...config, revisaoDosPresets: REVISAO_DOS_PRESETS }
}

const gravadaComPresetsDeHoje = (salva: unknown) =>
  typeof salva === 'object' &&
  salva !== null &&
  'revisaoDosPresets' in salva &&
  salva.revisaoDosPresets === REVISAO_DOS_PRESETS

export function lerConfigSalva(salva: unknown): ConfigTransmissao {
  const padrao = configPadrao()
  const resultado = schemaComPadrao(padrao).safeParse(salva)
  if (!resultado.success) return padrao
  const config = resultado.data
  if (gravadaComPresetsDeHoje(salva)) return config
  const antigo = PRESETS_ANTIGOS.find(([, valores]) =>
    Object.entries(valores).every(
      ([campo, valor]) => config[campo as keyof typeof config] === valor,
    ),
  )
  return antigo ? aplicarPreset(config, antigo[0]) : config
}

const FOLGA = 1.2

export function uploadNecessarioKbps(resolvida: TransmissaoResolvida): number {
  const audio = resolvida.constraintsAudioSistema ? resolvida.audio.bitrateKbps : 0
  const camadas = resolvida.camadas.reduce((soma, camada) => soma + camada.bitrateKbps, 0)
  return Math.round((resolvida.bitrateKbps + camadas + audio) * FOLGA)
}

// Uma tela Full HD: os presets pedem no máximo 1080p, então o tamanho real não muda a conta.
const TELA_DE_REFERENCIA = { largura: 1920, altura: 1080 }

export function presetQueCabe(uploadKbps: number): PresetId | null {
  const cabem = (Object.keys(PRESETS) as PresetId[])
    .map((id) => ({
      id,
      necessario: uploadNecessarioKbps(
        resolverTransmissao(aplicarPreset(configPadrao(), id), TELA_DE_REFERENCIA, []),
      ),
    }))
    .filter(({ necessario }) => necessario <= uploadKbps)
    .sort((a, b) => b.necessario - a.necessario)
  return cabem[0]?.id ?? null
}

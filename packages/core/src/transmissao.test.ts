import { describe, expect, it } from 'vitest'
import {
  aplicarPreset,
  type ConfigTransmissao,
  configPadrao,
  PRESETS,
  type PresetId,
  presetAtual,
  resolverTransmissao,
} from './transmissao.ts'

const FULL_HD = { largura: 1920, altura: 1080 }
const TODOS_OS_CODECS = ['av1', 'vp9', 'h264', 'vp8']

function comPreset(id: PresetId): ConfigTransmissao {
  return aplicarPreset(configPadrao(), id)
}

describe('presets', () => {
  it.each([
    ['texto', '1080p · 15 fps · até 2,5 Mbps · áudio Voz'],
    ['jogo', '1080p · 60 fps · até 8 Mbps · áudio Música'],
    ['filme', '1080p · 30 fps · até 6 Mbps · áudio Alta fidelidade'],
    ['economia', '720p · 30 fps · até 1,5 Mbps · áudio Voz'],
  ] as const)('%s gera o resumo da tabela', (id, resumo) => {
    expect(resolverTransmissao(comPreset(id), FULL_HD, TODOS_OS_CODECS).resumo).toBe(resumo)
  })

  it('começa no preset Texto/código com áudio do sistema e simulcast ligados', () => {
    const config = configPadrao()
    expect(presetAtual(config)).toBe('texto')
    expect(config.audioSistema).toBe(true)
    expect(config.simulcast).toBe(true)
    expect(config.microfone.ativo).toBe(false)
  })

  it('reconhece o preset aplicado', () => {
    for (const id of Object.keys(PRESETS) as PresetId[]) {
      expect(presetAtual(comPreset(id))).toBe(id)
    }
  })

  it('vira personalizado quando um controle manual muda', () => {
    expect(presetAtual({ ...comPreset('jogo'), fps: 30 })).toBe('personalizado')
    expect(presetAtual({ ...comPreset('jogo'), bitrateMaxKbps: 'auto' })).toBe('personalizado')
  })

  it('mexer no que não está na tabela não tira do preset', () => {
    expect(presetAtual({ ...comPreset('jogo'), codec: 'h264', audioSistema: false })).toBe('jogo')
  })

  it('aplicar preset mantém o que não está na tabela', () => {
    const config = aplicarPreset({ ...configPadrao(), codec: 'vp9', simulcast: false }, 'jogo')
    expect(config.codec).toBe('vp9')
    expect(config.simulcast).toBe(false)
  })
})

describe('resolução', () => {
  it('nunca faz upscale e avisa', () => {
    const r = resolverTransmissao(
      comPreset('jogo'),
      { largura: 1280, altura: 720 },
      TODOS_OS_CODECS,
    )
    expect(r.alvo).toEqual({ largura: 1280, altura: 720 })
    expect(r.limitadoPelaFonte).toBe(true)
    expect(r.resumo.startsWith('720p')).toBe(true)
  })

  it('mantém a proporção da fonte com largura par', () => {
    const r = resolverTransmissao(
      { ...configPadrao(), resolucao: '1080p' },
      { largura: 3440, altura: 1440 },
      TODOS_OS_CODECS,
    )
    expect(r.alvo).toEqual({ largura: 2580, altura: 1080 })
    expect(r.limitadoPelaFonte).toBe(false)
  })

  it('nativa usa a resolução da fonte', () => {
    const r = resolverTransmissao(
      { ...configPadrao(), resolucao: 'nativa' },
      { largura: 2560, altura: 1440 },
      TODOS_OS_CODECS,
    )
    expect(r.alvo).toEqual({ largura: 2560, altura: 1440 })
    expect(r.limitadoPelaFonte).toBe(false)
  })

  it('limita a captura ao alvo e ao fps', () => {
    const r = resolverTransmissao(comPreset('economia'), FULL_HD, TODOS_OS_CODECS)
    expect(r.constraintsVideo).toEqual({
      width: { max: 1280 },
      height: { max: 720 },
      frameRate: { max: 30 },
    })
  })
})

describe('bitrate', () => {
  it('usa o máximo escolhido', () => {
    expect(resolverTransmissao(comPreset('jogo'), FULL_HD, TODOS_OS_CODECS).bitrateKbps).toBe(8000)
  })

  it('no automático cresce com pixels e fps e fica entre 0,5 e 20 Mbps', () => {
    const auto = (resolucao: ConfigTransmissao['resolucao'], fps: ConfigTransmissao['fps']) =>
      resolverTransmissao(
        { ...configPadrao(), bitrateMaxKbps: 'auto', resolucao, fps },
        { largura: 3840, altura: 2160 },
        TODOS_OS_CODECS,
      ).bitrateKbps

    expect(auto('1080p', 15)).toBe(2500)
    expect(auto('1080p', 60)).toBeGreaterThan(auto('1080p', 30))
    expect(auto('1440p', 30)).toBeGreaterThan(auto('1080p', 30))
    expect(auto('480p', 5)).toBe(500)
    expect(auto('2160p', 120)).toBe(20000)
  })

  it('mostra "automático" no resumo', () => {
    const r = resolverTransmissao(
      { ...comPreset('texto'), bitrateMaxKbps: 'auto' },
      FULL_HD,
      TODOS_OS_CODECS,
    )
    expect(r.resumo).toBe('1080p · 15 fps · bitrate automático · áudio Voz')
  })
})

describe('codec', () => {
  it('no automático tenta AV1, depois VP9, depois H.264', () => {
    const codec = (host: string[]) => resolverTransmissao(configPadrao(), FULL_HD, host).codec
    expect(codec(['vp8', 'h264', 'vp9', 'av1'])).toBe('av1')
    expect(codec(['vp8', 'h264', 'vp9'])).toBe('vp9')
    expect(codec(['vp8', 'h264'])).toBe('h264')
    expect(codec(['vp8'])).toBe('vp8')
  })

  it('usa VP8 de reserva só para AV1 e VP9', () => {
    const backup = (codec: ConfigTransmissao['codec']) =>
      resolverTransmissao({ ...configPadrao(), codec }, FULL_HD, TODOS_OS_CODECS).backupCodec
    expect(backup('av1')).toBe('vp8')
    expect(backup('vp9')).toBe('vp8')
    expect(backup('h264')).toBeNull()
    expect(backup('vp8')).toBeNull()
  })
})

describe('otimização', () => {
  it.each([
    ['nitidez', 'detail', 'maintain-resolution'],
    ['fluidez', 'motion', 'maintain-framerate'],
    ['equilibrio', '', 'balanced'],
  ] as const)('%s', (otimizacao, contentHint, degradacao) => {
    const r = resolverTransmissao({ ...configPadrao(), otimizacao }, FULL_HD, TODOS_OS_CODECS)
    expect(r.contentHint).toBe(contentHint)
    expect(r.degradacao).toBe(degradacao)
  })
})

describe('simulcast', () => {
  it('cria uma camada menor para quem tem internet fraca', () => {
    const r = resolverTransmissao(comPreset('jogo'), FULL_HD, TODOS_OS_CODECS)
    expect(r.camadas).toEqual([{ largura: 960, altura: 540, fps: 15, bitrateKbps: 2000 }])
  })

  it('sem simulcast não tem camadas', () => {
    const r = resolverTransmissao(
      { ...comPreset('jogo'), simulcast: false },
      FULL_HD,
      TODOS_OS_CODECS,
    )
    expect(r.camadas).toEqual([])
  })
})

describe('áudio', () => {
  it.each([
    ['voz', { bitrateKbps: 32, estereo: false, dtx: true, red: true }],
    ['musica', { bitrateKbps: 128, estereo: true, dtx: false, red: false }],
    ['alta', { bitrateKbps: 256, estereo: true, dtx: false, red: true }],
  ] as const)('qualidade %s', (qualidadeAudio, audio) => {
    const r = resolverTransmissao({ ...configPadrao(), qualidadeAudio }, FULL_HD, TODOS_OS_CODECS)
    expect(r.audio).toEqual(audio)
  })

  it('áudio do sistema vai sem cancelamento de eco, supressão de ruído nem ganho automático', () => {
    const r = resolverTransmissao(comPreset('jogo'), FULL_HD, TODOS_OS_CODECS)
    expect(r.constraintsAudioSistema).toEqual({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 2,
    })
  })

  it('sem áudio do sistema não pede áudio e o resumo avisa', () => {
    const r = resolverTransmissao(
      { ...comPreset('jogo'), audioSistema: false },
      FULL_HD,
      TODOS_OS_CODECS,
    )
    expect(r.constraintsAudioSistema).toBeNull()
    expect(r.resumo.endsWith('sem áudio')).toBe(true)
  })

  it('microfone desligado não pede nada; ligado usa o processamento escolhido', () => {
    expect(resolverTransmissao(configPadrao(), FULL_HD, []).constraintsMicrofone).toBeNull()

    const microfone = {
      ativo: true,
      deviceId: 'mic-1',
      cancelamentoEco: true,
      supressaoRuido: false,
      ganhoAutomatico: true,
    }
    const r = resolverTransmissao({ ...configPadrao(), microfone }, FULL_HD, [])
    expect(r.constraintsMicrofone).toEqual({
      deviceId: { exact: 'mic-1' },
      echoCancellation: true,
      noiseSuppression: false,
      autoGainControl: true,
    })
  })
})

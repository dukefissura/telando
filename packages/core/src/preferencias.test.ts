import { describe, expect, it } from 'vitest'
import { lerConfigSalva, presetQueCabe, uploadNecessarioKbps } from './preferencias.ts'
import { aplicarPreset, configPadrao, resolverTransmissao } from './transmissao.ts'

describe('lerConfigSalva', () => {
  it('completa com o padrão o que não foi salvo', () => {
    const config = lerConfigSalva({ fps: 60, microfone: { ativo: true } })
    expect(config.fps).toBe(60)
    expect(config.resolucao).toBe(configPadrao().resolucao)
    expect(config.microfone).toEqual({ ...configPadrao().microfone, ativo: true })
  })

  it('volta ao padrão se o que foi salvo não faz sentido', () => {
    expect(lerConfigSalva({ fps: 7 })).toEqual(configPadrao())
    expect(lerConfigSalva('lixo')).toEqual(configPadrao())
    expect(lerConfigSalva(undefined)).toEqual(configPadrao())
  })
})

describe('upload', () => {
  it('pede 20% de folga sobre vídeo e áudio', () => {
    const jogo = resolverTransmissao(aplicarPreset(configPadrao(), 'jogo'), FULL_HD, [])
    expect(uploadNecessarioKbps(jogo)).toBe(Math.round((8000 + 128) * 1.2))
  })

  it('sem áudio do sistema conta só o vídeo', () => {
    const semAudio = { ...aplicarPreset(configPadrao(), 'jogo'), audioSistema: false }
    expect(uploadNecessarioKbps(resolverTransmissao(semAudio, FULL_HD, []))).toBe(9600)
  })

  it('sugere o preset mais caprichado que cabe no upload medido', () => {
    expect(presetQueCabe(50_000)).toBe('jogo')
    expect(presetQueCabe(8000)).toBe('filme')
    expect(presetQueCabe(3100)).toBe('texto')
    expect(presetQueCabe(1900)).toBe('economia')
    expect(presetQueCabe(1000)).toBeNull()
  })
})

const FULL_HD = { largura: 1920, altura: 1080 }

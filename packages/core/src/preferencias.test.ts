import { describe, expect, it } from 'vitest'
import { lerConfigSalva, paraGravar, presetQueCabe, uploadNecessarioKbps } from './preferencias.ts'
import { aplicarPreset, configPadrao, presetAtual, resolverTransmissao } from './transmissao.ts'

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

  it('um preset salvo com os valores da 0.4 volta com os valores de hoje', () => {
    const jogoAntigo = {
      ...configPadrao(),
      resolucao: '1080p',
      fps: 60,
      bitrateMaxKbps: 8000,
      otimizacao: 'fluidez',
      qualidadeAudio: 'musica',
      simulcast: true,
      microfone: { ...configPadrao().microfone, ativo: true },
    }
    const config = lerConfigSalva(jogoAntigo)
    expect(presetAtual(config)).toBe('jogo')
    expect(config.microfone.ativo).toBe(true)
  })

  it('o Jogo salvo na 0.4.1 e na 0.4.2 volta com os valores de hoje', () => {
    const jogoDa041 = {
      ...configPadrao(),
      resolucao: '1080p',
      fps: 60,
      bitrateMaxKbps: 12_000,
      otimizacao: 'fluidez',
      qualidadeAudio: 'musica',
      simulcast: false,
    }
    expect(presetAtual(lerConfigSalva(jogoDa041))).toBe('jogo')
  })

  it('o que já foi gravado com os presets de hoje não é migrado, mesmo igual a um antigo', () => {
    const escolhidoHoje = paraGravar({
      ...configPadrao(),
      resolucao: '1080p',
      fps: 60,
      bitrateMaxKbps: 12_000,
      otimizacao: 'fluidez',
      qualidadeAudio: 'musica',
      simulcast: false,
    })
    const lida = lerConfigSalva(JSON.parse(JSON.stringify(escolhidoHoje)))
    expect(lida.bitrateMaxKbps).toBe(12_000)
    expect(lida.simulcast).toBe(false)
  })

  it('um ajuste próprio não vira preset', () => {
    const proprio = { ...configPadrao(), fps: 60, bitrateMaxKbps: 8000 }
    expect(lerConfigSalva(proprio).bitrateMaxKbps).toBe(8000)
  })
})

describe('upload', () => {
  it('pede 20% de folga sobre vídeo, camada menor e áudio', () => {
    const jogo = resolverTransmissao(aplicarPreset(configPadrao(), 'jogo'), FULL_HD, [])
    expect(uploadNecessarioKbps(jogo)).toBe(Math.round((16_000 + 1500 + 128) * 1.2))
  })

  it('sem áudio do sistema conta só o vídeo', () => {
    const semAudio = { ...aplicarPreset(configPadrao(), 'jogo'), audioSistema: false }
    expect(uploadNecessarioKbps(resolverTransmissao(semAudio, FULL_HD, []))).toBe(21_000)
  })

  it('sugere o preset mais caprichado que cabe no upload medido', () => {
    expect(presetQueCabe(50_000)).toBe('jogo')
    expect(presetQueCabe(15_000)).toBe('filme')
    expect(presetQueCabe(10_000)).toBe('texto')
    expect(presetQueCabe(3800)).toBe('economia')
    expect(presetQueCabe(3700)).toBeNull()
  })
})

const FULL_HD = { largura: 1920, altura: 1080 }

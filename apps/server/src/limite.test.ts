import { expect, it } from 'vitest'
import { limitePorJanela } from './limite.ts'

it('libera de novo quando as tentativas antigas saem da janela', () => {
  let agora = 0
  const permitir = limitePorJanela({ limite: 2, janelaMs: 60_000, agora: () => agora })

  expect(permitir('ip')).toBe(true)
  agora = 30_000
  expect(permitir('ip')).toBe(true)
  expect(permitir('ip')).toBe(false)
  expect(permitir('outro-ip')).toBe(true)

  agora = 60_001
  expect(permitir('ip')).toBe(true)
  expect(permitir('ip')).toBe(false)
})

import { expect, it } from 'vitest'
import { apelidoAleatorio } from './apelidos.ts'

function sequencia(...valores: number[]) {
  return () => valores.shift() ?? 0
}

it('junta um bicho e uma cor', () => {
  expect(apelidoAleatorio(() => 0)).toBe('Capivara Azul')
})

it('concorda a cor com o gênero do bicho', () => {
  expect(apelidoAleatorio(sequencia(0, 0.9999))).toBe('Capivara Amarela')
  expect(apelidoAleatorio(sequencia(0.9999, 0.9999))).toBe('Tatu Amarelo')
})

it('sorteia com Math.random por padrão', () => {
  expect(apelidoAleatorio()).toMatch(/^\S+ \S+$/)
})

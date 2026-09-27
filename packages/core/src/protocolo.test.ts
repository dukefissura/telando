import { expect, it } from 'vitest'
import { codificarMensagem, lerMensagem, REACOES } from './protocolo.ts'

it('ida e volta de chat e reação', () => {
  const chat = { t: 'chat', texto: 'olá, pessoal' } as const
  const reacao = { t: 'reacao', emoji: REACOES[0] } as const
  expect(lerMensagem(codificarMensagem(chat))).toEqual(chat)
  expect(lerMensagem(codificarMensagem(reacao))).toEqual(reacao)
})

it('apara o chat e recusa mensagem vazia ou longa demais', () => {
  expect(lerMensagem(texto({ t: 'chat', texto: '  oi  ' }))).toEqual({ t: 'chat', texto: 'oi' })
  expect(lerMensagem(texto({ t: 'chat', texto: '   ' }))).toBeNull()
  expect(lerMensagem(texto({ t: 'chat', texto: 'a'.repeat(501) }))).toBeNull()
})

it('recusa reação fora da lista e lixo', () => {
  expect(lerMensagem(texto({ t: 'reacao', emoji: '💩' }))).toBeNull()
  expect(lerMensagem(texto({ t: 'aprovado' }))).toBeNull()
  expect(lerMensagem('{')).toBeNull()
})

it('ignora campos a mais, como um remetente forjado', () => {
  expect(lerMensagem(texto({ t: 'chat', texto: 'oi', de: 'host' }))).toEqual({
    t: 'chat',
    texto: 'oi',
  })
})

function texto(valor: unknown) {
  return JSON.stringify(valor)
}

import { expect, it } from 'vitest'
import { codificarMensagem, lerMensagem, REACOES } from './protocolo.ts'

it('ida e volta de chat e reação', () => {
  const chat = { t: 'chat', texto: 'olá, pessoal' } as const
  const reacao = { t: 'reacao', emoji: REACOES[0] } as const
  expect(lerMensagem(codificarMensagem(chat))).toEqual(chat)
  expect(lerMensagem(codificarMensagem(reacao))).toEqual(reacao)
})

it('apara o chat e recusa mensagem vazia ou longa demais', () => {
  expect(lerMensagem(bytes({ t: 'chat', texto: '  oi  ' }))).toEqual({ t: 'chat', texto: 'oi' })
  expect(lerMensagem(bytes({ t: 'chat', texto: '   ' }))).toBeNull()
  expect(lerMensagem(bytes({ t: 'chat', texto: 'a'.repeat(501) }))).toBeNull()
})

it('recusa reação fora da lista e lixo', () => {
  expect(lerMensagem(bytes({ t: 'reacao', emoji: '💩' }))).toBeNull()
  expect(lerMensagem(bytes({ t: 'aprovado' }))).toBeNull()
  expect(lerMensagem(new TextEncoder().encode('{'))).toBeNull()
})

it('ignora campos a mais, como um remetente forjado', () => {
  expect(lerMensagem(bytes({ t: 'chat', texto: 'oi', de: 'host' }))).toEqual({
    t: 'chat',
    texto: 'oi',
  })
})

function bytes(valor: unknown) {
  return new TextEncoder().encode(JSON.stringify(valor))
}

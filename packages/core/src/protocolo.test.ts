import { expect, it } from 'vitest'
import { codificarAviso, lerAviso } from './protocolo.ts'

it('avisos de revezamento vão e voltam', () => {
  for (const t of [
    'pedido-tela',
    'pedido-cancelado',
    'pedido-recusado',
    'devolver-tela',
  ] as const) {
    expect(lerAviso(codificarAviso({ t }))).toEqual({ t })
  }
})

it('recusa o que não é aviso, inclusive o chat antigo, e lixo', () => {
  expect(lerAviso(JSON.stringify({ t: 'aprovado' }))).toBeNull()
  expect(lerAviso(JSON.stringify({ t: 'chat', texto: 'oi' }))).toBeNull()
  expect(lerAviso('{')).toBeNull()
})

it('ignora campos a mais, como um remetente forjado', () => {
  expect(lerAviso(JSON.stringify({ t: 'pedido-tela', de: 'host' }))).toEqual({ t: 'pedido-tela' })
})

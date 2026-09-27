import { describe, expect, it } from 'vitest'
import { lerSessaoMetadata } from './sessao.ts'

const valido = {
  v: 1,
  hostIdentity: 'h_abc',
  hostNome: 'Luan',
  presenterIdentity: null,
  trancada: false,
}

describe('lerSessaoMetadata', () => {
  it('aceita metadados válidos', () => {
    expect(lerSessaoMetadata(JSON.stringify(valido))).toEqual(valido)
  })

  it('devolve null para sala sem metadados', () => {
    expect(lerSessaoMetadata(undefined)).toBeNull()
    expect(lerSessaoMetadata('')).toBeNull()
  })

  it('devolve null para JSON quebrado ou versão desconhecida', () => {
    expect(lerSessaoMetadata('{')).toBeNull()
    expect(lerSessaoMetadata(JSON.stringify({ ...valido, v: 2 }))).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { destinoDoLink } from './destino-link.ts'

describe('destinoDoLink', () => {
  it('lê o link de uma sessão, de qualquer domínio', () => {
    expect(destinoDoLink('https://telando.app/s/k7Qm2xPa9Lzz')).toEqual({
      tipo: 'sessao',
      id: 'k7Qm2xPa9Lzz',
    })
    expect(destinoDoLink('http://localhost:8787/s/k7Qm2xPa9Lzz')).toEqual({
      tipo: 'sessao',
      id: 'k7Qm2xPa9Lzz',
    })
  })

  it('aceita o código curto de hoje e o de 12 caracteres dos links antigos', () => {
    expect(destinoDoLink('https://telando.up.railway.app/s/bdBjd88c')).toEqual({
      tipo: 'sessao',
      id: 'bdBjd88c',
    })
    expect(destinoDoLink('telando://s/k7Qm2xPa9Lzz')).toEqual({
      tipo: 'sessao',
      id: 'k7Qm2xPa9Lzz',
    })
    expect(destinoDoLink('https://telando.app/s/bdBjd88')).toBeNull()
    expect(destinoDoLink('https://telando.app/s/k7Qm2xPa9Lzza')).toBeNull()
    // Um link antigo cortado no fim não passa por um código de outro tamanho.
    expect(destinoDoLink('https://telando.app/s/k7Qm2xPa9Lz')).toBeNull()
  })

  it('lê o link fixo', () => {
    expect(destinoDoLink('https://telando.app/luan')).toEqual({ tipo: 'linkFixo', slug: 'luan' })
  })

  it('lê os links do protocolo telando://', () => {
    expect(destinoDoLink('telando://s/k7Qm2xPa9Lzz')).toEqual({
      tipo: 'sessao',
      id: 'k7Qm2xPa9Lzz',
    })
    expect(destinoDoLink('telando://luan/')).toEqual({ tipo: 'linkFixo', slug: 'luan' })
  })

  it('aceita espaços em volta, como vem de um copiar e colar', () => {
    expect(destinoDoLink('  https://telando.app/luan \n')).toEqual({
      tipo: 'linkFixo',
      slug: 'luan',
    })
  })

  it('recusa o que não é link do Telando', () => {
    for (const texto of [
      '',
      'luan',
      'ftp://telando.app/luan',
      'https://telando.app/',
      'https://telando.app/s/curto',
      // 0 não está no alfabeto dos ids.
      'https://telando.app/s/k7Qm2xPa9Lz0',
      'https://telando.app/Luan',
      'https://telando.app/luan/extra',
      'telando://s/',
      `https://telando.app/${'a'.repeat(21)}`,
    ]) {
      expect(destinoDoLink(texto), texto).toBeNull()
    }
  })
})

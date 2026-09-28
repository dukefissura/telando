import type { criarClienteApi } from '@telando/core'

export type FonteDeCaptura = {
  id: string
  nome: string
  tipo: 'tela' | 'janela'
  /** data: URL da miniatura. */
  miniatura: string
  icone: string | null
  /** Só as telas têm tamanho conhecido antes de capturar. */
  largura: number | null
  altura: number | null
}

export type MeuLinkFixo = { slug: string; nome: string; url: string }

/** O que o app desktop entrega às telas. */
export type Plataforma = {
  api: ReturnType<typeof criarClienteApi>
  /** Seletor próprio de telas e janelas (o getDisplayMedia usa a fonte escolhida aqui). */
  fontes: {
    listar(): Promise<FonteDeCaptura[]>
    escolher(id: string): Promise<void>
  }
  usoDeCpu: () => Promise<number>
  preferencias: {
    ler(): Promise<unknown>
    gravar(config: unknown): Promise<void>
  }
  /** Link fixo pessoal. O segredo nunca sai do computador de quem é dono. */
  linkFixo: {
    segredo(): Promise<string>
    ler(): Promise<MeuLinkFixo | null>
    gravar(link: MeuLinkFixo): Promise<void>
  }
  /** Avisa quando a transmissão começa ou acaba (ícone da bandeja e atalho global). */
  aoMudarTransmissao: (aoVivo: boolean) => void
  /** Atalho global do sistema para parar; devolve a função que remove o ouvinte. */
  aoAtalhoParar: (callback: () => void) => () => void
  /** Link telando:// com que o app foi aberto, se ainda não foi lido. */
  linkPendente(): Promise<string | null>
  /** Links que chegam com o app já aberto; devolve a função que remove o ouvinte. */
  aoAbrirLink(callback: (texto: string) => void): () => void
}

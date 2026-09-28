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
  /** O último link telando:// recebido, se ainda não foi lido (e o apaga). */
  linkPendente(): Promise<string | null>
  /** Avisa que chegou um link com o app aberto; devolve a função que remove o ouvinte. */
  aoChegarLink(callback: () => void): () => void
}

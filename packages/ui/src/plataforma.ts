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

/** O que muda entre o site e o app desktop. */
export type Plataforma = {
  api: ReturnType<typeof criarClienteApi>
  /** Seletor próprio de telas e janelas. Sem ele, quem escolhe é o seletor do navegador. */
  fontes?: {
    listar(): Promise<FonteDeCaptura[]>
    escolher(id: string): Promise<void>
  }
  usoDeCpu?: () => Promise<number>
  preferencias: {
    ler(): Promise<unknown>
    gravar(config: unknown): Promise<void>
  }
  /** Atalho global do sistema para parar; devolve a função que remove o ouvinte. */
  aoAtalhoParar?: (callback: () => void) => () => void
}

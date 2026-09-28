import type { FonteDeCaptura, MeuLinkFixo } from '@telando/ui'

/** O que o preload expõe em `window.telando`. Tudo passa por IPC e é validado no main. */
export type TelandoDesktop = {
  listarFontes(): Promise<FonteDeCaptura[]>
  escolherFonte(id: string): Promise<void>
  usoDeCpu(): Promise<number>
  lerPreferencias(): Promise<unknown>
  gravarPreferencias(config: unknown): Promise<void>
  avisarTransmitindo(transmitindo: boolean): void
  segredoDoLink(): Promise<string>
  lerLinkFixo(): Promise<MeuLinkFixo | null>
  gravarLinkFixo(link: MeuLinkFixo): Promise<void>
  aoAtalhoParar(callback: () => void): () => void
  linkPendente(): Promise<string | null>
  aoChegarLink(callback: () => void): () => void
}

export const CANAIS = {
  listarFontes: 'fontes:listar',
  escolherFonte: 'fontes:escolher',
  usoDeCpu: 'cpu:uso',
  lerPreferencias: 'preferencias:ler',
  gravarPreferencias: 'preferencias:gravar',
  transmitindo: 'transmissao:estado',
  atalhoParar: 'atalho:parar',
  segredoDoLink: 'link:segredo',
  lerLinkFixo: 'link:ler',
  gravarLinkFixo: 'link:gravar',
  linkPendente: 'link:pendente',
  chegouLink: 'link:chegou',
} as const

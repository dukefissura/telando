import type { Reacao } from '@telando/core'
import type { RemoteVideoTrack } from 'livekit-client'
import {
  Maximize,
  MessageSquare,
  Minimize,
  PictureInPicture2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { BotoesDeReacao } from '../sala/reacoes.tsx'
import { IndicadorConexao } from './indicador-conexao.tsx'

export type Qualidade = 'auto' | 'alta' | 'media' | 'baixa'

function BotaoIcone({
  rotulo,
  atalho,
  ativo = false,
  onClick,
  children,
}: {
  rotulo: string
  atalho?: string
  ativo?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      title={atalho ? `${rotulo} (${atalho})` : rotulo}
      aria-keyshortcuts={atalho}
      aria-pressed={ativo}
      className={`relative rounded-md p-2 hover:bg-white/10 ${ativo ? 'text-texto' : 'text-texto-suave'}`}
    >
      {children}
    </button>
  )
}

export function BarraDeControles({
  volume,
  mudo,
  aoMudarVolume,
  aoAlternarMudo,
  qualidade,
  aoMudarQualidade,
  trilha,
  aoReagir,
  chatAberto,
  naoLidas,
  aoAlternarChat,
  telaCheia,
  aoAlternarTelaCheia,
  aoAlternarPip,
  revezamento,
  aoSair,
}: {
  volume: number
  mudo: boolean
  aoMudarVolume: (volume: number) => void
  aoAlternarMudo: () => void
  qualidade: Qualidade
  aoMudarQualidade: (qualidade: Qualidade) => void
  trilha: RemoteVideoTrack | undefined
  aoReagir: (emoji: Reacao) => void
  chatAberto: boolean
  naoLidas: number
  aoAlternarChat: () => void
  telaCheia: boolean
  aoAlternarTelaCheia: () => void
  aoAlternarPip: (() => void) | null
  /** Pedir, cancelar ou devolver a vez de compartilhar. */
  revezamento: ReactNode
  aoSair: () => void
}) {
  const icone = { size: 18, strokeWidth: 1.5, 'aria-hidden': true } as const
  return (
    <div className="flex items-center gap-1 rounded-xl border border-borda bg-fundo/90 px-2 py-1.5">
      <BotaoIcone rotulo={mudo ? 'Ligar o som' : 'Tirar o som'} atalho="M" onClick={aoAlternarMudo}>
        {mudo ? <VolumeX {...icone} /> : <Volume2 {...icone} />}
      </BotaoIcone>
      <input
        type="range"
        min={0}
        max={100}
        value={mudo ? 0 : Math.round(volume * 100)}
        onChange={(e) => aoMudarVolume(Number(e.target.value) / 100)}
        aria-label="Volume"
        className="w-24 accent-texto"
      />

      <span className="mx-1 h-5 w-px bg-borda" aria-hidden />
      <select
        value={qualidade}
        onChange={(e) => aoMudarQualidade(e.target.value as Qualidade)}
        aria-label="Qualidade do vídeo"
        className="rounded-md bg-transparent px-2 py-1.5 text-sm text-texto-suave hover:bg-white/10"
      >
        <option value="auto">Automática</option>
        <option value="alta">Alta</option>
        <option value="media">Média</option>
        <option value="baixa">Baixa</option>
      </select>
      <IndicadorConexao trilha={trilha} />

      <span className="mx-1 h-5 w-px bg-borda" aria-hidden />
      <BotoesDeReacao aoReagir={aoReagir} />

      <span className="mx-1 h-5 w-px bg-borda" aria-hidden />
      {revezamento}

      <span className="mx-1 h-5 w-px bg-borda" aria-hidden />
      <BotaoIcone
        rotulo={chatAberto ? 'Fechar o chat' : 'Abrir o chat'}
        atalho="C"
        ativo={chatAberto}
        onClick={aoAlternarChat}
      >
        <MessageSquare {...icone} />
        {naoLidas > 0 && !chatAberto && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-texto px-1 font-mono text-[10px] text-fundo">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </BotaoIcone>
      {aoAlternarPip && (
        <BotaoIcone rotulo="Janela flutuante" onClick={aoAlternarPip}>
          <PictureInPicture2 {...icone} />
        </BotaoIcone>
      )}
      <BotaoIcone
        rotulo={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
        atalho="F"
        onClick={aoAlternarTelaCheia}
      >
        {telaCheia ? <Minimize {...icone} /> : <Maximize {...icone} />}
      </BotaoIcone>

      <span className="mx-1 h-5 w-px bg-borda" aria-hidden />
      <button
        type="button"
        onClick={aoSair}
        className="rounded-md px-2.5 py-1.5 text-sm text-texto-suave hover:bg-white/10"
      >
        Sair
      </button>
    </div>
  )
}

import type { RemoteVideoTrack } from 'livekit-client'
import { ChevronDown, Maximize, Minimize, PictureInPicture2, Volume2, VolumeX } from 'lucide-react'
import type { ReactNode } from 'react'
import { animacaoBotao } from '../controles.tsx'
import { IndicadorConexao } from './indicador-conexao.tsx'

export type Qualidade = 'auto' | 'alta' | 'media' | 'baixa'

/** Botões de texto da barra (Sair, pedir a vez). */
export const classeBotaoDaBarra = `inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-3.5 font-medium text-[13px] hover:bg-preenchimento ${animacaoBotao}`

function Divisor() {
  return <span className="mx-1 h-[22px] w-px bg-vidro-borda" aria-hidden />
}

function BotaoDaBarra({
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
      className={`relative grid size-10 place-items-center rounded-full hover:bg-preenchimento ${animacaoBotao} ${ativo ? 'text-texto' : 'text-texto-suave'}`}
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
  telaCheia: boolean
  aoAlternarTelaCheia: () => void
  aoAlternarPip: (() => void) | null
  /** Pedir, cancelar ou devolver a vez de compartilhar. */
  revezamento: ReactNode
  aoSair: () => void
}) {
  const icone = { size: 17, strokeWidth: 1.75, 'aria-hidden': true } as const
  const nivel = mudo ? 0 : Math.round(volume * 100)
  return (
    <div className="vidro flex w-max items-center gap-1 whitespace-nowrap rounded-full p-1.5">
      <BotaoDaBarra
        rotulo={mudo ? 'Ligar o som' : 'Tirar o som'}
        atalho="M"
        onClick={aoAlternarMudo}
      >
        {mudo ? <VolumeX {...icone} /> : <Volume2 {...icone} />}
      </BotaoDaBarra>
      <input
        type="range"
        min={0}
        max={100}
        value={nivel}
        onChange={(e) => aoMudarVolume(Number(e.target.value) / 100)}
        aria-label="Volume"
        // O range nativo não tem preenchimento: o trilho pinta até o nível.
        style={{
          background: `linear-gradient(to right, var(--texto) ${nivel}%, color-mix(in srgb, var(--texto) 18%, transparent) ${nivel}%)`,
        }}
        className="mr-2 h-1.5 w-24 cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-texto"
      />

      <Divisor />
      <label className="relative">
        <select
          value={qualidade}
          onChange={(e) => aoMudarQualidade(e.target.value as Qualidade)}
          aria-label="Qualidade do vídeo"
          className={`h-10 cursor-pointer appearance-none rounded-full bg-transparent pr-8 pl-3.5 font-medium text-[13px] hover:bg-preenchimento ${animacaoBotao}`}
        >
          <option value="auto">Automática</option>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>
        <ChevronDown
          size={14}
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-texto-suave"
        />
      </label>
      <IndicadorConexao trilha={trilha} />

      <Divisor />
      {revezamento}

      <Divisor />
      {aoAlternarPip && (
        <BotaoDaBarra rotulo="Janela flutuante" onClick={aoAlternarPip}>
          <PictureInPicture2 {...icone} />
        </BotaoDaBarra>
      )}
      <BotaoDaBarra
        rotulo={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
        atalho="F"
        onClick={aoAlternarTelaCheia}
      >
        {telaCheia ? <Minimize {...icone} /> : <Maximize {...icone} />}
      </BotaoDaBarra>

      <Divisor />
      <button type="button" onClick={aoSair} className={`${classeBotaoDaBarra} text-texto-suave`}>
        Sair
      </button>
    </div>
  )
}

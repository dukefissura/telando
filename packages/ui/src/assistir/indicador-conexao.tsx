import type { AmostraRecebimento } from '@telando/core'
import { formatarMbps, type Recebimento, resumirRecebimento } from '@telando/core'
import type { RemoteVideoTrack } from 'livekit-client'
import { Signal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { animacaoBotao } from '../controles.tsx'

function useRecebimento(trilha: RemoteVideoTrack | undefined) {
  const [recebimento, setRecebimento] = useState<Recebimento | null>(null)
  useEffect(() => {
    if (!trilha) return
    let anterior: AmostraRecebimento | null = null
    const medir = async () => {
      const relatorio = await trilha.getRTCStatsReport()
      if (!relatorio) return
      const { recebimento: atual, amostra } = resumirRecebimento(
        relatorio.values(),
        anterior,
        performance.now(),
      )
      anterior = amostra
      setRecebimento(atual)
    }
    const intervalo = setInterval(medir, 2000)
    void medir()
    return () => clearInterval(intervalo)
  }, [trilha])
  return recebimento
}

export function IndicadorConexao({ trilha }: { trilha: RemoteVideoTrack | undefined }) {
  const recebimento = useRecebimento(trilha)
  const ruim = recebimento !== null && (recebimento.perdaPct > 3 || recebimento.fps < 5)
  const descricao = recebimento
    ? `${recebimento.largura}×${recebimento.altura} · ${recebimento.fps} fps · ${formatarMbps(recebimento.kbps)} · perda ${recebimento.perdaPct.toLocaleString('pt-BR')}%`
    : 'Medindo a conexão…'

  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={`Conexão: ${descricao}`}
        className={`rounded-md p-2 hover:bg-white/10 ${animacaoBotao} ${ruim ? 'text-aviso' : 'text-texto-suave'}`}
      >
        <Signal size={18} strokeWidth={1.5} aria-hidden />
      </button>
      <div
        role="tooltip"
        className="pointer-events-none absolute right-0 bottom-full mb-2 hidden whitespace-nowrap rounded-md border border-borda bg-fundo px-2.5 py-1.5 font-mono text-xs tabular-nums group-focus-within:block group-hover:block"
      >
        {ruim && <span className="block text-aviso">Conexão instável</span>}
        {descricao}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import type { FonteDeCaptura, Plataforma } from '../plataforma.ts'

type Fontes = NonNullable<Plataforma['fontes']>

/** Lista telas e janelas, com miniaturas que se atualizam a cada segundo enquanto estiver aberto. */
export function useFontes(fontes: Fontes | undefined) {
  const [lista, setLista] = useState<FonteDeCaptura[]>([])
  useEffect(() => {
    if (!fontes) return
    let ativo = true
    const atualizar = async () => {
      const novas = await fontes.listar()
      if (ativo) setLista(novas)
    }
    void atualizar()
    const intervalo = setInterval(atualizar, 1000)
    return () => {
      ativo = false
      clearInterval(intervalo)
    }
  }, [fontes])
  return lista
}

function CartaoFonte({
  fonte,
  escolhida,
  aoEscolher,
}: {
  fonte: FonteDeCaptura
  escolhida: boolean
  aoEscolher: () => void
}) {
  return (
    <button
      type="button"
      onClick={aoEscolher}
      aria-pressed={escolhida}
      className={`grid gap-1.5 rounded-lg border p-1.5 text-left transition-colors ${
        escolhida ? 'border-texto bg-superficie-2' : 'border-borda hover:bg-superficie'
      }`}
    >
      <img
        src={fonte.miniatura}
        alt=""
        className="aspect-video w-full rounded object-contain bg-black"
      />
      <span className="flex min-w-0 items-center gap-1.5 text-xs">
        {fonte.icone && <img src={fonte.icone} alt="" className="size-3.5 shrink-0" />}
        <span className="truncate">{fonte.nome}</span>
        {fonte.largura && fonte.altura && (
          <span className="ml-auto shrink-0 font-mono text-texto-suave">
            {fonte.largura}×{fonte.altura}
          </span>
        )}
      </span>
    </button>
  )
}

export function PainelFonte({
  lista,
  escolhida,
  aoEscolher,
}: {
  lista: FonteDeCaptura[]
  escolhida: string | null
  aoEscolher: (fonte: FonteDeCaptura) => void
}) {
  const [busca, setBusca] = useState('')
  const telas = lista.filter((fonte) => fonte.tipo === 'tela')
  const janelas = lista.filter(
    (fonte) =>
      fonte.tipo === 'janela' && fonte.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  )

  if (lista.length === 0) {
    return <p className="text-sm text-texto-suave">Procurando telas e janelas…</p>
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <h3 className="text-sm text-texto-suave">Telas</h3>
        <div className="grid grid-cols-2 gap-2">
          {telas.map((fonte) => (
            <CartaoFonte
              key={fonte.id}
              fonte={fonte}
              escolhida={fonte.id === escolhida}
              aoEscolher={() => aoEscolher(fonte)}
            />
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm text-texto-suave">Janelas</h3>
          <input
            type="search"
            placeholder="Buscar janela"
            aria-label="Buscar janela"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-40 rounded-md border border-borda bg-superficie px-2 py-1 text-xs"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {janelas.map((fonte) => (
            <CartaoFonte
              key={fonte.id}
              fonte={fonte}
              escolhida={fonte.id === escolhida}
              aoEscolher={() => aoEscolher(fonte)}
            />
          ))}
        </div>
        {janelas.length === 0 && (
          <p className="text-xs text-texto-suave">Nenhuma janela com esse nome.</p>
        )}
      </div>
    </div>
  )
}

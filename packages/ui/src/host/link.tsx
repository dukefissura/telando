import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Botao } from '../controles.tsx'

/** Separa "telando.app/s/" de "k7Qm2xPa9L" para o final do link ganhar destaque. */
function partesDo(url: string) {
  const { host, pathname } = new URL(url)
  const corte = pathname.lastIndexOf('/') + 1
  return { base: `${host}${pathname.slice(0, corte)}`, final: pathname.slice(corte) }
}

/**
 * O link é o que o app existe para produzir, então ele é o elemento de destaque da tela do host:
 * Geist Mono grande, e o endereço pessoal do link fixo na cor de destaque, como um canal de TV.
 */
export function Link({
  id,
  rotulo,
  url,
  grande,
  destacarFinal,
  aoCopiar,
}: {
  id: string
  rotulo: string
  url: string
  grande: boolean
  destacarFinal: boolean
  aoCopiar: (url: string) => void
}) {
  const [acabouDeCopiar, setAcabouDeCopiar] = useState(false)
  const { base, final } = partesDo(url)

  useEffect(() => {
    if (!acabouDeCopiar) return
    const timer = setTimeout(() => setAcabouDeCopiar(false), 2000)
    return () => clearTimeout(timer)
  }, [acabouDeCopiar])

  return (
    <div className="grid gap-1.5">
      <span id={`${id}-rotulo`} className="text-texto-suave text-xs">
        {rotulo}
      </span>
      <div
        className={`flex items-center gap-3 rounded-xl border border-borda bg-superficie pr-2 pl-4 ${grande ? 'py-3' : 'py-1.5'}`}
      >
        <output
          id={id}
          data-url={url}
          aria-labelledby={`${id}-rotulo`}
          className={`min-w-0 flex-1 select-all truncate font-mono tracking-tight ${grande ? 'text-xl' : 'text-sm'}`}
        >
          <span className="text-texto-suave">{base}</span>
          <span className={destacarFinal ? 'text-destaque' : 'text-texto'}>{final}</span>
        </output>
        <Botao
          variante={grande ? 'primario' : 'secundario'}
          onClick={() => {
            aoCopiar(url)
            setAcabouDeCopiar(true)
          }}
        >
          {acabouDeCopiar ? (
            <Check size={16} strokeWidth={1.5} aria-hidden />
          ) : (
            <Copy size={16} strokeWidth={1.5} aria-hidden />
          )}
          {acabouDeCopiar ? 'Copiado' : 'Copiar'}
        </Botao>
      </div>
    </div>
  )
}

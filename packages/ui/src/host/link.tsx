import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Botao } from '../controles.tsx'

/** Separa "telando.app/s/" de "k7Qm2xPa9L" para o final do link ganhar destaque. */
function partesDo(url: string) {
  const { host, pathname } = new URL(url)
  const corte = pathname.lastIndexOf('/') + 1
  return { base: `${host}${pathname.slice(0, corte)}`, final: pathname.slice(corte) }
}

type Copia = 'parado' | 'copiado' | 'falhou'

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
  aoCopiar: (url: string) => Promise<boolean>
}) {
  const [copia, setCopia] = useState<Copia>('parado')
  const { base, final } = partesDo(url)

  useEffect(() => {
    if (copia === 'parado') return
    const timer = setTimeout(() => setCopia('parado'), 2500)
    return () => clearTimeout(timer)
  }, [copia])

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
          onClick={async () => setCopia((await aoCopiar(url)) ? 'copiado' : 'falhou')}
        >
          {copia === 'copiado' ? (
            <Check size={16} strokeWidth={1.5} aria-hidden />
          ) : (
            <Copy size={16} strokeWidth={1.5} aria-hidden />
          )}
          {copia === 'copiado' ? 'Copiado' : copia === 'falhou' ? 'Selecione e copie' : 'Copiar'}
        </Botao>
      </div>
    </div>
  )
}

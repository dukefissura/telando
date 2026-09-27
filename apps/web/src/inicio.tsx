import { useEffect, useState } from 'react'

type EstadoServer = 'verificando' | 'no-ar' | 'fora'

export function Inicio() {
  const [estado, setEstado] = useState<EstadoServer>('verificando')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => setEstado(res.ok ? 'no-ar' : 'fora'))
      .catch(() => setEstado('fora'))
  }, [])

  return (
    <main className="grid min-h-dvh place-content-center gap-2 p-8">
      <h1 className="font-semibold text-2xl tracking-tight">Telando</h1>
      <p className="text-neutral-400 text-sm" aria-live="polite">
        {estado === 'verificando' && 'Procurando o servidor…'}
        {estado === 'no-ar' && 'Servidor no ar.'}
        {estado === 'fora' && 'Servidor fora do ar. Rode pnpm dev na raiz do projeto.'}
      </p>
    </main>
  )
}

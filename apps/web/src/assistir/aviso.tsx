import type { ReactNode } from 'react'

/** Um estado da sessão: o que aconteceu no título, o que fazer embaixo. */
export function Aviso({
  titulo,
  texto,
  children,
}: {
  titulo: string
  texto: string
  children?: ReactNode
}) {
  return (
    <div role="status" className="grid max-w-md content-center gap-2 p-8 text-center">
      <h1 className="font-semibold text-xl tracking-tight">{titulo}</h1>
      <p className="text-texto-suave">{texto}</p>
      {children && <div className="mt-4 flex justify-center">{children}</div>}
    </div>
  )
}

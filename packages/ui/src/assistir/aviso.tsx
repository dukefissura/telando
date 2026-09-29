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
      <p className="text-pretty text-texto-suave">{texto}</p>
      {children && <div className="mt-4 flex justify-center gap-2">{children}</div>}
    </div>
  )
}

/** Centraliza um aviso ou formulário na tela toda, sobre o fundo escuro. */
export function Centro({ children }: { children: ReactNode }) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden">{children}</main>
  )
}

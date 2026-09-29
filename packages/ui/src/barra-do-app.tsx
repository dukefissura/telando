import type { ReactNode } from 'react'
import icone from './assets/icone.svg'
import { BotaoTema } from './tema.tsx'

/** Barra de cima das telas do app: o que muda fica à esquerda; o tema, sempre à direita. */
export function BarraDoApp({ children }: { children: ReactNode }) {
  return (
    <header className="relative flex h-14 shrink-0 items-center gap-3 px-4">
      {children}
      <div className="ml-auto">
        <BotaoTema />
      </div>
    </header>
  )
}

export function Marca() {
  return (
    <span className="flex items-center gap-2.5">
      <img src={icone} alt="" className="size-[22px]" />
      <span className="font-semibold text-sm">Telando</span>
    </span>
  )
}

export function IconeTelando({ className }: { className: string }) {
  return <img src={icone} alt="" className={className} />
}

/**
 * Luz azul suave atrás do conteúdo; cada tela escolhe onde ela fica. No tema claro, `--luz` é
 * transparente. Quem usa precisa de `isolate` para a luz não sair de trás da tela.
 */
export function Luz({ posicao }: { posicao: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{ background: `radial-gradient(${posicao}, var(--luz), transparent 70%)` }}
    />
  )
}

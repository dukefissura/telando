import { REACOES, type Reacao } from '@telando/core'
import type { ReacaoNaTela } from '@telando/core/cliente'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

export function BotoesDeReacao({ aoReagir }: { aoReagir: (emoji: Reacao) => void }) {
  return (
    <fieldset className="flex gap-0.5">
      <legend className="sr-only">Reagir</legend>
      {REACOES.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => aoReagir(emoji)}
          aria-label={`Reagir com ${emoji}`}
          className="rounded-md px-1.5 py-1 text-lg leading-none transition-transform hover:bg-white/10 active:scale-90"
        >
          {emoji}
        </button>
      ))}
    </fieldset>
  )
}

/** Coluna estreita junto à borda: as reações aparecem sem cobrir o que está sendo mostrado. */
export function ColunaDeReacoes({ reacoes }: { reacoes: ReacaoNaTela[] }) {
  const reduzir = useReducedMotion()
  return (
    <div
      className="pointer-events-none absolute right-4 bottom-24 flex w-10 flex-col-reverse items-center"
      aria-hidden
    >
      <AnimatePresence>
        {reacoes.map((reacao) => (
          <motion.span
            key={reacao.id}
            title={reacao.nome}
            className="text-2xl"
            initial={reduzir ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.8 }}
            animate={reduzir ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduzir ? { opacity: 0 } : { opacity: 0, y: -40 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {reacao.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  )
}

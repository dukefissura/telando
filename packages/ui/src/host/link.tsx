import { Check, Copy } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Botao } from '../controles.tsx'
import { ESTALO } from '../movimento.ts'

/** Separa "telando.app/s/" de "k7Qm2xPa9L" para o final do link ganhar destaque. */
function partesDo(url: string) {
  const { host, pathname } = new URL(url)
  const corte = pathname.lastIndexOf('/') + 1
  return { base: `${host}${pathname.slice(0, corte)}`, final: pathname.slice(corte) }
}

type Copia = 'parado' | 'copiado' | 'falhou'

const CARACTERES = 'abcdefghijklmnopqrstuvwxyz0123456789'
const TROCA_MS = 45
const FIXA_PRIMEIRO_MS = 220
const FIXA_CADA_MS = 110

/**
 * O final do link sintoniza como um canal: cada caractere gira até fixar no valor certo, da
 * esquerda para a direita. Devolve null quando não há (ou acabou a) animação.
 */
function useSintonia(final: string, ligada: boolean) {
  const [texto, setTexto] = useState<string | null>(ligada ? final : null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: sintoniza só ao montar, uma vez por transmissão
  useEffect(() => {
    if (!ligada) return
    const inicio = performance.now()
    // Quando o último caractere fixa, todos já fixaram.
    const fim = FIXA_PRIMEIRO_MS + (final.length - 1) * FIXA_CADA_MS
    const intervalo = setInterval(() => {
      const passou = performance.now() - inicio
      if (passou >= fim) {
        clearInterval(intervalo)
        setTexto(null)
        return
      }
      setTexto(
        final
          .split('')
          .map((certo, i) =>
            passou >= FIXA_PRIMEIRO_MS + i * FIXA_CADA_MS
              ? certo
              : (CARACTERES[Math.floor(Math.random() * CARACTERES.length)] ?? certo),
          )
          .join(''),
      )
    }, TROCA_MS)
    return () => clearInterval(intervalo)
  }, [])

  return texto
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
  aoCopiar: (url: string) => Promise<boolean>
}) {
  const [copia, setCopia] = useState<Copia>('parado')
  const [copias, setCopias] = useState(0)
  const reduzir = useReducedMotion()
  const { base, final } = partesDo(url)
  const sintonizando = useSintonia(final, destacarFinal && !reduzir)
  const copiado = copia === 'copiado'

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
        className={`relative flex items-center gap-3 rounded-xl border border-borda bg-superficie pr-2 pl-4 ${grande ? 'py-3' : 'py-1.5'}`}
      >
        {copias > 0 && (
          // A borda acende no destaque a cada cópia e apaga de novo.
          <motion.span
            key={copias}
            aria-hidden
            className="pointer-events-none absolute -inset-px rounded-xl border border-destaque"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.7, times: [0, 0.2, 0.57, 1], ease: 'easeOut' }}
          />
        )}
        <output
          id={id}
          data-url={url}
          aria-labelledby={`${id}-rotulo`}
          className={`min-w-0 flex-1 select-all truncate font-mono tracking-tight ${grande ? 'text-xl' : 'text-sm'}`}
        >
          <motion.span
            className="text-texto-suave"
            initial={destacarFinal ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {base}
          </motion.span>
          {sintonizando === null ? (
            <span className={destacarFinal ? 'text-destaque' : 'text-texto'}>{final}</span>
          ) : (
            // O texto certo fica no DOM para leitores de tela (e para os testes); o giro é só visual.
            <>
              <span className="sr-only">{final}</span>
              <span aria-hidden className="text-destaque">
                {sintonizando}
              </span>
            </>
          )}
        </output>
        <Botao
          variante={grande ? 'primario' : 'secundario'}
          onClick={async () => {
            const deuCerto = await aoCopiar(url)
            setCopia(deuCerto ? 'copiado' : 'falhou')
            if (deuCerto) setCopias((n) => n + 1)
          }}
        >
          <span className="relative grid size-4 place-items-center">
            <AnimatePresence initial={false}>
              <motion.span
                key={copiado ? 'check' : 'copy'}
                className="absolute"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0, transition: { duration: 0.15, ease: 'easeIn' } }}
                transition={{ duration: 0.2, ease: ESTALO }}
              >
                {copiado ? (
                  <Check size={16} strokeWidth={1.5} aria-hidden />
                ) : (
                  <Copy size={16} strokeWidth={1.5} aria-hidden />
                )}
              </motion.span>
            </AnimatePresence>
          </span>
          {copiado ? 'Copiado' : copia === 'falhou' ? 'Selecione e copie' : 'Copiar'}
        </Botao>
      </div>
    </div>
  )
}

import { Sparkles } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Botao } from '../controles.tsx'
import { MOLA_SUAVE, SAIDA } from '../movimento.ts'
import type { Plataforma } from '../plataforma.ts'

/**
 * Versão nova já baixada: oferece reiniciar agora. Só aparece na tela inicial, onde ninguém está
 * transmitindo; quem ignorar recebe a versão na próxima vez que sair do Telando.
 */
export function AvisoAtualizacao({ atualizacao }: { atualizacao: Plataforma['atualizacao'] }) {
  const [versao, setVersao] = useState<string | null>(null)

  useEffect(() => {
    const ler = () => void atualizacao.versaoNova().then(setVersao)
    ler()
    return atualizacao.aoChegar(ler)
  }, [atualizacao])

  return (
    <AnimatePresence>
      {versao && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={SAIDA}
          transition={{ duration: 0.3, ease: MOLA_SUAVE }}
          className="vidro fixed bottom-6 left-1/2 flex w-max -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full py-1.5 pr-1.5 pl-4 text-[13px]"
        >
          <Sparkles size={15} aria-hidden className="text-destaque" />
          <span>
            A versão <span className="font-mono">{versao}</span> do Telando está pronta.
          </span>
          <Botao variante="invertido" tamanho="compacto" onClick={atualizacao.instalar}>
            Reiniciar e atualizar
          </Botao>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

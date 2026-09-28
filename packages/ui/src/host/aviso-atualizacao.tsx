import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Botao } from '../controles.tsx'
import { ENTRADA, SAIDA } from '../movimento.ts'
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
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={SAIDA}
          transition={ENTRADA}
          className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-xl border border-borda bg-superficie py-2 pr-2 pl-4 text-sm"
        >
          <span>
            A versão <span className="font-mono">{versao}</span> do Telando está pronta.
          </span>
          <Botao variante="primario" onClick={atualizacao.instalar}>
            Reiniciar e atualizar
          </Botao>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

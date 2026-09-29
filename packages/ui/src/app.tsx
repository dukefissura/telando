import { type Destino, destinoDoLink } from '@telando/core'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Assistir } from './assistir/assistir.tsx'
import { EsperarLinkFixo } from './assistir/esperar-link-fixo.tsx'
import { Botao } from './controles.tsx'
import { AppHost } from './host/app-host.tsx'
import { MOLA_SUAVE, SAIDA } from './movimento.ts'
import type { Plataforma } from './plataforma.ts'

/** Um link chegou com uma sessão aberta: trocar só se a pessoa quiser. */
function PerguntaDeTroca({ aoAbrir, aoIgnorar }: { aoAbrir: () => void; aoIgnorar: () => void }) {
  return (
    <motion.div
      role="alertdialog"
      aria-label="Abrir outro link"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={SAIDA}
      transition={{ duration: 0.3, ease: MOLA_SUAVE }}
      className="vidro fixed top-4 left-1/2 z-50 flex w-max -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full py-1.5 pr-1.5 pl-4 text-[13px]"
    >
      Chegou outro link. Sair desta transmissão e abrir?
      <span className="flex gap-1">
        <Botao variante="primario" tamanho="compacto" onClick={aoAbrir}>
          Abrir
        </Botao>
        <Botao variante="fantasma" tamanho="compacto" onClick={aoIgnorar}>
          Ficar aqui
        </Botao>
      </span>
    </motion.div>
  )
}

/** Painel de quem compartilha, ou a transmissão de alguém aberta por um link. */
export function App({ plataforma }: { plataforma: Plataforma }) {
  const [destino, setDestino] = useState<Destino | null>(null)
  const [proximo, setProximo] = useState<Destino | null>(null)
  const [avisoLink, setAvisoLink] = useState<string | null>(null)
  // Lidos dentro do callback do protocolo, que não acompanha os renders.
  const painelOcupado = useRef(false)
  const temSessao = useRef(false)
  temSessao.current = destino !== null

  const aoMudarOcupado = useCallback((ocupado: boolean) => {
    painelOcupado.current = ocupado
    // Parou de transmitir: o "Pare a sua transmissão" não vale mais.
    if (!ocupado) setAvisoLink(null)
  }, [])

  const abrir = useCallback((texto: string) => {
    const lido = destinoDoLink(texto)
    if (!lido) {
      setAvisoLink('Esse link não é de uma transmissão do Telando.')
      return
    }
    // Qualquer página pode abrir telando://: um link nunca derruba uma transmissão começando ou
    // no ar, e nunca tira alguém de uma sessão sem perguntar.
    if (painelOcupado.current) {
      setAvisoLink('Pare a sua transmissão para assistir.')
      return
    }
    if (temSessao.current) {
      setProximo(lido)
      return
    }
    setAvisoLink(null)
    setDestino(lido)
  }, [])

  // O main guarda o link e só avisa que chegou um; ler é sempre pedir o pendente.
  useEffect(() => {
    const lerPendente = () => void plataforma.linkPendente().then((texto) => texto && abrir(texto))
    lerPendente()
    return plataforma.aoChegarLink(lerPendente)
  }, [plataforma, abrir])

  const voltar = () => setDestino(null)
  const pergunta = (
    <AnimatePresence>
      {proximo && (
        <PerguntaDeTroca
          aoAbrir={() => {
            setDestino(proximo)
            setProximo(null)
          }}
          aoIgnorar={() => setProximo(null)}
        />
      )}
    </AnimatePresence>
  )

  if (destino?.tipo === 'sessao') {
    return (
      <>
        <Assistir key={destino.id} plataforma={plataforma} id={destino.id} aoVoltar={voltar} />
        {pergunta}
      </>
    )
  }
  if (destino?.tipo === 'linkFixo') {
    // O endereço do canal e o selo do palco dividem o layoutId "selo-tela".
    return (
      <LayoutGroup>
        <EsperarLinkFixo
          key={destino.slug}
          plataforma={plataforma}
          slug={destino.slug}
          aoVoltar={voltar}
        />
        {pergunta}
      </LayoutGroup>
    )
  }
  return (
    <AppHost
      plataforma={plataforma}
      aoEntrarComLink={abrir}
      avisoLink={avisoLink}
      aoMudarOcupado={aoMudarOcupado}
    />
  )
}

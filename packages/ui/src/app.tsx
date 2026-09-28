import { type Destino, destinoDoLink } from '@telando/core'
import { LayoutGroup } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Assistir } from './assistir/assistir.tsx'
import { EsperarLinkFixo } from './assistir/esperar-link-fixo.tsx'
import { AppHost } from './host/app-host.tsx'
import type { Plataforma } from './plataforma.ts'

/** Painel de quem compartilha, ou a transmissão de alguém aberta por um link. */
export function App({ plataforma }: { plataforma: Plataforma }) {
  const [destino, setDestino] = useState<Destino | null>(null)
  const [avisoLink, setAvisoLink] = useState<string | null>(null)
  const aoVivo = useRef(false)

  // O painel avisa quando entra e sai do ar; aqui isso decide se um link pode abrir.
  const plataformaDoPainel = useMemo<Plataforma>(
    () => ({
      ...plataforma,
      aoMudarTransmissao: (agora) => {
        aoVivo.current = agora
        plataforma.aoMudarTransmissao(agora)
      },
    }),
    [plataforma],
  )

  const abrir = useCallback((texto: string) => {
    const lido = destinoDoLink(texto)
    if (!lido) {
      setAvisoLink('Esse link não é de uma transmissão do Telando.')
      return
    }
    // Um link aberto por qualquer página não pode derrubar a transmissão de quem está no ar.
    if (aoVivo.current) {
      setAvisoLink('Pare a sua transmissão para assistir.')
      return
    }
    setAvisoLink(null)
    setDestino(lido)
  }, [])

  useEffect(() => {
    void plataforma.linkPendente().then((texto) => texto && abrir(texto))
    return plataforma.aoAbrirLink(abrir)
  }, [plataforma, abrir])

  const voltar = () => setDestino(null)
  if (destino?.tipo === 'sessao') {
    return <Assistir key={destino.id} plataforma={plataforma} id={destino.id} aoVoltar={voltar} />
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
      </LayoutGroup>
    )
  }
  return <AppHost plataforma={plataformaDoPainel} aoEntrarComLink={abrir} avisoLink={avisoLink} />
}

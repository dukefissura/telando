import { type ConfigTransmissao, lerConfigSalva } from '@telando/core'
import { useTransmissao } from '@telando/core/cliente'
import { useCallback, useEffect, useState } from 'react'
import { Botao } from '../controles.tsx'
import type { Plataforma } from '../plataforma.ts'
import { TelaCompartilhando } from './tela-compartilhando.tsx'
import { TelaConfiguracoes } from './tela-configuracoes.tsx'

function useConfigSalva(preferencias: Plataforma['preferencias']) {
  const [config, setConfig] = useState<ConfigTransmissao | null>(null)
  useEffect(() => {
    void preferencias.ler().then((salva) => setConfig(lerConfigSalva(salva)))
  }, [preferencias])
  const mudar = useCallback(
    (nova: ConfigTransmissao) => {
      setConfig(nova)
      void preferencias.gravar(nova)
    },
    [preferencias],
  )
  return [config, mudar] as const
}

function TelaInicio({ aoCompartilhar }: { aoCompartilhar: () => void }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-xl content-center gap-6 p-8">
      <div className="grid gap-2">
        <h1 className="font-semibold text-3xl tracking-tight">Telando</h1>
        <p className="text-texto-suave">Mostre sua tela para quem tiver o link.</p>
      </div>
      <Botao
        variante="primario"
        className="justify-self-start px-5 py-3 text-base"
        onClick={aoCompartilhar}
      >
        Compartilhar tela
      </Botao>
    </main>
  )
}

export function AppHost({ plataforma }: { plataforma: Plataforma }) {
  const [config, mudarConfig] = useConfigSalva(plataforma.preferencias)
  const controle = useTransmissao({
    api: plataforma.api,
    ...(plataforma.usoDeCpu && { usoDeCpu: plataforma.usoDeCpu }),
  })
  const [configurando, setConfigurando] = useState(false)
  const { estado, parar } = controle

  useEffect(() => {
    if (estado.fase === 'ao-vivo') setConfigurando(false)
  }, [estado.fase])

  useEffect(() => plataforma.aoAtalhoParar?.(() => void parar()), [plataforma, parar])

  if (!config) return null
  if (estado.fase === 'ao-vivo') {
    return (
      <TelaCompartilhando plataforma={plataforma} controle={controle} aoMudarConfig={mudarConfig} />
    )
  }
  if (configurando || estado.fase === 'iniciando' || estado.fase === 'erro') {
    return (
      <TelaConfiguracoes
        plataforma={plataforma}
        config={config}
        aoMudarConfig={mudarConfig}
        aoIniciar={() => void controle.iniciar(config)}
        aoVoltar={() => setConfigurando(false)}
        iniciando={estado.fase === 'iniciando'}
        erro={estado.fase === 'erro' ? estado.mensagem : null}
      />
    )
  }
  return <TelaInicio aoCompartilhar={() => setConfigurando(true)} />
}

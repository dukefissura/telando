import { type ConfigTransmissao, lerConfigSalva, mensagemDoErro } from '@telando/core'
import { useTransmissao } from '@telando/core/cliente'
import { useCallback, useEffect, useState } from 'react'
import { Botao } from '../controles.tsx'
import type { MeuLinkFixo, Plataforma } from '../plataforma.ts'
import { TelaCompartilhando } from './tela-compartilhando.tsx'
import { TelaConfiguracoes } from './tela-configuracoes.tsx'
import { TelaLinkFixo } from './tela-link-fixo.tsx'

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

function TelaInicio({
  aoCompartilhar,
  aoAbrirLinkFixo,
}: {
  aoCompartilhar: () => void
  aoAbrirLinkFixo: (() => void) | null
}) {
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
      {aoAbrirLinkFixo && (
        <Botao variante="fantasma" className="justify-self-start" onClick={aoAbrirLinkFixo}>
          Meu link fixo
        </Botao>
      )}
    </main>
  )
}

export function AppHost({ plataforma }: { plataforma: Plataforma }) {
  const [config, mudarConfig] = useConfigSalva(plataforma.preferencias)
  const controle = useTransmissao({
    api: plataforma.api,
    ...(plataforma.usoDeCpu && { usoDeCpu: plataforma.usoDeCpu }),
  })
  const [tela, setTela] = useState<'inicio' | 'configurando' | 'link-fixo'>('inicio')
  const [meuLink, setMeuLink] = useState<MeuLinkFixo | null>(null)
  const [usarLinkFixo, setUsarLinkFixo] = useState(true)
  const [preparando, setPreparando] = useState(false)
  const [erroAoPreparar, setErroAoPreparar] = useState<string | null>(null)
  const { estado, parar } = controle
  const { linkFixo } = plataforma

  useEffect(() => {
    void linkFixo?.ler().then(setMeuLink)
  }, [linkFixo])

  useEffect(() => {
    if (estado.fase === 'ao-vivo') setTela('inicio')
  }, [estado.fase])

  const iniciar = async (config: ConfigTransmissao) => {
    // Enquanto lê o segredo o botão já fica travado: um clique duplo abriria duas sessões.
    setPreparando(true)
    setErroAoPreparar(null)
    try {
      const comLink = linkFixo && meuLink && usarLinkFixo
      const segredo = comLink ? await linkFixo.segredo() : null
      await controle.iniciar(
        config,
        comLink && segredo ? { slug: meuLink.slug, segredo, url: meuLink.url } : undefined,
      )
    } catch (erro) {
      setErroAoPreparar(
        mensagemDoErro(erro, 'Não consegui ler o seu link fixo. Desligue a opção e tente de novo.'),
      )
    } finally {
      setPreparando(false)
    }
  }

  useEffect(() => plataforma.aoAtalhoParar?.(() => void parar()), [plataforma, parar])

  const aoVivo = estado.fase === 'ao-vivo'
  useEffect(() => plataforma.aoMudarTransmissao?.(aoVivo), [plataforma, aoVivo])

  if (!config) return null
  if (estado.fase === 'ao-vivo') {
    return (
      <TelaCompartilhando plataforma={plataforma} controle={controle} aoMudarConfig={mudarConfig} />
    )
  }
  if (tela === 'link-fixo' && linkFixo) {
    return (
      <TelaLinkFixo
        plataforma={{ ...plataforma, linkFixo }}
        atual={meuLink}
        aoSalvar={(link) => {
          setMeuLink(link)
          setTela('inicio')
        }}
        aoVoltar={() => setTela('inicio')}
      />
    )
  }
  if (tela === 'configurando' || estado.fase === 'iniciando' || estado.fase === 'erro') {
    return (
      <TelaConfiguracoes
        plataforma={plataforma}
        config={config}
        aoMudarConfig={mudarConfig}
        aoIniciar={() => void iniciar(config)}
        aoVoltar={() => setTela('inicio')}
        linkFixo={meuLink}
        usarLinkFixo={usarLinkFixo}
        aoMudarUsarLinkFixo={setUsarLinkFixo}
        iniciando={preparando || estado.fase === 'iniciando'}
        erro={erroAoPreparar ?? (estado.fase === 'erro' ? estado.mensagem : null)}
      />
    )
  }
  return (
    <TelaInicio
      aoCompartilhar={() => setTela('configurando')}
      aoAbrirLinkFixo={linkFixo ? () => setTela('link-fixo') : null}
    />
  )
}

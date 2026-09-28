import { type ConfigTransmissao, lerConfigSalva, mensagemDoErro } from '@telando/core'
import { useTransmissao } from '@telando/core/cliente'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Botao, classeCampo } from '../controles.tsx'
import type { MeuLinkFixo, Plataforma } from '../plataforma.ts'
import { BotaoTema } from '../tema.tsx'
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
  meuLink,
  aoCompartilhar,
  aoAbrirLinkFixo,
  aoEntrarComLink,
  avisoLink,
}: {
  meuLink: MeuLinkFixo | null
  aoCompartilhar: () => void
  aoAbrirLinkFixo: () => void
  aoEntrarComLink: (texto: string) => void
  avisoLink: string | null
}) {
  const entrar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    const campo = new FormData(evento.currentTarget).get('link')
    if (typeof campo === 'string') aoEntrarComLink(campo)
  }

  return (
    <main className="relative grid min-h-dvh content-center px-8 py-16">
      <div className="absolute top-4 right-4">
        <BotaoTema />
      </div>
      <div className="mx-auto grid w-full max-w-md gap-10">
        <div className="grid gap-3">
          <h1 className="font-semibold text-[40px] leading-[1.1] tracking-tight">Telando</h1>
          <p className="text-lg text-texto-suave">Mostre sua tela para quem tiver o link.</p>
        </div>

        <Botao variante="primario" tamanho="grande" onClick={aoCompartilhar}>
          Compartilhar tela
        </Botao>

        <div className="flex items-center justify-between gap-4 border-borda border-t pt-5">
          {meuLink ? (
            <p className="min-w-0 truncate font-mono text-sm">
              <span className="text-texto-suave">{new URL(meuLink.url).host}/</span>
              <span className="text-destaque">{meuLink.slug}</span>
            </p>
          ) : (
            <p className="text-sm text-texto-suave">Um endereço que seus amigos salvam.</p>
          )}
          <Botao variante="fantasma" onClick={aoAbrirLinkFixo}>
            {meuLink ? 'Editar link fixo' : 'Criar link fixo'}
          </Botao>
        </div>

        <form className="grid gap-2 border-borda border-t pt-5" onSubmit={entrar}>
          <label htmlFor="entrar-link" className="text-sm text-texto-suave">
            Entrar com um link
          </label>
          <div className="flex gap-2">
            <input
              id="entrar-link"
              name="link"
              placeholder="Cole aqui o link que te mandaram"
              className={`${classeCampo} min-w-0 flex-1`}
            />
            <Botao type="submit">Entrar</Botao>
          </div>
          {avisoLink && (
            <p role="alert" className="text-parar text-sm">
              {avisoLink}
            </p>
          )}
        </form>
      </div>
    </main>
  )
}

export function AppHost({
  plataforma,
  aoEntrarComLink,
  avisoLink,
}: {
  plataforma: Plataforma
  aoEntrarComLink: (texto: string) => void
  avisoLink: string | null
}) {
  const [config, mudarConfig] = useConfigSalva(plataforma.preferencias)
  const controle = useTransmissao({ api: plataforma.api, usoDeCpu: plataforma.usoDeCpu })
  const [tela, setTela] = useState<'inicio' | 'configurando' | 'link-fixo'>('inicio')
  const [meuLink, setMeuLink] = useState<MeuLinkFixo | null>(null)
  const [usarLinkFixo, setUsarLinkFixo] = useState(true)
  const [preparando, setPreparando] = useState(false)
  const [erroAoPreparar, setErroAoPreparar] = useState<string | null>(null)
  const { estado, parar } = controle
  const { linkFixo } = plataforma

  useEffect(() => {
    void linkFixo.ler().then(setMeuLink)
  }, [linkFixo])

  useEffect(() => {
    if (estado.fase === 'ao-vivo') setTela('inicio')
  }, [estado.fase])

  const iniciar = async (config: ConfigTransmissao) => {
    // Enquanto lê o segredo o botão já fica travado: um clique duplo abriria duas sessões.
    setPreparando(true)
    setErroAoPreparar(null)
    try {
      const comLink = meuLink && usarLinkFixo
      const segredo = comLink ? await linkFixo.segredo() : null
      await controle.iniciar(
        config,
        comLink && segredo
          ? { slug: meuLink.slug, segredo, nome: meuLink.nome, url: meuLink.url }
          : undefined,
      )
    } catch (erro) {
      setErroAoPreparar(
        mensagemDoErro(erro, 'Não consegui ler o seu link fixo. Desligue a opção e tente de novo.'),
      )
    } finally {
      setPreparando(false)
    }
  }

  useEffect(() => plataforma.aoAtalhoParar(() => void parar()), [plataforma, parar])

  const aoVivo = estado.fase === 'ao-vivo'
  useEffect(() => plataforma.aoMudarTransmissao(aoVivo), [plataforma, aoVivo])

  if (!config) return null
  if (estado.fase === 'ao-vivo') {
    return (
      <TelaCompartilhando
        plataforma={plataforma}
        controle={controle}
        aoMudarConfig={mudarConfig}
        avisoLink={avisoLink}
      />
    )
  }
  if (tela === 'link-fixo') {
    return (
      <TelaLinkFixo
        plataforma={plataforma}
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
      meuLink={meuLink}
      aoCompartilhar={() => setTela('configurando')}
      aoAbrirLinkFixo={() => setTela('link-fixo')}
      aoEntrarComLink={aoEntrarComLink}
      avisoLink={avisoLink}
    />
  )
}

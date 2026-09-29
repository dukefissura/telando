import { type ConfigTransmissao, lerConfigSalva, mensagemDoErro } from '@telando/core'
import { useTransmissao } from '@telando/core/cliente'
import { Clipboard, Link2, LogIn, ScreenShare } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { BarraDoApp, IconeTelando, Luz, Marca } from '../barra-do-app.tsx'
import {
  AbreEspaco,
  Botao,
  classeCampoEmGrupo,
  Grupo,
  LinhaDeGrupo,
  Separador,
} from '../controles.tsx'
import type { MeuLinkFixo, Plataforma } from '../plataforma.ts'
import { AvisoAtualizacao } from './aviso-atualizacao.tsx'
import { partesDo } from './link.tsx'
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

// Links que não voltam como sugestão: os usados, os dispensados e os do próprio host (que ele
// copiou para mandar aos amigos). Ficam no módulo porque o Início desmonta a cada vez que a
// pessoa vai assistir, configurar ou transmitir, e a lista precisa sobreviver a isso.
const linksQueNaoVoltam = new Set<string>()

/**
 * Um link do Telando copiado há pouco vira sugestão no "Entrar com um link". Consulta ao abrir e a
 * cada vez que a janela ganha foco.
 */
function useSugestaoDeLink(ler: Plataforma['linkNaAreaDeTransferencia'], meuLink: string | null) {
  const [sugestao, setSugestao] = useState<string | null>(null)

  useEffect(() => {
    const consultar = () =>
      void ler().then((texto) =>
        setSugestao(texto && texto !== meuLink && !linksQueNaoVoltam.has(texto) ? texto : null),
      )
    consultar()
    window.addEventListener('focus', consultar)
    return () => window.removeEventListener('focus', consultar)
  }, [ler, meuLink])

  const dispensar = () => {
    if (sugestao) linksQueNaoVoltam.add(sugestao)
    setSugestao(null)
  }
  return { sugestao, dispensar }
}

function TelaInicio({
  meuLink,
  aoCompartilhar,
  aoAbrirLinkFixo,
  aoEntrarComLink,
  avisoLink,
  lerAreaDeTransferencia,
}: {
  meuLink: MeuLinkFixo | null
  aoCompartilhar: () => void
  aoAbrirLinkFixo: () => void
  aoEntrarComLink: (texto: string) => void
  avisoLink: string | null
  lerAreaDeTransferencia: Plataforma['linkNaAreaDeTransferencia']
}) {
  const { sugestao, dispensar } = useSugestaoDeLink(lerAreaDeTransferencia, meuLink?.url ?? null)
  const partes = sugestao ? partesDo(sugestao) : null

  const entrar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    const campo = new FormData(evento.currentTarget).get('link')
    if (typeof campo === 'string') aoEntrarComLink(campo)
  }

  return (
    <main className="relative isolate flex min-h-dvh flex-col">
      <Luz posicao="55% 45% at 50% 18%" />
      <BarraDoApp>
        <Marca />
      </BarraDoApp>
      <div className="mx-auto grid w-full max-w-[440px] gap-8 px-4 pt-16 pb-24">
        <div className="grid justify-items-center gap-3 text-center">
          <IconeTelando className="size-24 drop-shadow-[0_18px_30px_rgb(11_107_219/0.28)]" />
          <h1 className="font-semibold text-[40px] leading-[1.1] tracking-[-0.03em]">Telando</h1>
          <p className="text-[17px] text-texto-suave leading-[26px]">
            Mostre sua tela para quem tiver o link.
          </p>
        </div>

        <Botao variante="primario" tamanho="grande" className="w-full" onClick={aoCompartilhar}>
          <ScreenShare size={19} aria-hidden />
          Compartilhar tela
        </Botao>

        <Grupo rotulo="Seu link fixo">
          <LinhaDeGrupo
            icone={Link2}
            acessorio={
              <Botao
                variante="fantasma"
                tamanho="compacto"
                aria-label={meuLink ? 'Editar link fixo' : undefined}
                onClick={aoAbrirLinkFixo}
              >
                {meuLink ? 'Editar' : 'Criar link fixo'}
              </Botao>
            }
          >
            {meuLink ? (
              <p className="min-w-0 truncate font-mono">
                <span className="text-texto-suave">{new URL(meuLink.url).host}/</span>
                <span className="text-destaque">{meuLink.slug}</span>
              </p>
            ) : (
              <p className="text-texto-suave">Um endereço que seus amigos salvam.</p>
            )}
          </LinhaDeGrupo>
        </Grupo>

        <form className="grid gap-2" onSubmit={entrar}>
          <Grupo rotulo="Entrar com um link">
            <AnimatePresence initial={false}>
              {sugestao && partes && (
                <AbreEspaco key="sugestao">
                  <LinhaDeGrupo
                    icone={Clipboard}
                    destaque
                    acessorio={
                      <Botao
                        tamanho="compacto"
                        aria-label={`Entrar em ${sugestao}`}
                        onClick={() => {
                          dispensar()
                          aoEntrarComLink(sugestao)
                        }}
                      >
                        Entrar
                      </Botao>
                    }
                  >
                    <div className="grid min-w-0 gap-0.5">
                      <span className="text-texto-suave text-xs">Copiado agora há pouco</span>
                      <span className="truncate font-mono tracking-tight">
                        <span className="text-texto-suave">{partes.base}</span>
                        <span className="text-destaque">{partes.final}</span>
                      </span>
                    </div>
                  </LinhaDeGrupo>
                  <Separador />
                </AbreEspaco>
              )}
            </AnimatePresence>
            <LinhaDeGrupo
              icone={LogIn}
              acessorio={
                <Botao variante="fantasma" tamanho="compacto" type="submit">
                  Entrar
                </Botao>
              }
            >
              <input
                id="entrar-link"
                name="link"
                aria-label="Entrar com um link"
                placeholder="Cole aqui o link que te mandaram"
                onChange={dispensar}
                className={classeCampoEmGrupo}
              />
            </LinhaDeGrupo>
          </Grupo>
          {avisoLink && (
            <p role="alert" className="pl-4 text-parar text-sm">
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
  aoMudarOcupado,
}: {
  plataforma: Plataforma
  aoEntrarComLink: (texto: string) => void
  avisoLink: string | null
  /** Preparando, começando ou no ar: enquanto isso, um link não pode tirar o painel da tela. */
  aoMudarOcupado: (ocupado: boolean) => void
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

  // Os links desta transmissão vão para a área de transferência (para mandar aos amigos) e não
  // podem voltar como sugestão depois do "Parar".
  useEffect(() => {
    if (estado.fase !== 'ao-vivo') return
    linksQueNaoVoltam.add(estado.link)
    if (estado.linkFixo) linksQueNaoVoltam.add(estado.linkFixo)
  }, [estado])

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

  const ocupado = aoVivo || preparando || estado.fase === 'iniciando'
  useEffect(() => aoMudarOcupado(ocupado), [aoMudarOcupado, ocupado])

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
    <>
      <TelaInicio
        meuLink={meuLink}
        aoCompartilhar={() => setTela('configurando')}
        aoAbrirLinkFixo={() => setTela('link-fixo')}
        aoEntrarComLink={aoEntrarComLink}
        avisoLink={avisoLink}
        lerAreaDeTransferencia={plataforma.linkNaAreaDeTransferencia}
      />
      <AvisoAtualizacao atualizacao={plataforma.atualizacao} />
    </>
  )
}

import { type ConfigTransmissao, lerConfigSalva, mensagemDoErro, paraGravar } from '@telando/core'
import { useTransmissao } from '@telando/core/cliente'
import { AnimatePresence } from 'motion/react'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { AbreEspaco } from '../controles.tsx'
import type { MeuLinkFixo, Plataforma } from '../plataforma.ts'
import { AvisoAtualizacao } from './aviso-atualizacao.tsx'
import { FundoPulsante, IconeColorido, useFundoPulsante } from './fundo-pulsante.tsx'
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
      void preferencias.gravar(paraGravar(nova))
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

// Vidro leve dos grupos do Início, sobre o fundo pulsante.
const vidroDoGrupo =
  'rounded-[20px] border border-white/[0.07] bg-[rgb(20_20_20/0.55)] shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] backdrop-blur-[20px] backdrop-saturate-150'

/**
 * O Início é sempre escuro: um painel de vidro sobre o fundo pulsante, com o destaque passando pelas
 * cores do ciclo. As CSS vars do destaque ficam na raiz daqui e somem quando o Início desmonta.
 */
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

  const raiz = useRef<HTMLElement>(null)
  const centro = useRef<HTMLDivElement>(null)
  const painel = useRef<HTMLDivElement>(null)
  const focos = useRef<(HTMLDivElement | null)[]>([])
  useFundoPulsante(raiz, { centro, painel, focos })

  const entrar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    const campo = new FormData(evento.currentTarget).get('link')
    if (typeof campo === 'string') aoEntrarComLink(campo)
  }

  return (
    <main
      ref={raiz}
      className="sempre-escuro relative min-h-dvh overflow-hidden bg-[#050505] text-texto"
    >
      <FundoPulsante centro={centro} focos={focos} />

      {/* 10% de margem nas laterais e 5,5% em cima e embaixo. */}
      <div className="absolute inset-x-[10%] inset-y-[5.5%] overflow-hidden rounded-[14px] bg-[rgb(10_10_10/0.6)] shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_0_0_1px_rgb(255_255_255/0.08),0_40px_120px_-40px_rgb(0_0_0/0.9)] backdrop-blur-[40px] backdrop-saturate-[1.4]">
        <div
          ref={painel}
          aria-hidden
          className="pointer-events-none absolute inset-0 origin-[50%_18%]"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 18%, color-mix(in srgb, var(--destaque) 30%, transparent), transparent 70%)',
          }}
        />

        <div className="relative grid h-full justify-items-center overflow-y-auto pt-[120px] pb-10">
          <div className="grid w-[440px] max-w-full content-start gap-8 px-4">
            <div className="grid justify-items-center gap-[18px] text-center">
              <IconeColorido />
              <div className="grid gap-2">
                <h1 className="font-semibold text-[40px] leading-[1.1] tracking-[-0.03em]">
                  Telando
                </h1>
                <p className="text-[17px] text-texto-suave leading-[26px]">
                  Mostre sua tela para quem tiver o link.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={aoCompartilhar}
              className="flex h-[52px] items-center justify-center rounded-full font-semibold text-[#0a0a0a] text-base transition-[translate,scale,filter] duration-150 ease-out hover:-translate-y-px hover:brightness-105 active:translate-y-0 active:scale-[0.98] active:duration-75"
              style={{
                background: 'linear-gradient(180deg, var(--destaque-topo), var(--destaque))',
                boxShadow:
                  'inset 0 1px 0 rgb(255 255 255 / 0.45), 0 10px 24px -10px color-mix(in srgb, var(--destaque) 60%, transparent)',
              }}
            >
              Compartilhar tela
            </button>

            <div className="grid gap-2">
              <span className="pl-4 text-texto-suave text-xs">Seu link fixo</span>
              {/* A linha inteira é o botão de editar, sem botão à mostra. */}
              <button
                type="button"
                onClick={aoAbrirLinkFixo}
                title={meuLink ? 'Editar link fixo' : 'Criar link fixo'}
                className={`${vidroDoGrupo} truncate px-4 py-3.5 text-left font-mono text-sm tracking-[-0.02em] transition-colors hover:bg-[rgb(28_28_28/0.6)]`}
              >
                <span className="sr-only">
                  {meuLink ? 'Editar link fixo: ' : 'Criar link fixo: '}
                </span>
                {meuLink ? (
                  <>
                    <span className="text-texto-suave">{new URL(meuLink.url).host}/</span>
                    <span style={{ color: 'var(--destaque)' }}>{meuLink.slug}</span>
                  </>
                ) : (
                  <span className="font-sans text-texto-suave">
                    Um endereço que seus amigos salvam.
                  </span>
                )}
              </button>
            </div>

            <form className="grid gap-2" onSubmit={entrar}>
              <label htmlFor="entrar-link" className="pl-4 text-texto-suave text-xs">
                Entrar com um link
              </label>
              <div className={`${vidroDoGrupo} overflow-hidden`}>
                <AnimatePresence initial={false}>
                  {sugestao && partes && (
                    <AbreEspaco key="sugestao">
                      <div
                        className="flex items-center gap-3 py-2.5 pr-2 pl-4"
                        style={{
                          background: 'color-mix(in srgb, var(--destaque) 6%, transparent)',
                        }}
                      >
                        <span className="grid min-w-0 flex-1 gap-px">
                          <span className="text-texto-suave text-xs">Copiado agora há pouco</span>
                          <span className="truncate font-mono text-sm tracking-[-0.02em]">
                            <span className="text-texto-suave">{partes.base}</span>
                            <span style={{ color: 'var(--destaque)' }}>{partes.final}</span>
                          </span>
                        </span>
                        <button
                          type="button"
                          aria-label={`Entrar em ${sugestao}`}
                          onClick={() => {
                            dispensar()
                            aoEntrarComLink(sugestao)
                          }}
                          className="h-8 shrink-0 rounded-full border border-white/10 bg-white/[0.08] px-3.5 font-medium text-[13px] transition-colors hover:bg-white/[0.14]"
                        >
                          Entrar
                        </button>
                      </div>
                      <div className="h-px bg-white/[0.07]" />
                    </AbreEspaco>
                  )}
                </AnimatePresence>
                <div className="flex items-center gap-3 py-2 pr-2 pl-4">
                  <input
                    id="entrar-link"
                    name="link"
                    placeholder="Cole aqui o link que te mandaram"
                    onChange={dispensar}
                    className="h-8 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-texto-suave/70"
                  />
                  <button
                    type="submit"
                    className="h-8 shrink-0 rounded-full px-3.5 font-medium text-[13px] text-texto-suave transition-colors hover:bg-white/[0.08] hover:text-texto"
                  >
                    Entrar
                  </button>
                </div>
              </div>
              {avisoLink && (
                <p role="alert" className="pl-4 text-parar text-sm">
                  {avisoLink}
                </p>
              )}
            </form>
          </div>
        </div>
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

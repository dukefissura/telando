import {
  aplicarPreset,
  type ConfigTransmissao,
  formatarMbps,
  mensagemDoErro,
  PRESETS,
  type PresetId,
  presetAtual,
  presetQueCabe,
  resolverTransmissao,
  uploadNecessarioKbps,
} from '@telando/core'
import { codecsDoHost } from '@telando/core/cliente'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, useState } from 'react'
import { Alternador, Botao, Secao, Segmentado } from '../controles.tsx'
import { ENTRADA } from '../movimento.ts'
import type { FonteDeCaptura, MeuLinkFixo, Plataforma } from '../plataforma.ts'
import { PainelAudio, PainelVideo } from './paineis.tsx'
import { PainelFonte, useFontes } from './painel-fonte.tsx'
import { useMicrofones } from './use-microfones.ts'

// Janelas só revelam o tamanho depois de capturar.
const FONTE_PRESUMIDA = { largura: 1920, altura: 1080 }

type Teste =
  | { fase: 'parado' }
  | { fase: 'medindo' }
  | { fase: 'medido'; uploadKbps: number }
  | { fase: 'erro'; mensagem: string }

function ResultadoDoTeste({
  teste,
  necessarioKbps,
  aoUsarPreset,
}: {
  teste: Teste
  necessarioKbps: number
  aoUsarPreset: (id: PresetId) => void
}) {
  if (teste.fase === 'erro') return <p className="text-parar text-xs">{teste.mensagem}</p>
  if (teste.fase !== 'medido') return null

  const upload = `Upload de uns ${formatarMbps(teste.uploadKbps)}.`
  if (teste.uploadKbps >= necessarioKbps) {
    return <p className="text-texto-suave text-xs">{upload} Dá para essa configuração.</p>
  }
  const sugestao = presetQueCabe(teste.uploadKbps)
  if (!sugestao) {
    return (
      <p className="text-aviso text-xs">
        {upload} Mesmo o preset Economia pode travar para quem assiste.
      </p>
    )
  }
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-aviso text-xs">
      {upload} É pouco para essa configuração; o preset {PRESETS[sugestao].nome} cabe.
      <button type="button" className="underline" onClick={() => aoUsarPreset(sugestao)}>
        Usar {PRESETS[sugestao].nome}
      </button>
    </p>
  )
}

// A régua vai até 10 Mbps, como no handoff; uma configuração que pede mais fica com a marca no fim.
const ESCALA_KBPS = 10_000
// easeOutCubic: 1 - (1 - p)^3.
const ASSENTAR = [0.33, 1, 0.68, 1] as const

/**
 * O upload medido numa régua, com uma marca no que a configuração pede. Enquanto mede, o número
 * "respira" subindo; quando o valor chega, os dois assentam nele. O valor anima fora do React.
 */
function ReguaDeUpload({ teste, necessarioKbps }: { teste: Teste; necessarioKbps: number }) {
  const reduzir = useReducedMotion()
  const kbps = useMotionValue(0)
  const texto = useTransform(kbps, (valor) => formatarMbps(Math.round(valor)))
  const preenchimento = useTransform(kbps, (valor) => Math.min(1, valor / ESCALA_KBPS))

  useEffect(() => {
    if (teste.fase === 'medindo') {
      if (reduzir) return
      // O valor real só chega no fim; até lá sobe até ~70% de um palpite, com um ruído que acalma.
      const palpite = ESCALA_KBPS / 2
      const inicio = performance.now()
      let quadro = 0
      const passo = (agora: number) => {
        const segundos = (agora - inicio) / 1000
        const subida = 0.7 * palpite * (1 - Math.exp(-segundos * 1.5))
        const ruido = (Math.random() * 2 - 1) * 150 * Math.exp(-segundos / 2)
        kbps.set(Math.max(0, subida + ruido))
        quadro = requestAnimationFrame(passo)
      }
      quadro = requestAnimationFrame(passo)
      return () => cancelAnimationFrame(quadro)
    }
    if (teste.fase === 'medido') {
      if (reduzir) {
        kbps.set(teste.uploadKbps)
        return
      }
      const animacao = animate(kbps, teste.uploadKbps, { duration: 0.6, ease: ASSENTAR })
      return () => animacao.stop()
    }
    kbps.set(0)
  }, [teste, reduzir, kbps])

  const temValor = teste.fase === 'medido' || (teste.fase === 'medindo' && !reduzir)
  const cor =
    teste.fase !== 'medido'
      ? 'text-texto-suave'
      : teste.uploadKbps >= necessarioKbps
        ? 'text-destaque'
        : 'text-aviso'
  const marca = Math.min(100, (necessarioKbps / ESCALA_KBPS) * 100)

  return (
    <div className={`grid gap-2 transition-colors duration-200 ${cor}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-texto-suave text-xs">Upload</span>
        <span className="font-mono text-xl tabular-nums">
          {temValor ? <motion.span>{texto}</motion.span> : '—'}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-superficie-2">
        <motion.div
          className="absolute inset-0 origin-left rounded-full bg-current"
          style={{ scaleX: preenchimento }}
        />
        <span
          aria-hidden
          className="absolute -top-1.5 -bottom-1.5 w-px bg-texto-suave"
          style={{ left: `${marca}%` }}
        />
      </div>
      <span
        className="relative text-texto-suave text-xs"
        // Centrada na marca, sem sair da coluna quando a marca fica perto de uma ponta.
        style={{
          left: `${Math.min(80, Math.max(20, marca))}%`,
          translate: '-50% 0',
          width: 'max-content',
        }}
      >
        o que esta configuração pede
      </span>
    </div>
  )
}

export function TelaConfiguracoes({
  plataforma,
  config,
  aoMudarConfig,
  aoIniciar,
  aoVoltar,
  iniciando,
  erro,
  linkFixo,
  usarLinkFixo,
  aoMudarUsarLinkFixo,
}: {
  plataforma: Plataforma
  config: ConfigTransmissao
  aoMudarConfig: (config: ConfigTransmissao) => void
  aoIniciar: () => void
  aoVoltar: () => void
  iniciando: boolean
  erro: string | null
  linkFixo: MeuLinkFixo | null
  usarLinkFixo: boolean
  aoMudarUsarLinkFixo: (usar: boolean) => void
}) {
  const fontes = useFontes(plataforma.fontes)
  const microfones = useMicrofones(config.microfone.ativo)
  const [fonteEscolhida, setFonteEscolhida] = useState<FonteDeCaptura | null>(null)
  const [erroFonte, setErroFonte] = useState<string | null>(null)
  const [teste, setTeste] = useState<Teste>({ fase: 'parado' })

  const fonteAtual = fontes.find((fonte) => fonte.id === fonteEscolhida?.id) ?? fonteEscolhida
  const dimensoes =
    fonteAtual?.largura && fonteAtual.altura
      ? { largura: fonteAtual.largura, altura: fonteAtual.altura }
      : FONTE_PRESUMIDA
  const resolvida = resolverTransmissao(config, dimensoes, codecsDoHost())
  const necessarioKbps = uploadNecessarioKbps(resolvida)
  const preset = presetAtual(config)
  const precisaEscolherFonte = !fonteAtual

  const escolherFonte = async (fonte: FonteDeCaptura) => {
    try {
      await plataforma.fontes.escolher(fonte.id)
      setFonteEscolhida(fonte)
      setErroFonte(null)
    } catch {
      setErroFonte('Essa janela acabou de fechar. Escolha outra.')
    }
  }

  const testar = async () => {
    setTeste({ fase: 'medindo' })
    try {
      setTeste({ fase: 'medido', uploadKbps: await plataforma.api.medirUploadKbps() })
    } catch (e) {
      setTeste({
        fase: 'erro',
        mensagem: mensagemDoErro(e, 'Não consegui medir a conexão.'),
      })
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 p-6 min-[1100px]:p-10">
      <header className="flex items-center justify-between">
        <h1 className="font-semibold text-lg">Configurar transmissão</h1>
        <Botao variante="fantasma" onClick={aoVoltar}>
          Voltar
        </Botao>
      </header>

      <div className="grid gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_24rem] min-[1100px]:items-start">
        <section aria-label="O que compartilhar" className="grid gap-3">
          <h2 className="font-medium">O que compartilhar</h2>
          <PainelFonte
            lista={fontes}
            escolhida={fonteAtual?.id ?? null}
            aoEscolher={escolherFonte}
          />
          {erroFonte && (
            <p role="alert" className="text-parar text-xs">
              {erroFonte}
            </p>
          )}
        </section>

        <div className="grid gap-5">
          <Segmentado
            rotulo={preset === 'personalizado' ? 'Preset: personalizado' : 'Preset'}
            opcoes={(Object.keys(PRESETS) as PresetId[]).map((id) => ({
              valor: id,
              texto: PRESETS[id].nome,
            }))}
            valor={preset === 'personalizado' ? null : preset}
            aoMudar={(id) => aoMudarConfig(aplicarPreset(config, id))}
          />

          <div>
            <Secao titulo="Vídeo">
              <PainelVideo
                config={config}
                aoMudar={aoMudarConfig}
                codecsDoHost={codecsDoHost()}
                limitadoPelaFonte={resolvida.limitadoPelaFonte}
                uploadNecessarioKbps={necessarioKbps}
              />
            </Secao>
            <Secao titulo="Áudio">
              <PainelAudio config={config} aoMudar={aoMudarConfig} microfones={microfones} />
            </Secao>
          </div>

          {fonteAtual && (
            <img
              src={fonteAtual.miniatura}
              alt={`Prévia de ${fonteAtual.nome}`}
              className="aspect-video w-full rounded-lg border border-borda bg-black object-contain"
            />
          )}

          <div className="grid gap-2">
            <p className="font-mono text-sm" data-testid="resumo">
              {resolvida.resumo}
            </p>
            <ReguaDeUpload teste={teste} necessarioKbps={necessarioKbps} />
            <div className="flex items-center gap-3">
              <Botao onClick={testar} disabled={teste.fase === 'medindo'}>
                {teste.fase === 'medindo' ? 'Testando…' : 'Testar conexão'}
              </Botao>
              <motion.div
                key={teste.fase}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={ENTRADA}
              >
                <ResultadoDoTeste
                  teste={teste}
                  necessarioKbps={necessarioKbps}
                  aoUsarPreset={(id) => aoMudarConfig(aplicarPreset(config, id))}
                />
              </motion.div>
            </div>
          </div>

          <div className="grid gap-2">
            {linkFixo && (
              <Alternador
                rotulo="Usar meu link fixo nesta transmissão"
                descricao={linkFixo.url}
                ligado={usarLinkFixo}
                aoMudar={aoMudarUsarLinkFixo}
              />
            )}
            <Botao
              variante="primario"
              className="py-3"
              onClick={aoIniciar}
              disabled={iniciando || precisaEscolherFonte}
            >
              {iniciando
                ? 'Começando…'
                : precisaEscolherFonte
                  ? 'Escolha uma tela ou janela'
                  : 'Iniciar'}
            </Botao>
            {erro && (
              <p role="alert" className="text-parar text-sm">
                {erro}
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

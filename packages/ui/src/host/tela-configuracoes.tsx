import {
  aplicarPreset,
  type ConfigTransmissao,
  ErroApi,
  PRESETS,
  type PresetId,
  presetAtual,
  presetQueCabe,
  resolverTransmissao,
  uploadNecessarioKbps,
} from '@telando/core'
import { codecsDoHost } from '@telando/core/cliente'
import { useEffect, useState } from 'react'
import { Botao, Secao, Segmentado } from '../controles.tsx'
import type { FonteDeCaptura, Plataforma } from '../plataforma.ts'
import { formatarMbps, PainelAudio, PainelVideo } from './paineis.tsx'
import { PainelFonte, useFontes } from './painel-fonte.tsx'

// Janelas e o seletor do navegador só revelam o tamanho depois de capturar.
const FONTE_PRESUMIDA = { largura: 1920, altura: 1080 }

export function useMicrofones() {
  const [microfones, setMicrofones] = useState<MediaDeviceInfo[]>([])
  useEffect(() => {
    void navigator.mediaDevices
      .enumerateDevices()
      .then((dispositivos) => setMicrofones(dispositivos.filter((d) => d.kind === 'audioinput')))
  }, [])
  return microfones
}

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

export function TelaConfiguracoes({
  plataforma,
  config,
  aoMudarConfig,
  aoIniciar,
  aoVoltar,
  iniciando,
  erro,
}: {
  plataforma: Plataforma
  config: ConfigTransmissao
  aoMudarConfig: (config: ConfigTransmissao) => void
  aoIniciar: () => void
  aoVoltar: () => void
  iniciando: boolean
  erro: string | null
}) {
  const fontes = useFontes(plataforma.fontes)
  const microfones = useMicrofones()
  const [fonteEscolhida, setFonteEscolhida] = useState<FonteDeCaptura | null>(null)
  const [teste, setTeste] = useState<Teste>({ fase: 'parado' })

  const fonteAtual = fontes.find((fonte) => fonte.id === fonteEscolhida?.id) ?? fonteEscolhida
  const dimensoes =
    fonteAtual?.largura && fonteAtual.altura
      ? { largura: fonteAtual.largura, altura: fonteAtual.altura }
      : FONTE_PRESUMIDA
  const resolvida = resolverTransmissao(config, dimensoes, codecsDoHost())
  const necessarioKbps = uploadNecessarioKbps(resolvida)
  const preset = presetAtual(config)
  const precisaEscolherFonte = Boolean(plataforma.fontes) && !fonteAtual

  const escolherFonte = async (fonte: FonteDeCaptura) => {
    setFonteEscolhida(fonte)
    await plataforma.fontes?.escolher(fonte.id)
  }

  const testar = async () => {
    setTeste({ fase: 'medindo' })
    try {
      setTeste({ fase: 'medido', uploadKbps: await plataforma.api.medirUploadKbps() })
    } catch (e) {
      setTeste({
        fase: 'erro',
        mensagem: e instanceof ErroApi ? e.message : 'Não consegui medir a conexão.',
      })
    }
  }

  return (
    <main className="mx-auto grid max-w-xl gap-5 p-6">
      <header className="flex items-center justify-between">
        <h1 className="font-semibold text-lg">Configurar transmissão</h1>
        <Botao variante="fantasma" onClick={aoVoltar}>
          Voltar
        </Botao>
      </header>

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
        <Secao titulo="Fonte" aberta={Boolean(plataforma.fontes)}>
          {plataforma.fontes ? (
            <PainelFonte
              lista={fontes}
              escolhida={fonteAtual?.id ?? null}
              aoEscolher={escolherFonte}
            />
          ) : (
            <p className="text-sm text-texto-suave">
              Ao iniciar, o navegador abre o seletor dele: dá para escolher a tela inteira, uma
              janela ou uma aba. Para mandar o som, marque “Compartilhar áudio” nele.
            </p>
          )}
        </Secao>
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
        <div className="flex items-center gap-3">
          <Botao onClick={testar} disabled={teste.fase === 'medindo'}>
            {teste.fase === 'medindo' ? 'Testando…' : 'Testar conexão'}
          </Botao>
          <ResultadoDoTeste
            teste={teste}
            necessarioKbps={necessarioKbps}
            aoUsarPreset={(id) => aoMudarConfig(aplicarPreset(config, id))}
          />
        </div>
      </div>

      <div className="grid gap-2">
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
    </main>
  )
}

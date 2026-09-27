import { type ConfigTransmissao, uploadNecessarioKbps } from '@telando/core'
import { codecsDoHost, type Estatisticas, type useTransmissao } from '@telando/core/cliente'
import { useEffect, useState } from 'react'
import { Botao, Secao } from '../controles.tsx'
import type { FonteDeCaptura, Plataforma } from '../plataforma.ts'
import { formatarMbps, PainelAudio, PainelVideo } from './paineis.tsx'
import { PainelFonte, useFontes } from './painel-fonte.tsx'
import { useMicrofones } from './tela-configuracoes.tsx'

type Controle = ReturnType<typeof useTransmissao>

const TEXTO_LIMITACAO = {
  banda: 'A qualidade baixou porque falta banda de upload.',
  cpu: 'A qualidade baixou porque o computador não está dando conta de codificar.',
}

function PainelEstatisticas({ estatisticas }: { estatisticas: Estatisticas | null }) {
  if (!estatisticas) return <p className="text-sm text-texto-suave">Medindo…</p>
  const linhas: Array<[string, string]> = [
    ['Resolução', `${estatisticas.largura}×${estatisticas.altura}`],
    ['Quadros', `${estatisticas.fps} fps`],
    ['Vídeo', formatarMbps(estatisticas.videoKbps)],
    ['Áudio', `${estatisticas.audioKbps} kbps`],
    ['Codec', estatisticas.codec ?? '—'],
    ['Perda de pacotes', `${estatisticas.perdaPct.toLocaleString('pt-BR')}%`],
  ]
  if (estatisticas.cpuPct !== null)
    linhas.push(['CPU do app', `${Math.round(estatisticas.cpuPct)}%`])

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm" data-testid="estatisticas">
      {linhas.map(([nome, valor]) => (
        <div key={nome} className="contents">
          <dt className="text-texto-suave">{nome}</dt>
          <dd className="text-right font-mono tabular-nums">{valor}</dd>
        </div>
      ))}
    </dl>
  )
}

function useAtalhosDaJanela(atalhos: Record<string, () => void>) {
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      const alvo = evento.target as HTMLElement
      if (evento.ctrlKey || evento.metaKey || evento.altKey) return
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(alvo.tagName)) return
      atalhos[evento.key.toLowerCase()]?.()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [atalhos])
}

export function TelaCompartilhando({
  plataforma,
  controle,
  aoMudarConfig,
}: {
  plataforma: Plataforma
  controle: Controle
  aoMudarConfig: (config: ConfigTransmissao) => void
}) {
  const { estado, estatisticas } = controle
  const [painel, setPainel] = useState<'nenhum' | 'ajustes' | 'fonte'>('nenhum')
  const [verEstatisticas, setVerEstatisticas] = useState(false)
  const microfones = useMicrofones()
  const fontes = useFontes(painel === 'fonte' ? plataforma.fontes : undefined)

  useAtalhosDaJanela({
    p: controle.alternarPausa,
    m: controle.alternarAudio,
    n: controle.alternarMicrofone,
  })

  if (estado.fase !== 'ao-vivo') return null
  const { config, resolvida } = estado

  const ajustar = (nova: ConfigTransmissao) => {
    aoMudarConfig(nova)
    void controle.ajustar(nova)
  }

  const trocarFonte = async (fonte?: FonteDeCaptura) => {
    if (fonte) await plataforma.fontes?.escolher(fonte.id)
    setPainel('nenhum')
    await controle.trocarFonte()
  }

  return (
    <main className="mx-auto grid max-w-xl gap-5 p-6">
      <div className="flex items-center gap-2 text-sm">
        <span className="size-2 rounded-full bg-ao-vivo" aria-hidden />
        <span className="font-medium text-ao-vivo tracking-wide">AO VIVO</span>
        <span className="text-texto-suave" data-testid="espectadores">
          ·{' '}
          {estado.espectadores === 1
            ? '1 pessoa assistindo'
            : `${estado.espectadores} pessoas assistindo`}
        </span>
        {estado.pausado && <span className="ml-auto text-aviso">Vídeo pausado</span>}
      </div>

      <div className="grid gap-2">
        <label htmlFor="link" className="text-sm text-texto-suave">
          {estado.copiado
            ? 'Link copiado. É só mandar para quem vai assistir.'
            : 'Mande este link para quem vai assistir.'}
        </label>
        <div className="flex gap-2">
          <input
            id="link"
            readOnly
            value={estado.link}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-borda bg-superficie px-3 py-2 font-mono text-sm"
          />
          <Botao onClick={controle.copiarLink}>Copiar</Botao>
        </div>
        <p className="font-mono text-texto-suave text-xs">{resolvida.resumo}</p>
      </div>

      {config.audioSistema && !estado.comAudio && (
        <p className="text-sm text-texto-suave">
          Sem áudio: a captura não trouxe som. No navegador, marque “Compartilhar áudio” no seletor;
          no Windows isso funciona com a tela inteira ou com uma aba.
        </p>
      )}
      {estatisticas?.limitacao && (
        <p role="status" className="rounded-lg border border-aviso/40 px-3 py-2 text-aviso text-sm">
          {TEXTO_LIMITACAO[estatisticas.limitacao]}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Botao onClick={controle.alternarPausa} aria-keyshortcuts="P">
          {estado.pausado ? 'Retomar vídeo' : 'Pausar vídeo'}
        </Botao>
        {estado.comAudio && (
          <Botao onClick={controle.alternarAudio} aria-keyshortcuts="M">
            {estado.audioMudo ? 'Ligar áudio' : 'Mutar áudio'}
          </Botao>
        )}
        {config.microfone.ativo && (
          <Botao onClick={controle.alternarMicrofone} aria-keyshortcuts="N">
            {estado.microfoneMudo ? 'Ligar microfone' : 'Mutar microfone'}
          </Botao>
        )}
        <Botao onClick={() => (plataforma.fontes ? setPainel('fonte') : void trocarFonte())}>
          Trocar tela/janela
        </Botao>
        <Botao
          onClick={() => setPainel(painel === 'ajustes' ? 'nenhum' : 'ajustes')}
          aria-expanded={painel === 'ajustes'}
        >
          Ajustes
        </Botao>
        <Botao
          variante="fantasma"
          onClick={() => setVerEstatisticas(!verEstatisticas)}
          aria-expanded={verEstatisticas}
        >
          Estatísticas
        </Botao>
      </div>

      {verEstatisticas && <PainelEstatisticas estatisticas={estatisticas} />}

      {painel === 'fonte' && (
        <section aria-label="Trocar o que está sendo compartilhado" className="grid gap-3">
          <PainelFonte
            lista={fontes}
            escolhida={null}
            aoEscolher={(fonte) => void trocarFonte(fonte)}
          />
          <Botao variante="fantasma" onClick={() => setPainel('nenhum')}>
            Cancelar
          </Botao>
        </section>
      )}

      {painel === 'ajustes' && (
        <aside aria-label="Ajustes da transmissão">
          <Secao titulo="Vídeo" aberta>
            <PainelVideo
              config={config}
              aoMudar={ajustar}
              codecsDoHost={codecsDoHost()}
              limitadoPelaFonte={resolvida.limitadoPelaFonte}
              uploadNecessarioKbps={uploadNecessarioKbps(resolvida)}
            />
          </Secao>
          <Secao titulo="Áudio" aberta>
            <PainelAudio
              config={config}
              aoMudar={ajustar}
              nivelAudio={controle.nivelAudio}
              microfones={microfones}
            />
          </Secao>
        </aside>
      )}

      <Botao variante="perigo" className="justify-self-start" onClick={controle.parar}>
        Parar
      </Botao>
    </main>
  )
}

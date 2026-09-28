import {
  type Codec,
  type ConfigTransmissao,
  type Fps,
  formatarMbps,
  NOMES_QUALIDADE_AUDIO,
  type QualidadeAudio,
  type Resolucao,
} from '@telando/core'
import { useEffect, useState } from 'react'
import { Alternador, classeCampo, Segmentado } from '../controles.tsx'

type PropsPainel = {
  config: ConfigTransmissao
  aoMudar: (config: ConfigTransmissao) => void
}

const RESOLUCOES: ReadonlyArray<{ valor: Resolucao; texto: string }> = [
  { valor: 'nativa', texto: 'Nativa' },
  { valor: '2160p', texto: '4K' },
  { valor: '1440p', texto: '1440p' },
  { valor: '1080p', texto: '1080p' },
  { valor: '720p', texto: '720p' },
  { valor: '480p', texto: '480p' },
]

const FPS: ReadonlyArray<{ valor: Fps; texto: string; dica?: string }> = [
  { valor: 5, texto: '5' },
  { valor: 15, texto: '15' },
  { valor: 30, texto: '30' },
  { valor: 60, texto: '60' },
  { valor: 120, texto: '120', dica: 'Experimental: depende do monitor e do codec' },
]

const NOMES_CODEC: Record<Exclude<Codec, 'auto'>, string> = {
  av1: 'AV1',
  vp9: 'VP9',
  h264: 'H.264',
  vp8: 'VP8',
}

export function PainelVideo({
  config,
  aoMudar,
  codecsDoHost,
  limitadoPelaFonte,
  uploadNecessarioKbps,
}: PropsPainel & {
  codecsDoHost: string[]
  limitadoPelaFonte: boolean
  uploadNecessarioKbps: number
}) {
  const mudar = (mudanca: Partial<ConfigTransmissao>) => aoMudar({ ...config, ...mudanca })
  const bitrateManual = config.bitrateMaxKbps === 'auto' ? null : config.bitrateMaxKbps
  const codecs = (Object.keys(NOMES_CODEC) as Array<keyof typeof NOMES_CODEC>).filter((codec) =>
    codecsDoHost.includes(codec),
  )

  return (
    <>
      <div className="grid gap-1.5">
        <Segmentado
          rotulo="Resolução"
          opcoes={RESOLUCOES}
          valor={config.resolucao}
          aoMudar={(resolucao) => mudar({ resolucao })}
        />
        {limitadoPelaFonte && (
          <p className="text-texto-suave text-xs">
            A fonte é menor que isso, então vai na resolução dela.
          </p>
        )}
      </div>

      <Segmentado
        rotulo="Quadros por segundo"
        opcoes={FPS}
        valor={config.fps}
        aoMudar={(fps) => mudar({ fps })}
      />

      <div className="grid gap-2">
        <Alternador
          rotulo="Bitrate automático"
          ligado={bitrateManual === null}
          aoMudar={(ligado) => mudar({ bitrateMaxKbps: ligado ? 'auto' : 4000 })}
        />
        {bitrateManual !== null && (
          <label className="grid gap-1 text-sm">
            <span className="flex justify-between text-texto-suave">
              Bitrate máximo
              <span className="font-mono text-texto">{formatarMbps(bitrateManual)}</span>
            </span>
            <input
              type="range"
              min={500}
              max={20_000}
              step={500}
              value={bitrateManual}
              onChange={(e) => mudar({ bitrateMaxKbps: Number(e.target.value) })}
              className="accent-texto"
            />
          </label>
        )}
        <p className="text-texto-suave text-xs">
          Precisa de uns {formatarMbps(uploadNecessarioKbps)} de upload.
        </p>
      </div>

      <Segmentado
        rotulo="Otimizar para"
        opcoes={[
          {
            valor: 'nitidez',
            texto: 'Nitidez',
            dica: 'Texto e código legíveis; se faltar banda, cai o fps',
          },
          {
            valor: 'fluidez',
            texto: 'Fluidez',
            dica: 'Movimento suave; se faltar banda, cai a resolução',
          },
          { valor: 'equilibrio', texto: 'Equilíbrio' },
        ]}
        valor={config.otimizacao}
        aoMudar={(otimizacao) => mudar({ otimizacao })}
      />

      <label className="grid gap-1.5 text-sm">
        <span className="text-texto-suave">Codec</span>
        <select
          value={config.codec}
          onChange={(e) => mudar({ codec: e.target.value as Codec })}
          className={classeCampo}
        >
          <option value="auto">Automático</option>
          {codecs.map((codec) => (
            <option key={codec} value={codec}>
              {NOMES_CODEC[codec]}
            </option>
          ))}
        </select>
      </label>

      <Alternador
        rotulo="Várias qualidades para quem assiste"
        descricao="Ajuda quem tem internet fraca. Desligue para gastar menos CPU."
        ligado={config.simulcast}
        aoMudar={(simulcast) => mudar({ simulcast })}
      />
    </>
  )
}

function MedidorDeNivel({ nivel }: { nivel: () => number }) {
  const [valor, setValor] = useState(0)
  useEffect(() => {
    let quadro = requestAnimationFrame(function medir() {
      setValor(nivel())
      quadro = requestAnimationFrame(medir)
    })
    return () => cancelAnimationFrame(quadro)
  }, [nivel])

  return (
    <meter aria-label="Nível do áudio" min={0} max={1} value={valor} className="h-1.5 w-full" />
  )
}

export function PainelAudio({
  config,
  aoMudar,
  nivelAudio,
  microfones,
}: PropsPainel & {
  /** Só existe durante a transmissão, quando há áudio de verdade passando. */
  nivelAudio?: () => number
  microfones: MediaDeviceInfo[]
}) {
  const mudar = (mudanca: Partial<ConfigTransmissao>) => aoMudar({ ...config, ...mudanca })
  const mudarMicrofone = (mudanca: Partial<ConfigTransmissao['microfone']>) =>
    mudar({ microfone: { ...config.microfone, ...mudanca } })

  return (
    <>
      <Alternador
        rotulo="Compartilhar o áudio do sistema"
        ligado={config.audioSistema}
        aoMudar={(audioSistema) => mudar({ audioSistema })}
      />

      {config.audioSistema && (
        <>
          <label className="grid gap-1 text-sm">
            <span className="flex justify-between text-texto-suave">
              Volume do áudio compartilhado
              <span className="font-mono text-texto">{Math.round(config.volumeAudio * 100)}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={150}
              step={5}
              value={Math.round(config.volumeAudio * 100)}
              onChange={(e) => mudar({ volumeAudio: Number(e.target.value) / 100 })}
              className="accent-texto"
            />
          </label>
          {nivelAudio && <MedidorDeNivel nivel={nivelAudio} />}

          <Segmentado
            rotulo="Qualidade do áudio"
            opcoes={(Object.keys(NOMES_QUALIDADE_AUDIO) as QualidadeAudio[]).map((valor) => ({
              valor,
              texto: NOMES_QUALIDADE_AUDIO[valor],
            }))}
            valor={config.qualidadeAudio}
            aoMudar={(qualidadeAudio) => mudar({ qualidadeAudio })}
          />
        </>
      )}

      <Alternador
        rotulo="Microfone junto"
        ligado={config.microfone.ativo}
        aoMudar={(ativo) => mudarMicrofone({ ativo })}
      />
      {config.microfone.ativo && (
        <div className="grid gap-2 border-borda border-l pl-3">
          <select
            aria-label="Microfone"
            value={config.microfone.deviceId ?? ''}
            onChange={(e) => mudarMicrofone({ deviceId: e.target.value || null })}
            className={classeCampo}
          >
            <option value="">Microfone padrão do sistema</option>
            {microfones.map((mic) => (
              <option key={mic.deviceId} value={mic.deviceId}>
                {mic.label || 'Microfone sem nome'}
              </option>
            ))}
          </select>
          <Alternador
            rotulo="Cancelamento de eco"
            ligado={config.microfone.cancelamentoEco}
            aoMudar={(cancelamentoEco) => mudarMicrofone({ cancelamentoEco })}
          />
          <Alternador
            rotulo="Supressão de ruído"
            ligado={config.microfone.supressaoRuido}
            aoMudar={(supressaoRuido) => mudarMicrofone({ supressaoRuido })}
          />
          <Alternador
            rotulo="Ganho automático"
            ligado={config.microfone.ganhoAutomatico}
            aoMudar={(ganhoAutomatico) => mudarMicrofone({ ganhoAutomatico })}
          />
        </div>
      )}
    </>
  )
}

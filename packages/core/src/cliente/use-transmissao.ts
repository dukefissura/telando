import { useCallback, useEffect, useRef, useState } from 'react'
import { type criarClienteApi, mensagemDoErro } from '../api.ts'
import type { EstatisticasEnvio } from '../estatisticas.ts'
import type { ConfigTransmissao, TransmissaoResolvida } from '../transmissao.ts'
import { CapturaCancelada, type Espectador, TransmissaoAoVivo } from './transmissao-ao-vivo.ts'

export type EstadoTransmissao =
  | { fase: 'parada' }
  | { fase: 'iniciando' }
  | { fase: 'erro'; mensagem: string }
  | {
      fase: 'ao-vivo'
      link: string
      copiado: boolean
      espectadores: Espectador[]
      trancada: boolean
      config: ConfigTransmissao
      resolvida: TransmissaoResolvida
      comAudio: boolean
      pausado: boolean
      audioMudo: boolean
      microfoneMudo: boolean
      /** Um ajuste ou troca de fonte que não deu certo; a transmissão continua como estava. */
      aviso: string | null
    }

export type Estatisticas = EstatisticasEnvio & { cpuPct: number | null }

type Opcoes = {
  api: ReturnType<typeof criarClienteApi>
  /** Só o desktop sabe o uso de CPU do processo. */
  usoDeCpu?: () => Promise<number>
}

function mensagemDeErro(erro: unknown): string {
  if (erro instanceof DOMException && erro.name === 'NotReadableError') {
    return 'O sistema não deixou capturar essa tela. Tente outra janela ou a tela inteira.'
  }
  return mensagemDoErro(erro, 'Não consegui começar a transmissão. Tente de novo.')
}

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    // Sem foco na janela ou sem permissão: o botão "Copiar" continua lá.
    return false
  }
}

export function useTransmissao({ api, usoDeCpu }: Opcoes) {
  const [estado, setEstado] = useState<EstadoTransmissao>({ fase: 'parada' })
  const [estatisticas, setEstatisticas] = useState<Estatisticas | null>(null)
  const ativa = useRef<TransmissaoAoVivo | null>(null)

  const atualizarAoVivo = useCallback(
    (mudanca: Partial<Extract<EstadoTransmissao, { fase: 'ao-vivo' }>>) =>
      setEstado((atual) => (atual.fase === 'ao-vivo' ? { ...atual, ...mudanca } : atual)),
    [],
  )

  const parar = useCallback(async () => {
    const transmissao = ativa.current
    if (!transmissao) return
    ativa.current = null
    setEstado({ fase: 'parada' })
    setEstatisticas(null)
    await transmissao.encerrar()
  }, [])

  const iniciar = useCallback(
    async (config: ConfigTransmissao) => {
      setEstado({ fase: 'iniciando' })
      try {
        const transmissao = await TransmissaoAoVivo.iniciar(api, config, {
          aoMudarEspectadores: (espectadores) => atualizarAoVivo({ espectadores }),
          aoCair: async () => {
            await parar()
            setEstado({
              fase: 'erro',
              mensagem: 'A conexão com o servidor caiu e a transmissão parou. Comece de novo.',
            })
          },
          aoPerderCaptura: () => void parar(),
        })
        ativa.current = transmissao
        setEstado({
          fase: 'ao-vivo',
          link: transmissao.sessao.url,
          copiado: await copiar(transmissao.sessao.url),
          espectadores: transmissao.espectadores,
          trancada: false,
          config: transmissao.config,
          resolvida: transmissao.resolvida,
          comAudio: transmissao.comAudio,
          pausado: false,
          audioMudo: false,
          microfoneMudo: false,
          aviso: null,
        })
      } catch (erro) {
        setEstado(
          erro instanceof CapturaCancelada
            ? { fase: 'parada' }
            : { fase: 'erro', mensagem: mensagemDeErro(erro) },
        )
      }
    },
    [api, atualizarAoVivo, parar],
  )

  /** Roda uma mudança na transmissão e devolve se deu certo; se não, mostra o aviso. */
  const mudarTransmissao = useCallback(
    async (mudanca: (transmissao: TransmissaoAoVivo) => Promise<void>, falha: string) => {
      const transmissao = ativa.current
      if (!transmissao) return false
      let aviso: string | null = null
      try {
        await mudanca(transmissao)
      } catch (erro) {
        if (!(erro instanceof CapturaCancelada)) aviso = falha
      }
      atualizarAoVivo({
        config: transmissao.config,
        resolvida: transmissao.resolvida,
        comAudio: transmissao.comAudio,
        aviso,
      })
      return aviso === null
    },
    [atualizarAoVivo],
  )

  const ajustar = useCallback(
    (config: ConfigTransmissao) =>
      mudarTransmissao(
        (transmissao) => transmissao.ajustar(config),
        'Não consegui aplicar esse ajuste. A transmissão segue com o anterior.',
      ),
    [mudarTransmissao],
  )

  const trocarFonte = useCallback(
    () =>
      mudarTransmissao(
        (transmissao) => transmissao.trocarFonte(),
        'Não consegui capturar essa tela ou janela. A transmissão segue com a anterior.',
      ),
    [mudarTransmissao],
  )

  const trancar = useCallback(
    async (trancada: boolean) => {
      const transmissao = ativa.current
      if (!transmissao) return
      try {
        await transmissao.trancar(trancada)
        atualizarAoVivo({ trancada, aviso: null })
      } catch (erro) {
        atualizarAoVivo({ aviso: mensagemDoErro(erro, 'Não consegui trancar a sessão.') })
      }
    },
    [atualizarAoVivo],
  )

  const remover = useCallback(
    async (identity: string) => {
      try {
        await ativa.current?.remover(identity)
      } catch (erro) {
        atualizarAoVivo({ aviso: mensagemDoErro(erro, 'Não consegui remover essa pessoa.') })
      }
    },
    [atualizarAoVivo],
  )

  const copiarLink = useCallback(async () => {
    const link = ativa.current?.sessao.url
    if (link) atualizarAoVivo({ copiado: await copiar(link) })
  }, [atualizarAoVivo])

  const alternar = useCallback(
    (campo: 'pausado' | 'audioMudo' | 'microfoneMudo') => async () => {
      const transmissao = ativa.current
      if (estado.fase !== 'ao-vivo' || !transmissao) return
      const ligar = !estado[campo]
      if (campo === 'pausado') await transmissao.pausarVideo(ligar)
      if (campo === 'audioMudo') await transmissao.mutarAudioSistema(ligar)
      if (campo === 'microfoneMudo') await transmissao.mutarMicrofone(ligar)
      atualizarAoVivo({ [campo]: ligar })
    },
    [estado, atualizarAoVivo],
  )

  const aoVivo = estado.fase === 'ao-vivo'
  useEffect(() => {
    if (!aoVivo) return
    const intervalo = setInterval(async () => {
      const transmissao = ativa.current
      if (!transmissao) return
      const [envio, cpuPct] = await Promise.all([
        transmissao.estatisticas(),
        usoDeCpu ? usoDeCpu() : Promise.resolve(null),
      ])
      setEstatisticas({ ...envio, cpuPct })
    }, 1000)
    return () => clearInterval(intervalo)
  }, [aoVivo, usoDeCpu])

  useEffect(() => {
    const aoSair = () => void parar()
    window.addEventListener('pagehide', aoSair)
    return () => {
      window.removeEventListener('pagehide', aoSair)
      void parar()
    }
  }, [parar])

  return {
    estado,
    estatisticas,
    iniciar,
    parar,
    ajustar,
    trocarFonte,
    copiarLink,
    trancar,
    remover,
    sala: estado.fase === 'ao-vivo' ? (ativa.current?.sala ?? null) : null,
    alternarPausa: alternar('pausado'),
    alternarAudio: alternar('audioMudo'),
    alternarMicrofone: alternar('microfoneMudo'),
    nivelAudio: () => ativa.current?.nivelAudio() ?? 0,
  }
}

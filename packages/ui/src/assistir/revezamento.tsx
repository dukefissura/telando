import {
  type AvisoRevezamento,
  aplicarPreset,
  configPadrao,
  mensagemDoErro,
  PRESETS,
  type PresetId,
  type SessaoMetadata,
} from '@telando/core'
import { compartilharComoConvidado } from '@telando/core/cliente'
import type { Room } from 'livekit-client'
import { Hand } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alternador, Botao, Segmentado } from '../controles.tsx'
import { PainelFonte, useFontes } from '../host/painel-fonte.tsx'
import { ENTRADA } from '../movimento.ts'
import type { FonteDeCaptura, Plataforma } from '../plataforma.ts'
import { classeBotaoDaBarra } from './barra-de-controles.tsx'

type Pedido = 'livre' | 'pedido' | 'recusado'
type Compartilhamento = Awaited<ReturnType<typeof compartilharComoConvidado>>

const MOSTRAR_RECUSA_MS = 4000

export function useRevezamento(
  room: Room,
  sessao: SessaoMetadata | null,
  avisar: (aviso: AvisoRevezamento, para: string) => Promise<void>,
  fontes: Plataforma['fontes'],
) {
  const [pedido, setPedido] = useState<Pedido>('livre')
  const [compartilhando, setCompartilhando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const atual = useRef<Compartilhamento | null>(null)
  const souApresentador = sessao?.presenterIdentity === room.localParticipant.identity
  // Lido depois de awaits: o host pode ter retomado a vez enquanto a captura começava.
  const aindaSouApresentador = useRef(souApresentador)
  aindaSouApresentador.current = souApresentador
  const host = sessao?.hostIdentity

  const pararCaptura = useCallback(async () => {
    const compartilhamento = atual.current
    atual.current = null
    setCompartilhando(false)
    await compartilhamento?.parar()
  }, [])

  const devolver = useCallback(async () => {
    await pararCaptura()
    setPedido('livre')
    if (host) await avisar({ t: 'devolver-tela' }, host)
  }, [pararCaptura, avisar, host])

  // O host retomou a vez (ou quem apresentava perdeu a permissão): a captura local para junto.
  useEffect(() => {
    if (!souApresentador && atual.current) void pararCaptura()
    if (souApresentador) setPedido('livre')
  }, [souApresentador, pararCaptura])

  useEffect(() => {
    if (pedido !== 'recusado') return
    const timer = setTimeout(() => setPedido('livre'), MOSTRAR_RECUSA_MS)
    return () => clearTimeout(timer)
  }, [pedido])

  return {
    fase: souApresentador ? (compartilhando ? 'compartilhando' : 'aprovado') : pedido,
    erro,
    aoAviso(aviso: AvisoRevezamento) {
      if (aviso.t === 'pedido-recusado') setPedido('recusado')
    },
    async pedir() {
      if (!host) return
      setPedido('pedido')
      await avisar({ t: 'pedido-tela' }, host)
    },
    async cancelar() {
      setPedido('livre')
      if (host) await avisar({ t: 'pedido-cancelado' }, host)
    },
    async compartilhar(preset: PresetId, comAudio: boolean, fonte: FonteDeCaptura) {
      setErro(null)
      try {
        await fontes.escolher(fonte.id)
        const config = { ...aplicarPreset(configPadrao(), preset), audioSistema: comAudio }
        const compartilhamento = await compartilharComoConvidado(
          room,
          config,
          () => void devolver(),
        )
        if (!aindaSouApresentador.current) {
          await compartilhamento.parar()
          return
        }
        atual.current = compartilhamento
        setCompartilhando(true)
      } catch (e) {
        if (e instanceof DOMException && e.name === 'NotAllowedError') return
        setErro(mensagemDoErro(e, 'Não consegui compartilhar a sua tela.'))
      }
    },
    devolver,
  }
}

export type Revezamento = ReturnType<typeof useRevezamento>

/** O que aparece para quem foi aprovado pelo host: a fonte, os presets e o som, sem o resto. */
export function EscolherOQueCompartilhar({
  revezamento,
  fontes,
}: {
  revezamento: Revezamento
  fontes: Plataforma['fontes']
}) {
  const [preset, setPreset] = useState<PresetId>('texto')
  const [comAudio, setComAudio] = useState(true)
  const [fonte, setFonte] = useState<FonteDeCaptura | null>(null)
  const lista = useFontes(fontes)

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={ENTRADA}
      aria-label="Você foi aprovado"
      className="grid max-h-[calc(100dvh-8rem)] w-[44rem] max-w-[calc(100vw-2rem)] gap-[18px] overflow-y-auto rounded-[28px] border border-grupo-borda bg-superficie p-[22px] shadow-[0_30px_60px_-30px_rgb(0_0_0/0.9)]"
    >
      <PainelFonte
        titulo="Você foi aprovado, escolha o que compartilhar"
        lista={lista}
        escolhida={fonte?.id ?? null}
        aoEscolher={setFonte}
      />
      <Segmentado
        rotulo="Tipo de conteúdo"
        opcoes={(Object.keys(PRESETS) as PresetId[]).map((id) => ({
          valor: id,
          texto: PRESETS[id].nomeCurto,
          dica: PRESETS[id].nome,
        }))}
        valor={preset}
        aoMudar={setPreset}
      />
      <Alternador
        rotulo="Compartilhar o som do computador"
        ligado={comAudio}
        aoMudar={setComAudio}
      />
      <div className="flex gap-2">
        <Botao
          variante="primario"
          disabled={!fonte}
          onClick={() => fonte && void revezamento.compartilhar(preset, comAudio, fonte)}
        >
          {fonte ? 'Compartilhar' : 'Escolha uma tela ou janela'}
        </Botao>
        <Botao variante="fantasma" onClick={() => void revezamento.devolver()}>
          Agora não
        </Botao>
      </div>
      {revezamento.erro && (
        <p role="alert" className="text-parar text-sm">
          {revezamento.erro}
        </p>
      )}
    </motion.section>
  )
}

/** Botão do revezamento na barra de controles; muda conforme a fase. */
export function BotaoRevezamento({ revezamento }: { revezamento: Revezamento }) {
  switch (revezamento.fase) {
    case 'livre':
      return (
        <button
          type="button"
          className={`${classeBotaoDaBarra} bg-preenchimento-forte`}
          onClick={() => void revezamento.pedir()}
        >
          <Hand size={17} strokeWidth={1.75} aria-hidden />
          Pedir para compartilhar
        </button>
      )
    case 'pedido':
      return (
        <button
          type="button"
          className={`${classeBotaoDaBarra} text-texto-suave`}
          onClick={() => void revezamento.cancelar()}
        >
          Pedido enviado · cancelar
        </button>
      )
    case 'recusado':
      return (
        <span role="status" className="px-3.5 text-[13px] text-texto-suave">
          O host recusou agora
        </span>
      )
    case 'compartilhando':
      return (
        <button
          type="button"
          className={classeBotaoDaBarra}
          onClick={() => void revezamento.devolver()}
        >
          Devolver a vez
        </button>
      )
    default:
      return null
  }
}

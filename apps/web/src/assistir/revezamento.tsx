import {
  aplicarPreset,
  configPadrao,
  mensagemDoErro,
  PRESETS,
  type PresetId,
  type SessaoMetadata,
} from '@telando/core'
import { type AvisoRevezamento, compartilharComoConvidado } from '@telando/core/cliente'
import { Alternador, Botao, Segmentado } from '@telando/ui'
import type { Room } from 'livekit-client'
import { useCallback, useEffect, useRef, useState } from 'react'

type Pedido = 'livre' | 'pedido' | 'recusado'
type Compartilhamento = Awaited<ReturnType<typeof compartilharComoConvidado>>

const MOSTRAR_RECUSA_MS = 4000

export function useRevezamento(
  room: Room,
  sessao: SessaoMetadata | null,
  avisar: (aviso: AvisoRevezamento, para: string) => Promise<void>,
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
    async compartilhar(preset: PresetId, comAudio: boolean) {
      setErro(null)
      try {
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

/** O que aparece para quem foi aprovado pelo host: presets e áudio, sem o resto das configurações. */
export function EscolherOQueCompartilhar({ revezamento }: { revezamento: Revezamento }) {
  const [preset, setPreset] = useState<PresetId>('texto')
  const [comAudio, setComAudio] = useState(true)

  return (
    <section
      aria-label="Você foi aprovado"
      className="grid w-96 gap-4 rounded-xl border border-borda bg-fundo p-4"
    >
      <h2 className="font-semibold">Você foi aprovado, escolha o que compartilhar</h2>
      <Segmentado
        rotulo="Tipo de conteúdo"
        opcoes={(Object.keys(PRESETS) as PresetId[]).map((id) => ({
          valor: id,
          texto: PRESETS[id].nome,
        }))}
        valor={preset}
        aoMudar={setPreset}
      />
      <Alternador rotulo="Compartilhar o áudio" ligado={comAudio} aoMudar={setComAudio} />
      <div className="flex gap-2">
        <Botao variante="primario" onClick={() => void revezamento.compartilhar(preset, comAudio)}>
          Compartilhar
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
    </section>
  )
}

/** Botão do revezamento na barra de controles; muda conforme a fase. */
export function BotaoRevezamento({ revezamento }: { revezamento: Revezamento }) {
  // Navegador sem captura de tela (raro no PC) não mostra a opção.
  if (!navigator.mediaDevices?.getDisplayMedia) return null
  const classe = 'rounded-md px-2.5 py-1.5 text-sm hover:bg-white/10'

  switch (revezamento.fase) {
    case 'livre':
      return (
        <button type="button" className={classe} onClick={() => void revezamento.pedir()}>
          Pedir para compartilhar
        </button>
      )
    case 'pedido':
      return (
        <button
          type="button"
          className={`${classe} text-texto-suave`}
          onClick={() => void revezamento.cancelar()}
        >
          Pedido enviado · cancelar
        </button>
      )
    case 'recusado':
      return (
        <span role="status" className="px-2.5 text-sm text-texto-suave">
          O host recusou agora
        </span>
      )
    case 'compartilhando':
      return (
        <button type="button" className={classe} onClick={() => void revezamento.devolver()}>
          Devolver a vez
        </button>
      )
    default:
      return null
  }
}

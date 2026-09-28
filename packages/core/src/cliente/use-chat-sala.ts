import { type RemoteParticipant, type Room, RoomEvent } from 'livekit-client'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  codificarMensagem,
  lerMensagem,
  type MensagemSala,
  type Reacao,
  TOPICO,
} from '../protocolo.ts'

export type ItemChat = { id: number; nome: string; texto: string; meu: boolean }
export type ReacaoNaTela = { id: number; emoji: Reacao; nome: string }
/** Avisos do revezamento: não aparecem no chat, vão para quem cuida da vez de compartilhar. */
export type AvisoRevezamento = Exclude<MensagemSala, { t: 'chat' } | { t: 'reacao' }>
export type Remetente = { identity: string; nome: string }

// Tudo é efêmero e só em memória; os limites evitam que alguém inunde a tela dos outros.
const MAXIMO_MENSAGENS = 100
const MAXIMO_REACOES_NA_TELA = 24
const DURACAO_REACAO_MS = 3000
const ESPERA_PELO_NOME_MS = 5000

/**
 * O LiveKit avisa sobre quem só assiste com alguns segundos de atraso (agrupa essas atualizações),
 * então a mensagem pode chegar antes de sabermos o apelido de quem mandou.
 */
function nomeDe(room: Room, identity: string): Promise<string> {
  const conhecido = room.getParticipantByIdentity(identity)
  if (conhecido) return Promise.resolve(conhecido.name || 'Sem apelido')
  return new Promise((resolver) => {
    const terminar = (nome: string) => {
      clearTimeout(timer)
      room.off(RoomEvent.ParticipantConnected, aoEntrar)
      resolver(nome)
    }
    const aoEntrar = (participante: RemoteParticipant) => {
      if (participante.identity === identity) terminar(participante.name || 'Sem apelido')
    }
    const timer = setTimeout(() => terminar('Alguém'), ESPERA_PELO_NOME_MS)
    room.on(RoomEvent.ParticipantConnected, aoEntrar)
  })
}

/**
 * Chat, reações e avisos de revezamento passam pelo mesmo tópico: o LiveKit aceita um só handler
 * de text stream por tópico, então este hook é o único que escuta a sala.
 */
export function useChatSala(
  room: Room | null,
  aoAviso?: (aviso: AvisoRevezamento, de: Remetente) => void,
) {
  const [mensagens, setMensagens] = useState<ItemChat[]>([])
  const [reacoes, setReacoes] = useState<ReacaoNaTela[]>([])
  const proximoId = useRef(0)
  const aoAvisoAtual = useRef(aoAviso)
  aoAvisoAtual.current = aoAviso

  const mostrar = useCallback((mensagem: MensagemSala, nome: string, meu: boolean) => {
    const id = proximoId.current++
    if (mensagem.t === 'chat') {
      setMensagens((atuais) =>
        [...atuais, { id, nome, texto: mensagem.texto, meu }].slice(-MAXIMO_MENSAGENS),
      )
    } else if (mensagem.t === 'reacao') {
      setReacoes((atuais) =>
        [...atuais, { id, emoji: mensagem.emoji, nome }].slice(-MAXIMO_REACOES_NA_TELA),
      )
      setTimeout(
        () => setReacoes((atuais) => atuais.filter((reacao) => reacao.id !== id)),
        DURACAO_REACAO_MS,
      )
    }
  }, [])

  useEffect(() => {
    if (!room) return
    // Text streams dizem quem mandou mesmo quando o participante ainda não apareceu para nós.
    room.registerTextStreamHandler(TOPICO, async (leitor, { identity }) => {
      const mensagem = lerMensagem(await leitor.readAll())
      if (!mensagem) return
      const nome = await nomeDe(room, identity)
      if (mensagem.t === 'chat' || mensagem.t === 'reacao') mostrar(mensagem, nome, false)
      else aoAvisoAtual.current?.(mensagem, { identity, nome })
    })
    return () => room.unregisterTextStreamHandler(TOPICO)
  }, [room, mostrar])

  const enviar = useCallback(
    async (mensagem: MensagemSala, para?: string[]) => {
      if (!room) return
      await room.localParticipant.sendText(codificarMensagem(mensagem), {
        topic: TOPICO,
        ...(para && { destinationIdentities: para }),
      })
      mostrar(mensagem, room.localParticipant.name || 'Você', true)
    },
    [room, mostrar],
  )

  return {
    mensagens,
    reacoes,
    enviarChat: (texto: string) => {
      const limpo = texto.trim().slice(0, 500)
      return limpo ? enviar({ t: 'chat', texto: limpo }) : Promise.resolve()
    },
    reagir: (emoji: Reacao) =>
      enviar({ t: 'reacao', emoji }).catch(() => {
        // Uma reação perdida durante uma reconexão não vale um aviso na tela.
      }),
    avisar: (aviso: AvisoRevezamento, para: string) => enviar(aviso, [para]),
  }
}

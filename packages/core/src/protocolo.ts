import { z } from 'zod'

/** Tópico das mensagens do Telando no data channel do LiveKit. */
export const TOPICO = 'telando'

export const REACOES = ['👍', '❤️', '😂', '😮', '👏', '🔥'] as const
export type Reacao = (typeof REACOES)[number]

// Objetos do Zod descartam campos desconhecidos: um "de" forjado no corpo nunca chega à tela.
// Quem mandou vem sempre do participant.identity do LiveKit.
const mensagemSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('chat'), texto: z.string().trim().min(1).max(500) }),
  z.object({ t: z.literal('reacao'), emoji: z.enum(REACOES) }),
])

export type MensagemSala = z.infer<typeof mensagemSchema>

export function codificarMensagem(mensagem: MensagemSala): string {
  return JSON.stringify(mensagem)
}

export function lerMensagem(texto: string): MensagemSala | null {
  try {
    const resultado = mensagemSchema.safeParse(JSON.parse(texto))
    return resultado.success ? resultado.data : null
  } catch {
    // Qualquer participante pode mandar bytes quaisquer; o que não é JSON é ignorado.
    return null
  }
}
